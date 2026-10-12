import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['dist/src/server.js'], { env: { ...process.env, PORT: '4017' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output=''; child.stdout.on('data', x => { output += x; }); child.stderr.on('data', x => { output += x; });
try {
  const deadline = Date.now() + 10000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Server exited: ' + output);
    try { response = await fetch('http://127.0.0.1:4017/api/health'); if(response.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!response?.ok) throw new Error('Built server failed to become ready: ' + output);
  console.log('Built server health:', await response.text());
} finally { child.kill(); }
