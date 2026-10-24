// npm run dev:all   the server (Flask + MongoDB) and the app (Vite) together; Ctrl+C stops both.
// npm run server    only the server.
// npm test          the tests of the server (an in-memory database is used, no MongoDB needed).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server_py');
const serverOnly = process.argv.includes('--server-only');

// The virtual environment of server_py (see README), else the python on the PATH
const python =
  [path.join(serverDir, '.venv', 'Scripts', 'python.exe'), path.join(serverDir, '.venv', 'bin', 'python')].find(file =>
    fs.existsSync(file)
  ) || 'python';

let children = [];
let stopping = false;

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}

const run = (name, command, args, cwd = root) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  child.on('exit', code => {
    console.log(`${name} stopped (${code ?? 'signal'})`);
    stopAll();
  });
  return child;
};

if (process.argv.includes('--test')) {
  const test = spawn(python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], { cwd: serverDir, stdio: 'inherit' });
  test.on('exit', code => process.exit(code ?? 1));
} else {
  children = [run('server (Flask + MongoDB)', python, ['run.py'], serverDir)];
  if (!serverOnly) {
    // --strictPort: if port 3000 is taken Vite stops, instead of moving to a port where /api would reach another server
    children.push(run('app', process.execPath, ['node_modules/vite/bin/vite.js', '--port=3000', '--strictPort', '--host=0.0.0.0']));
  }
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
}
