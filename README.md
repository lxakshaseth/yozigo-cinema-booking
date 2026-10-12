# Yozigo Cinemas

Full-stack single-screen cinema booking application. `src/` is the Express and Prisma API; `web/` is the existing React, TypeScript and Vite customer/admin UI. During development Vite proxies `/api` to Express so cookie sessions and CSRF protection work on the same origin.

## Stack and architecture

Node.js 22.12+ (verified on 24.19), strict TypeScript, Express 5, PostgreSQL, Prisma **6.19.0**, Zod 4, Argon2id, PostgreSQL-backed cookie sessions, React 19, Vite 8, Vitest and Supertest. The API and frontend each have an npm lockfile. Prisma 6 deliberately uses `prisma-client-js` and `url = env("DATABASE_URL")` inside `schema.prisma`; do not copy Prisma 7 configuration into this project.

Official references used: [Prisma 6 data sources](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources), [Prisma 6 migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/).

```text
src/app.ts                 Express composition and security headers
src/server.ts              Listener, session cleanup and graceful shutdown
src/config.ts              Validated environment
src/db.ts                  Prisma client and PostgreSQL session pool
src/controllers/auth.ts    Authentication request handlers
src/routes/                Public, customer and admin HTTP endpoints
src/services/inventory.ts  Locks, expiry, holds, payment and cancellation
src/services/shows.ts      Scheduling, atomic inventory, show lifecycle
src/middleware/            Authentication, authorization, CSRF and errors
src/validation.ts          Strict request contracts
src/openapi.ts             OpenAPI 3.0 contract
prisma/schema.prisma       Relational models
prisma/migrations/         Generated DDL plus explicit PostgreSQL constraints
prisma/seed.ts             Separate demo account/movie/show seed
scripts/migrate-test.ts    Dedicated test database migration guard
tests/integration.test.ts Real HTTP + PostgreSQL integration tests
web/src/App.tsx            Customer booking and admin UI
web/src/api.ts             Typed cookie/CSRF-aware API client
web/src/connected.css      Responsive styles for connected screens
scripts/dev.mjs            Starts API and Vite together
FEATURE_API_CHECKLIST.md   Feature-to-endpoint integration checklist
```

## Start locally

Run the following in this repository root (PowerShell shown). Docker Desktop must be running for Compose.

```powershell
Copy-Item .env.example .env
npm ci
npm --prefix web ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Web: `http://localhost:5173`; API: `http://localhost:4000/api`; [Swagger UI](http://localhost:4000/api/docs); [OpenAPI JSON](http://localhost:4000/api/openapi.json); [health](http://localhost:4000/api/health). `npm run dev` starts both. To start one side, use `npm run dev:web` or `npm run dev:api`.

`npm run typecheck` and `npm run build` check both apps. The Vite API base defaults to `/api` and can be overridden with `VITE_API_BASE_URL` in `web/.env`.

Compose publishes PostgreSQL on **127.0.0.1:5434** and creates `yozigo` plus `yozigo_test` on its first initialization. If reusing an existing Compose volume without a test database:

```powershell
docker compose exec db createdb -U yozigo yozigo_test
```

Demo accounts (local development only):

| Role | Email | Password |
|---|---|---|
| Admin | admin@yozigo.local | LocalAdmin123! |
| Customer | customer@yozigo.local | LocalCustomer123! |

Seed is repeatable and does not reset existing passwords. It creates a fictional movie and a future show containing 80 seats. Demo seed refuses to run in production.

### Installed PostgreSQL alternative

Docker was unavailable during implementation, so verification used an isolated PostgreSQL 18.6 cluster in ignored `.local-postgres/`. These commands reproduce that setup when PostgreSQL tools are on PATH; do not run `initdb` again on an initialized cluster:

```powershell
initdb -D .local-postgres -U yozigo -A trust --encoding=UTF8 --locale=C
pg_ctl -D .local-postgres -l postgres.log -o '-h 127.0.0.1 -p 5434' start
createdb -h 127.0.0.1 -p 5434 -U yozigo yozigo
createdb -h 127.0.0.1 -p 5434 -U yozigo yozigo_test
npm run db:migrate
npm run db:seed
```

This alternative trusts local connections, binds only loopback, and is for development only. Stop it with `pg_ctl -D .local-postgres stop` before starting Compose on the same port. Never use this cluster or trust authentication in production.

## Environment

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL application/session database URL |
| `TEST_DATABASE_URL` | Separate disposable database; its name must end in `_test` |
| `SESSION_SECRET` | At least 32 characters; use a cryptographically random production secret |
| `FRONTEND_ORIGIN` | Exact frontend origin, default `http://localhost:5173`; no trailing slash |
| `PORT` | HTTP port, default 4000 |
| `NODE_ENV` | development, test or production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional local seed admin credentials |
| `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD` | Optional local seed customer credentials |

