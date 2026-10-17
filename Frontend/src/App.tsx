import { useEffect, useState, type ReactNode } from "react";
import { api, dateLabel, errorMessage, getCsrf, inr, type ApiBooking, type ApiMovie, type ApiSeat, type ApiShow, type ApiUser } from "./api";

type DemoSession = Pick<ApiUser, "id" | "name" | "email" | "role">;
let signedInUser: DemoSession | null = null;
function setSession(user: DemoSession | null) { signedInUser = user; }
const authChanged = () => window.dispatchEvent(new Event("yozigo-auth-change"));

type MovieView = ApiMovie & { runtime: string; genre: string; image: string; synopsis: string; cast: string; director: string };
type ShowSelection = { id: string; movieTitle: string; date: string; time: string; startsAt: string; price: number; seats: number; totalSeats: number };
const movieArt: Record<string, string> = {
  "Beyond the Horizon": "https://images.unsplash.com/photo-1622914232194-7747242349ab?auto=format&fit=crop&w=1400&q=84",
};
function movieView(movie: ApiMovie): MovieView {
  const hours = Math.floor(movie.durationMinutes / 60);
  const minutes = movie.durationMinutes % 60;
  return { ...movie, runtime: `${hours}h ${String(minutes).padStart(2, "0")}m`, genre: "Now showing", image: movie.posterUrl || movieArt[movie.title] || "", synopsis: movie.description || "Movie details will be updated by the cinema team.", cast: "", director: "" };
}

