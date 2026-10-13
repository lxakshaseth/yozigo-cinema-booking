import type { z } from 'zod';
import { db } from '../db.js';
import { fail, ApiError } from '../middleware/errors.js';
import { databaseNow, withInventory } from './inventory.js';
import type { Tx } from './inventory.js';
import { showSchema } from '../validation.js';
export async function createShow(input: z.infer<typeof showSchema>, client = db) {
  return client.$transaction(async tx => {
    const movie = await tx.movie.findUnique({ where: { id: input.movieId } });
    if (!movie) return fail(404, 'NOT_FOUND', 'Movie not found');
    const durationMinutes = input.durationMinutes ?? movie.durationMinutes;
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
    if (startsAt <= await databaseNow(tx)) return fail(400, 'INVALID_SCHEDULE', 'Show must start in the future');
    await checkOverlap(tx, startsAt, endsAt);
    return tx.show.create({ data: { movieId: movie.id, startsAt, endsAt, durationMinutes, ticketPricePaise: input.ticketPricePaise, seats: { create: [...'ABCDEFGH'].flatMap(rowLabel => Array.from({ length: 10 }, (_, n) => ({ rowLabel, seatNumber: n + 1 }))) } } });
  });
}
async function checkOverlap(tx: Tx, startsAt: Date, endsAt: Date, id?: string) {
  const existing = await tx.show.findFirst({ where: { ...(id ? { id: { not: id } } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
  if (existing) fail(409, 'SCHEDULE_CONFLICT', 'This show overlaps an existing show');
}
export async function editShow(id: string, input: Partial<z.infer<typeof showSchema>>) {
  return withInventory(id, async (tx, { show, now }) => {
    if (show.startsAt <= now) return new ApiError(409, 'SHOW_STARTED', 'Started shows cannot be edited');
    if (await tx.booking.count({ where: { showId: id } }) || await tx.seatHold.count({ where: { showId: id, status: 'ACTIVE' } })) return new ApiError(409, 'SHOW_IN_USE', 'Shows with active holds or booking history cannot be edited');
    const movieId = input.movieId ?? show.movieId;
    if (!await tx.movie.findUnique({ where: { id: movieId } })) return fail(404, 'NOT_FOUND', 'Movie not found');
    const startsAt = input.startsAt ? new Date(input.startsAt) : show.startsAt;
    const durationMinutes = input.durationMinutes ?? show.durationMinutes;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
    if (startsAt <= now) return new ApiError(400, 'INVALID_SCHEDULE', 'Show must start in the future');
    await checkOverlap(tx, startsAt, endsAt, id);
    return tx.show.update({ where: { id }, data: { movieId, startsAt, endsAt, durationMinutes, ticketPricePaise: input.ticketPricePaise ?? show.ticketPricePaise } });
  });
}
export async function deleteShow(id: string) {
  return withInventory(id, async tx => {
    // Preserve all hold/payment history as well as booking history.
    if (await tx.booking.count({ where: { showId: id } }) || await tx.seatHold.count({ where: { showId: id } })) return new ApiError(409, 'SHOW_IN_USE', 'Shows with hold or booking history cannot be deleted');
    await tx.showSeat.deleteMany({ where: { showId: id } });
    await tx.show.delete({ where: { id } });
    return { deleted: true };
  });
}
export async function showDetail(id: string) {
  return withInventory(id, async (tx, { show }) => ({ ...show, movie: await tx.movie.findUnique({ where: { id: show.movieId } }), remainingSeats: await tx.showSeat.count({ where: { showId: id, status: 'AVAILABLE' } }), totalSeats: 80 }));
}
