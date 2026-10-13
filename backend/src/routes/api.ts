import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db.js';
import { customer } from '../middleware/auth.js';
import { fail } from '../middleware/errors.js';
import { idSchema, holdSchema, pageSchema } from '../validation.js';
import { bookingInclude, cancel, createHold, ownHold, pay, seatMap } from '../services/inventory.js';
import { showDetail } from '../services/shows.js';
export const apiRouter = Router();
apiRouter.get('/movies', async (req, res) => {
  const { page, limit, search, language, rating } = pageSchema.parse(req.query);
  const where: Prisma.MovieWhereInput = { ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}), language, rating };
  const [items, total] = await Promise.all([db.movie.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ title: 'asc' }, { id: 'asc' }] }), db.movie.count({ where })]);
  res.json({ items, total, page, limit });
});
apiRouter.get('/movies/:id', async (req, res) => {
  const movie = await db.movie.findUnique({ where: { id: idSchema.parse(req.params.id) } });
  if (!movie) return fail(404, 'NOT_FOUND', 'Movie not found'); res.json(movie);
});
apiRouter.get('/movies/:id/shows', async (req, res) => {
  const movieId = idSchema.parse(req.params.id);
  if (!await db.movie.findUnique({ where: { id: movieId } })) return fail(404, 'NOT_FOUND', 'Movie not found');
  const { page, limit } = pageSchema.parse(req.query);
  const shows = await db.show.findMany({ where: { movieId, startsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, skip: (page - 1) * limit, take: limit });
  res.json({ items: await Promise.all(shows.map(s => showDetail(s.id))), page, limit });
});
apiRouter.get('/shows/:id', async (req, res) => res.json(await showDetail(idSchema.parse(req.params.id))));
apiRouter.get('/shows/:id/seats', async (req, res) => res.json({ seats: await seatMap(idSchema.parse(req.params.id), req.user?.id) }));
apiRouter.post('/shows/:id/holds', customer, async (req, res) => res.status(201).json(await createHold(idSchema.parse(req.params.id), req.user!.id, holdSchema.parse(req.body).seatIds)));
apiRouter.get('/holds/:id', customer, async (req, res) => res.json(await ownHold(idSchema.parse(req.params.id), req.user!.id)));
apiRouter.delete('/holds/:id', customer, async (req, res) => res.json(await ownHold(idSchema.parse(req.params.id), req.user!.id, true)));
apiRouter.post('/holds/:id/payment', customer, async (req, res) => {
  const { outcome } = z.object({ outcome: z.enum(['SUCCESS','FAILURE']) }).strict().parse(req.body);
  res.json(await pay(idSchema.parse(req.params.id), req.user!.id, outcome));
});
apiRouter.get('/bookings/me', customer, async (req, res) => {
  const { page, limit } = pageSchema.parse(req.query);
  // Order before pagination: future first ascending, then past descending.
  const ids = await db.$queryRaw<{ id: string }[]>`SELECT b.id FROM "Booking" b JOIN "Show" s ON s.id=b."showId" WHERE b."userId"=${req.user!.id}::uuid ORDER BY (s."startsAt" >= clock_timestamp()) DESC, CASE WHEN s."startsAt" >= clock_timestamp() THEN s."startsAt" END ASC, CASE WHEN s."startsAt" < clock_timestamp() THEN s."startsAt" END DESC, b.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
  const rows = await db.booking.findMany({ where: { userId: req.user!.id, id: { in: ids.map(x => x.id) } }, include: bookingInclude });
  res.json({ items: ids.map(x => rows.find(b => b.id === x.id)), page, limit, total: await db.booking.count({ where: { userId: req.user!.id } }) });
});
apiRouter.get('/bookings/:id', customer, async (req, res) => {
  const booking = await db.booking.findFirst({ where: { id: idSchema.parse(req.params.id), userId: req.user!.id }, include: bookingInclude });
  if (!booking) return fail(404, 'NOT_FOUND', 'Booking not found'); res.json(booking);
});
apiRouter.post('/bookings/:id/cancel', customer, async (req, res) => res.json(await cancel(idSchema.parse(req.params.id), req.user!.id)));