type IconName =
  | "arrow-left"
  | "bell"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "dashboard"
  | "eye"
  | "eye-off"
  | "film"
  | "image"
  | "menu"
  | "more"
  | "search"
  | "seat"
  | "settings"
  | "star"
  | "ticket"
  | "users"
  | "x";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    "arrow-left": <path d="m15 18-6-6 6-6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "eye-off": (
      <>
        <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a16 16 0 0 1-2 3M6.6 6.6C3.6 8.5 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 3-.4" />
      </>
    ),
    film: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    seat: (
      <>
        <path d="M6 11V7a3 3 0 0 1 6 0v4M12 11V7a3 3 0 0 1 6 0v4" />
        <path d="M4 11a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2M5 19v2M19 19v2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    star: <path d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1Z" />,
    ticket: (
      <>
        <path d="M3 8a2 2 0 0 0 0 4v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0 0-4V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2M13 11v2M13 17v2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span />
        <span />
      </div>
      {!compact && (
        <div className="brand-name">
          <strong>Yozigo</strong>
          <small>CINEMAS</small>
        </div>
      )}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

function Button({
  children,
  variant = "primary",
  disabled,
  loading,
  icon,
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      type="button"
    >
      {loading ? <span className="spinner" /> : icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "violet" | "green" | "amber" | "red" | "gray" | "blue";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <select value={value} onChange={() => undefined}>
          <option>{value}</option>
        </select>
        <Icon name="chevron-down" size={16} />
      </span>
    </label>
  );
}

function TablePreview() {
  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div className="search-control compact"><Icon name="search" size={16} /><span>Search bookings</span></div>
        <div className="filter-group">
          <Button variant="outline" icon="calendar">May 24, 2025</Button>
          <SelectField label="" value="All statuses" />
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Booking</th><th>Customer</th><th>Showtime</th><th>Seats</th><th>Status</th><th>Total</th><th /></tr></thead>
          <tbody>
            <tr><td><strong>#YZ-2048</strong></td><td><span className="table-person"><i>AK</i><span>Alex Kim<small>alex@example.com</small></span></span></td><td>May 24 · 6:30 PM</td><td>B2, B3</td><td><Badge tone="green">Booked</Badge></td><td><strong>{formatINR(500)}</strong></td><td><Icon name="more" /></td></tr>
            <tr><td><strong>#YZ-2047</strong></td><td><span className="table-person"><i>MS</i><span>Maya Singh<small>maya@example.com</small></span></span></td><td>May 24 · 6:30 PM</td><td>C5</td><td><Badge tone="amber">Held</Badge></td><td><strong>{formatINR(250)}</strong></td><td><Icon name="more" /></td></tr>
            <tr><td><strong>#YZ-2046</strong></td><td><span className="table-person"><i>JL</i><span>Jordan Lee<small>jordan@example.com</small></span></span></td><td>May 23 · 9:15 PM</td><td>A4, A5</td><td><Badge tone="gray">Completed</Badge></td><td><strong>{formatINR(500)}</strong></td><td><Icon name="more" /></td></tr>
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>Showing 1–3 of 48 bookings</span>
        <div>
          <button type="button" aria-label="Previous page"><Icon name="chevron-left" size={16} /></button>
          <button className="page-active" type="button">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <button type="button" aria-label="Next page"><Icon name="chevron-right" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

type CustomerPage =
  | "signup"
  | "login"
  | "home"
  | "details"
  | "seats"
  | "checkout"
  | "payment"
  | "success"
  | "failure"
  | "expired"
  | "bookings"
  | "admin-dashboard"
  | "admin-movies"
  | "admin-shows"
  | "admin-bookings"
  | "admin-seats"
  | "admin-show-detail"
  | "handoff"
  | "unauthorized";
type ListingState = "ready" | "loading" | "error";

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const movieImages = {
  horizon: "https://images.unsplash.com/photo-1622914232194-7747242349ab?auto=format&fit=crop&w=1400&q=84",
  silence: "https://images.unsplash.com/photo-1540744381243-9f7352eee2f1?auto=format&fit=crop&w=900&q=82",
  wild: "https://images.unsplash.com/photo-1721786719473-cd15719e16dc?auto=format&fit=crop&w=900&q=82",
  summit: "https://images.unsplash.com/photo-1558578194-d41aaa387624?auto=format&fit=crop&w=900&q=82",
  ember: "https://images.unsplash.com/photo-1775240158468-06faa67b7286?auto=format&fit=crop&w=900&q=82",
};

function CustomerHeader({ page, navigate }: { page: CustomerPage; navigate: (page: CustomerPage) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<DemoSession | null>(signedInUser);
  useEffect(() => {
    const update = () => setUser(signedInUser);
    window.addEventListener("yozigo-auth-change", update);
    return () => window.removeEventListener("yozigo-auth-change", update);
  }, []);
  return (
    <header className="public-header">
      <button className="brand-button" type="button" onClick={() => navigate("home")} aria-label="Yozigo Cinemas home"><Brand /></button>
      <nav aria-label="Customer navigation">
        <button className={page === "home" || page === "details" ? "active" : ""} onClick={() => navigate("home")} type="button">Movies</button>
        <button className={page === "bookings" ? "active" : ""} onClick={() => navigate("bookings")} type="button">My Bookings</button>
      </nav>
      <button className="customer-mobile-menu" type="button" aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} aria-controls="customer-mobile-navigation" aria-expanded={mobileNavOpen} onClick={() => { setMobileNavOpen((open) => !open); setMenuOpen(false); }}><Icon name={mobileNavOpen ? "x" : "menu"} size={20} /></button>
      <div className="public-actions">
        <button className="header-search" type="button" onClick={() => navigate("home")}><Icon name="search" size={16} /><span>Search</span><kbd>⌘ K</kbd></button>
        <button className="notification-button" type="button" aria-label="Open booking updates" onClick={() => navigate("bookings")}><Icon name="bell" /></button>
        <div className="profile-menu">
          <button className={`profile-menu-trigger ${menuOpen ? "open" : ""}`} type="button" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => { setMenuOpen(!menuOpen); setMobileNavOpen(false); }}>
            <div className="avatar">{user?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?"}</div>
            <span className="public-user">{user?.name || "Guest"}<small>Customer</small></span>
            <Icon name="chevron-down" size={15} />
          </button>
          {menuOpen && <div className="profile-dropdown" role="menu"><div><strong>{user?.name || "Guest"}</strong><span>{user?.email || "Not signed in"}</span></div><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); navigate("bookings"); }}><Icon name="ticket" size={15} />My Bookings</button><button role="menuitem" type="button" onClick={async () => { try { await api.post<void>("/auth/logout"); } finally { setSession(null); authChanged(); setMenuOpen(false); navigate("login"); } }}><Icon name="arrow-left" size={15} />Sign Out</button></div>}
        </div>
      </div>
      {mobileNavOpen && <nav className="customer-mobile-nav" id="customer-mobile-navigation" aria-label="Customer navigation"><button className={page === "home" || page === "details" ? "active" : ""} type="button" onClick={() => { navigate("home"); setMobileNavOpen(false); }}>Movies</button><button className={page === "bookings" ? "active" : ""} type="button" onClick={() => { navigate("bookings"); setMobileNavOpen(false); }}>My Bookings</button></nav>}
    </header>
  );
}

function AuthField({
  label,
  value,
  placeholder,
  type = "text",
  error,
  onChange,
  endAction,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  error?: string;
  onChange: (value: string) => void;
  endAction?: ReactNode;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className={`auth-input ${error ? "has-error" : ""}`}>
        <input value={value} placeholder={placeholder} type={type} onChange={(event) => onChange(event.target.value)} />
        {endAction}
      </div>
      {error && <small className="auth-error"><span>!</span>{error}</small>}
    </label>
  );
}

function AuthScreen({ mode, navigate }: { mode: "signup" | "login"; navigate: (page: CustomerPage) => void }) {
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  const submit = async () => {
    setSubmitted(true);
    setServerError("");
    if ((signup && name.trim().length < 2) || !email.includes("@") || password.length < 8) return;
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      await getCsrf();
      if (signup) await api.post<ApiUser>("/auth/register", { name: name.trim(), email: normalizedEmail, password });
      const result = await api.post<{ user: ApiUser; csrfToken: string }>("/auth/login", { email: normalizedEmail, password });
      api.setCsrf(result.csrfToken);
      setSession(result.user);
      authChanged();
      navigate(!signup && result.user.role === "ADMIN" ? "admin-dashboard" : "home");
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual-top"><Brand /><span>Single screen. Unforgettable stories.</span></div>
        <div className="ticket-art">
          <div className="ticket-frame">
            <span>NOW SHOWING</span>
            <strong>Stories feel bigger<br />on the big screen.</strong>
            <p>Discover films, pick your favourite seats, and make movie night effortless.</p>
          </div>
          <div className="floating-ticket"><Icon name="ticket" /><span>Yozigo Cinemas<small>ADMIT TWO · SCREEN 1</small></span></div>
        </div>
        <small>Demo customer experience · Yozigo Cinemas</small>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form">
          <span className="auth-kicker">{signup ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span>
          <h1>{signup ? "Join us for the next show" : "Sign in to Yozigo"}</h1>
          <p>{signup ? "Book seats faster and keep every ticket in one place." : "Access your bookings and continue your movie night."}</p>
          {serverError && <div className="auth-alert"><span>!</span><div><strong>{serverError.includes("incorrect") ? "Invalid credentials" : "Something went wrong"}</strong><p>{serverError}</p></div></div>}
          <div className="auth-fields">
            {signup && <AuthField label="Full name" value={name} placeholder="e.g. Alex Kim" onChange={setName} error={submitted && name.trim().length < 2 ? "Enter your full name." : undefined} />}
            <AuthField label="Email address" value={email} placeholder="you@example.com" type="email" onChange={setEmail} error={submitted && !email.includes("@") ? "Enter a valid email address." : undefined} />
            <AuthField
              label="Password"
              value={password}
              placeholder={signup ? "Create a password" : "Enter your password"}
              type={showPassword ? "text" : "password"}
              onChange={setPassword}
              error={submitted && password.length < 8 ? "Password must contain at least 8 characters." : undefined}
              endAction={<button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}><Icon name={showPassword ? "eye-off" : "eye"} size={17} /></button>}
            />
            {signup && <div className={`password-requirement ${password.length >= 8 ? "met" : ""}`}><span>{password.length >= 8 ? <Icon name="check" size={11} /> : "8"}</span>Minimum 8 characters</div>}
          </div>
          <Button className="auth-submit" loading={loading} onClick={submit}>{signup ? "Create Account" : "Sign In"}</Button>
          <p className="auth-switch">{signup ? "Already have an account?" : "New to Yozigo?"} <button type="button" onClick={() => navigate(signup ? "login" : "signup")}>{signup ? "Sign in" : "Create an account"}</button></p>
          <div className="auth-secure"><Icon name="check" size={13} /> Your details are securely protected.</div>
          {!signup && <button className="staff-portal-link" type="button" onClick={() => navigate("admin-dashboard")}><Icon name="settings" size={14} /> Cinema staff portal <Icon name="chevron-right" size={13} /></button>}
        </div>
      </section>
    </div>
  );
}

function MovieDiscoveryCard({ movie, navigate, selectMovie }: { movie: MovieView; navigate: (page: CustomerPage) => void; selectMovie: (movie: MovieView) => void }) {
  const openMovie = () => { selectMovie(movie); navigate("details"); };
  return (
    <article className="discovery-card">
      <div className={`discovery-poster ${!movie.image ? "poster-missing" : ""}`}>
        {movie.image ? <img src={movie.image} alt={`${movie.title} demonstration poster`} /> : <div><Icon name="image" size={28} /><span>Poster coming soon</span></div>}
        <span className="rating-chip">{movie.rating}</span>
      </div>
      <div className="discovery-card-body">
        <span className="movie-genre">{movie.genre}</span>
        <h3>{movie.title}</h3>
        <div className="movie-meta"><span>{movie.language}</span><i /><span>{movie.runtime}</span></div>
        <Button variant="outline" className="full-width" onClick={openMovie}>View Details & Shows <Icon name="chevron-right" size={14} /></Button>
      </div>
    </article>
  );
}

function ListingFeedback({ state, retry }: { state: "loading" | "error"; retry: () => void }) {
  if (state === "loading") {
    return <div className="listing-skeletons">{[1, 2, 3, 4].map((item) => <div className="listing-skeleton" key={item}><div /><span /><span /><span /></div>)}</div>;
  }
  return (
    <div className="listing-empty error-listing">
      <span><Icon name="film" /></span>
      <h2>We couldn’t load movies</h2>
      <p>There was a problem connecting to the cinema service. Your filters have been saved.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}

function HomeScreen({ navigate, selectMovie }: { navigate: (page: CustomerPage) => void; selectMovie: (movie: MovieView) => void }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All languages");
  const [rating, setRating] = useState("All ratings");
  const [listingState, setListingState] = useState<ListingState>("loading");
  const [movies, setMovies] = useState<MovieView[]>([]);
  const [loadError, setLoadError] = useState("");
  const loadMovies = async () => {
    setListingState("loading");
    setLoadError("");
    try {
      const response = await api.get<{ items: ApiMovie[] }>("/movies?limit=100");
      setMovies(response.items.map(movieView));
      setListingState("ready");
    } catch (error) {
      setLoadError(errorMessage(error));
      setListingState("error");
    }
  };
  useEffect(() => { void loadMovies(); }, []);
  const filteredMovies = movies.filter((movie) =>
    movie.title.toLowerCase().includes(query.toLowerCase()) &&
    (language === "All languages" || movie.language === language) &&
    (rating === "All ratings" || movie.rating === rating),
  );

  const previewState = (state: ListingState) => {
    if (state === "loading") void loadMovies();
    else { setLoadError("Movie list preview error"); setListingState(state); }
  };
  const featuredMovie = movies[0];

  return (
    <div className="customer-app">
      <CustomerHeader page="home" navigate={navigate} />
      <main className="customer-main">
        {loadError && <div className="booking-notice notice-error"><Icon name="x" size={16} /><span>{loadError}</span><button type="button" onClick={() => void loadMovies()}>Retry</button></div>}
        {featuredMovie && <section className="featured-movie">
          {featuredMovie.image && <img src={featuredMovie.image} alt={`${featuredMovie.title} poster`} />}
          <div className="featured-overlay" />
          <div className="featured-content">
            <Badge tone="violet">Featured premiere</Badge>
            <h1>{featuredMovie.title}</h1>
            <div className="featured-meta"><span className="feature-rating">{featuredMovie.rating}</span><span>{featuredMovie.language}</span><i /><span>{featuredMovie.runtime}</span></div>
            <p>{featuredMovie.synopsis}</p>
            <Button onClick={() => { selectMovie(featuredMovie); navigate("details"); }}>View Details <Icon name="chevron-right" size={15} /></Button>
          </div>
          <span className="photo-credit">Photo: Jahmanz Williams / Unsplash</span>
        </section>}

        <section className="movie-listing">
          <div className="listing-heading">
            <div><span className="eyebrow">NOW SHOWING</span><h2>Find your next story</h2><p>Fresh releases and audience favourites, all on our single premium screen.</p></div>
            <span>{filteredMovies.length} movies</span>
          </div>
          <div className="movie-filters">
            <label className="movie-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setListingState("ready"); }} placeholder="Search by movie title" /></label>
            <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>All languages</option><option>English</option><option>Hindi</option><option>Tamil</option></select><Icon name="chevron-down" size={15} /></label>
            <label><span>Rating</span><select value={rating} onChange={(event) => setRating(event.target.value)}><option>All ratings</option><option>U</option><option>UA</option><option>A</option></select><Icon name="chevron-down" size={15} /></label>
          </div>

          {listingState !== "ready" ? listingState === "error" ? <div className="listing-empty error-listing"><span><Icon name="film" /></span><h2>We couldn’t load movies</h2><p>{loadError}</p><Button onClick={() => void loadMovies()}>Try again</Button></div> : <ListingFeedback state="loading" retry={() => void loadMovies()} /> : filteredMovies.length ? (
            <div className="discovery-grid">{filteredMovies.map((movie) => <MovieDiscoveryCard key={movie.id} movie={movie} navigate={navigate} selectMovie={selectMovie} />)}</div>
          ) : (
            <div className="listing-empty"><span><Icon name="search" /></span><h2>No movies found</h2><p>Try another title or clear your filters to see everything now showing.</p><Button variant="outline" onClick={() => { setQuery(""); setLanguage("All languages"); setRating("All ratings"); }}>Clear filters</Button></div>
          )}
        </section>
      </main>
    </div>
  );
}

function DetailsScreen({ navigate, selectMovie, selectShow, movie, saved, toggleSaved }: { navigate: (page: CustomerPage) => void; selectMovie: (movie: MovieView) => void; selectShow: (show: ShowSelection) => void; movie: MovieView; saved: boolean; toggleSaved: () => void }) {
  const [carouselMovies, setCarouselMovies] = useState<MovieView[]>([]);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselHovered, setCarouselHovered] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [schedule, setSchedule] = useState<Array<{ date: string; detail: string; shows: Array<{ api: ApiShow; time: string; price: number; seats: number }> }>>([]);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void api.get<{ items: ApiMovie[] }>("/movies?limit=100").then(({ items }) => {
      if (active) setCarouselMovies(items.map(movieView));
    }).catch(() => {
      if (active) setCarouselMovies([movie]);
    });
    return () => { active = false; };
  }, []);
  const slides = carouselMovies.length ? carouselMovies : [movie];
  const activeIndex = Math.max(0, slides.findIndex((item) => item.id === movie.id));
  const changeSlide = (offset: number) => {
    if (slides.length < 2) return;
    selectMovie(slides[(activeIndex + offset + slides.length) % slides.length]!);
  };
  useEffect(() => {
    if (slides.length < 2 || carouselPaused || carouselHovered || carouselFocused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const currentIndex = slides.findIndex((item) => item.id === movie.id);
      selectMovie(slides[(currentIndex + 1) % slides.length]!);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides, movie.id, carouselPaused, carouselHovered, carouselFocused, selectMovie]);
  useEffect(() => {
    let active = true;
    setSchedule([]);
    setLoadError("");
    void api.get<{ items: ApiShow[] }>(`/movies/${movie.id}/shows?limit=100`).then(({ items }) => {
      if (!active) return;
      const grouped = new Map<string, Array<{ api: ApiShow; time: string; price: number; seats: number }>>();
      for (const apiShow of items) {
        const day = dateLabel(apiShow.startsAt, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
        const entry = { api: apiShow, time: dateLabel(apiShow.startsAt, { hour: "numeric", minute: "2-digit" }), price: apiShow.ticketPricePaise / 100, seats: apiShow.remainingSeats };
        grouped.set(day, [...(grouped.get(day) || []), entry]);
      }
      const days = [...grouped.entries()].map(([detail, shows]) => ({ date: detail.split(",")[0], detail, shows }));
      setSchedule(days);
      if (days[0]?.shows[0]) {
        setSelectedDate(0);
        setSelectedTime(days[0].shows[0].api.id);
        selectShow({ id: days[0].shows[0].api.id, movieTitle: movie.title, date: days[0].detail, time: days[0].shows[0].time, startsAt: days[0].shows[0].api.startsAt, price: days[0].shows[0].price, seats: days[0].shows[0].seats, totalSeats: days[0].shows[0].api.totalSeats });
      }
    }).catch((error) => { if (active) setLoadError(errorMessage(error)); });
    return () => { active = false; };
  }, [movie.id]);
  const chooseShow = (show: { api: ApiShow; time: string; price: number; seats: number }, date = schedule[selectedDate]?.detail || "") => {
    setSelectedTime(show.api.id);
    selectShow({ id: show.api.id, movieTitle: movie.title, date, time: show.time, startsAt: show.api.startsAt, price: show.price, seats: show.seats, totalSeats: show.api.totalSeats });
  };
  const continueWithShow = (show: { api: ApiShow; time: string; price: number; seats: number }) => { chooseShow(show); navigate("seats"); };
  return (
    <div className="customer-app">
      <CustomerHeader page="details" navigate={navigate} />
      <main className="customer-main detail-main">
        <button className="back-link" type="button" onClick={() => navigate("home")}><Icon name="arrow-left" size={16} /> Back to movies</button>
      <section className="detail-hero" role="region" aria-roledescription="carousel" aria-label="Now showing movies" onMouseEnter={() => setCarouselHovered(true)} onMouseLeave={() => setCarouselHovered(false)} onFocusCapture={() => setCarouselFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselFocused(false); }}>
          {movie.image && <img key={movie.id} className="detail-backdrop" src={movie.image} alt="" />}
          <div className="detail-backdrop-overlay" />
          <div className="detail-content" key={movie.id} role="group" aria-roledescription="slide" aria-label={`${activeIndex + 1} of ${slides.length}: ${movie.title}`}>
            <div className={`detail-poster ${!movie.image ? "poster-missing" : ""}`}>{movie.image ? <img src={movie.image} alt={`${movie.title} poster`} /> : <div><Icon name="image" size={28} /><span>Poster coming soon</span></div>}<span>{movie.rating}</span></div>
            <div className="detail-copy">
              <span className="eyebrow">NOW SHOWING</span>
              <h1>{movie.title}</h1>
              <div className="detail-meta"><span className="feature-rating">{movie.rating}</span><span>{movie.language}</span><i /><span>{movie.runtime}</span></div>
              <p>{movie.synopsis}</p>
              <Button variant="outline" onClick={toggleSaved}>{saved ? "✓ Added to Watchlist" : "+ Add to Watchlist"}</Button>
            </div>
          </div>
          {slides.length > 1 && <div className="detail-carousel-controls">
            <button className="detail-carousel-arrow" type="button" aria-label="Previous movie" onClick={() => changeSlide(-1)}><Icon name="chevron-left" size={16} /></button>
            <span className="detail-carousel-count" aria-live="off">{activeIndex + 1} / {slides.length}</span>
            <div className="detail-carousel-dots" role="group" aria-label="Choose a movie">
              {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Show ${slide.title}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => selectMovie(slide)} />)}
            </div>
            <button className="detail-carousel-toggle" type="button" aria-label={carouselPaused ? "Resume automatic slides" : "Pause automatic slides"} onClick={() => setCarouselPaused((paused) => !paused)}>{carouselPaused ? "▶" : "Ⅱ"}</button>
            <button className="detail-carousel-arrow" type="button" aria-label="Next movie" onClick={() => changeSlide(1)}><Icon name="chevron-right" size={16} /></button>
          </div>}
        </section>
        <section className="showtime-section">
          <div className="showtime-heading"><div><span className="eyebrow">UPCOMING SHOWS</span><h2>Choose a showtime</h2><p>Only future sessions from the cinema schedule are shown.</p></div><div className="showtime-heading-actions"><div className="screen-label"><span>SCREEN</span><strong>1</strong></div></div></div>
          <div className="date-tabs">
            {schedule.map((day, index) => <button className={selectedDate === index ? "active" : ""} onClick={() => { setSelectedDate(index); if (day.shows[0]) chooseShow(day.shows[0], day.detail); }} type="button" key={day.detail}><span>{day.date}</span><strong>{day.detail}</strong></button>)}
          </div>
          {loadError ? <div className="listing-empty error-listing"><h2>Couldn’t load showtimes</h2><p>{loadError}</p><Button variant="outline" onClick={() => navigate("home")}>Back to movies</Button></div> : !schedule.length ? <div className="listing-empty no-shows-state"><span><Icon name="calendar" /></span><h2>No upcoming shows</h2><p>The cinema has not scheduled another session for this movie yet.</p><Button variant="outline" onClick={() => navigate("home")}>Browse Other Movies</Button></div> : <div className="show-list">
            <div className="show-date-title"><Icon name="calendar" size={17} /><strong>{schedule[selectedDate]?.date}, {schedule[selectedDate]?.detail}</strong><span>{schedule[selectedDate]?.shows.length} shows</span></div>
            {schedule[selectedDate]?.shows.map((show) => (
              <article className={`show-row ${selectedTime === show.api.id ? "selected-show-row" : ""}`} key={show.api.id}>
                <button className={`time-button ${selectedTime === show.api.id ? "selected" : ""}`} type="button" aria-pressed={selectedTime === show.api.id} onClick={() => chooseShow(show)}><Icon name={selectedTime === show.api.id ? "check" : "clock"} size={15} /><span>{show.time}</span></button>
                <div className="show-price"><span>Ticket price</span><strong>{formatINR(show.price)}</strong></div>
                <div className="availability"><div><span>Seats remaining</span><strong>{show.seats} <small>/ {show.api.totalSeats}</small></strong></div><span className="availability-bar"><i style={{ width: `${(show.seats / show.api.totalSeats) * 100}%` }} /></span></div>
                <Button disabled={!show.seats} onClick={() => continueWithShow(show)}>{selectedTime === show.api.id ? "Select Seats" : "Choose Show"} <Icon name="chevron-right" size={14} /></Button>
              </article>
            ))}
          </div>}
          <div className="schedule-note"><Icon name="check" size={14} /> Show availability and ticket prices are loaded from the cinema database.</div>
        </section>
      </main>
    </div>
  );
}

