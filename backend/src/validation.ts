import { z } from 'zod';
export const idSchema = z.uuid();
export const movieSchema = z.object({ title: z.string().trim().min(1).max(200), posterUrl: z.url().refine(v => ['https:', 'http:'].includes(new URL(v).protocol)).nullable().optional(), language: z.string().trim().min(1).max(50), durationMinutes: z.number().int().min(1).max(600), rating: z.enum(['U', 'UA', 'A']), description: z.string().max(5000).nullable().optional() }).strict();
export const showSchema = z.object({ movieId: idSchema, startsAt: z.iso.datetime({ offset: true }), durationMinutes: z.number().int().min(1).max(600).optional(), ticketPricePaise: z.number().int().min(1).max(10000000) }).strict();
export const holdSchema = z.object({ seatIds: z.array(idSchema).min(1).max(6).refine(ids => new Set(ids).size === ids.length, 'Seats must be distinct') }).strict();
export const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().max(200).optional(), language: z.string().max(50).optional(), rating: z.enum(['U','UA','A']).optional() });
