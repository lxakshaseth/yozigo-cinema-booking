import { spawn, spawnSync } from 'node:child_process';

const jobs = [
  { cwd: process.cwd(), command: 'npm run dev:api' },
  { cwd: new URL('../web/', import.meta.url), command: 'npm run dev' },
];
const children = jobs.map(({ cwd, command }) => spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', command] : command.split(' ').slice(1), {
  cwd,
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
