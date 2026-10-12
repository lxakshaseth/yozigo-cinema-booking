import 'dotenv/config';
import argon2 from 'argon2';
import { db } from '../src/db.js';
import { createShow } from '../src/services/shows.js';
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production; provision an administrator separately');
  const users = [
    { email: process.env.ADMIN_EMAIL ?? 'admin@yozigo.local', password: process.env.ADMIN_PASSWORD ?? 'LocalAdmin123!', name: 'Yozigo Admin', role: 'ADMIN' as const },
    { email: process.env.CUSTOMER_EMAIL ?? 'customer@yozigo.local', password: process.env.CUSTOMER_PASSWORD ?? 'LocalCustomer123!', name: 'Demo Customer', role: 'CUSTOMER' as const },
  ];
  for (const u of users) {
    if (u.password.length < 8) throw new Error('Seed passwords must have at least 8 characters');
    await db.user.upsert({ where: { email: u.email.trim().toLowerCase() }, update: {}, create: { email: u.email.trim().toLowerCase(), name: u.name, role: u.role, passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }) } });
  }
  const movie = await db.movie.upsert({ where: { id: '10000000-0000-4000-8000-000000000001' }, update: {}, create: { id: '10000000-0000-4000-8000-000000000001', title: 'Beyond the Horizon', language: 'Hindi', durationMinutes: 120, rating: 'UA', description: 'A fictional adventure seeded for the Yozigo demo.' } });
  if (!await db.show.count({ where: { movieId: movie.id, startsAt: { gt: new Date() } } })) {
    const starts = new Date(); starts.setUTCDate(starts.getUTCDate() + 2); starts.setUTCHours(12, 0, 0, 0);
    await createShow({ movieId: movie.id, startsAt: starts.toISOString(), ticketPricePaise: 25000 });
  }
  console.log('Demo users, movie and 80-seat show seeded');
}
main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => db.$disconnect());
