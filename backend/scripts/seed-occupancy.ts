import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

function url(name: string, key: string) {
  if (process.env[key]) return process.env[key]!;
  const value = new URL(process.env.DATABASE_URL!);
  value.pathname = '/' + name;
  return value.toString();
}
const identity = new PrismaClient({ datasources: { db: { url: url('yozigo_identity', 'IDENTITY_DATABASE_URL') } } });
const cinema = new PrismaClient({ datasources: { db: { url: url('yozigo_cinema', 'CINEMA_DATABASE_URL') } } });

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo occupancy is disabled in production');
  const audience = await identity.user.upsert({
    where: { email: 'demo-audience@yozigo.local' }, update: {},
    create: { email: 'demo-audience@yozigo.local', name: 'Demo Audience', role: 'CUSTOMER', passwordHash: await argon2.hash(randomUUID()) },
  });
  const movies = await cinema.movie.findMany({ orderBy: { id: 'asc' } });
  for (const [index, movie] of movies.filter(movie => movie.id.startsWith('10000000-0000-4000-8000-')).entries()) {
    const shows = await cinema.show.findMany({ where: { movieId: movie.id, startsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } });
    for (const [showIndex, show] of shows.entries()) {
      await cinema.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "ShowSeat" WHERE "showId" = ${show.id}::uuid ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Show" WHERE id = ${show.id}::uuid FOR UPDATE`;
        if (await tx.booking.count({ where: { showId: show.id, userId: audience.id } })) return;
        const count = 8 + ((index * 2 + showIndex * 7) % 61);
        const seats = await tx.showSeat.findMany({ where: { showId: show.id, status: 'AVAILABLE' }, orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }], take: count });
        for (let offset = 0; offset < seats.length; offset += 6) {
          const group = seats.slice(offset, offset + 6);
          const hold = await tx.seatHold.create({ data: { showId: show.id, userId: audience.id, status: 'CONFIRMED', expiresAt: new Date(), items: { create: group.map(seat => ({ showSeatId: seat.id })) } } });
          const booking = await tx.booking.create({ data: { showId: show.id, userId: audience.id, holdId: hold.id, totalAmountPaise: group.length * show.ticketPricePaise, seats: { create: group.map(seat => ({ showSeatId: seat.id, seatPricePaise: show.ticketPricePaise })) } } });
          await tx.paymentAttempt.create({ data: { holdId: hold.id, userId: audience.id, outcome: 'SUCCESS' } });
          await tx.showSeat.updateMany({ where: { id: { in: group.map(seat => seat.id) } }, data: { status: 'BOOKED', currentBookingId: booking.id } });
        }
      });
    }
  }
  console.log('Demo bookings added; existing bookings and holds preserved.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await Promise.all([identity.$disconnect(), cinema.$disconnect()]); });
