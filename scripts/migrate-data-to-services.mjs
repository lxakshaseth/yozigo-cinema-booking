import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must point to the existing monolith database');

function databaseUrl(name, envName) {
  if (process.env[envName]) return process.env[envName];
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

const source = new Client({ connectionString: process.env.DATABASE_URL });
const identity = new Client({ connectionString: databaseUrl('yozigo_identity', 'IDENTITY_DATABASE_URL') });
const cinema = new Client({ connectionString: databaseUrl('yozigo_cinema', 'CINEMA_DATABASE_URL') });
const userIds = new Map();

async function inTransaction(client, fn) {
  await client.query('BEGIN');
  try { const result = await fn(); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
}

async function copyRows(client, table, columns, rows, keyColumns, customConflict) {
  const batchSize = Math.max(1, Math.floor(60000 / columns.length));
  let copied = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const tuples = batch.map(row => `(${columns.map(column => {
      values.push(row[column]);
      return `$${values.length}`;
    }).join(', ')})`);
    const conflict = customConflict ?? `ON CONFLICT (${keyColumns.map(key => `"${key}"`).join(', ')}) DO UPDATE SET ${columns.filter(column => !keyColumns.includes(column)).map(column => `"${column}" = EXCLUDED."${column}"`).join(', ')}`;
    const result = await client.query(`INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES ${tuples.join(', ')} ${conflict}`, values);
    copied += result.rowCount ?? 0;
  }
  return copied;
}

async function migrateIdentity() {
  const users = (await source.query('SELECT "id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt" FROM "User" ORDER BY "createdAt", "id"')).rows;
  await inTransaction(identity, async () => {
    for (const user of users) {
      const existing = await identity.query('SELECT "id" FROM "User" WHERE "email" = $1', [user.email]);
      const targetId = existing.rows[0]?.id ?? user.id;
      await identity.query(`INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5::"Role", $6, $7)
        ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "email"=EXCLUDED."email", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"`,
      [targetId, user.name, user.email, user.passwordHash, user.role, user.createdAt, user.updatedAt]);
      userIds.set(user.id, targetId);
    }

    const sessionTable = await source.query("SELECT to_regclass('public.session') AS name");
    if (sessionTable.rows[0]?.name) {
      const sessions = (await source.query('SELECT sid, sess, expire FROM session WHERE expire > now()')).rows;
      for (const sessionRow of sessions) {
        const sess = typeof sessionRow.sess === 'string' ? JSON.parse(sessionRow.sess) : sessionRow.sess;
        if (sess?.userId && userIds.has(sess.userId)) sess.userId = userIds.get(sess.userId);
        await identity.query('INSERT INTO session (sid, sess, expire) VALUES ($1, $2, $3) ON CONFLICT (sid) DO UPDATE SET sess=EXCLUDED.sess, expire=EXCLUDED.expire', [sessionRow.sid, sess, sessionRow.expire]);
      }
    }
    console.log(`Identity records migrated: ${users.length} users`);
  });
}

async function migrateCinema() {
  const tableRows = async (table, orderBy = '"id"') => (await source.query(`SELECT * FROM "${table}" ORDER BY ${orderBy}`)).rows;
  const movies = await tableRows('Movie');
  const shows = await tableRows('Show');
  const holds = await tableRows('SeatHold');
  const seats = await tableRows('ShowSeat');
  const holdSeats = await tableRows('HoldSeat', '"holdId", "showSeatId"');
  const bookings = await tableRows('Booking');
  const bookingSeats = await tableRows('BookingSeat');
  const payments = await tableRows('PaymentAttempt');

  await inTransaction(cinema, async () => {
    await copyRows(cinema, 'Movie', ['id', 'title', 'posterUrl', 'language', 'durationMinutes', 'rating', 'description', 'createdAt', 'updatedAt'], movies, ['id']);
    await copyRows(cinema, 'Show', ['id', 'movieId', 'startsAt', 'endsAt', 'durationMinutes', 'ticketPricePaise', 'createdAt', 'updatedAt'], shows, ['id']);
    await copyRows(cinema, 'SeatHold', ['id', 'userId', 'showId', 'expiresAt', 'status', 'createdAt', 'updatedAt'], holds.map(row => ({ ...row, userId: userIds.get(row.userId) ?? row.userId })), ['id']);
    await copyRows(cinema, 'ShowSeat', ['id', 'showId', 'rowLabel', 'seatNumber', 'status', 'currentHoldId', 'currentBookingId', 'createdAt', 'updatedAt'], seats.map(row => ({ ...row, status: 'AVAILABLE', currentHoldId: null, currentBookingId: null })), ['id'], 'ON CONFLICT ("id") DO UPDATE SET "showId"=EXCLUDED."showId", "rowLabel"=EXCLUDED."rowLabel", "seatNumber"=EXCLUDED."seatNumber", "status"=\'AVAILABLE\', "currentHoldId"=NULL, "currentBookingId"=NULL, "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"');
    await copyRows(cinema, 'HoldSeat', ['holdId', 'showSeatId'], holdSeats, ['holdId', 'showSeatId'], 'ON CONFLICT ("holdId", "showSeatId") DO NOTHING');
    await copyRows(cinema, 'Booking', ['id', 'userId', 'showId', 'holdId', 'totalAmountPaise', 'status', 'createdAt', 'updatedAt'], bookings.map(row => ({ ...row, userId: userIds.get(row.userId) ?? row.userId })), ['id']);
    await copyRows(cinema, 'BookingSeat', ['id', 'bookingId', 'showSeatId', 'seatPricePaise', 'createdAt'], bookingSeats, ['id']);
    await copyRows(cinema, 'PaymentAttempt', ['id', 'holdId', 'userId', 'outcome', 'createdAt'], payments.map(row => ({ ...row, userId: userIds.get(row.userId) ?? row.userId })), ['id']);

    const seatStates = seats.map(row => ({ id: row.id, status: row.status, currentHoldId: row.currentHoldId, currentBookingId: row.currentBookingId }));
    if (seatStates.length) {
      const result = await cinema.query(`UPDATE "ShowSeat" AS target SET "status"=source.status::"SeatStatus", "currentHoldId"=source."currentHoldId"::uuid, "currentBookingId"=source."currentBookingId"::uuid
        FROM jsonb_to_recordset($1::jsonb) AS source(id text, status text, "currentHoldId" text, "currentBookingId" text)
        WHERE target.id=source.id::uuid`, [JSON.stringify(seatStates)]);
      if (result.rowCount !== seatStates.length) throw new Error(`Expected to restore ${seatStates.length} seat states, updated ${result.rowCount}`);
    }
    console.log(`Cinema records migrated: ${movies.length} movies, ${shows.length} shows, ${seats.length} seats, ${holds.length} holds, ${bookings.length} bookings`);
  });
}

try {
  await Promise.all([source.connect(), identity.connect(), cinema.connect()]);
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await migrateIdentity();
  await migrateCinema();
  await source.query('COMMIT');
} catch (error) {
  await source.query('ROLLBACK').catch(() => undefined);
  console.error(error instanceof Error ? error.message : 'Service data migration failed');
  process.exitCode = 1;
} finally {
  await Promise.all([source.end(), identity.end(), cinema.end()]);
}
