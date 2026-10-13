import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, sessionPool } from './db.js';
const server = createApp().listen(config.PORT, () => console.log(`Yozigo API listening on port ${config.PORT}`));
const cleanup = setInterval(() => { void sessionPool.query('DELETE FROM session WHERE expire < now()').catch(() => console.error('Session cleanup failed')); }, 3600000);
cleanup.unref();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true; clearInterval(cleanup);
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(async () => { await closeDatabase(); clearTimeout(timeout); process.exit(0); });
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
