import { Router } from 'express';
import { db } from '../db.js';
import { admin } from '../middleware/auth.js';
import { idSchema, movieSchema, showSchema, pageSchema } from '../validation.js';
import { createShow, editShow, deleteShow, showDetail } from '../services/shows.js';
import { bookingInclude, withInventory } from '../services/inventory.js';
export const adminRouter = Router();
adminRouter.use(admin);
adminRouter.get('/movies', async (req, res) => { const { page, limit } = pageSchema.parse(req.query); res.json({ items: await db.movie.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { title: 'asc' } }), page, limit }); });
adminRouter.post('/movies', async (req, res) => res.status(201).json(await db.movie.create({ data: movieSchema.parse(req.body) })));
adminRouter.patch('/movies/:id', async (req, res) => res.json(await db.movie.update({ where: { id: idSchema.parse(req.params.id) }, data: movieSchema.partial().parse(req.body) })));
adminRouter.delete('/movies/:id', async (req, res) => { await db.movie.delete({ where: { id: idSchema.parse(req.params.id) } }); res.status(204).end(); });
adminRouter.get('/shows', async (req, res) => {
  const { page, limit } = pageSchema.parse(req.query);
  const shows = await db.show.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { startsAt: 'asc' } });
  res.json({ items: await Promise.all(shows.map(s => showDetail(s.id))), page, limit });
});
adminRouter.post('/shows', async (req, res) => res.status(201).json(await createShow(showSchema.parse(req.body))));
adminRouter.patch('/shows/:id', async (req, res) => res.json(await editShow(idSchema.parse(req.params.id), showSchema.partial().parse(req.body))));
adminRouter.delete('/shows/:id', async (req, res) => { await deleteShow(idSchema.parse(req.params.id)); res.status(204).end(); });
adminRouter.get('/shows/:id/summary', async (req, res) => res.json(await withInventory(idSchema.parse(req.params.id), async (tx, { show }) => {
  const bookedSeats = await tx.showSeat.count({ where: { showId: show.id, status: 'BOOKED' } });
  const totals = await tx.booking.aggregate({ where: { showId: show.id, status: 'CONFIRMED' }, _sum: { totalAmountPaise: true }, _count: true });
  return { showId: show.id, bookedSeats, totalSeats: 80, occupancyPercent: bookedSeats / 80 * 100, confirmedBookings: totals._count, revenuePaise: totals._sum.totalAmountPaise ?? 0 };
})));
adminRouter.get('/shows/:id/bookings', async (req, res) => {
  const showId = idSchema.parse(req.params.id); const { page, limit } = pageSchema.parse(req.query);
  await showDetail(showId);
  res.json({ items: await db.booking.findMany({ where: { showId }, include: { ...bookingInclude, user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), page, limit });
});
