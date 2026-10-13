import { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { ApiError, fail } from '../middleware/errors.js';
export type Tx = Prisma.TransactionClient;
export async function databaseNow(tx: Tx) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row!.now;
}
// Single screen / 80 seats: lock the entire show's inventory, in UUID order.
// This deliberately trades per-show throughput for a simple, uniform deadlock order.
export async function lockInventory(tx: Tx, showId: string) {
  await tx.$queryRaw`SELECT id FROM "ShowSeat" WHERE "showId" = ${showId}::uuid ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Show" WHERE id = ${showId}::uuid FOR UPDATE`;
  const show = await tx.show.findUnique({ where: { id: showId } });
  if (!show) return fail(404, 'NOT_FOUND', 'Show not found');
  const now = await databaseNow(tx);
  const expired = await tx.seatHold.findMany({ where: { showId, status: 'ACTIVE', expiresAt: { lte: now } }, select: { id: true } });
  if (expired.length) {
    const ids = expired.map(h => h.id);
    await tx.showSeat.updateMany({ where: { showId, currentHoldId: { in: ids }, status: 'HELD' }, data: { status: 'AVAILABLE', currentHoldId: null } });
    await tx.seatHold.updateMany({ where: { id: { in: ids }, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  }
  return { show, now };
}
export async function withInventory<T>(showId: string, fn: (tx: Tx, context: Awaited<ReturnType<typeof lockInventory>>) => Promise<T>) {
  const result = await db.$transaction(async tx => fn(tx, await lockInventory(tx, showId)), { timeout: 15000, maxWait: 15000 });
  if (result instanceof ApiError) throw result;
  return result as Exclude<T, ApiError>;
}
export async function seatMap(showId: string, userId?: string) {
  return withInventory(showId, async tx => {
    const seats = await tx.showSeat.findMany({ where: { showId }, orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }], include: { currentHold: { select: { userId: true } } } });
    return seats.map(s => ({ id: s.id, rowLabel: s.rowLabel, seatNumber: s.seatNumber, status: s.status === 'HELD' ? (s.currentHold?.userId === userId ? 'HELD_BY_ME' : 'HELD_BY_OTHER') : s.status }));
  });
}
export const bookingInclude = { show: { include: { movie: true } }, seats: { include: { showSeat: { select: { id: true, rowLabel: true, seatNumber: true } } } } } satisfies Prisma.BookingInclude;
export const holdInclude = { items: { include: { showSeat: { select: { id: true, rowLabel: true, seatNumber: true } } } } } satisfies Prisma.SeatHoldInclude;
export async function createHold(showId: string, userId: string, seatIds: string[]) {
  return withInventory(showId, async (tx, { show, now }) => {
    if (show.startsAt <= now) return new ApiError(409, 'SHOW_STARTED', 'This show has already started');
    const seats = await tx.showSeat.findMany({ where: { id: { in: seatIds }, showId } });
    if (seats.length !== seatIds.length) return new ApiError(400, 'INVALID_SEATS', 'Every seat must belong to the requested show');
    const holdIds = [...new Set(seats.map(s => s.currentHoldId).filter((id): id is string => !!id))];
    if (holdIds.length === 1 && seats.every(s => s.status === 'HELD' && s.currentHoldId === holdIds[0])) {
      const existing = await tx.seatHold.findUnique({ where: { id: holdIds[0]! }, include: holdInclude });
      if (existing?.userId === userId && existing.status === 'ACTIVE' && existing.expiresAt > now && existing.items.length === seatIds.length) return existing;
    }
    const conflicts = seats.filter(s => s.status !== 'AVAILABLE').map(s => s.id);
    if (conflicts.length) return new ApiError(409, 'SEAT_CONFLICT', 'One or more seats are unavailable', { seatIds: conflicts });
    const hold = await tx.seatHold.create({ data: { userId, showId, expiresAt: new Date(now.getTime() + 300000), items: { create: seatIds.map(showSeatId => ({ showSeatId })) } }, include: holdInclude });
    await tx.showSeat.updateMany({ where: { id: { in: seatIds }, showId }, data: { status: 'HELD', currentHoldId: hold.id } });
    return hold;
  });
}
export async function ownHold(id: string, userId: string, release = false) {
  const preliminary = await db.seatHold.findFirst({ where: { id, userId } });
  if (!preliminary) return fail(404, 'NOT_FOUND', 'Hold not found');
  return withInventory(preliminary.showId, async tx => {
    await tx.$queryRaw`SELECT id FROM "SeatHold" WHERE id = ${id}::uuid FOR UPDATE`;
    const hold = await tx.seatHold.findFirst({ where: { id, userId }, include: holdInclude });
    if (!hold) return fail(404, 'NOT_FOUND', 'Hold not found');
    if (release && hold.status === 'ACTIVE') {
      await tx.showSeat.updateMany({ where: { currentHoldId: id, status: 'HELD' }, data: { status: 'AVAILABLE', currentHoldId: null } });
      return tx.seatHold.update({ where: { id }, data: { status: 'RELEASED' }, include: holdInclude });
    }
    return hold;
  });
}
export async function pay(id: string, userId: string, outcome: 'SUCCESS' | 'FAILURE') {
  const preliminary = await db.seatHold.findFirst({ where: { id, userId } });
  if (!preliminary) return fail(404, 'NOT_FOUND', 'Hold not found');
  return withInventory(preliminary.showId, async (tx, { show }) => {
    await tx.$queryRaw`SELECT id FROM "SeatHold" WHERE id = ${id}::uuid FOR UPDATE`;
    const hold = await tx.seatHold.findFirst({ where: { id, userId }, include: { items: true } });
    if (!hold) return fail(404, 'NOT_FOUND', 'Hold not found');
    if (hold.status === 'CONFIRMED' && outcome === 'SUCCESS') return { outcome, booking: await tx.booking.findUniqueOrThrow({ where: { holdId: id }, include: bookingInclude }) };
    const now = await databaseNow(tx);
    if (hold.status !== 'ACTIVE' || hold.expiresAt <= now || show.startsAt <= now) {
      if (hold.status === 'ACTIVE' && hold.expiresAt <= now) {
        await tx.showSeat.updateMany({ where: { currentHoldId: id }, data: { status: 'AVAILABLE', currentHoldId: null } });
        await tx.seatHold.update({ where: { id }, data: { status: 'EXPIRED' } });
      }
      return new ApiError(409, 'HOLD_UNAVAILABLE', 'Hold expired, released, confirmed, or show already started');
    }
    const seats = await tx.showSeat.findMany({ where: { currentHoldId: id, status: 'HELD', showId: hold.showId } });
    if (seats.length !== hold.items.length || seats.length < 1 || seats.length > 6) return fail(409, 'SEAT_CONFLICT', 'Hold no longer owns its seats');
    await tx.paymentAttempt.create({ data: { holdId: id, userId, outcome } });
    if (outcome === 'FAILURE') return { outcome, booking: null, message: 'Simulated payment failed; your hold remains active' };
    const booking = await tx.booking.create({ data: { holdId: id, userId, showId: hold.showId, totalAmountPaise: seats.length * show.ticketPricePaise, seats: { create: seats.map(s => ({ showSeatId: s.id, seatPricePaise: show.ticketPricePaise })) } }, include: bookingInclude });
    await tx.showSeat.updateMany({ where: { currentHoldId: id }, data: { status: 'BOOKED', currentHoldId: null, currentBookingId: booking.id } });
    await tx.seatHold.update({ where: { id }, data: { status: 'CONFIRMED' } });
    return { outcome, booking };
  });
}
export async function cancel(id: string, userId: string) {
  const preliminary = await db.booking.findFirst({ where: { id, userId } });
  if (!preliminary) return fail(404, 'NOT_FOUND', 'Booking not found');
  return withInventory(preliminary.showId, async (tx, { show }) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id}::uuid FOR UPDATE`;
    const booking = await tx.booking.findFirst({ where: { id, userId }, include: bookingInclude });
    if (!booking) return fail(404, 'NOT_FOUND', 'Booking not found');
    if (booking.status === 'CANCELLED') return booking;
    const now = await databaseNow(tx);
    if (show.startsAt.getTime() - now.getTime() < 7200000) return new ApiError(409, 'CANCELLATION_CUTOFF', 'Cancellation requires at least two hours before the show');
    await tx.showSeat.updateMany({ where: { currentBookingId: id, status: 'BOOKED' }, data: { status: 'AVAILABLE', currentBookingId: null } });
    return tx.booking.update({ where: { id }, data: { status: 'CANCELLED' }, include: bookingInclude });
  });
}