`.env` is ignored. Use a separate database role/secret and a secure deployment secret store in production. Production requires an HTTPS frontend origin and rejects the example session secret. Set TLS at a trusted reverse proxy; `trust proxy = 1` assumes exactly one proxy, with the API inaccessible directly. Cookies use HTTP-only, SameSite=Lax, 24-hour expiry and Secure in production. Keep frontend and API on the same site (for example subdomains of one domain); unrelated domains are incompatible with this Lax-cookie contract. CORS allows only the configured frontend origin. Every mutation requires a session-bound CSRF token; requests with a mismatched Origin are rejected even with a token. Auth endpoints are rate limited to 30 requests/15 minutes; all endpoints to 300/minute/IP. These limits are per process, suitable for the single-instance assignment deployment.

## Frontend connection

1. Fetch `GET /api/auth/csrf` using `credentials: 'include'`; save `csrfToken`.
2. Register and login with JSON, `credentials: 'include'`, and `X-CSRF-Token`. Registration creates a CUSTOMER and does not sign in automatically. The login response contains a **new** token; replace the old token.
3. Load movies, future shows and the chosen show's seats. Hold requests use inventory UUIDs from that seat map, not row labels or browser-generated IDs.
4. POST `{ "seatIds": ["uuid"] }` to `/api/shows/:id/holds`. Display the returned server expiry, refresh on conflict, and let server responses decide validity.
5. POST `{ "outcome": "SUCCESS" }` or `{ "outcome": "FAILURE" }` to `/api/holds/:id/payment`. This is simulation only: never collect card data.
6. Display the returned booking. Read `/api/bookings/me` for history; POST `/api/bookings/:id/cancel` for eligible cancellation.

```js
const base = 'http://localhost:4000/api';
let { csrfToken } = await fetch(`${base}/auth/csrf`, {
  credentials: 'include'
}).then(r => r.json());
const response = await fetch(`${base}/auth/login`, {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email: 'customer@yozigo.local', password: 'LocalCustomer123!' })
});
if (!response.ok) throw new Error('Login failed');
({ csrfToken } = await response.json());
```

Money is integer INR paise (25000 means INR 250). Timestamps are ISO strings with timezone information; group show dates in **Asia/Kolkata**. Seat responses contain `AVAILABLE`, `HELD_BY_ME`, `HELD_BY_OTHER`, or `BOOKED`, and never another holder's identity. Public shows list only future shows, ascending. Movie filters are `search`, `language`, `rating`; pagination is `page` (1-based) and `limit` (1–100). Booking lists place upcoming shows first, then past shows. `id` is the booking reference.

## Endpoint summary

| Access | Method and path |
|---|---|
| Public | GET `/api/health`, `/api/docs`, `/api/openapi.json` |
| Public | GET `/api/auth/csrf`; POST `/api/auth/register`, `/api/auth/login` |
| Signed in | GET `/api/auth/me`; POST `/api/auth/logout` |
| Public | GET `/api/movies`, `/api/movies/:id`, `/api/movies/:id/shows` |
| Public | GET `/api/shows/:id`, `/api/shows/:id/seats` |
| Customer | POST `/api/shows/:id/holds`; GET/DELETE `/api/holds/:id` |
| Customer | POST `/api/holds/:id/payment` |
| Customer | GET `/api/bookings/me`, `/api/bookings/:id`; POST `/api/bookings/:id/cancel` |
| Admin | GET/POST `/api/admin/movies`; PATCH/DELETE `/api/admin/movies/:id` |
| Admin | GET/POST `/api/admin/shows`; PATCH/DELETE `/api/admin/shows/:id` |
| Admin | GET `/api/admin/shows/:id/summary`, `/api/admin/shows/:id/bookings` |

Errors use `{ "error": { "code": "SEAT_CONFLICT", "message": "...", "details": { "seatIds": ["..."] } } }`. Details are optional. Validation returns 400, unauthenticated access 401, role/CSRF denial 403, missing or inaccessible holds/bookings 404, and lifecycle/scheduling/uniqueness conflicts 409. A simulated FAILURE returns 200 with `outcome: FAILURE` and no booking; an expired attempt returns 409. Exact-set hold retries return the original hold without extending expiry. Duplicate successful payments return the existing logical booking and do not add another payment attempt. After cancellation, that retry returns the original CANCELLED booking; a new purchase needs a new hold.

## Database and transaction design

