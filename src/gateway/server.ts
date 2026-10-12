import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { openapi } from '../openapi.js';

type User = { id: string; name: string; email: string; role: 'CUSTOMER' | 'ADMIN' };
type SessionInfo = { user: User; csrfToken: string | null };
const identityUrl = (process.env.IDENTITY_SERVICE_URL || 'http://127.0.0.1:4101').replace(/\/$/, '');
const cinemaUrl = (process.env.CINEMA_SERVICE_URL || 'http://127.0.0.1:4102').replace(/\/$/, '');
const blockedHeaders = new Set(['connection', 'content-encoding', 'content-length', 'host', 'keep-alive', 'transfer-encoding', 'upgrade', 'accept-encoding']);

function error(res: express.Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

async function sessionFor(req: Request): Promise<SessionInfo | null> {
  const cookie = req.get('cookie');
  if (!cookie?.includes('yozigo.sid=')) return null;
  const response = await fetch(`${identityUrl}/internal/session`, {
    headers: { cookie, 'x-yozigo-service-token': config.INTERNAL_SERVICE_TOKEN },
    signal: AbortSignal.timeout(4000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Identity service returned ${response.status}`);
  return response.json() as Promise<SessionInfo>;
}

async function userNames(userIds: string[]) {
  if (!userIds.length) return new Map<string, User>();
  const response = await fetch(`${identityUrl}/internal/users/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-yozigo-service-token': config.INTERNAL_SERVICE_TOKEN },
    body: JSON.stringify({ userIds }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Identity service returned ${response.status}`);
  const data = await response.json() as { items: User[] };
  return new Map(data.items.map(user => [user.id, user]));
}

async function proxy(req: Request, res: express.Response, target: string, session: SessionInfo | null) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (blockedHeaders.has(key.toLowerCase()) || value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-yozigo-service-token', config.INTERNAL_SERVICE_TOKEN);
  if (target === cinemaUrl) headers.delete('cookie');
  headers.delete('x-yozigo-user-id');
  headers.delete('x-yozigo-user-role');
  if (session?.user) {
    headers.set('x-yozigo-user-id', session.user.id);
    headers.set('x-yozigo-user-role', session.user.role);
  }
  const targetUrl = `${target}${req.originalUrl}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
  });
  const responseHeaders = response.headers;
  responseHeaders.forEach((value, name) => {
    if (!blockedHeaders.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') res.setHeader(name, value);
  });
  const cookies = responseHeaders.getSetCookie?.() ?? [];
  if (cookies.length) res.setHeader('set-cookie', cookies);
  res.status(response.status);
  if (response.status === 204 || response.status === 304) { res.end(); return; }
  let body = Buffer.from(await response.arrayBuffer());
  const pathname = req.originalUrl.split('?')[0] ?? '';
  if (target === cinemaUrl && response.ok && /^\/api\/admin\/shows\/[^/]+\/bookings\/?$/.test(pathname)) {
    const data = JSON.parse(body.toString('utf8')) as { items?: Array<{ userId: string; user?: { name: string } }> };
    if (data.items?.length) {
      const users = await userNames([...new Set(data.items.map(item => item.userId))]);
      data.items = data.items.map(item => ({ ...item, user: { name: users.get(item.userId)?.name ?? 'Unknown customer' } }));
      body = Buffer.from(JSON.stringify(data));
    }
  }
  res.setHeader('content-length', String(body.length));
  res.end(body);
}

export function createGatewayApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true, allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
  app.use(express.json({ limit: '16kb' }));
  app.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } }));
  app.get('/api/health', async (_req, res) => {
    try {
      const [identity, cinema] = await Promise.all([
        fetch(`${identityUrl}/health`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${cinemaUrl}/health`, { signal: AbortSignal.timeout(3000) }),
      ]);
      const healthy = identity.ok && cinema.ok;
      res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', services: { identity: identity.ok, cinema: cinema.ok } });
    } catch {
      res.status(503).json({ status: 'degraded', services: { identity: false, cinema: false } });
    }
  });
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api', async (req, res) => {
    const pathname = req.originalUrl.split('?')[0] ?? '';
    const authRoute = pathname === '/api/auth' || pathname.startsWith('/api/auth/');
    try {
      let session: SessionInfo | null = null;
      if (!authRoute) session = await sessionFor(req);
      if (!authRoute && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin && origin !== config.FRONTEND_ORIGIN) return error(res, 403, 'CSRF_REJECTED', 'Origin is not allowed');
        const supplied = req.get('x-csrf-token') ?? '';
        const expected = session?.csrfToken ?? '';
        if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
          return error(res, 403, 'CSRF_REJECTED', 'A valid CSRF token is required');
        }
      }
      await proxy(req, res, authRoute ? identityUrl : cinemaUrl, session);
    } catch (err) {
      console.error('Gateway request failed', err instanceof Error ? err.name : 'UnknownError');
      error(res, 503, 'SERVICE_UNAVAILABLE', 'A Yozigo service is temporarily unavailable');
    }
  });

  const webDist = fileURLToPath(new URL('../../../web/dist', import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false }));
    app.get(/.*/, (req, res, next) => {
      if (req.accepts('html')) res.sendFile(join(webDist, 'index.html'), err => { if (err) next(err); });
      else next();
    });
  }
  app.use((_req, res) => error(res, 404, 'NOT_FOUND', 'Route not found'));
  return app;
}

const server = createGatewayApp().listen(config.PORT, process.env.GATEWAY_BIND_HOST || '127.0.0.1', () => console.log(`Yozigo API gateway listening on port ${config.PORT}`));
server.requestTimeout = 15000;
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
