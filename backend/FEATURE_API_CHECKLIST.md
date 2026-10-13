# Yozigo feature-to-API checklist

| Feature | Frontend route / screen | API contract | State |
|---|---|---|---|
| Register and login | `/register`, `/login` | `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Connected |
| Logout and session restore | Header and app startup | `POST /auth/logout`, `GET /auth/me` | Connected |
| Movie search and filters | `/movies` | `GET /movies?search=&language=&rating=` | Connected |
| Movie details and future showtimes | `/movies/:movieId` | `GET /movies/:id`, `GET /movies/:id/shows` | Connected |
| Seat map and live availability | `/shows/:showId/seats` | `GET /shows/:id`, `GET /shows/:id/seats` | Connected; polls every 2.5 seconds while visible |
| Atomic five-minute hold | `/shows/:showId/seats` to `/holds/:holdId` | `POST /shows/:id/holds`, `GET /holds/:id` | Connected; expiry refreshed from server |
| Simulated payment | `/holds/:holdId/payment` | `POST /holds/:id/payment` | Connected; success is idempotent on the API, failure preserves the active hold |
| Confirmation | `/payment/success/:bookingId` | `GET /bookings/:id` | Connected |
| Customer booking history and cancellation | `/bookings` | `GET /bookings/me`, `POST /bookings/:id/cancel` | Connected |
| Admin catalogue management | `/admin/movies` | `/admin/movies` GET/POST/PATCH/DELETE | Connected |
| Admin show scheduling and reports | `/admin/shows`, `/admin/shows/:showId` | `/admin/shows`, `/admin/shows/:id/summary`, `/admin/shows/:id/bookings`, `GET /shows/:id/seats` | Connected |
| Admin booking list | `/admin/bookings` | Aggregates authorized per-show `GET /admin/shows/:id/bookings` | Connected |
| PostgreSQL double-booking protection | API integration suite | Transaction row locks, constraints, independent authenticated clients | API coverage exists; rerun blocked in this environment because PostgreSQL is unreachable to the test runner |
| Browser end-to-end verification | Full customer/admin browser flow | Uses the contracts above | Not run in this environment |
