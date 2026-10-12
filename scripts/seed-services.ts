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
  console.log('Identity and cinema demo records seeded');
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Service seed failed'); process.exitCode = 1; })
  .finally(async () => { await Promise.all([identity.$disconnect(), cinema.$disconnect()]); });