type SeatStatus = "available" | "selected" | "held-other" | "held-you" | "booked" | "expired";

function BookingFacts({ show }: { show: ShowSelection }) {
  return (
    <div className="booking-facts">
      <div><Icon name="film" size={16} /><span>Movie<strong>{show.movieTitle}</strong></span></div>
      <div><Icon name="calendar" size={16} /><span>Date<strong>{show.date}</strong></span></div>
      <div><Icon name="clock" size={16} /><span>Showtime<strong>{show.time} · Screen 1</strong></span></div>
      <div><Icon name="ticket" size={16} /><span>Ticket price<strong>{formatINR(show.price)} each</strong></span></div>
    </div>
  );
}

function SeatButton({
  id,
  number,
  status,
  onSelect,
}: {
  id: string;
  number: number;
  status: SeatStatus;
  onSelect?: () => void;
}) {
  const disabled = !onSelect || status === "booked" || status === "held-other" || status === "held-you" || status === "expired";
  const statusText = {
    available: "Available",
    selected: "Selected",
    "held-other": "Held by another customer",
    "held-you": "Held by you",
    booked: "Booked",
    expired: "Expired hold",
  }[status];

  return (
    <button
      aria-label={`${id}, ${statusText}`}
      className={`cinema-seat cinema-seat-${status} ${!onSelect ? "seat-readonly" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span>{number}</span>
      {status === "selected" && <Icon name="check" size={9} />}
      {status === "held-other" && <small>H</small>}
      {status === "held-you" && <small>Y</small>}
      {status === "booked" && <small>×</small>}
      {status === "expired" && <small>E</small>}
    </button>
  );
}

function SeatStateLegend() {
  const entries: Array<[SeatStatus, string, string]> = [
    ["available", "Available", "A"],
    ["selected", "Selected", "✓"],
    ["held-other", "Held by another", "H"],
    ["held-you", "Held by you", "Y"],
    ["booked", "Booked", "×"],
    ["expired", "Expired hold", "E"],
  ];
  return (
    <div className="cinema-legend">
      {entries.map(([status, label, mark]) => <span key={status}><i className={`legend-seat legend-seat-${status}`}>{mark}</i>{label}</span>)}
    </div>
  );
}

function PriceSummary({
  seats,
  show,
  action,
  loading,
}: {
  seats: string[];
  show: ShowSelection;
  action: () => void;
  loading?: boolean;
}) {
  const total = seats.length * show.price;
  return (
    <aside className="booking-summary-card">
      <span className="eyebrow">YOUR SELECTION</span>
      <h2>Booking summary</h2>
      <BookingFacts show={show} />
      <div className="selected-seat-box">
        <div><span>Selected seats</span><strong>{seats.length} / 6</strong></div>
        {seats.length ? <div className="selected-chips">{seats.map((seat) => <span key={seat}>{seat}</span>)}</div> : <p>Select up to six available seats from the map.</p>}
      </div>
      <div className="summary-price"><span>Tickets</span><strong>{seats.length} × {formatINR(show.price)}</strong></div>
      <div className="summary-total"><span>Total</span><strong>{formatINR(total)}</strong></div>
      <Button className="full-width" disabled={!seats.length} loading={loading} onClick={action}>Continue <Icon name="chevron-right" size={15} /></Button>
      <small className="summary-security"><Icon name="check" size={12} /> Seats are not held until the server confirms.</small>
    </aside>
  );
}

function SeatSelectionScreen({
  navigate,
  selectedSeats,
  setSelectedSeats,
  show,
  onHoldCreated,
}: {
  navigate: (page: CustomerPage) => void;
  selectedSeats: string[];
  setSelectedSeats: (seats: string[]) => void;
  show: ShowSelection;
  onHoldCreated: (hold: { id: string; expiresAt: string }) => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [seatMap, setSeatMap] = useState<ApiSeat[]>([]);
  const [mapError, setMapError] = useState("");
  const rows = "ABCDEFGH".split("");
  const refreshSeats = async () => {
    try {
      const response = await api.get<{ seats: ApiSeat[] }>(`/shows/${show.id}/seats`);
      setSeatMap(response.seats);
      setMapError("");
    } catch (error) { setMapError(errorMessage(error)); }
  };
  useEffect(() => {
    void refreshSeats();
    const timer = window.setInterval(() => void refreshSeats(), 8000);
    return () => window.clearInterval(timer);
  }, [show.id]);

  const selectSeat = (label: string) => {
    setMessage("");
    if (selectedSeats.includes(label)) {
      setSelectedSeats(selectedSeats.filter((seat) => seat !== label));
      return;
    }
    if (selectedSeats.length === 6) {
      setMessage("You can select a maximum of 6 seats per booking.");
      return;
    }
    setSelectedSeats([...selectedSeats, label]);
  };

  const continueToHold = async () => {
    setLoading(true);
    setMessage("");
    try {
      const ids = selectedSeats.map((label) => seatMap.find((seat) => `${seat.rowLabel}${seat.seatNumber}` === label)?.id);
      if (ids.some((id) => !id)) throw new Error("Refresh the seat map and select available seats again.");
      const hold = await api.post<{ id: string; expiresAt: string }>(`/shows/${show.id}/holds`, { seatIds: ids });
      onHoldCreated(hold);
      navigate("checkout");
    } catch (error) {
      setMessage(errorMessage(error));
      void refreshSeats();
    } finally { setLoading(false); }
  };

  return (
    <div className="customer-app">
      <CustomerHeader page="details" navigate={navigate} />
      <main className="customer-main seat-page seat-selection-page">
        <button className="back-link" type="button" onClick={() => navigate("details")}><Icon name="arrow-left" size={16} /> Back to showtimes</button>
        <div className="seat-page-heading">
          <div><span className="eyebrow">{show.movieTitle.toUpperCase()} · SCREEN 1</span><h1>Select your seats</h1><p>{show.date} · {show.time} · {formatINR(show.price)} per ticket</p></div>
          <Badge tone="green">{seatMap.filter((seat) => seat.status === "AVAILABLE").length} of {show.totalSeats} available</Badge>
        </div>
        <div className="seat-booking-layout">
          <section className="full-seat-map">
            <div className="screen-direction"><span>SCREEN THIS WAY</span><i /></div>
            <div className="seat-grid-shell">
              <div className="seat-column-numbers"><span />{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
              {rows.map((row) => (
                <div className="cinema-seat-row" key={row}>
                  <strong>{row}</strong>
                  {Array.from({ length: 10 }, (_, index) => {
                    const number = index + 1;
                    const id = `${row}${number}`;
                    const data = seatMap.find((seat) => seat.rowLabel === row && seat.seatNumber === number);
                    const status: SeatStatus = selectedSeats.includes(id) ? "selected" : data?.status === "BOOKED" ? "booked" : data?.status === "HELD_BY_OTHER" ? "held-other" : data?.status === "HELD_BY_ME" ? "held-you" : "available";
                    return <SeatButton id={id} key={id} number={number} status={status} onSelect={data?.status === "AVAILABLE" ? () => selectSeat(id) : undefined} />;
                  })}
                </div>
              ))}
            </div>
            <div className="aisle-labels"><span>LEFT AISLE</span><span>CENTRE</span><span>RIGHT AISLE</span></div>
            <SeatStateLegend />
            {(message || mapError) && <div className="selection-message" role="alert"><span>!</span>{message || mapError}<button type="button" onClick={() => { setMessage(""); setMapError(""); }}><Icon name="x" size={14} /></button></div>}
            <div className="live-availability"><i /><span>Availability updates live from the cinema service. Unavailable seats cannot be selected.</span></div>
          </section>
          <PriceSummary seats={selectedSeats} show={show} action={continueToHold} loading={loading} />
        </div>
      </main>
    </div>
  );
}

function HoldCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(onExpire, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onExpire, expiresAt]);
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return (
    <div className="hold-countdown">
      <span><Icon name="clock" size={17} /> Temporary hold expires in</span>
      <strong>{minutes}:{remainder}</strong>
      <div><i style={{ width: `${(seconds / 300) * 100}%` }} /></div>
    </div>
  );
}

function CheckoutScreen({ navigate, seats, show, hold, onExpire }: { navigate: (page: CustomerPage) => void; seats: string[]; show: ShowSelection; hold: { id: string; expiresAt: string }; onExpire: () => void }) {
  return (
    <div className="customer-app checkout-canvas">
      <CustomerHeader page="details" navigate={navigate} />
      <main className="checkout-main">
        <button className="back-link" type="button" onClick={() => navigate("seats")}><Icon name="arrow-left" size={16} /> Change seats</button>
        <div className="checkout-progress"><span className="complete"><i><Icon name="check" size={11} /></i><span className="checkout-step-label">Select seats</span></span><b /><span className="active"><i>2</i><span className="checkout-step-label">Temporary hold</span></span><b /><span><i>3</i><span className="checkout-step-label">Payment</span></span></div>
        <div className="checkout-grid">
          <section className="hold-panel">
            <div className="hold-status-icon"><Icon name="check" size={20} /></div>
            <span className="eyebrow">SEATS HELD TEMPORARILY</span>
            <h1>Your seats are reserved for now</h1>
            <p>The cinema service has returned a temporary hold. Complete the demonstration payment before the server-provided expiry time.</p>
            <HoldCountdown expiresAt={hold.expiresAt} onExpire={onExpire} />
            <div className="server-notice">
              <span>i</span>
              <p><strong>The backend is authoritative.</strong> This countdown represents the hold expiry returned by the server. The timer alone does not guarantee that the reservation remains valid.</p>
            </div>
            <Button className="pay-button" onClick={() => navigate("payment")}>Continue to Demo Payment <Icon name="chevron-right" size={15} /></Button>
            <button className="preview-expiry" type="button" onClick={() => navigate("expired")}>Preview hold-expired state</button>
          </section>
          <PriceSummaryStatic seats={seats} show={show} />
        </div>
      </main>
    </div>
  );
}

function PriceSummaryStatic({ seats, show, paymentLabel = "Total due" }: { seats: string[]; show: ShowSelection; paymentLabel?: string }) {
  return (
    <aside className="checkout-summary">
      <span className="eyebrow">BOOKING SUMMARY</span>
      <h2>The Last Horizon</h2>
      <BookingFacts show={show} />
      <div className="checkout-seats"><span>Seats</span><div>{seats.map((seat) => <strong key={seat}>{seat}</strong>)}</div></div>
      <div className="summary-price"><span>{seats.length} tickets × {formatINR(show.price)}</span><strong>{formatINR(seats.length * show.price)}</strong></div>
      <div className="summary-total"><span>{paymentLabel}</span><strong>{formatINR(seats.length * show.price)}</strong></div>
      <small>Demonstration booking · No real payment will be collected</small>
    </aside>
  );
}

function PaymentScreen({ navigate, seats, show, onPay, paying, error }: { navigate: (page: CustomerPage) => void; seats: string[]; show: ShowSelection; onPay: (outcome: "SUCCESS" | "FAILURE") => void; paying: boolean; error: string }) {
  return (
    <div className="customer-app checkout-canvas">
      <CustomerHeader page="details" navigate={navigate} />
      <main className="checkout-main payment-main">
        <button className="back-link" type="button" onClick={() => navigate("checkout")}><Icon name="arrow-left" size={16} /> Back to hold details</button>
        <div className="checkout-progress"><span className="complete"><i><Icon name="check" size={11} /></i><span className="checkout-step-label">Select seats</span></span><b /><span className="complete"><i><Icon name="check" size={11} /></i><span className="checkout-step-label">Temporary hold</span></span><b /><span className="active"><i>3</i><span className="checkout-step-label">Payment</span></span></div>
        <div className="checkout-grid">
          <section className="fake-payment-panel">
            <Badge tone="violet">Demonstration only</Badge>
            <h1>Choose a test payment outcome</h1>
            <p>No genuine card or payment information is requested. Select one of the two outcomes below to continue the prototype.</p>
            {error && <div className="auth-alert"><span>!</span><div><strong>Payment was not completed</strong><p>{error}</p></div></div>}
            <div className="payment-outcomes">
              <button className="payment-outcome success-outcome" disabled={paying} type="button" onClick={() => onPay("SUCCESS")}>
                <span><Icon name="check" size={20} /></span>
                <div><strong>Payment Success</strong><small>Confirm the booking and issue a reference.</small></div>
                <Icon name="chevron-right" size={17} />
              </button>
              <button className="payment-outcome failure-outcome" disabled={paying} type="button" onClick={() => onPay("FAILURE")}>
                <span><Icon name="x" size={20} /></span>
                <div><strong>Payment Failure</strong><small>Keep the server-confirmed hold until expiry.</small></div>
                <Icon name="chevron-right" size={17} />
              </button>
            </div>
            <div className="server-notice"><span>i</span><p>The final booking status must be confirmed by the backend. This screen only demonstrates possible responses.</p></div>
          </section>
          <PriceSummaryStatic seats={seats} show={show} />
        </div>
      </main>
    </div>
  );
}

function ConfirmationDetails({ seats, show, booking }: { seats: string[]; show: ShowSelection; booking: ApiBooking | null }) {
  return (
    <div className="confirmation-details">
      <div><span>Booking reference</span><strong>#{booking?.id.slice(0, 8).toUpperCase()}</strong></div>
      <div><span>Movie</span><strong>{show.movieTitle}</strong></div>
      <div><span>Show date</span><strong>{show.date}</strong></div>
      <div><span>Showtime</span><strong>{show.time} · Screen 1</strong></div>
      <div><span>Seats</span><strong>{seats.join(", ")}</strong></div>
      <div><span>Total amount</span><strong>{formatINR(seats.length * show.price)}</strong></div>
      <div><span>Status</span><Badge tone="green">Confirmed</Badge></div>
    </div>
  );
}

function PaymentResultPanel({
  result,
  navigate,
  seats,
  show,
  booking,
}: {
  result: "success" | "failure" | "expired";
  navigate: (page: CustomerPage) => void;
  seats: string[];
  show: ShowSelection;
  booking: ApiBooking | null;
}) {
  const success = result === "success";
  const expired = result === "expired";
  return (
    <div className="result-page">
      <div className={`result-icon result-${result}`}>{success ? <Icon name="check" size={28} /> : expired ? <Icon name="clock" size={28} /> : <Icon name="x" size={28} />}</div>
      <span className="eyebrow">{success ? "BOOKING CONFIRMED" : expired ? "HOLD EXPIRED" : "PAYMENT NOT COMPLETED"}</span>
      <h1>{success ? "You’re all set for movie night" : expired ? "Your temporary hold has expired" : "Payment failed"}</h1>
      <p>{success ? "Your booking was confirmed by the demonstration service. Keep the reference below for your records." : expired ? "The payment attempt cannot be confirmed because the server-provided hold is no longer valid. Your seats may now be available to others." : "No booking was confirmed. Your temporary hold remains valid only until its server-provided expiry and only if the backend still confirms it."}</p>
      {success && <ConfirmationDetails seats={seats} show={show} booking={booking} />}
      {!success && !expired && <div className="failure-hold-note"><Icon name="clock" size={17} /><span><strong>Temporary hold may still be active</strong>Return to payment before expiry. The backend remains authoritative.</span></div>}
      <div className="result-actions">
        {success ? (
          <><Button onClick={() => navigate("bookings")}>View My Bookings</Button><Button variant="outline" onClick={() => navigate("home")}>Back to Home</Button></>
        ) : expired ? (
          <><Button onClick={() => navigate("seats")}>Return to Seat Selection</Button><Button variant="outline" onClick={() => navigate("details")}>View Other Shows</Button></>
        ) : (
          <><Button onClick={() => navigate("payment")}>Try Again</Button><Button variant="outline" onClick={() => navigate("seats")}>Return to Seat Selection</Button></>
        )}
      </div>
      <small>Yozigo Cinemas demonstration flow · No real transaction occurred</small>
    </div>
  );
}

function ResultScreen({ result, navigate, seats, show, booking }: { result: "success" | "failure" | "expired"; navigate: (page: CustomerPage) => void; seats: string[]; show: ShowSelection; booking: ApiBooking | null }) {
  return (
    <div className="customer-app checkout-canvas">
      <CustomerHeader page="details" navigate={navigate} />
      <main className="result-main"><PaymentResultPanel result={result} navigate={navigate} seats={seats} show={show} booking={booking} /></main>
    </div>
  );
}

type BookingStatus = "Confirmed" | "Completed" | "Cancelled";
type BookingFilter = "All" | "Upcoming" | "Past" | "Cancelled";

const initialBookings: Array<{ id: string; bookingId: string; title: string; date: string; time: string; seats: string[]; total: number; status: BookingStatus; period: string; image: string; eligible: boolean }> = [];
function toBookingCard(booking: ApiBooking) {
  const startsAt = new Date(booking.show.startsAt);
  const past = startsAt.getTime() < Date.now();
  const status: BookingStatus = booking.status === "CANCELLED" ? "Cancelled" : past ? "Completed" : "Confirmed";
  return {
    id: booking.id.slice(0, 8).toUpperCase(), bookingId: booking.id, title: booking.show.movie.title,
    date: dateLabel(booking.show.startsAt, { weekday: "short", month: "short", day: "numeric" }),
    time: dateLabel(booking.show.startsAt, { hour: "numeric", minute: "2-digit" }),
    seats: booking.seats.map(({ showSeat }) => `${showSeat.rowLabel}${showSeat.seatNumber}`),
    total: booking.totalAmountPaise / 100, status,
    period: status === "Cancelled" ? "Cancelled" : past ? "Past" : "Upcoming",
    image: booking.show.movie.posterUrl || movieArt[booking.show.movie.title] || "",
    eligible: booking.status === "CONFIRMED" && startsAt.getTime() - Date.now() > 2 * 60 * 60 * 1000,
  };
}

function BookingDetailsModal({
  booking,
  close,
  cancel,
}: {
  booking: typeof initialBookings[number];
  close: () => void;
  cancel: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="booking-detail-modal" role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="detail-modal-header">
          <div><span className="eyebrow">BOOKING DETAILS</span><h2 id="booking-detail-title">#{booking.id}</h2></div>
          <button type="button" onClick={close} aria-label="Close booking details"><Icon name="x" /></button>
        </div>
        <div className="detail-booking-movie"><img src={booking.image} alt="" /><div><Badge tone={booking.status === "Confirmed" ? "green" : booking.status === "Cancelled" ? "red" : "gray"}>{booking.status}</Badge><h3>{booking.title}</h3><p>{booking.date} · {booking.time} · Screen 1</p></div></div>
        <div className="booking-detail-grid">
          <div><span>Seats</span><strong>{booking.seats.join(", ")}</strong></div>
          <div><span>Amount paid</span><strong>{formatINR(booking.total)}</strong></div>
          <div><span>Booked on</span><strong>May 20, 10:42 AM</strong></div>
          <div><span>Booking reference</span><strong>#{booking.id}</strong></div>
        </div>
        {!booking.eligible && booking.status === "Confirmed" && <div className="cancellation-rule"><Icon name="clock" size={16} /><span><strong>Cancellation is no longer available.</strong>This show starts within two hours. The cinema service will reject late cancellation requests.</span></div>}
        <div className="detail-modal-actions">
          {booking.eligible && <Button variant="danger" onClick={cancel}>Cancel booking</Button>}
          <Button variant="outline" onClick={close}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function MyBookingsScreen({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const [filter, setFilter] = useState<BookingFilter>("All");
  const [bookings, setBookings] = useState(initialBookings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState<typeof initialBookings[number] | null>(null);
  const [cancelTarget, setCancelTarget] = useState<typeof initialBookings[number] | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ items: ApiBooking[] }>("/bookings/me?limit=100");
      setBookings(response.items.map(toBookingCard));
      setLoadError("");
    } catch (error) { setLoadError(errorMessage(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadBookings(); }, []);
  const periodOrder: Record<string, number> = { Upcoming: 0, Past: 1, Cancelled: 2 };
  const visible = bookings
    .filter((booking) => filter === "All" || booking.period === filter || (filter === "Cancelled" && booking.status === "Cancelled"))
    .sort((a, b) => periodOrder[a.period] - periodOrder[b.period]);

  const confirmCancellation = async () => {
    if (!cancelTarget) return;
    try {
      await api.post(`/bookings/${cancelTarget.bookingId}/cancel`);
      setNotice({ tone: "success", text: `Booking #${cancelTarget.id} was cancelled successfully.` });
      await loadBookings();
    } catch (error) { setNotice({ tone: "error", text: errorMessage(error) }); }
    setCancelTarget(null);
    setDetail(null);
  };

  return (
    <div className="customer-app">
      <CustomerHeader page="bookings" navigate={navigate} />
      <main className="customer-main bookings-main">
        <div className="bookings-heading"><div><span className="eyebrow">YOUR TICKETS</span><h1>My bookings</h1><p>Upcoming bookings appear first, followed by your cinema history.</p></div><Button onClick={() => navigate("home")}>Browse Movies</Button></div>
        {loadError && <div className="booking-notice notice-error"><Icon name="x" size={16} /><span>{loadError}</span><button type="button" onClick={() => void loadBookings()}>Retry</button></div>}
        {notice && <div className={`booking-notice notice-${notice.tone}`}><Icon name={notice.tone === "success" ? "check" : "x"} size={16} /><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)}><Icon name="x" size={14} /></button></div>}
        <div className="booking-tabs">
          {(["All", "Upcoming", "Past", "Cancelled"] as BookingFilter[]).map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} type="button" key={item}>{item}<span>{bookings.filter((booking) => item === "All" || booking.period === item || (item === "Cancelled" && booking.status === "Cancelled")).length}</span></button>)}
        </div>
        {loading ? <ListingFeedback state="loading" retry={() => void loadBookings()} /> : visible.length ? <div className="booking-list">{visible.map((booking) => (
          <article className="booking-card" key={booking.id}>
            <img src={booking.image} alt={`${booking.title} poster thumbnail`} />
            <div className="booking-primary"><Badge tone={booking.status === "Confirmed" ? "green" : booking.status === "Cancelled" ? "red" : "gray"}>{booking.status}</Badge><h2>{booking.title}</h2><span>#{booking.id}</span></div>
            <div className="booking-data"><span>Show</span><strong>{booking.date}</strong><small>{booking.time} · Screen 1</small></div>
            <div className="booking-data"><span>Seats</span><strong>{booking.seats.join(", ")}</strong><small>{booking.seats.length} {booking.seats.length === 1 ? "ticket" : "tickets"}</small></div>
            <div className="booking-data"><span>Amount paid</span><strong>{formatINR(booking.total)}</strong><small>Payment successful</small></div>
            <div className="booking-card-actions"><Button variant="outline" onClick={() => setDetail(booking)}>View details</Button>{booking.eligible && <button type="button" onClick={() => setCancelTarget(booking)}>Cancel</button>}</div>
          </article>
        ))}</div> : <div className="listing-empty bookings-empty"><span><Icon name="ticket" /></span><h2>No bookings here yet</h2><p>When you book a show, your tickets and booking details will appear here.</p><Button onClick={() => navigate("home")}>Browse Movies</Button></div>}
      </main>
      {detail && <BookingDetailsModal booking={detail} close={() => setDetail(null)} cancel={() => { setCancelTarget(detail); setDetail(null); }} />}
      {cancelTarget && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCancelTarget(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-icon"><Icon name="ticket" /></div><h2>Cancel booking #{cancelTarget.id}?</h2><p>The seats {cancelTarget.seats.join(", ")} will be released if the cinema cancellation rules allow it.</p><div className="modal-actions"><Button variant="outline" onClick={() => setCancelTarget(null)}>Keep booking</Button><Button variant="danger" onClick={() => void confirmCancellation()}>Cancel booking</Button></div></div></div>}
    </div>
  );
}

