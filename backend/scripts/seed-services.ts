import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

function databaseUrl(name: string, envName: string) {
  const configured = process.env[envName];
  if (configured) return configured;
  if (!process.env.DATABASE_URL) throw new Error(`Set ${envName} or DATABASE_URL in .env`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return url.toString();
}
const identity = new PrismaClient({ datasources: { db: { url: databaseUrl('yozigo_identity', 'IDENTITY_DATABASE_URL') } } });
const cinema = new PrismaClient({ datasources: { db: { url: databaseUrl('yozigo_cinema', 'CINEMA_DATABASE_URL') } } });

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  for (const user of [
    { email: process.env.ADMIN_EMAIL ?? 'admin@yozigo.local', password: process.env.ADMIN_PASSWORD ?? 'LocalAdmin123!', name: 'Yozigo Admin', role: 'ADMIN' as const },
    { email: process.env.CUSTOMER_EMAIL ?? 'customer@yozigo.local', password: process.env.CUSTOMER_PASSWORD ?? 'LocalCustomer123!', name: 'Demo Customer', role: 'CUSTOMER' as const },
  ]) {
    if (user.password.length < 8) throw new Error('Seed passwords must have at least 8 characters');
    await identity.user.upsert({
      where: { email: user.email.trim().toLowerCase() }, update: {},
      create: { email: user.email.trim().toLowerCase(), name: user.name, role: user.role, passwordHash: await argon2.hash(user.password, { type: argon2.argon2id }) },
    });
  }
  const movie = await cinema.movie.upsert({
    where: { id: '10000000-0000-4000-8000-000000000001' }, update: {},
    create: { id: '10000000-0000-4000-8000-000000000001', title: 'Beyond the Horizon', language: 'Hindi', durationMinutes: 120, rating: 'UA', description: 'A fictional adventure seeded for the Yozigo demo.' },
  });
  if (!await cinema.show.count({ where: { movieId: movie.id, startsAt: { gt: new Date() } } })) {
    const startsAt = new Date(); startsAt.setUTCDate(startsAt.getUTCDate() + 2); startsAt.setUTCHours(12, 0, 0, 0);
    const durationMinutes = movie.durationMinutes;
    await cinema.show.create({ data: {
      movieId: movie.id, startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60000), durationMinutes, ticketPricePaise: 25000,
      seats: { create: [...'ABCDEFGH'].flatMap(rowLabel => Array.from({ length: 10 }, (_, index) => ({ rowLabel, seatNumber: index + 1 }))) },
    } });
  }

  const catalogue = [
    { id: '10000000-0000-4000-8000-000000000002', title: 'The Last Horizon', language: 'English', durationMinutes: 138, rating: 'UA' as const, description: 'A signal from beyond the mapped world sends a gifted pilot and her estranged father on one final journey across the stars.', posterUrl: 'https://images.unsplash.com/photo-1622914232194-7747242349ab?auto=format&fit=crop&w=1400&q=84' },
    { id: '10000000-0000-4000-8000-000000000003', title: 'A Quiet Distance', language: 'English', durationMinutes: 114, rating: 'U' as const, description: 'When two siblings return to their childhood home, a long-buried family secret changes how they remember everything.', posterUrl: 'https://images.unsplash.com/photo-1540744381243-9f7352eee2f1?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000004', title: 'Wild Meridian', language: 'Hindi', durationMinutes: 126, rating: 'UA' as const, description: 'A young cartographer follows a forgotten trail through the desert to find a village missing from every map.', posterUrl: 'https://images.unsplash.com/photo-1721786719473-cd15719e16dc?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000005', title: 'Above the Silence', language: 'English', durationMinutes: 108, rating: 'U' as const, description: 'A small research team records the changing soundscape of a mountain community over four seasons.', posterUrl: 'https://images.unsplash.com/photo-1558578194-d41aaa387624?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000006', title: 'Ember Valley', language: 'Tamil', durationMinutes: 132, rating: 'A' as const, description: 'After a power outage traps a town in darkness, a journalist uncovers the truth behind a decades-old fire.', posterUrl: 'https://images.unsplash.com/photo-1775240158468-06faa67b7286?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000007', title: 'Paper Moons', language: 'English', durationMinutes: 102, rating: 'U' as const, description: 'Two strangers leave anonymous notes in a second-hand bookshop and slowly find their way into each other’s lives.', posterUrl: null },
  ];

  for (const [index, item] of catalogue.entries()) {
    const seededMovie = await cinema.movie.upsert({ where: { id: item.id }, update: item, create: item });
    if (!await cinema.show.count({ where: { movieId: seededMovie.id, startsAt: { gt: new Date() } } })) {
      const startsAt = new Date();
      startsAt.setUTCDate(startsAt.getUTCDate() + 3 + Math.floor(index / 3));
      startsAt.setUTCHours(7 + (index % 3) * 6, 0, 0, 0);
      const durationMinutes = seededMovie.durationMinutes;
      await cinema.show.create({ data: {
        movieId: seededMovie.id, startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60000), durationMinutes, ticketPricePaise: (20000 + (index % 3) * 5000),
        seats: { create: [...'ABCDEFGH'].flatMap(rowLabel => Array.from({ length: 10 }, (_, seatNumber) => ({ rowLabel, seatNumber: seatNumber + 1 }))) },
      } });
    }
  }
  console.log('Identity and cinema demo records seeded');
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Service seed failed'); process.exitCode = 1; })
  .finally(async () => { await Promise.all([identity.$disconnect(), cinema.$disconnect()]); });
