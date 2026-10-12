import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from '../../src/config.js';
import { db, closeDatabase } from '../../src/db.js';
import { errorHandler } from '../../src/middleware/errors.js';
import { requireGateway } from '../../src/middleware/service-context.js';
import { apiRouter } from '../../src/routes/api.js';
import { adminRouter } from '../../src/routes/admin.js';
import { openapi } from '../../src/openapi.js';

export function createCinemaApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ service: 'cinema', status: 'ok' }); });
  app.use('/api', requireGateway);
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}

const server = createCinemaApp().listen(config.PORT, process.env.SERVICE_BIND_HOST || '127.0.0.1', () => console.log(`Cinema service listening on port ${config.PORT}`));
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(async () => { await closeDatabase(); clearTimeout(timeout); process.exit(0); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