type AdminPage = "admin-dashboard" | "admin-movies" | "admin-shows" | "admin-bookings" | "admin-seats" | "admin-show-detail";

const adminMovies = [
  { id: 1, title: "The Last Horizon", language: "English", duration: "2h 18m", rating: "UA", image: movieImages.horizon, shows: 4 },
  { id: 2, title: "A Quiet Distance", language: "English", duration: "1h 54m", rating: "U", image: movieImages.silence, shows: 2 },
  { id: 3, title: "Wild Meridian", language: "Hindi", duration: "2h 06m", rating: "UA", image: movieImages.wild, shows: 0 },
  { id: 4, title: "Above the Silence", language: "English", duration: "1h 48m", rating: "U", image: movieImages.summit, shows: 1 },
  { id: 5, title: "Ember Valley", language: "Tamil", duration: "2h 12m", rating: "A", image: movieImages.ember, shows: 3 },
];

const adminShows = [
  { id: "SH-051", movie: "The Last Horizon", date: "May 24, 2025", time: "6:30 PM", price: 250, booked: 62, status: "Upcoming", bookings: 34 },
  { id: "SH-052", movie: "The Last Horizon", date: "May 24, 2025", time: "9:15 PM", price: 300, booked: 48, status: "Upcoming", bookings: 26 },
  { id: "SH-053", movie: "A Quiet Distance", date: "May 25, 2025", time: "3:45 PM", price: 220, booked: 31, status: "Upcoming", bookings: 18 },
  { id: "SH-054", movie: "Ember Valley", date: "May 25, 2025", time: "7:00 PM", price: 250, booked: 70, status: "Upcoming", bookings: 39 },
];

