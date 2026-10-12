import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { db, sessionPool, closeDatabase } from '../src/db.js';
import { createShow } from '../src/services/shows.js';
const app = createApp();
const password = 'Customer123!';
const movieInput = { title: 'Fixture', language: 'Hindi', durationMinutes: 90, rating: 'UA' as const };
let a: Awaited<ReturnType<typeof login>>, b: Awaited<ReturnType<typeof login>>, admin: Awaited<ReturnType<typeof login>>;
async function login(email: string) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const result = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password });
  expect(result.status).toBe(200);
  return { agent, token: result.body.csrfToken as string, id: result.body.user.id as string };
}
function post(client: typeof a, url: string, body: object = {}) { return client.agent.post(url).set('X-CSRF-Token', client.token).send(body); }
function del(client: typeof a, url: string) { return client.agent.delete(url).set('X-CSRF-Token', client.token); }
function patch(client: typeof a, url: string, body: object) { return client.agent.patch(url).set('X-CSRF-Token', client.token).send(body); }
async function fixture(offsetHours = 48) {
  const movie = await db.movie.create({ data: movieInput });
  const show = await createShow({ movieId: movie.id, startsAt: new Date(Date.now() + offsetHours * 3600000).toISOString(), ticketPricePaise: 25000 });
  const seats = await db.showSeat.findMany({ where: { showId: show.id }, orderBy: [{rowLabel:'asc'},{seatNumber:'asc'}] });
  return { movie, show, seats, ids: seats.map(s => s.id) };
}
async function held(client: typeof a, showId: string, seatIds: string[]) {
  const result = await post(client, `/api/shows/${showId}/holds`, { seatIds }); expect(result.status).toBe(201); return result.body;
}
async function booked(client: typeof a, showId: string, seatIds: string[]) {
  const hold = await held(client, showId, seatIds); const result = await post(client, `/api/holds/${hold.id}/payment`, { outcome: 'SUCCESS' }); expect(result.status).toBe(200); return result.body.booking;
}
async function expire(id: string) { await db.seatHold.update({where:{id},data:{expiresAt:new Date(Date.now()-1000)}}); }
// Hold a real database lock until both independent HTTP requests are observed
// waiting in PostgreSQL. This is a barrier, not a timing-based race or a mock.
async function raceOnSeat(seatId: string, one: () => PromiseLike<request.Response>, two: () => PromiseLike<request.Response>) {
  const blocker = await sessionPool.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT id FROM "ShowSeat" WHERE id=$1::uuid FOR UPDATE', [seatId]);
  const pending = [Promise.resolve(one()), Promise.resolve(two())];
  try {
    const deadline = Date.now() + 10000;
    let count = 0;
    while (Date.now() < deadline) {
      const result = await sessionPool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%ShowSeat%'`);
      count = result.rows[0].n;
      if (count >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(count).toBeGreaterThanOrEqual(2);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  return Promise.all(pending);
}
beforeAll(async () => {
  await db.$executeRaw`TRUNCATE "PaymentAttempt", "BookingSeat", "HoldSeat", "ShowSeat", "Booking", "SeatHold", "Show", "Movie", "User", session CASCADE`;
  for (const [email, role] of [['a@test.local','CUSTOMER'],['b@test.local','CUSTOMER'],['admin@test.local','ADMIN']] as const) await db.user.create({data:{email,role,name:email,passwordHash:await argon2.hash(password,{type:argon2.argon2id})}});
  a = await login('a@test.local'); b = await login('b@test.local'); admin = await login('admin@test.local');
});
beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "PaymentAttempt", "BookingSeat", "HoldSeat", "ShowSeat", "Booking", "SeatHold", "Show", "Movie" CASCADE`;
});
afterAll(closeDatabase);
test('health checks PostgreSQL and OpenAPI is served', async () => { expect((await request(app).get('/api/health')).body.status).toBe('ok'); expect((await request(app).get('/api/openapi.json')).body.openapi).toBe('3.0.3'); });
test('register normalizes email, hashes password, rejects duplicate and role injection', async () => {
  const c = request.agent(app); const token = (await c.get('/api/auth/csrf')).body.csrfToken;
  const input = {name:'New Customer',email:'NEW@Test.local',password};
  const first = await c.post('/api/auth/register').set('X-CSRF-Token',token).send(input); expect(first.status).toBe(201); expect(first.body.role).toBe('CUSTOMER'); expect(first.body.passwordHash).toBeUndefined();
  const user = await db.user.findUniqueOrThrow({where:{email:'new@test.local'}}); expect(user.passwordHash).toMatch(/^\$argon2id\$/); expect(await argon2.verify(user.passwordHash,password)).toBe(true);
  expect((await c.post('/api/auth/register').set('X-CSRF-Token',token).send(input)).status).toBe(409);
  expect((await c.post('/api/auth/register').set('X-CSRF-Token',token).send({...input,email:'evil@test.local',role:'ADMIN'})).status).toBe(400);
});
test('wrong user and wrong password have identical generic responses', async () => {
  const c = request.agent(app); const token = (await c.get('/api/auth/csrf')).body.csrfToken;
  const first = await c.post('/api/auth/login').set('X-CSRF-Token',token).send({email:'missing@test.local',password});
  const second = await c.post('/api/auth/login').set('X-CSRF-Token',token).send({email:'a@test.local',password:'wrong-password'});
  expect(first.status).toBe(401); expect(second.status).toBe(401); expect(first.body).toEqual(second.body);
});
test('authorization, CSRF token and origin checks are enforced', async () => {
  expect((await request(app).get('/api/bookings/me')).status).toBe(401);
  expect((await a.agent.get('/api/admin/movies')).status).toBe(403);
  expect((await a.agent.post('/api/shows/'+randomUUID()+'/holds').send({seatIds:[randomUUID()]})).status).toBe(403);
  expect((await post(a,'/api/auth/logout').set('Origin','https://evil.example')).status).toBe(403);
});
test('login rotates session and token; logout destroys the session', async () => {
  const c = await login('a@test.local'); expect((await c.agent.get('/api/auth/me')).status).toBe(200);
  expect((await post(c,'/api/auth/logout')).status).toBe(204); expect((await c.agent.get('/api/auth/me')).status).toBe(401);
});
test('show creation has exactly 80 unique valid seats', async () => { const f=await fixture(); expect(f.seats).toHaveLength(80); expect(new Set(f.ids).size).toBe(80); expect(f.seats[0]!.rowLabel).toBe('A'); expect(f.seats[79]!.seatNumber).toBe(10); });
test('database rejects incomplete inventory and invalid seat states', async () => {
  const f=await fixture();
  await expect(db.showSeat.delete({where:{id:f.ids[0]}})).rejects.toThrow();
  await expect(db.showSeat.update({where:{id:f.ids[0]},data:{status:'HELD'}})).rejects.toThrow();
  await expect(db.showSeat.update({where:{id:f.ids[0]},data:{rowLabel:'Z'}})).rejects.toThrow();
  expect(await db.showSeat.count({where:{showId:f.show.id}})).toBe(80);
});
test('six seats allowed, seven/duplicate/invalid/cross-show seats rejected', async () => {
  const f=await fixture(), other=await fixture(72); await held(a,f.show.id,f.ids.slice(0,6));
  for (const seatIds of [f.ids.slice(6,13),[f.ids[7],f.ids[7]],['not-a-uuid'],[other.ids[0]],[randomUUID()]]) expect((await post(a,`/api/shows/${f.show.id}/holds`,{seatIds})).status).toBe(400);
});
test('seat map hides identity and distinguishes owner; exact-set retry reuses hold', async () => {
  const f=await fixture(); const hold=await held(a,f.show.id,f.ids.slice(0,2)); const retry=await held(a,f.show.id,f.ids.slice(0,2).reverse()); expect(retry.id).toBe(hold.id); expect(retry.expiresAt).toBe(hold.expiresAt);
  expect((await a.agent.get(`/api/shows/${f.show.id}/seats`)).body.seats[0].status).toBe('HELD_BY_ME');
  const map=(await b.agent.get(`/api/shows/${f.show.id}/seats`)).body; expect(map.seats[0].status).toBe('HELD_BY_OTHER'); expect(JSON.stringify(map)).not.toContain(a.id);
  expect((await b.agent.get(`/api/holds/${hold.id}`)).status).toBe(404);
});
test('multi-seat conflict rolls back whole reservation and exposes conflicting IDs', async () => {
  const f=await fixture(); await held(a,f.show.id,[f.ids[0]!]); const result=await post(b,`/api/shows/${f.show.id}/holds`,{seatIds:f.ids.slice(0,2)});
  expect(result.status).toBe(409); expect(result.body.error.details.seatIds).toEqual([f.ids[0]]); expect((await db.showSeat.findUniqueOrThrow({where:{id:f.ids[1]}})).status).toBe('AVAILABLE'); expect(await db.seatHold.count()).toBe(1);
});
test('expiry releases all claims and retains historical seat membership', async () => {
  const f=await fixture(); const h=await held(a,f.show.id,f.ids.slice(0,2)); await expire(h.id);
  const map=await b.agent.get(`/api/shows/${f.show.id}/seats`); expect(map.body.seats[0].status).toBe('AVAILABLE'); expect((await db.seatHold.findUniqueOrThrow({where:{id:h.id}})).status).toBe('EXPIRED'); expect(await db.holdSeat.count({where:{holdId:h.id}})).toBe(2); await held(b,f.show.id,[f.ids[0]!]);
});
test('concurrent customers: exactly one claim and one 409 after a database barrier', async () => {
  const f=await fixture(); const results=await raceOnSeat(f.ids[0]!,()=>post(a,`/api/shows/${f.show.id}/holds`,{seatIds:[f.ids[0]]}),()=>post(b,`/api/shows/${f.show.id}/holds`,{seatIds:[f.ids[0]]}));
  expect(results.map(r=>r.status).sort()).toEqual([201,409]); const winner=results[0]!.status===201 ? a : b;
  const seat=await db.showSeat.findUniqueOrThrow({where:{id:f.ids[0]},include:{currentHold:true}}); expect(seat.status).toBe('HELD'); expect(seat.currentHold!.userId).toBe(winner.id); expect(await db.seatHold.count({where:{status:'ACTIVE'}})).toBe(1); expect(await db.booking.count()).toBe(0); expect(await db.showSeat.count()).toBe(80);
});
test('concurrent overlapping multi-seat requests are atomic', async () => {
  const f=await fixture(); const results=await raceOnSeat(f.ids[0]!,()=>post(a,`/api/shows/${f.show.id}/holds`,{seatIds:f.ids.slice(0,2)}),()=>post(b,`/api/shows/${f.show.id}/holds`,{seatIds:f.ids.slice(1,3)}));
  expect(results.map(r=>r.status).sort()).toEqual([201,409]); expect(await db.showSeat.count({where:{status:'HELD'}})).toBe(2); expect(await db.seatHold.count()).toBe(1);
});
test('failure records attempt and keeps hold; later success snapshots prices and books', async () => {
  const f=await fixture(); const h=await held(a,f.show.id,f.ids.slice(0,2)); const failed=await post(a,`/api/holds/${h.id}/payment`,{outcome:'FAILURE'}); expect(failed.status).toBe(200); expect(failed.body.booking).toBeNull(); expect(await db.booking.count()).toBe(0); expect(await db.showSeat.count({where:{status:'HELD'}})).toBe(2);
  const success=await post(a,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'}); expect(success.status).toBe(200); expect(success.body.booking.totalAmountPaise).toBe(50000); expect(success.body.booking.seats[0].seatPricePaise).toBe(25000); expect(await db.paymentAttempt.count()).toBe(2); expect(await db.showSeat.count({where:{status:'BOOKED'}})).toBe(2);
});
test('concurrent payment successes return exactly one logical booking', async () => {
  const f=await fixture(); const h=await held(a,f.show.id,[f.ids[0]!]); const results=await raceOnSeat(f.ids[0]!,()=>post(a,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'}),()=>post(a,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'}));
  expect(results.map(r=>r.status)).toEqual([200,200]); expect(results[0]!.body.booking.id).toBe(results[1]!.body.booking.id); expect(await db.booking.count()).toBe(1); expect(await db.paymentAttempt.count()).toBe(1);
});
test('expired hold cannot be paid; foreign payment and invalid outcome rejected', async () => {
  const f=await fixture(); const h=await held(a,f.show.id,[f.ids[0]!]); expect((await post(b,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'})).status).toBe(404); expect((await post(a,`/api/holds/${h.id}/payment`,{outcome:'FREE'})).status).toBe(400); await expire(h.id); expect((await post(a,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'})).status).toBe(409); expect(await db.paymentAttempt.count()).toBe(0); expect((await db.seatHold.findUniqueOrThrow({where:{id:h.id}})).status).toBe('EXPIRED');
});
test('booking privacy, history, eligible cancellation and rebooking preserve records', async () => {
  const f=await fixture(); const booking=await booked(a,f.show.id,[f.ids[0]!]); expect((await b.agent.get(`/api/bookings/${booking.id}`)).status).toBe(404); expect((await post(b,`/api/bookings/${booking.id}/cancel`)).status).toBe(404); expect((await a.agent.get('/api/bookings/me')).body.items).toHaveLength(1);
  const cancels=await Promise.all([post(a,`/api/bookings/${booking.id}/cancel`),post(a,`/api/bookings/${booking.id}/cancel`)]); expect(cancels.map(r=>r.status)).toEqual([200,200]);
  await booked(b,f.show.id,[f.ids[0]!]); expect(await db.bookingSeat.count({where:{showSeatId:f.ids[0]}})).toBe(2); expect(await db.booking.count()).toBe(2);
});
test('cancellation cutoff and past show are rejected; started show hidden', async () => {
  const f=await fixture(1); const booking=await booked(a,f.show.id,[f.ids[0]!]); expect((await post(a,`/api/bookings/${booking.id}/cancel`)).status).toBe(409);
  const startsAt=new Date(Date.now()-7200000); await db.show.update({where:{id:f.show.id},data:{startsAt,endsAt:new Date(startsAt.getTime()+90*60000)}});
  expect((await post(a,`/api/bookings/${booking.id}/cancel`)).status).toBe(409); expect((await a.agent.get(`/api/movies/${f.movie.id}/shows`)).body.items).toHaveLength(0); expect((await post(a,`/api/shows/${f.show.id}/holds`,{seatIds:[f.ids[1]]})).status).toBe(409);
});
test('release is private and idempotent', async () => { const f=await fixture(); const h=await held(a,f.show.id,[f.ids[0]!]); expect((await del(b,`/api/holds/${h.id}`)).status).toBe(404); expect((await del(a,`/api/holds/${h.id}`)).body.status).toBe('RELEASED'); expect((await del(a,`/api/holds/${h.id}`)).body.status).toBe('RELEASED'); expect(await db.showSeat.count({where:{status:'AVAILABLE'}})).toBe(80); });
test('admin movie and show CRUD, runtime snapshot and dependent deletes', async () => {
  const m=await post(admin,'/api/admin/movies',movieInput); expect(m.status).toBe(201);
  const start=new Date(Date.now()+48*3600000).toISOString(); const s=await post(admin,'/api/admin/shows',{movieId:m.body.id,startsAt:start,ticketPricePaise:25000}); expect(s.status).toBe(201);
  expect((await patch(admin,`/api/admin/movies/${m.body.id}`,{durationMinutes:120})).status).toBe(200); expect((await db.show.findUniqueOrThrow({where:{id:s.body.id}})).durationMinutes).toBe(90);
  expect((await del(admin,`/api/admin/movies/${m.body.id}`)).status).toBe(409); expect((await patch(admin,`/api/admin/shows/${s.body.id}`,{ticketPricePaise:30000})).status).toBe(200);
  expect((await del(admin,`/api/admin/shows/${s.body.id}`)).status).toBe(204); expect((await del(admin,`/api/admin/movies/${m.body.id}`)).status).toBe(204);
});
test('overlap rejected, back-to-back allowed, invalid schedule rejected', async () => {
  const f=await fixture(); const body={movieId:f.movie.id,startsAt:f.show.startsAt.toISOString(),ticketPricePaise:25000}; expect((await post(admin,'/api/admin/shows',body)).status).toBe(409); expect((await post(admin,'/api/admin/shows',{...body,startsAt:f.show.endsAt.toISOString()})).status).toBe(201); expect((await post(admin,'/api/admin/shows',{...body,ticketPricePaise:-1})).status).toBe(400);
});
test('concurrent show creation cannot bypass exclusion constraint', async () => {
  const m=await db.movie.create({data:movieInput}); const body={movieId:m.id,startsAt:new Date(Date.now()+48*3600000).toISOString(),ticketPricePaise:25000};
  const results=await Promise.all([post(admin,'/api/admin/shows',body),post(admin,'/api/admin/shows',body)]); expect(results.map(r=>r.status).sort()).toEqual([201,409]); expect(await db.show.count()).toBe(1); expect(await db.showSeat.count()).toBe(80);
});
test('database overlap rule independently rejects overlapping raw writes', async () => {
  const f=await fixture(); await expect(db.$executeRaw`INSERT INTO "Show" (id,"movieId","startsAt","endsAt","durationMinutes","ticketPricePaise","updatedAt") VALUES (${randomUUID()}::uuid,${f.movie.id}::uuid,${f.show.startsAt},${f.show.endsAt},90,25000,now())`).rejects.toThrow();
});
test('booking history and holds block unsafe show changes and deletion; reports exclude cancellation', async () => {
  const f=await fixture(); const booking=await booked(a,f.show.id,f.ids.slice(0,2)); await held(b,f.show.id,[f.ids[2]!]);
  const summary=await admin.agent.get(`/api/admin/shows/${f.show.id}/summary`); expect(summary.body.bookedSeats).toBe(2); expect(summary.body.occupancyPercent).toBe(2.5); expect(summary.body.revenuePaise).toBe(50000);
  expect((await admin.agent.get(`/api/admin/shows/${f.show.id}/bookings`)).body.items[0].user.name).toBe('a@test.local'); expect((await patch(admin,`/api/admin/shows/${f.show.id}`,{ticketPricePaise:50000})).status).toBe(409);
  await post(a,`/api/bookings/${booking.id}/cancel`); expect((await del(admin,`/api/admin/shows/${f.show.id}`)).status).toBe(409); expect((await admin.agent.get(`/api/admin/shows/${f.show.id}/summary`)).body.revenuePaise).toBe(0);
});

test('session cookie is HTTP-only and SameSite=Lax; protected admin mutations reject customer', async () => {
  const c=request.agent(app); const result=await c.get('/api/auth/csrf'); const cookies=result.headers['set-cookie'] as unknown as string[]; expect(cookies[0]).toContain('HttpOnly'); expect(cookies[0]).toContain('SameSite=Lax'); expect((await post(a,'/api/admin/movies',movieInput)).status).toBe(403);
});
test('active hold prevents show deletion; public pagination and filters work', async () => {
  const f=await fixture(); await held(a,f.show.id,[f.ids[0]!]); expect((await del(admin,`/api/admin/shows/${f.show.id}`)).status).toBe(409);
  const result=await request(app).get('/api/movies?search=Fixture&language=Hindi&rating=UA&limit=1'); expect(result.body.items).toHaveLength(1); expect(result.body.total).toBe(1); expect((await request(app).get(`/api/shows/${f.show.id}`)).body.remainingSeats).toBe(79);
});
test('payment insertion failure rolls back attempt, booking, lifecycle and seats together', async () => {
  const f=await fixture(); const h=await held(a,f.show.id,[f.ids[0]!]);
  await db.$executeRaw`CREATE FUNCTION test_reject_booking() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected test failure''; END'`;
  await db.$executeRaw`CREATE TRIGGER test_reject_booking BEFORE INSERT ON "BookingSeat" FOR EACH ROW EXECUTE FUNCTION test_reject_booking()`;
  try {
    expect((await post(a,`/api/holds/${h.id}/payment`,{outcome:'SUCCESS'})).status).toBe(500);
    expect(await db.booking.count()).toBe(0); expect(await db.paymentAttempt.count()).toBe(0); expect((await db.seatHold.findUniqueOrThrow({where:{id:h.id}})).status).toBe('ACTIVE'); expect((await db.showSeat.findUniqueOrThrow({where:{id:f.ids[0]}})).status).toBe('HELD');
  } finally { await db.$executeRaw`DROP TRIGGER test_reject_booking ON "BookingSeat"`; await db.$executeRaw`DROP FUNCTION test_reject_booking()`; }
});
