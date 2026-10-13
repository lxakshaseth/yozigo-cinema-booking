import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { config } from './config.js';
export const db = new PrismaClient();
export const sessionPool = new pg.Pool({ connectionString: config.DATABASE_URL });
export async function closeDatabase() { await Promise.all([db.$disconnect(), sessionPool.end()]); }