function AdminLayout({ page, navigate, children, title }: { page: AdminPage; navigate: (page: CustomerPage) => void; children: ReactNode; title: string }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navItems: Array<[AdminPage, IconName, string]> = [
    ["admin-dashboard", "dashboard", "Dashboard"],
    ["admin-movies", "film", "Movies"],
    ["admin-shows", "calendar", "Shows"],
    ["admin-bookings", "ticket", "Bookings"],
    ["admin-seats", "seat", "Seat Inventory"],
  ];
  return (
    <div className="app-shell admin-portal">
      {navigationOpen && <button className="sidebar-overlay" type="button" aria-label="Close staff navigation" onClick={() => setNavigationOpen(false)} />}
      <aside className={`admin-sidebar ${navigationOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><Brand /><button className="sidebar-close" type="button" aria-label="Close staff navigation" onClick={() => setNavigationOpen(false)}><Icon name="x" size={18} /></button></div>
        <div className="staff-mode"><span>STAFF PORTAL</span><strong>Yozigo Cinema</strong><small>Single-screen operations</small></div>
        <nav aria-label="Staff navigation">
          <span className="nav-section-label">MANAGEMENT</span>
          {navItems.map(([itemPage, icon, label]) => <button className={`sidebar-link ${page === itemPage || (itemPage === "admin-shows" && page === "admin-show-detail") ? "active" : ""}`} type="button" onClick={() => { navigate(itemPage); setNavigationOpen(false); }} key={itemPage}><Icon name={icon} /><span>{label}</span></button>)}
        </nav>
        <button className="admin-logout" type="button" onClick={async () => { try { await api.post<void>("/auth/logout"); } finally { setSession(null); authChanged(); navigate("login"); } }}><Icon name="arrow-left" size={17} />Logout</button>
        <div className="sidebar-user"><div className="avatar">{signedInUser?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD"}</div><div><strong>{signedInUser?.name || "Staff"}</strong><span>{signedInUser?.role === "ADMIN" ? "Cinema admin" : "Customer"}</span></div><Icon name="more" /></div>
      </aside>
      <div className="admin-main">
        <header className="admin-header"><button className="mobile-menu" type="button" aria-label={navigationOpen ? "Close staff navigation" : "Open staff navigation"} aria-expanded={navigationOpen} onClick={() => setNavigationOpen((open) => !open)}><Icon name={navigationOpen ? "x" : "menu"} /></button><div><span className="admin-context">STAFF MANAGEMENT</span><strong>{title}</strong></div><div className="admin-header-actions"><span className="operation-status"><i /> Screen open</span><button className="notification-button" type="button" aria-label="Open staff booking alerts" onClick={() => navigate("admin-bookings")}><Icon name="bell" /><i /></button><span className="header-divider" /><div className="avatar">{signedInUser?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD"}</div></div></header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

function AdminPageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="admin-page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function AdminDashboard({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const [state, setState] = useState<"ready" | "loading" | "error" | "empty">("ready");
  return (
    <AdminLayout page="admin-dashboard" navigate={navigate} title="Dashboard">
      <AdminPageHeading title="Good morning, Rina" description="Here’s how Yozigo Cinema is performing today." action={<div className="heading-actions"><Button variant="ghost" onClick={() => navigate("handoff")}>Handoff Guide</Button><Button variant="outline" onClick={() => navigate("admin-movies")}>Add Movie</Button><Button onClick={() => navigate("admin-shows")}>Add Show</Button></div>} />
      <div className="demo-banner admin-demo"><span>DASHBOARD STATES</span>Revenue includes confirmed successful bookings only.<div><button type="button" onClick={() => setState("loading")}>Loading</button><button type="button" onClick={() => setState("empty")}>Empty</button><button type="button" onClick={() => setState("error")}>Error</button><button type="button" onClick={() => navigate("unauthorized")}>Unauthorized</button><button type="button" onClick={() => setState("ready")}>Reset</button></div></div>
      {state === "loading" ? <div className="admin-state-grid">{[1, 2, 3, 4, 5].map((item) => <div className="admin-metric-skeleton" key={item}><i /><span /><span /></div>)}</div> : state === "error" ? <AdminState icon="x" title="Dashboard data couldn’t be loaded" text="Check the cinema service connection and try again." action={<Button onClick={() => setState("ready")}>Try again</Button>} tone="error" /> : state === "empty" ? <AdminState icon="calendar" title="No activity to report yet" text="Add a movie and schedule the first show to begin taking bookings." action={<Button onClick={() => navigate("admin-movies")}>Add first movie</Button>} /> : <>
        <div className="admin-metrics">
          <AdminMetric label="Total movies" value="5" helper="4 currently showing" icon="film" tone="violet" />
          <AdminMetric label="Upcoming shows" value="12" helper="4 scheduled today" icon="calendar" tone="blue" />
          <AdminMetric label="Booked seats" value="306" helper="Across future shows" icon="seat" tone="green" />
          <AdminMetric label="Occupancy" value="72%" helper="+8% vs last week" icon="users" tone="amber" />
          <AdminMetric label="Money collected" value={formatINR(76800)} helper="Confirmed bookings only" icon="ticket" tone="violet" />
        </div>
        <section className="admin-card">
          <div className="admin-card-header"><div><h2>Upcoming shows</h2><p>Seat sales and occupancy across the next scheduled sessions.</p></div><Button variant="outline" onClick={() => navigate("admin-shows")}>View all shows</Button></div>
          <AdminShowsTable navigate={navigate} compact />
        </section>
      </>}
    </AdminLayout>
  );
}

function AdminMetric({ label, value, helper, icon, tone }: { label: string; value: string; helper: string; icon: IconName; tone: string }) {
  return <div className="admin-metric"><div className={`metric-icon metric-${tone}`}><Icon name={icon} size={19} /></div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function AdminState({ icon, title, text, action, tone = "default" }: { icon: IconName; title: string; text: string; action: ReactNode; tone?: "default" | "error" }) {
  return <div className={`admin-empty-state state-${tone}`}><span><Icon name={icon} /></span><h2>{title}</h2><p>{text}</p>{action}</div>;
}

function AdminShowsTable({ navigate, compact = false }: { navigate: (page: CustomerPage) => void; compact?: boolean }) {
  return <div className="admin-table-wrap"><table className="management-table"><thead><tr><th>Movie</th><th>Date & time</th><th>Price</th><th>Booked seats</th><th>Occupancy</th>{!compact && <th>Status</th>}<th /></tr></thead><tbody>{adminShows.map((show) => <tr key={show.id}><td><strong>{show.movie}</strong><small>{show.id}</small></td><td><strong>{show.date}</strong><small>{show.time}</small></td><td>{formatINR(show.price)}</td><td><strong>{show.booked} / 80</strong></td><td><span className="occupancy-cell"><i><b style={{ width: `${(show.booked / 80) * 100}%` }} /></i><strong>{Math.round(show.booked / 80 * 100)}%</strong></span></td>{!compact && <td><Badge tone="blue">{show.status}</Badge></td>}<td><button className="table-action" type="button" onClick={() => navigate("admin-show-detail")}>View <Icon name="chevron-right" size={13} /></button></td></tr>)}</tbody></table></div>;
}

function AdminField({ label, value, onChange, error, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; placeholder?: string }) {
  return <label className="admin-form-field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />{error && <small>{error}</small>}</label>;
}

function MovieForm({ movie, close, saved }: { movie?: typeof adminMovies[number]; close: () => void; saved: (message: string) => void }) {
  const [form, setForm] = useState({ title: movie?.title || "", poster: movie?.image || "", language: movie?.language || "", duration: movie?.duration || "", rating: movie?.rating || "", description: movie ? "A compelling cinematic story created for the Yozigo demonstration catalogue." : "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  const submit = () => {
    setSubmitted(true);
    setError("");
    if (Object.values(form).some((value) => !value.trim())) return;
    if (!movie && form.title.toLowerCase() === "the last horizon") return setError("A movie with this title already exists.");
    if (form.poster.includes("server-error")) return setError("The movie could not be saved. Please try again.");
    saved(movie ? "Movie changes saved successfully." : "Movie added successfully.");
  };
  return <div className="modal-backdrop"><div className="management-modal wide-modal" role="dialog" aria-modal="true"><div className="management-modal-header"><div><span className="eyebrow">{movie ? "EDIT MOVIE" : "NEW MOVIE"}</span><h2>{movie ? movie.title : "Add a movie"}</h2></div><button type="button" onClick={close}><Icon name="x" /></button></div>{error && <div className="form-server-error"><Icon name="x" size={15} />{error}</div>}<div className="management-form-grid"><AdminField label="Movie title *" value={form.title} onChange={(value) => update("title", value)} error={submitted && !form.title ? "Title is required." : undefined} placeholder="e.g. The Last Horizon" /><AdminField label="Poster image URL *" value={form.poster} onChange={(value) => update("poster", value)} error={submitted && !form.poster ? "Poster URL is required." : undefined} placeholder="https://..." /><AdminField label="Language *" value={form.language} onChange={(value) => update("language", value)} error={submitted && !form.language ? "Language is required." : undefined} placeholder="English" /><AdminField label="Duration *" value={form.duration} onChange={(value) => update("duration", value)} error={submitted && !form.duration ? "Duration is required." : undefined} placeholder="2h 18m" /><AdminField label="Rating category *" value={form.rating} onChange={(value) => update("rating", value)} error={submitted && !form.rating ? "Rating is required." : undefined} placeholder="U, UA or A" /><label className="admin-form-field span-full"><span>Description *</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Movie synopsis" />{submitted && !form.description && <small>Description is required.</small>}</label></div><div className="management-modal-actions"><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={submit}>Save Movie</Button></div></div></div>;
}

function MovieManagement({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [formMovie, setFormMovie] = useState<typeof adminMovies[number] | "new" | null>(null);
  const [deleteMovie, setDeleteMovie] = useState<typeof adminMovies[number] | null>(null);
  const [notice, setNotice] = useState("");
  const movies = [...adminMovies].filter((movie) => movie.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  return <AdminLayout page="admin-movies" navigate={navigate} title="Movies"><AdminPageHeading title="Movie management" description="Manage the catalogue available for show scheduling." action={<Button onClick={() => setFormMovie("new")}>Add Movie</Button>} />{notice && <div className="admin-success"><Icon name="check" size={15} />{notice}<button onClick={() => setNotice("")} type="button"><Icon name="x" size={14} /></button></div>}<section className="admin-card"><div className="management-toolbar"><label><Icon name="search" size={16} /><input placeholder="Search movie title" value={query} onChange={(event) => setQuery(event.target.value)} /></label><Button variant="outline" onClick={() => setSortAsc(!sortAsc)}>Title {sortAsc ? "A–Z" : "Z–A"}</Button></div><div className="admin-table-wrap"><table className="management-table movie-management-table"><thead><tr><th>Movie</th><th>Language</th><th>Duration</th><th>Rating</th><th>Shows</th><th>Actions</th></tr></thead><tbody>{movies.map((movie) => <tr key={movie.id}><td><span className="movie-table-title"><img src={movie.image} alt="" /><span><strong>{movie.title}</strong><small>ID MOV-{String(movie.id).padStart(3, "0")}</small></span></span></td><td>{movie.language}</td><td>{movie.duration}</td><td><Badge tone="gray">{movie.rating}</Badge></td><td>{movie.shows}</td><td><span className="row-actions"><button type="button" onClick={() => setFormMovie(movie)}>Edit</button><button className="danger-link" type="button" onClick={() => setDeleteMovie(movie)}>Delete</button></span></td></tr>)}</tbody></table></div></section>{formMovie && <MovieForm movie={formMovie === "new" ? undefined : formMovie} close={() => setFormMovie(null)} saved={(message) => { setNotice(message); setFormMovie(null); }} />}{deleteMovie && <div className="modal-backdrop"><div className="modal">{deleteMovie.shows > 0 ? <><div className="modal-icon"><Icon name="x" /></div><h2>Movie cannot be deleted</h2><p>{deleteMovie.title} is associated with {deleteMovie.shows} scheduled {deleteMovie.shows === 1 ? "show" : "shows"}. Remove or reassign those shows first.</p><div className="modal-actions"><Button onClick={() => setDeleteMovie(null)}>Understood</Button></div></> : <><div className="modal-icon"><Icon name="film" /></div><h2>Delete {deleteMovie.title}?</h2><p>This removes the movie from the catalogue. This action cannot be undone.</p><div className="modal-actions"><Button variant="outline" onClick={() => setDeleteMovie(null)}>Keep movie</Button><Button variant="danger" onClick={() => { setDeleteMovie(null); setNotice("Movie deleted successfully."); }}>Delete movie</Button></div></>}</div></div>}</AdminLayout>;
}

function ShowForm({ show, close, saved }: { show?: typeof adminShows[number]; close: () => void; saved: (message: string) => void }) {
  const [movie, setMovie] = useState(show?.movie || "");
  const [date, setDate] = useState(show ? "2025-05-24" : "");
  const [time, setTime] = useState(show ? "18:30" : "");
  const [price, setPrice] = useState(show ? String(show.price) : "");
  const [submitted, setSubmitted] = useState(false);
  const [conflict, setConflict] = useState("");
  const submit = () => {
    setSubmitted(true);
    setConflict("");
    if (!movie || !date || !time || !price) return;
    if (!show && date === "2025-05-24" && time === "18:30") return setConflict("The single screen is already occupied by The Last Horizon from 6:30 PM to 8:48 PM. Choose a non-overlapping time.");
    saved(show ? "Show changes saved successfully." : "Show added successfully.");
  };
  return <div className="modal-backdrop"><div className="management-modal" role="dialog" aria-modal="true"><div className="management-modal-header"><div><span className="eyebrow">{show ? "EDIT SHOW" : "NEW SHOW"}</span><h2>{show ? `Edit ${show.id}` : "Schedule a show"}</h2></div><button type="button" onClick={close}><Icon name="x" /></button></div>{conflict && <div className="overlap-error"><Icon name="clock" size={17} /><span><strong>Schedule conflict</strong>{conflict}</span></div>}<div className="management-form-grid"><label className="admin-form-field span-full"><span>Movie *</span><select value={movie} onChange={(event) => setMovie(event.target.value)}><option value="">Select a movie</option>{adminMovies.map((item) => <option key={item.id}>{item.title}</option>)}</select>{submitted && !movie && <small>Select a movie.</small>}</label><AdminField label="Show date *" value={date} onChange={setDate} type="date" error={submitted && !date ? "Date is required." : undefined} /><AdminField label="Start time *" value={time} onChange={setTime} type="time" error={submitted && !time ? "Time is required." : undefined} /><AdminField label="Ticket price (₹) *" value={price} onChange={setPrice} type="number" error={submitted && !price ? "Price is required." : undefined} placeholder="250" /></div><div className="management-modal-actions"><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={submit}>Save Show</Button></div></div></div>;
}

function ShowManagement({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const [formShow, setFormShow] = useState<typeof adminShows[number] | "new" | null>(null);
  const [deleteShow, setDeleteShow] = useState<typeof adminShows[number] | null>(null);
  const [notice, setNotice] = useState("");
  return <AdminLayout page="admin-shows" navigate={navigate} title="Shows"><AdminPageHeading title="Show management" description="Schedule the single screen and monitor seat sales." action={<Button onClick={() => setFormShow("new")}>Add Show</Button>} />{notice && <div className="admin-success"><Icon name="check" size={15} />{notice}</div>}<section className="admin-card"><div className="management-toolbar"><label><Icon name="search" size={16} /><input placeholder="Search shows" /></label><Button variant="outline" icon="calendar">Upcoming only</Button></div><AdminShowsTable navigate={navigate} /><div className="show-row-actions-demo"><span>Select a row to inspect bookings and seat inventory.</span>{adminShows.slice(0, 2).map((show) => <span key={show.id}><button type="button" onClick={() => setFormShow(show)}>Edit {show.id}</button><button type="button" onClick={() => setDeleteShow(show)}>Delete</button></span>)}</div></section>{formShow && <ShowForm show={formShow === "new" ? undefined : formShow} close={() => setFormShow(null)} saved={(message) => { setNotice(message); setFormShow(null); }} />}{deleteShow && <div className="modal-backdrop"><div className="modal"><div className="modal-icon"><Icon name="x" /></div><h2>Show cannot be deleted</h2><p>{deleteShow.id} has {deleteShow.bookings} confirmed bookings. Cancel or transfer those bookings before removing the show.</p><div className="modal-actions"><Button onClick={() => setDeleteShow(null)}>Understood</Button></div></div></div>}</AdminLayout>;
}

function AdminBookings({ navigate }: { navigate: (page: CustomerPage) => void }) {
  return <AdminLayout page="admin-bookings" navigate={navigate} title="Bookings"><AdminPageHeading title="Booking management" description="Confirmed customer bookings and successfully collected amounts." /><section className="admin-card"><div className="management-toolbar"><label><Icon name="search" size={16} /><input placeholder="Search reference or customer" /></label><Button variant="outline">Confirmed bookings</Button></div><TablePreview /></section></AdminLayout>;
}

function ShowSeatInventory({ detail = false }: { detail?: boolean }) {
  const rows = "ABCDEFGH".split("");
  const heldIndexes = [8, 27, 51, 64];
  return <div className={`admin-seat-inventory ${detail ? "inventory-detail" : ""}`}><div className="screen-direction"><span>SCREEN THIS WAY</span><i /></div><div className="seat-grid-shell"><div className="seat-column-numbers"><span />{Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>{rows.map((row, rowIndex) => <div className="cinema-seat-row" key={row}><strong>{row}</strong>{Array.from({ length: 10 }, (_, index) => { const id = `${row}${index + 1}`; const seatIndex = rowIndex * 10 + index; const status: SeatStatus = heldIndexes.includes(seatIndex) ? "held-other" : seatIndex < 66 ? "booked" : "available"; return <SeatButton id={id} number={index + 1} status={status} key={id} />; })}</div>)}</div><div className="inventory-legend"><span><i className="available-dot" />Available · 14</span><span><i className="booked-dot" />Booked · 62</span><span><i className="held-dot" />Held · 4</span></div></div>;
}

function SeatInventoryScreen({ navigate }: { navigate: (page: CustomerPage) => void }) {
  return <AdminLayout page="admin-seats" navigate={navigate} title="Seat Inventory"><AdminPageHeading title="Seat inventory" description="A live operational view of seat availability for the selected show." action={<Button variant="outline" onClick={() => navigate("admin-show-detail")}>View booking details</Button>} /><section className="admin-card"><div className="inventory-selector"><div><span>Selected show</span><strong>The Last Horizon · May 24 · 6:30 PM</strong></div><Button variant="outline" onClick={() => navigate("admin-shows")}>Change show</Button></div><ShowSeatInventory /></section></AdminLayout>;
}

function ShowBookingDetails({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const bookings = [{ id: "YZ-2048", name: "Alex Kim", seats: "C4, C5", time: "May 20 · 10:42 AM" }, { id: "YZ-2047", name: "Maya Singh", seats: "B2", time: "May 20 · 9:18 AM" }, { id: "YZ-2045", name: "Jordan Lee", seats: "F7, F8", time: "May 19 · 8:56 PM" }];
  return <AdminLayout page="admin-show-detail" navigate={navigate} title="Show details"><button className="back-link admin-back" type="button" onClick={() => navigate("admin-shows")}><Icon name="arrow-left" size={15} />Back to shows</button><AdminPageHeading title="The Last Horizon · 6:30 PM" description="Saturday, May 24 · Screen 1 · Show SH-051" /><div className="detail-admin-metrics"><AdminMetric label="Booked seats" value="62 / 80" helper="18 seats available" icon="seat" tone="green" /><AdminMetric label="Occupancy" value="78%" helper="Confirmed and held seats" icon="users" tone="amber" /><AdminMetric label="Collected revenue" value={formatINR(15500)} helper="Successful bookings only" icon="ticket" tone="violet" /></div><div className="show-detail-grid"><section className="admin-card"><div className="admin-card-header"><div><h2>Seat map</h2><p>Booked, held and available seats for this show.</p></div></div><ShowSeatInventory detail /></section><section className="admin-card"><div className="admin-card-header"><div><h2>Recent bookings</h2><p>Confirmed customers for this show.</p></div></div><div className="compact-booking-list">{bookings.map((booking) => <div key={booking.id}><div className="avatar">{booking.name.split(" ").map((part) => part[0]).join("")}</div><span><strong>{booking.name}</strong><small>#{booking.id} · {booking.time}</small></span><b>{booking.seats}</b></div>)}</div><Button variant="outline" className="full-width" onClick={() => navigate("admin-bookings")}>View all bookings</Button></section></div></AdminLayout>;
}

function HandoffScreen({ navigate }: { navigate: (page: CustomerPage) => void }) {
  const pageGroups = [
    ["01", "Design System", "Tokens, typography, controls, badges, tables and feedback states"],
    ["02", "Customer Experience", "Authentication, movie discovery, details and My Bookings"],
    ["03", "Seat Selection and Checkout", "80-seat map, hold, payment and confirmation outcomes"],
    ["04", "Admin Portal", "Dashboard, movies, shows, bookings and seat inventory"],
    ["05", "Prototype and Edge Cases", "Loading, empty, errors, expiry, conflicts and access rejection"],
  ];
  return (
    <AdminLayout page="admin-dashboard" navigate={navigate} title="Developer handoff">
      <button className="back-link admin-back" type="button" onClick={() => navigate("admin-dashboard")}><Icon name="arrow-left" size={15} />Back to dashboard</button>
      <AdminPageHeading title="Yozigo product handoff" description="Implementation reference for the demonstration frontend and future API integration." />
      <div className="handoff-grid">
        <section className="admin-card handoff-pages">
          <div className="admin-card-header"><div><h2>Page organization</h2><p>Recommended Figma page and implementation grouping.</p></div></div>
          {pageGroups.map(([number, title, description]) => <div className="handoff-page-row" key={number}><span>{number}</span><div><strong>{title}</strong><small>{description}</small></div></div>)}
        </section>
        <section className="admin-card">
          <div className="admin-card-header"><div><h2>Core tokens</h2><p>Shared across customer and staff experiences.</p></div></div>
          <div className="handoff-tokens">
            <div className="handoff-colors"><span className="token-navy"><i />Navy<strong>#111827</strong></span><span className="token-surface"><i />Surface<strong>#1F2937</strong></span><span className="token-violet"><i />Violet<strong>#7C3AED</strong></span><span className="token-green"><i />Success<strong>#16A34A</strong></span><span className="token-amber"><i />Warning<strong>#F59E0B</strong></span><span className="token-red"><i />Error<strong>#DC2626</strong></span></div>
            <div className="handoff-type"><span>Typography</span><strong>Inter</strong><small>30 / 24 / 18 / 14 / 12px hierarchy</small></div>
            <div className="handoff-type"><span>Spacing</span><strong>8px base unit</strong><small>8 / 16 / 24 / 32 / 40px rhythm</small></div>
            <div className="handoff-type"><span>Shape</span><strong>Medium radius</strong><small>8–14px corners · restrained elevation</small></div>
          </div>
        </section>
        <section className="admin-card span-two handoff-components">
          <div className="admin-card-header"><div><h2>Component variants and interaction states</h2><p>Hover, pressed and keyboard focus are implemented in CSS; disabled and loading variants are shown below.</p></div></div>
          <div className="handoff-button-row"><Button>Default primary</Button><Button variant="outline">Secondary action</Button><Button variant="danger">Destructive</Button><Button disabled>Disabled</Button><Button loading>Loading</Button></div>
          <div className="handoff-state-list">
            <span><Icon name="check" size={14} /><strong>Focus</strong>3px violet focus ring with offset</span>
            <span><Icon name="check" size={14} /><strong>Pressed</strong>1px vertical feedback without layout shift</span>
            <span><Icon name="check" size={14} /><strong>Seat states</strong>Color, symbol, text legend and accessible label</span>
            <span><Icon name="check" size={14} /><strong>Forms</strong>Errors remain adjacent to the relevant field</span>
          </div>
        </section>
        <section className="admin-card span-two">
          <div className="admin-card-header"><div><h2>Intended prototype navigation</h2><p>Seven mandatory flows and major operational branches.</p></div></div>
          <div className="navigation-map">
            <span>Sign Up <i>↔</i> Login</span><span>Movie Home <i>→</i> Details</span><span>Details <i>→</i> Seat Selection</span><span>Seats <i>→</i> Active Hold</span><span>Hold <i>→</i> Demo Payment</span><span>Payment <i>→</i> Success / Failure</span><span>Customer Nav <i>→</i> My Bookings</span><span>Admin <i>→</i> Management screens</span>
          </div>
          <div className="handoff-note"><Icon name="settings" size={16} /><span><strong>Backend boundary</strong>All movie, show, seat, hold, payment and cancellation data is demonstration content. The API remains authoritative for availability, expiry, booking status and collected revenue.</span></div>
        </section>
      </div>
    </AdminLayout>
  );
}

function UnauthorizedScreen({ navigate }: { navigate: (page: CustomerPage) => void }) {
  return (
    <div className="access-state-page">
      <Brand />
      <div className="access-state-card">
        <span className="access-icon"><Icon name="settings" size={25} /></span>
        <span className="eyebrow">ACCESS RESTRICTED</span>
        <h1>Staff authorization required</h1>
        <p>Your current session does not have permission to open the cinema management portal. Sign in with an authorized staff account or return to the customer experience.</p>
        <div><Button onClick={() => navigate("login")}>Return to Staff Login</Button><Button variant="outline" onClick={() => navigate("home")}>Go to Movie Home</Button></div>
      </div>
      <small>Yozigo Cinemas · Unauthorized access demonstration state</small>
    </div>
  );
}

type AdminShow = ApiShow & { movie: ApiMovie };
type AdminBooking = ApiBooking & { user: { name: string } };

function ConnectedAdminPanel({ page, navigate }: { page: AdminPage; navigate: (page: CustomerPage) => void }) {
  const [movies, setMovies] = useState<ApiMovie[]>([]);
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [bookings, setBookings] = useState<Array<{ booking: AdminBooking; show: AdminShow }>>([]);
  const [seats, setSeats] = useState<ApiSeat[]>([]);
  const [summary, setSummary] = useState({ bookedSeats: 0, revenuePaise: 0, confirmedBookings: 0 });
  const [selectedShowId, setSelectedShowId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [movieEditor, setMovieEditor] = useState<ApiMovie | "new" | null>(null);
  const [showEditor, setShowEditor] = useState<AdminShow | "new" | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [movieResult, showResult] = await Promise.all([
        api.get<{ items: ApiMovie[] }>("/admin/movies?limit=100"),
        api.get<{ items: AdminShow[] }>("/admin/shows?limit=100"),
      ]);
      setMovies(movieResult.items); setShows(showResult.items);
      const targetShowId = selectedShowId || showResult.items[0]?.id || "";
      if (targetShowId && page === "admin-seats") {
        const [seatResult, summaryResult] = await Promise.all([
          api.get<{ seats: ApiSeat[] }>(`/shows/${targetShowId}/seats`),
          api.get<typeof summary>(`/admin/shows/${targetShowId}/summary`),
        ]);
        setSeats(seatResult.seats); setSummary(summaryResult); setSelectedShowId(targetShowId);
      }
      if (page === "admin-dashboard" && showResult.items.length) {
        const summaries = await Promise.all(showResult.items.map((show) => api.get<typeof summary>(`/admin/shows/${show.id}/summary`)));
        setSummary(summaries.reduce((all, item) => ({ bookedSeats: all.bookedSeats + item.bookedSeats, revenuePaise: all.revenuePaise + item.revenuePaise, confirmedBookings: all.confirmedBookings + item.confirmedBookings }), { bookedSeats: 0, revenuePaise: 0, confirmedBookings: 0 }));
      }
      if (page === "admin-bookings" || page === "admin-show-detail") {
        const bookingResults = await Promise.all(showResult.items.map(async (show) => {
          const result = await api.get<{ items: AdminBooking[] }>(`/admin/shows/${show.id}/bookings?limit=100`);
          return result.items.map((booking) => ({ booking, show }));
        }));
        const allBookings = bookingResults.flat().sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));
        setBookings(page === "admin-show-detail" && targetShowId ? allBookings.filter((item) => item.show.id === targetShowId) : allBookings);
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [page, selectedShowId]);

  const saveMovie = async (form: { title: string; language: string; durationMinutes: number; rating: "U" | "UA" | "A"; posterUrl: string | null; description: string | null }) => {
    try {
      if (movieEditor === "new") await api.post("/admin/movies", form);
      else if (movieEditor) await api.patch(`/admin/movies/${movieEditor.id}`, form);
      setMovieEditor(null); setNotice("Movie saved to the cinema database."); await load();
    } catch (cause) { setError(errorMessage(cause)); }
  };
  const saveShow = async (form: { movieId: string; startsAt: string; durationMinutes: number; ticketPricePaise: number }) => {
    try {
      if (showEditor === "new") await api.post("/admin/shows", form);
      else if (showEditor) await api.patch(`/admin/shows/${showEditor.id}`, form);
      setShowEditor(null); setNotice("Show schedule saved to the cinema database."); await load();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const title = page === "admin-movies" ? "Movies" : page === "admin-shows" ? "Shows" : page === "admin-bookings" ? "Bookings" : page === "admin-seats" ? "Seat inventory" : page === "admin-show-detail" ? "Show bookings" : "Dashboard";
  return <AdminLayout page={page} navigate={navigate} title={title}>
    <AdminPageHeading title={title === "Dashboard" ? `Welcome, ${signedInUser?.name || "Admin"}` : title} description="Live catalogue, schedules and booking records from PostgreSQL." action={<div className="heading-actions">{page === "admin-movies" && <Button onClick={() => setMovieEditor("new")}>Add Movie</Button>}{page === "admin-shows" && <Button onClick={() => setShowEditor("new")}>Add Show</Button>}</div>} />
    {notice && <div className="admin-success"><Icon name="check" size={15} />{notice}<button type="button" onClick={() => setNotice("")}><Icon name="x" size={14} /></button></div>}
    {error && <div className="form-server-error"><Icon name="x" size={15} />{error}<Button variant="outline" onClick={() => void load()}>Retry</Button></div>}
    {loading ? <div className="listing-empty"><h2>Loading live cinema data…</h2></div> : page === "admin-dashboard" ? <>
      <div className="admin-metrics">
        <AdminMetric label="Movies" value={String(movies.length)} helper="Database catalogue" icon="film" tone="violet" />
        <AdminMetric label="Upcoming shows" value={String(shows.filter((show) => new Date(show.startsAt) > new Date()).length)} helper="From the cinema schedule" icon="calendar" tone="blue" />
        <AdminMetric label="Booked seats" value={String(summary.bookedSeats)} helper="Across scheduled shows" icon="seat" tone="green" />
        <AdminMetric label="Confirmed bookings" value={String(summary.confirmedBookings)} helper="Successful payments" icon="ticket" tone="amber" />
        <AdminMetric label="Money collected" value={inr(summary.revenuePaise)} helper="Confirmed bookings" icon="ticket" tone="violet" />
      </div><section className="admin-card"><AdminPageHeading title="Upcoming shows" description="Current schedule from PostgreSQL." />{renderShowsTable(shows, (id) => { setSelectedShowId(id); navigate("admin-show-detail"); }, (show) => setShowEditor(show))}</section>
    </> : page === "admin-movies" ? <section className="admin-card"><div className="management-toolbar"><label><Icon name="search" size={16} /><input placeholder="Search movie title" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>{renderMoviesTable(movies.filter((movie) => movie.title.toLowerCase().includes(query.toLowerCase())), (movie) => setMovieEditor(movie), async (movie) => { if (window.confirm(`Delete ${movie.title}?`)) { try { await api.delete(`/admin/movies/${movie.id}`); setNotice("Movie deleted."); await load(); } catch (cause) { setError(errorMessage(cause)); } } })}</section>
    : page === "admin-shows" ? <section className="admin-card">{renderShowsTable(shows, (id) => { setSelectedShowId(id); navigate("admin-show-detail"); }, (show) => setShowEditor(show), async (show) => { if (window.confirm(`Delete the show for ${show.movie.title}?`)) { try { await api.delete(`/admin/shows/${show.id}`); setNotice("Show deleted."); await load(); } catch (cause) { setError(errorMessage(cause)); } } })}</section>
    : page === "admin-bookings" || page === "admin-show-detail" ? <section className="admin-card">{bookings.length ? <div className="connected-admin-list">{bookings.map(({ booking: item }) => <article key={item.id}><div><strong>{item.show.movie.title}</strong><small>{item.user.name} · #{item.id.slice(0, 8).toUpperCase()}</small></div><span>{dateLabel(item.show.startsAt, { dateStyle: "medium", timeStyle: "short" })}</span><span>{item.seats.map(({ showSeat }) => `${showSeat.rowLabel}${showSeat.seatNumber}`).join(", ")}</span><strong>{inr(item.totalAmountPaise)} · {item.status}</strong></article>)}</div> : <AdminState icon="ticket" title="No bookings yet" text="Completed customer bookings will appear here." action={<Button onClick={() => navigate("admin-shows")}>View shows</Button>} />}</section>
    : <section className="admin-card"><div className="inventory-selector"><div><span>Selected show</span><select value={selectedShowId || shows[0]?.id || ""} onChange={(event) => setSelectedShowId(event.target.value)}>{shows.map((show) => <option value={show.id} key={show.id}>{show.movie.title} · {dateLabel(show.startsAt, { dateStyle: "medium", timeStyle: "short" })}</option>)}</select></div></div><div className="admin-seat-inventory"><div className="screen-direction"><span>SCREEN THIS WAY</span><i /></div><div className="seat-grid-shell">{[..."ABCDEFGH"].map((row) => <div className="cinema-seat-row" key={row}><strong>{row}</strong>{Array.from({ length: 10 }, (_, index) => { const seat = seats.find((item) => item.rowLabel === row && item.seatNumber === index + 1); const status: SeatStatus = seat?.status === "BOOKED" ? "booked" : seat?.status.startsWith("HELD") ? "held-other" : "available"; return <SeatButton key={index} id={`${row}${index + 1}`} number={index + 1} status={status} />; })}</div>)}</div><div className="inventory-legend"><span>Booked {summary.bookedSeats}</span><span>Available {seats.filter((seat) => seat.status === "AVAILABLE").length}</span></div></div></section>}
    {movieEditor && <ConnectedMovieForm movie={movieEditor === "new" ? undefined : movieEditor} close={() => setMovieEditor(null)} save={saveMovie} />}
    {showEditor && <ConnectedShowForm show={showEditor === "new" ? undefined : showEditor} movies={movies} close={() => setShowEditor(null)} save={saveShow} />}
  </AdminLayout>;
}

function renderMoviesTable(movies: ApiMovie[], edit: (movie: ApiMovie) => void, remove: (movie: ApiMovie) => void) {
  return <div className="admin-table-wrap"><table className="management-table movie-management-table"><thead><tr><th>Movie</th><th>Language</th><th>Duration</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{movies.map((movie) => <tr key={movie.id}><td><strong>{movie.title}</strong></td><td>{movie.language}</td><td>{movie.durationMinutes} min</td><td>{movie.rating}</td><td><span className="row-actions"><button type="button" onClick={() => edit(movie)}>Edit</button><button type="button" className="danger-link" onClick={() => remove(movie)}>Delete</button></span></td></tr>)}</tbody></table></div>;
}
function renderShowsTable(shows: AdminShow[], view: (id: string) => void, edit: (show: AdminShow) => void, remove?: (show: AdminShow) => void) {
  return <div className="admin-table-wrap"><table className="management-table"><thead><tr><th>Movie</th><th>Date & time</th><th>Price</th><th>Available</th><th>Actions</th></tr></thead><tbody>{shows.map((show) => <tr key={show.id}><td><strong>{show.movie.title}</strong></td><td>{dateLabel(show.startsAt, { dateStyle: "medium", timeStyle: "short" })}</td><td>{inr(show.ticketPricePaise)}</td><td>{show.remainingSeats} / {show.totalSeats}</td><td><span className="row-actions"><button type="button" onClick={() => view(show.id)}>Bookings</button><button type="button" onClick={() => edit(show)}>Edit</button>{remove && <button type="button" className="danger-link" onClick={() => remove(show)}>Delete</button>}</span></td></tr>)}</tbody></table></div>;
}

function ConnectedMovieForm({ movie, close, save }: { movie?: ApiMovie; close: () => void; save: (form: { title: string; language: string; durationMinutes: number; rating: "U" | "UA" | "A"; posterUrl: string | null; description: string | null }) => void }) {
  const [title, setTitle] = useState(movie?.title || ""); const [language, setLanguage] = useState(movie?.language || ""); const [duration, setDuration] = useState(String(movie?.durationMinutes || 120)); const [rating, setRating] = useState<ApiMovie["rating"]>(movie?.rating || "UA"); const [poster, setPoster] = useState(movie?.posterUrl || ""); const [description, setDescription] = useState(movie?.description || "");
  return <div className="modal-backdrop"><div className="management-modal wide-modal"><div className="management-modal-header"><div><span className="eyebrow">{movie ? "EDIT MOVIE" : "NEW MOVIE"}</span><h2>{movie ? movie.title : "Add a movie"}</h2></div><button type="button" onClick={close}><Icon name="x" /></button></div><div className="management-form-grid"><AdminField label="Title" value={title} onChange={setTitle} /><AdminField label="Language" value={language} onChange={setLanguage} /><AdminField label="Duration (minutes)" value={duration} onChange={setDuration} type="number" /><label className="admin-form-field"><span>Rating</span><select value={rating} onChange={(event) => setRating(event.target.value as ApiMovie["rating"])}><option>U</option><option>UA</option><option>A</option></select></label><AdminField label="Poster URL" value={poster} onChange={setPoster} /><AdminField label="Description" value={description} onChange={setDescription} /></div><div className="management-modal-actions"><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!title.trim() || !language.trim()} onClick={() => save({ title: title.trim(), language: language.trim(), durationMinutes: Number(duration), rating, posterUrl: poster.trim() || null, description: description.trim() || null })}>Save movie</Button></div></div></div>;
}
function ConnectedShowForm({ show, movies, close, save }: { show?: AdminShow; movies: ApiMovie[]; close: () => void; save: (form: { movieId: string; startsAt: string; durationMinutes: number; ticketPricePaise: number }) => void }) {
  const [movieId, setMovieId] = useState(show?.movieId || movies[0]?.id || ""); const [startsAt, setStartsAt] = useState(show ? new Date(new Date(show.startsAt).getTime() - new Date(show.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""); const [price, setPrice] = useState(String(show ? show.ticketPricePaise / 100 : 250));
  const selectedMovie = movies.find((movie) => movie.id === movieId);
  return <div className="modal-backdrop"><div className="management-modal"><div className="management-modal-header"><div><span className="eyebrow">{show ? "EDIT SHOW" : "NEW SHOW"}</span><h2>Schedule a show</h2></div><button type="button" onClick={close}><Icon name="x" /></button></div><div className="management-form-grid"><label className="admin-form-field span-full"><span>Movie</span><select value={movieId} onChange={(event) => setMovieId(event.target.value)}>{movies.map((movie) => <option value={movie.id} key={movie.id}>{movie.title}</option>)}</select></label><AdminField label="Show date and time" type="datetime-local" value={startsAt} onChange={setStartsAt} /><AdminField label="Ticket price (₹)" type="number" value={price} onChange={setPrice} /></div><div className="management-modal-actions"><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!movieId || !startsAt || Number(price) <= 0} onClick={() => save({ movieId, startsAt: new Date(startsAt).toISOString(), durationMinutes: selectedMovie?.durationMinutes || 120, ticketPricePaise: Math.round(Number(price) * 100) })}>Save show</Button></div></div></div>;
}

export default function App() {
  const [page, setPage] = useState<CustomerPage>("signup");
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedShow, setSelectedShow] = useState<ShowSelection | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<MovieView | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hold, setHold] = useState<{ id: string; expiresAt: string } | null>(null);
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        await getCsrf();
        const user = await api.get<ApiUser>("/auth/me");
        setSession(user);
        setPage(user.role === "ADMIN" ? "admin-dashboard" : "home");
      } catch {
        setSession(null);
      } finally {
        authChanged();
        setAuthLoading(false);
      }
    })();
  }, []);
  const toggleWatchlist = () => { if (!selectedMovie) return; setWatchlist((items) => items.includes(selectedMovie.id) ? items.filter((id) => id !== selectedMovie.id) : [...items, selectedMovie.id]); };
  const navigate = (nextPage: CustomerPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const completePayment = async (outcome: "SUCCESS" | "FAILURE") => {
    if (!hold) { setPaymentError("Your seat hold is missing. Return to seat selection and try again."); return; }
    setPaying(true);
    setPaymentError("");
    try {
      const result = await api.post<{ outcome: string; booking: ApiBooking | null }>(`/holds/${hold.id}/payment`, { outcome });
      setBooking(result.booking);
      navigate(outcome === "SUCCESS" && result.booking ? "success" : "failure");
    } catch (error) { setPaymentError(errorMessage(error)); }
    finally { setPaying(false); }
  };

  if (authLoading) return <div className="listing-empty"><h2>Connecting to Yozigo…</h2></div>;

  if (page === "signup" || page === "login") return <AuthScreen mode={page} navigate={navigate} />;
  if (page.startsWith("admin-") && signedInUser?.role !== "ADMIN") return <UnauthorizedScreen navigate={navigate} />;
  if (page === "details" && selectedMovie) return <DetailsScreen navigate={navigate} selectMovie={setSelectedMovie} selectShow={setSelectedShow} movie={selectedMovie} saved={watchlist.includes(selectedMovie.id)} toggleSaved={toggleWatchlist} />;
  if (page === "seats" && selectedShow) return <SeatSelectionScreen navigate={navigate} selectedSeats={selectedSeats} setSelectedSeats={setSelectedSeats} show={selectedShow} onHoldCreated={(value) => setHold(value)} />;
  if (page === "checkout" && selectedShow && hold) return <CheckoutScreen navigate={navigate} seats={selectedSeats} show={selectedShow} hold={hold} onExpire={() => { void api.delete(`/holds/${hold.id}`).catch(() => undefined); setHold(null); navigate("expired"); }} />;
  if (page === "payment" && selectedShow) return <PaymentScreen navigate={navigate} seats={selectedSeats} show={selectedShow} onPay={(outcome) => void completePayment(outcome)} paying={paying} error={paymentError} />;
  if ((page === "success" || page === "failure" || page === "expired") && selectedShow) return <ResultScreen result={page} navigate={navigate} seats={selectedSeats} show={selectedShow} booking={booking} />;
  if (page === "bookings") return <MyBookingsScreen navigate={navigate} />;
  if (page.startsWith("admin-")) return <ConnectedAdminPanel page={page as AdminPage} navigate={navigate} />;
  if (page === "handoff") return <HandoffScreen navigate={navigate} />;
  if (page === "unauthorized") return <UnauthorizedScreen navigate={navigate} />;
  return <HomeScreen navigate={navigate} selectMovie={setSelectedMovie} />;
}
