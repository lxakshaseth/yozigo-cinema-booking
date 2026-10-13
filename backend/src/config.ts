import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32).default('local-yozigo-service-token-change-this-value'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  FRONTEND_ORIGINS: z.string().optional(),
});
const parsed = schema.parse(process.env);
const frontendOrigins = [...new Set((parsed.FRONTEND_ORIGINS ?? parsed.FRONTEND_ORIGIN).split(',').map(value => value.trim()).filter(Boolean))];
if (!frontendOrigins.length) throw new Error('FRONTEND_ORIGINS must contain at least one exact origin');
for (const value of frontendOrigins) {
  const allowed = new URL(value);
  if (allowed.origin !== value) throw new Error(`Frontend origin must be exact and have no trailing slash: ${value}`);
}
const origin = new URL(parsed.FRONTEND_ORIGIN);
export const config = { ...parsed, FRONTEND_ORIGINS: frontendOrigins };
export const corsOrigin = (requestOrigin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  callback(null, !requestOrigin || config.FRONTEND_ORIGINS.includes(requestOrigin));
};
if (config.NODE_ENV === 'production' && (origin.protocol !== 'https:' || frontendOrigins.some(value => new URL(value).protocol !== 'https:') || config.SESSION_SECRET.includes('local-development'))) throw new Error('Production requires HTTPS origins and a random SESSION_SECRET');
if (config.NODE_ENV === 'production' && config.INTERNAL_SERVICE_TOKEN.startsWith('local-')) throw new Error('Production requires a random INTERNAL_SERVICE_TOKEN');
