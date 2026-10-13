import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
function databaseUrl(name, envName) {
  const configured = process.env[envName];
  if (configured) return configured;
  if (!process.env.DATABASE_URL) throw new Error(`Set ${envName} or DATABASE_URL in .env`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

const services = [
  { name: 'identity', database: 'yozigo_identity', url: databaseUrl('yozigo_identity', 'IDENTITY_DATABASE_URL'), file: new URL('../prisma/services/identity.sql', import.meta.url) },
  { name: 'cinema', database: 'yozigo_cinema', url: databaseUrl('yozigo_cinema', 'CINEMA_DATABASE_URL'), file: new URL('../prisma/services/cinema.sql', import.meta.url) },
];

async function ensureDatabase(url, database) {
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  } finally { await client.end(); }
}

for (const service of services) {
  await ensureDatabase(service.url, service.database);
  const sql = await readFile(service.file, 'utf8');
  const client = new Client({ connectionString: service.url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`yozigo-${service.name}-initial-schema`]);
    await client.query('CREATE TABLE IF NOT EXISTS "_YozigoMigration" (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = await client.query('SELECT 1 FROM "_YozigoMigration" WHERE version = $1', ['20261013_initial']);
    if (applied.rowCount) {
      await client.query('COMMIT');
      console.log(`${service.name} schema is already current`);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO "_YozigoMigration" (version) VALUES ($1)', ['20261013_initial']);
    await client.query('COMMIT');
    console.log(`${service.name} schema installed`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { await client.end(); }
}
