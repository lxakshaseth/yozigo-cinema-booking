# Verification report

Executed 13 October 2026 (Asia/Kolkata) on Windows, Node.js 24.19.0, PostgreSQL 18.6, Prisma 6.19.0.

| Check | Actual result |
|---|---|
| Dependency installation | Completed; lockfile created |
| Prisma client generation | Passed |
| Initial migration on `yozigo` | Applied |
| Initial migration on `yozigo_test` | Applied |
| `npm run db:migrate:test` | Passed; no pending migrations |
| `npm run db:seed` | Passed; local admin, customer, fictional movie and future 80-seat show created |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `node scripts/smoke.mjs` | Compiled server started and health returned `status: ok`; smoke server stopped afterward |
| Final `npm test` | **27 passed, 0 failed**, one test file, 12.11 seconds total |
| `docker compose config --quiet` | Passed |
| Docker Compose startup | Not executed; Docker Desktop daemon unavailable |
| Frontend/browser integration before service split | Passed live flow through the original Express API |

## Microservice conversion (13 October 2026)

The API now runs as an API gateway, Identity service and Cinema service. Identity owns users and session storage in `yozigo_identity`; Cinema owns movies, shows, seat inventory, holds, payments and bookings in `yozigo_cinema`. The gateway keeps the browser `/api` contract and forwards signed-in identity context with a shared internal token. The independent schemas, migration/seed scripts, local multi-process runner and Docker Compose stack were added. Seat holds and booking/payment transactions remain within Cinema so the existing database locking guarantees stay atomic.

Service implementation checks: `npm run typecheck`, `npm run build`, `docker compose config --quiet`, service schema migration, and service demo seed all passed. The Compose file was parsed but could not be started because the Docker daemon was unavailable.

The optional legacy-data transfer script also passes Node's syntax check. It was not run because this cutover path should only be run deliberately against a backed-up source database with writes stopped.

A live browser journey through the new gateway and services signed in with the seeded demo customer, selected the seeded movie and show, selected seat A1, created a five-minute hold, completed the simulated payment success, and displayed the booking in history. The booking was then cancelled and the UI confirmed the seat was released. This run used `YOZIGO_WEB_PORT=5174`, `YOZIGO_API_PORT=4200`, `YOZIGO_IDENTITY_PORT=4201`, and `YOZIGO_CINEMA_PORT=4202`.


The first integration run found two 500-vs-409 error mapping defects for PostgreSQL exclusion and RESTRICT failures wrapped by Prisma as unknown request errors. Both were corrected. A subsequent 24-test suite passed; three additional security/rollback checks were then added and the final 27-test suite passed.

Concurrency tests used separate authenticated HTTP clients, a real PostgreSQL lock barrier, and PostgreSQL lock-wait observation. They verified one hold winner, a 409 loser, matching seat ownership, atomic multi-seat requests, and one logical booking for duplicate concurrent payment successes. The rollback test deliberately injected a database trigger error and observed a 500 while asserting no booking or payment attempt committed and the hold remained intact; its error-type log is expected.

Migration: `prisma/migrations/202610120001_initial/migration.sql`. It includes Prisma table/index/foreign-key DDL plus exclusion, CHECK and deferred inventory/hold-cardinality constraints, and the session table.

No failing tests remain. The source repository is the `backend` directory; the generated SQL migration and package lock are tracked, while PostgreSQL's local development cluster is ignored in `.gitignore`.

