import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Read-only benchmark against the supplied checkout (default: current directory).
// Build first: pnpm build. Run: node scripts/benchmark-browser.mjs [checkout]
const cwd = resolve(process.argv[2] ?? process.cwd());
const entry = fileURLToPath(new URL('../apps/cli/dist/main.js', import.meta.url));
const start = performance.now();
const child = spawn(process.execPath, [entry, 'browser'], {
  cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');
try {
  const url = await new Promise((resolve, reject) => {
    let output = ''; let errors = '';
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 30000);
    child.stdout.on('data', data => {
      output += data;
      if (output.includes('\n')) { clearTimeout(timer); resolve(output.trim()); }
    });
    child.stderr.on('data', data => { errors += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(errors || 'Server exited')); });
  });
  const startupMs = performance.now() - start;
  const session = await (await fetch(new URL('/api/v1/session', url))).json();
  const requests = [];
  for (let index = 0; index < 4; index++) {
    const began = performance.now();
    const response = await fetch(new URL('/api/v1/project', url), { headers: { 'X-Tryce-Session': session.sessionId } });
    const data = await response.json();
    if (!response.ok || !data.brief?.ok) throw new Error(JSON.stringify(data));
    requests.push({ kind: index ? 'unchanged' : 'first', ms: Math.round(performance.now() - began),
      observation: data.brief.report.observation.id, requirements: data.requirements.data?.length });
  }
  console.log(JSON.stringify({ checkout: cwd, node: process.version, platform: process.platform,
    startupMs: Math.round(startupMs), requests }, null, 2));
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
}
