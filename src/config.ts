import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32).default('local-yozigo-service-token-change-this-value'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
});
export const config = schema.parse(process.env);
const origin = new URL(config.FRONTEND_ORIGIN);
if (origin.origin !== config.FRONTEND_ORIGIN) throw new Error('FRONTEND_ORIGIN must be an exact origin without a trailing slash');
if (config.NODE_ENV === 'production' && (origin.protocol !== 'https:' || config.SESSION_SECRET.includes('local-development'))) throw new Error('Production requires HTTPS and a random SESSION_SECRET');
if (config.NODE_ENV === 'production' && config.INTERNAL_SERVICE_TOKEN.startsWith('local-')) throw new Error('Production requires a random INTERNAL_SERVICE_TOKEN');
