const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export type User = { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" };
export type Movie = { id: string; title: string; posterUrl: string | null; language: string; durationMinutes: number; rating: "U" | "UA" | "A"; description: string | null };
export type Show = { id: string; movieId: string; startsAt: string; endsAt: string; durationMinutes: number; ticketPricePaise: number; remainingSeats: number; totalSeats: number; movie?: Movie };
export type Seat = { id: string; rowLabel: string; seatNumber: number; status: "AVAILABLE" | "BOOKED" | "HELD_BY_ME" | "HELD_BY_OTHER" };
export type Hold = { id: string; showId: string; status: string; expiresAt: string; items: Array<{ showSeat: { id: string; rowLabel: string; seatNumber: number } }> };
export type Booking = { id: string; status: "CONFIRMED" | "CANCELLED"; totalAmountPaise: number; createdAt: string; show: Show & { movie: Movie }; seats: Array<{ showSeat: { rowLabel: string; seatNumber: number } }> };
export type Page<T> = { items: T[]; total?: number; page: number; limit: number };

let csrfToken = "";

export async function getCsrf() {
  const data = await request<{ csrfToken: string }>("/auth/csrf");
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error;
    throw Object.assign(new Error(error?.message || `Request failed (${response.status})`), { status: response.status, code: error?.code, details: error?.details });
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  setCsrf: (value: string) => { csrfToken = value; },
};

export const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
export const dateTime = (value: string, options: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...options }).format(new Date(value));
export const seatLabel = (seat: { rowLabel: string; seatNumber: number }) => `${seat.rowLabel}${seat.seatNumber}`;
export function messageOf(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
