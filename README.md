# Yozigo Cinema Booking

This repository contains the Yozigo movie-ticket booking project:

- `backend/` — PostgreSQL-backed API, identity and cinema services, tests, and the connected React app in `backend/web/`.
- `Frontend/` — the separate UI prototype.

## Run the full-stack app locally

Use the connected app under `backend/web/` for real API and database booking flows. In PowerShell, from the repository root:

```powershell
Set-Location backend
Copy-Item .env.example .env
npm ci
npm --prefix web ci
npm run db:generate
npm run db:migrate:services
npm run db:seed:services
npm run dev
```

Docker Desktop must be running for the Compose database. Full setup, environment configuration, architecture, API contracts, and verification details are in [`backend/README.md`](backend/README.md).

The local seed creates these development accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@yozigo.local` | `LocalAdmin123!` |
| Customer | `customer@yozigo.local` | `LocalCustomer123!` |

Do not use the demo accounts outside local development.
