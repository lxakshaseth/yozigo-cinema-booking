import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';

const webPort = process.env.YOZIGO_WEB_PORT || '5173';
const gatewayPort = process.env.YOZIGO_API_PORT || process.env.YOZIGO_GATEWAY_PORT || '4000';
const identityPort = process.env.YOZIGO_IDENTITY_PORT || '4101';
const cinemaPort = process.env.YOZIGO_CINEMA_PORT || '4102';
if (!/^\d{1,5}$/.test(webPort) || Number(webPort) < 1 || Number(webPort) > 65535) {
  throw new Error('YOZIGO_WEB_PORT must be a valid TCP port');
}
for (const [name, port] of [['YOZIGO_API_PORT', gatewayPort], ['YOZIGO_IDENTITY_PORT', identityPort], ['YOZIGO_CINEMA_PORT', cinemaPort]]) {
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error(`${name} must be a valid TCP port`);
}
if (new Set([webPort, gatewayPort, identityPort, cinemaPort]).size !== 4) throw new Error('Web, gateway and service ports must be different');
function databaseUrl(name, envName) {
  if (process.env[envName]) return process.env[envName];
  if (!process.env.DATABASE_URL) throw new Error(`Set ${envName} or DATABASE_URL in .env`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  return url.toString();
}
const baseEnv = { ...process.env, FRONTEND_ORIGIN: `http://localhost:${webPort}` };
const identityEnv = { ...baseEnv, PORT: identityPort, DATABASE_URL: databaseUrl('yozigo_identity', 'IDENTITY_DATABASE_URL') };
const cinemaEnv = { ...baseEnv, PORT: cinemaPort, DATABASE_URL: databaseUrl('yozigo_cinema', 'CINEMA_DATABASE_URL'), YOZIGO_CINEMA_SERVICE: '1' };
const gatewayEnv = { ...baseEnv, PORT: gatewayPort, DATABASE_URL: process.env.DATABASE_URL || identityEnv.DATABASE_URL, IDENTITY_SERVICE_URL: `http://127.0.0.1:${identityPort}`, CINEMA_SERVICE_URL: `http://127.0.0.1:${cinemaPort}` };
const webEnv = { ...process.env, YOZIGO_API_PORT: gatewayPort };
const jobs = [
  { cwd: process.cwd(), args: ['run', 'dev:identity'], env: identityEnv },
  { cwd: process.cwd(), args: ['run', 'dev:cinema'], env: cinemaEnv },
  { cwd: process.cwd(), args: ['run', 'dev:gateway'], env: gatewayEnv },
  { cwd: new URL('../web/', import.meta.url), args: ['run', 'dev', '--', '--port', webPort], env: webEnv },
];
const children = jobs.map(({ cwd, args, env }) => spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args, {
  cwd,
  env,
  stdio: 'inherit',
}));

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => { console.error(`Could not start development process: ${error.message}`); stop(1); });
  child.on('exit', (code) => { if (!stopping && code !== 0) stop(code || 1); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