- `User` has normalized unique email; password hashes never appear in responses. Users own holds, bookings and payment attempts. Registration cannot assign a role.
- `Movie` has many `Show` rows. Shows snapshot runtime and compute end time at creation. Editing movie runtime leaves existing shows unchanged.
- `Show` owns exactly 80 `ShowSeat` records: rows A–H, seat numbers 1–10, unique `(showId, rowLabel, seatNumber)`. A deferred constraint trigger checks 80 seats at transaction commit. Creation inserts show and inventory atomically.
- PostgreSQL GiST exclusion constraint `Show_no_overlap` uses `tstzrange(startsAt, endsAt, '[)')`. All shows share one screen. Exact back-to-back schedules are valid. Service validation gives early feedback and database enforcement closes the concurrent-create race. SQLSTATE 23P01 maps to 409, including Prisma's unknown-request error wrapper.
- `SeatHold` belongs to one user/show. `HoldSeat` retains membership after expiry or release; deferred triggers enforce 1–6 members and matching show IDs. `(holdId, showSeatId)` is its primary key.
- `ShowSeat` is authoritative for the current claim: AVAILABLE has no references; HELD has only `currentHoldId`; BOOKED has only `currentBookingId`. Database CHECK constraints enforce these combinations, valid positions, positive money, runtime and computed end time.
- `Booking.holdId` is unique. `BookingSeat` preserves individual seat-price snapshots. `(bookingId, showSeatId)` is unique, but **showSeatId alone is not unique**, allowing rebooking after cancellation without destroying history.
- `PaymentAttempt` records user, hold, SUCCESS/FAILURE and database timestamp. Payment attempts never store financial credentials.
- Relations use `ON DELETE RESTRICT`. A referenced movie cannot be deleted. Show deletion explicitly removes its empty inventory inside a transaction, but **any hold history or booking history blocks deletion**, including expired holds and cancelled bookings. This intentionally stricter policy preserves audit history. Updating a show is blocked after it starts or when active holds or any booking history exist.
- Indexes support movie title, movie/start lookup, hold expiry, current hold/booking lookup, ownership, booking date, show/status and payment history. `session` is maintained by connect-pg-simple with an expiry index; the server periodically removes expired session rows.

### Locking and hold lifecycle

All inventory reads/mutations start a transaction and lock **all 80 seats of that show in UUID order** using parameterized `SELECT ... FOR UPDATE`, then lock the Show row. This is a deliberate small-screen simplification: the requested rows are included, and there is no partial-inventory/parent-lock ordering deadlock during expiry. Existing-hold/payment/cancellation flows then lock and re-read the parent hold or booking. Preliminary reads only identify the show; the final decision is made after locks. No unsafe raw SQL or user-string SQL concatenation is used.

Under these locks, expired ACTIVE holds are marked EXPIRED and all their inventory claims cleared. Expiry uses PostgreSQL `clock_timestamp()`, not the client clock. Reads of inventory/show availability also clean expiry. There is no mandatory timer: stale stored claims are harmless until the next locked access, when they are removed. Expired holds and their membership remain in history.

A new hold validates every requested seat, then creates the hold/membership and assigns seats atomically for five minutes. Any unavailable seat returns structured conflict IDs with no partial reservation. Returning an expected domain error from the transaction allows expiry cleanup to commit; unexpected exceptions roll back the whole transaction.

Payment rechecks owner, status, database time, show start and seat ownership. Attempt, booking, price snapshots, inventory updates and hold confirmation commit together. FAILURE records only an attempt and retains the valid hold. Cancellation locks inventory then booking, checks ownership and the two-hour cutoff, marks CANCELLED and releases inventory in one transaction. Duplicate cancellation safely returns the cancelled record. At exactly two hours cancellation is permitted.

Reports count only current BOOKED seats and CONFIRMED booking totals. Holds, failed attempts and cancelled bookings are excluded from active revenue. Cancellation has no real refund processing because payment is simulated.

## Verification

Tests are **destructive only to the dedicated test database**. The configuration refuses a database whose name does not end in `_test`. Tables are truncated between fixtures; development data is untouched.

```powershell
npm run db:migrate:test
npm run typecheck
npm run build
npm test
```

Tests use the real Express app, independent cookie agents, real Argon2 hashing and real PostgreSQL transactions. Critical hold and duplicate-payment races use a database barrier: a separate connection holds an inventory lock until PostgreSQL reports both requests waiting. Assertions verify one winner/409 loser, matching ownership, no partial claims and no duplicate booking. No mocked Prisma methods or fixed race sleeps. A trigger-injected payment failure verifies transaction rollback. The expected 500 log in that test is deliberate.

Observed verification details are recorded in `VERIFICATION.md`.

## Deployment and remaining work

Run `npm ci`, `npm run db:generate`, `npm run build`, then `npm run db:migrate` before `npm start`. The migration contains PostgreSQL-specific rules: do not replace it with `prisma db push`, which would omit the custom SQL. Keep database connections private, use TLS where required, restrict database roles, configure HTTPS and backups, and provision a non-demo administrator with an Argon2id hash through a trusted administration process. The app does not log bodies, passwords, session IDs or secrets. Unexpected errors log the error type only.

Completed: schema/migration, sessions/auth, catalogue, seat holds/expiry, fake payments, idempotent confirmation, booking privacy/history/cancellation, admin CRUD/reporting, OpenAPI and real concurrency tests.

Limits: one screen; per-show operations serialize across 80 seats; in-memory per-process rate limits; no password reset/email verification; no real payments/refunds. Docker Compose uses PostgreSQL 17, while the original database verification used installed PostgreSQL 18.6; Compose startup itself was not tested because Docker Desktop was stopped. Verify the Compose path and production reverse proxy/cookie configuration in the target environment.

