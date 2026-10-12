import { spawn, spawnSync } from 'node:child_process';

const webPort = process.env.YOZIGO_WEB_PORT || '5173';
const apiPort = process.env.YOZIGO_API_PORT || '4000';
if (!/^\d{1,5}$/.test(webPort) || Number(webPort) < 1 || Number(webPort) > 65535) {
  throw new Error('YOZIGO_WEB_PORT must be a valid TCP port');
}
if (!/^\d{1,5}$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535) {
  throw new Error('YOZIGO_API_PORT must be a valid TCP port');
}
const apiEnv = { ...process.env, PORT: apiPort };
const webEnv = { ...process.env, YOZIGO_API_PORT: apiPort };
if (process.env.YOZIGO_WEB_PORT) apiEnv.FRONTEND_ORIGIN = `http://localhost:${webPort}`;
const jobs = [
  { cwd: process.cwd(), args: ['run', 'dev:api'], env: apiEnv },
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
