const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export type ApiUser = { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" };
export type ApiMovie = { id: string; title: string; posterUrl: string | null; language: string; durationMinutes: number; rating: "U" | "UA" | "A"; description: string | null };
export type ApiShow = { id: string; movieId: string; startsAt: string; endsAt: string; durationMinutes: number; ticketPricePaise: number; remainingSeats: number; totalSeats: number; movie?: ApiMovie };
export type ApiSeat = { id: string; rowLabel: string; seatNumber: number; status: "AVAILABLE" | "BOOKED" | "HELD_BY_ME" | "HELD_BY_OTHER" };
export type ApiBooking = { id: string; status: "CONFIRMED" | "CANCELLED"; totalAmountPaise: number; createdAt: string; show: ApiShow & { movie: ApiMovie }; seats: Array<{ showSeat: { id?: string; rowLabel: string; seatNumber: number } }> };

let csrfToken = "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (!csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) && path !== "/auth/csrf") await getCsrf();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${apiBase}${path}`, { ...options, method, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error;
    throw Object.assign(new Error(error?.message || `Request failed (${response.status})`), { status: response.status, code: error?.code });
  }
  return data as T;
}

export async function getCsrf() {
  const data = await request<{ csrfToken: string }>("/auth/csrf");
  csrfToken = data.csrfToken;
  return csrfToken;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  setCsrf: (value: string) => { csrfToken = value; },
};

export const inr = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...options }).format(new Date(value));
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
