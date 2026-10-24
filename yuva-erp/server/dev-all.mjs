// npm run dev:all  starts the server and the app (Vite) together, and stops both with Ctrl+C.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const run = (name, args) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  child.on('exit', code => {
    console.log(`${name} stopped (${code ?? 'signal'})`);
    stopAll();
  });
  return child;
};

const children = [
  run('server', ['server/db-server.mjs']),
  run('app', ['node_modules/vite/bin/vite.js', '--port=3000', '--host=0.0.0.0'])
];

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
