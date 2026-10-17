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
    { id: '10000000-0000-4000-8000-000000000008', title: 'Neon Monsoon', language: 'Hindi', durationMinutes: 124, rating: 'UA' as const, description: 'During one electric Mumbai night, a radio host follows a caller’s trail through the city before the rain washes every clue away.', posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000009', title: 'Harbor of Glass', language: 'English', durationMinutes: 116, rating: 'U' as const, description: 'A young architect returns to a coastal town to rebuild its old lighthouse and discovers a family she never knew.', posterUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000010', title: 'The Mango Season', language: 'Hindi', durationMinutes: 128, rating: 'U' as const, description: 'Three generations gather for a summer harvest and find that home can change without disappearing.', posterUrl: 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000011', title: 'After the Last Train', language: 'Tamil', durationMinutes: 110, rating: 'UA' as const, description: 'Missed trains and missed chances bring two former classmates together across an overnight journey.', posterUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000012', title: 'Forest of Small Things', language: 'English', durationMinutes: 104, rating: 'U' as const, description: 'A curious schoolgirl documents the hidden lives of an ancient forest before a new road reaches its edge.', posterUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000013', title: 'Midnight in Kodaikanal', language: 'Tamil', durationMinutes: 136, rating: 'A' as const, description: 'A missing-person podcast leads a sound engineer into a hill-station mystery with no easy ending.', posterUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000014', title: 'Orbit of Us', language: 'English', durationMinutes: 118, rating: 'UA' as const, description: 'Two rival astronomers race to decode a distant signal while learning to trust each other.', posterUrl: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000015', title: 'Letters from Jaipur', language: 'Hindi', durationMinutes: 122, rating: 'U' as const, description: 'A forgotten bundle of letters sends a photographer across Jaipur to reunite two lifelong friends.', posterUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000016', title: 'Cobalt Sky', language: 'English', durationMinutes: 130, rating: 'UA' as const, description: 'An air-race crew faces its final flight above a storm system no one believes they can outrun.', posterUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000017', title: 'Three Stops Home', language: 'Hindi', durationMinutes: 98, rating: 'U' as const, description: 'One late-night bus ride gives three strangers the courage to make different choices by morning.', posterUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000018', title: 'The Lantern House', language: 'Tamil', durationMinutes: 112, rating: 'UA' as const, description: 'A family inherits a crumbling seaside house whose lantern still shines for ships that no longer pass.', posterUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000019', title: 'Raga for Rain', language: 'Hindi', durationMinutes: 126, rating: 'U' as const, description: 'A young singer and a retired maestro prepare for a monsoon concert that may save their fading music school.', posterUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000020', title: 'Satellite Hearts', language: 'English', durationMinutes: 108, rating: 'U' as const, description: 'Long-distance friends build a homemade satellite receiver and hear a message that changes their summer.', posterUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000021', title: 'Salt and Starlight', language: 'Tamil', durationMinutes: 134, rating: 'A' as const, description: 'A marine biologist returns to a fishing village where an old promise resurfaces with the tide.', posterUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000022', title: 'The Last Auto', language: 'Hindi', durationMinutes: 106, rating: 'UA' as const, description: 'On his final shift before retirement, an auto driver collects passengers whose stories echo his own.', posterUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000023', title: 'Monsoon Map', language: 'English', durationMinutes: 120, rating: 'UA' as const, description: 'An urban planner and a street artist redraw their flooded city one neighborhood at a time.', posterUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000024', title: 'A City of Kites', language: 'Hindi', durationMinutes: 115, rating: 'U' as const, description: 'A teenager enters Jaipur’s kite festival to honor her grandfather and finds an unexpected team.', posterUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82' },
    { id: '10000000-0000-4000-8000-000000000025', title: 'Parallel Lines', language: 'English', durationMinutes: 129, rating: 'UA' as const, description: 'A precision engineer and an expressive painter discover that their supposedly separate lives have always intersected.', posterUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=82' },
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
