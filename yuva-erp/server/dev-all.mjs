// npm run dev:all       starts the Node server and the app (Vite) together, and stops both with Ctrl+C.
// npm run dev:all:py    the same, but with the Flask + MongoDB server (server_py) instead of the Node server.
// npm run server:py     only the Flask + MongoDB server.
// npm run test:py       the tests of the Flask server.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const usePython = process.argv.includes('--py');
const serverOnly = process.argv.includes('--server-only');

// The virtual environment made for server_py (see server_py/README in the main README), else the python on the PATH
const venvPython = [
  path.join(root, 'server_py', '.venv', 'Scripts', 'python.exe'),
  path.join(root, 'server_py', '.venv', 'bin', 'python')
].find(file => fs.existsSync(file));

const run = (name, command, args, cwd = root) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  child.on('exit', code => {
    console.log(`${name} stopped (${code ?? 'signal'})`);
    stopAll();
  });
  return child;
};

let children = [];
let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}

if (process.argv.includes('--py-test')) {
  // npm run test:py   the tests of the Flask server (in-memory database, no MongoDB needed)
  const test = spawn(venvPython || 'python', ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], {
    cwd: path.join(root, 'server_py'),
    stdio: 'inherit'
  });
  test.on('exit', code => process.exit(code ?? 1));
} else {
  children = [
    usePython
      ? run('server (Flask + MongoDB)', venvPython || 'python', ['run.py'], path.join(root, 'server_py'))
      : run('server', process.execPath, ['server/db-server.mjs'])
  ];
  if (!serverOnly) {
    children.push(run('app', process.execPath, ['node_modules/vite/bin/vite.js', '--port=3000', '--host=0.0.0.0']));
  }
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
}
