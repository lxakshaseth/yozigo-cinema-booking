import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../../src/config.js';
import { db, sessionPool, closeDatabase } from '../../src/db.js';
import { csrf, loadUser, publicUser } from '../../src/middleware/auth.js';
import { errorHandler, fail } from '../../src/middleware/errors.js';
import { requireGateway } from '../../src/middleware/service-context.js';
import { authRouter } from '../../src/routes/auth.js';

export function createIdentityApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  const Store = connectPgSimple(session);
  app.use(session({
    name: 'yozigo.sid',
    store: new Store({ pool: sessionPool, tableName: 'session', createTableIfMissing: false, pruneSessionInterval: false }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', maxAge: 86400000 },
  }));
  app.get('/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ service: 'identity', status: 'ok' }); });

  app.use('/internal', requireGateway);
  app.get('/internal/session', loadUser, (req, res) => {
    if (!req.user) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue');
    res.json({ user: req.user, csrfToken: req.session.csrfToken ?? null });
  });
  app.post('/internal/users/batch', async (req, res) => {
    const ids = z.array(z.string().uuid()).max(100).parse(req.body.userIds);
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: publicUser });
    res.json({ items: users });
  });

  app.get('/api/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ service: 'identity', status: 'ok' }); });
  app.use('/api', requireGateway, loadUser, csrf);
  app.use('/api/auth', authRouter);
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}

const server = createIdentityApp().listen(config.PORT, process.env.SERVICE_BIND_HOST || '127.0.0.1', () => console.log(`Identity service listening on port ${config.PORT}`));
const cleanup = setInterval(() => { void sessionPool.query('DELETE FROM session WHERE expire < now()').catch(() => console.error('Session cleanup failed')); }, 3600000);
cleanup.unref();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true; clearInterval(cleanup);
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(async () => { await closeDatabase(); clearTimeout(timeout); process.exit(0); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
