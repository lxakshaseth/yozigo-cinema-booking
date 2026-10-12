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
| Frontend/browser integration | Not executed; no frontend files supplied |

The first integration run found two 500-vs-409 error mapping defects for PostgreSQL exclusion and RESTRICT failures wrapped by Prisma as unknown request errors. Both were corrected. A subsequent 24-test suite passed; three additional security/rollback checks were then added and the final 27-test suite passed.

Concurrency tests used separate authenticated HTTP clients, a real PostgreSQL lock barrier, and PostgreSQL lock-wait observation. They verified one hold winner, a 409 loser, matching seat ownership, atomic multi-seat requests, and one logical booking for duplicate concurrent payment successes. The rollback test deliberately injected a database trigger error and observed a 500 while asserting no booking or payment attempt committed and the hold remained intact; its error-type log is expected.

Migration: `prisma/migrations/202610120001_initial/migration.sql`. It includes Prisma table/index/foreign-key DDL plus exclusion, CHECK and deferred inventory/hold-cardinality constraints, and the session table.

No failing tests remain. No Git commit was made because this workspace is not a Git repository. PostgreSQL's local development cluster is ignored in `.gitignore`; it is not a deployment artifact. Keep the generated SQL migration and package lock under source control when initializing the repository.

