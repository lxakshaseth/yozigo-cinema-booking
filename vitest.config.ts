import 'dotenv/config';
import { defineConfig } from 'vitest/config';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a dedicated database ending in _test');
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ??= 'test-only-session-secret-at-least-32-characters';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], fileParallelism: false, testTimeout: 20000, hookTimeout: 30000, pool: 'forks', maxWorkers: 1 } });
