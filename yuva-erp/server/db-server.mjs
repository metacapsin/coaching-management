// AcademiaOS server. No API key and no extra packages needed, only Node.js 18 or newer.
//
//   npm run server            starts the API on http://localhost:3001
//   npm run build && npm run server   the same server also shows the app (one process, one address)
//
// What it does
//   - keeps accounts, institute data, sessions and the activity log in server/data/db.json
//   - signs people in with a password (stored with scrypt) and a session token
//   - sends every account only the data its role may see, and accepts only the changes it may make
//   - blocks guessing of passwords (5 wrong tries lock that account + address for 15 minutes)
//
// Settings (optional environment variables)
//   DB_PORT  port, default 3001
//   DB_HOST  address to listen on, default 0.0.0.0 (all computers in the network)
//   DB_DIR   folder for db.json, default server/data
//   DIST_DIR folder of the built app, default ../dist

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from './lib/store.mjs';
import { createRoutes } from './lib/routes.mjs';
import { userForToken } from './lib/auth.mjs';
import { HttpError, bearerToken, clientIp, readJson, sendJson } from './lib/http.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DB_PORT || 3001);
const HOST = process.env.DB_HOST || '0.0.0.0';
const DATA_DIR = process.env.DB_DIR || path.join(here, 'data');
const DIST_DIR = process.env.DIST_DIR || path.join(here, '..', 'dist');

const SMALL_BODY = 256 * 1024;
const INSTITUTE_BODY = 100 * 1024 * 1024; // student photos are stored inside the data

const store = createStore(DATA_DIR);
const routes = createRoutes(store).map(r => ({
  ...r,
  keys: [...r.pattern.matchAll(/:(\w+)/g)].map(m => m[1]),
  regex: new RegExp(`^${r.pattern.replace(/:(\w+)/g, '([^/]+)')}$`)
}));

// ---------- the app itself (after npm run build) ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'
};

const serveStatic = (req, res, pathname) => {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    sendJson(res, 404, { error: 'Not found. Run "npm run build" to let this server show the app.' });
    return;
  }
  let file = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(path.normalize(DIST_DIR))) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST_DIR, 'index.html');

  const ext = path.extname(file).toLowerCase();
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(res);
};

// ---------- requests ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (!pathname.startsWith('/api')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, pathname);
    }

    let matched = null;
    let params = {};
    let pathExists = false;
    for (const r of routes) {
      const m = pathname.match(r.regex);
      if (!m) continue;
      pathExists = true;
      if (r.method !== req.method) continue;
      matched = r;
      params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      break;
    }
    if (!matched) return sendJson(res, pathExists ? 405 : 404, { error: pathExists ? 'Method not allowed' : 'Not found' });

    const token = bearerToken(req);
    let user = null;
    if (matched.access !== 'public') {
      user = userForToken(store.state, token);
      if (!user) throw new HttpError(401, 'Please sign in.');
      if (matched.access === 'admin' && user.role !== 'admin') {
        throw new HttpError(403, 'Only the principal (administrator) can do this.');
      }
      if (matched.access === 'manager' && user.role !== 'admin' && user.role !== 'staff') {
        throw new HttpError(403, 'You do not have access to this.');
      }
    }

    const hasBody = req.method === 'POST' || req.method === 'PUT';
    const body = hasBody ? await readJson(req, pathname === '/api/institute' ? INSTITUTE_BODY : SMALL_BODY) : {};

    const result = await matched.handler({ req, body, params, query: url.searchParams, user, token, ip: clientIp(req) });
    return sendJson(res, 200, result);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    return sendJson(res, status, { error: status === 500 ? 'Server error.' : err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AcademiaOS server running on http://${HOST}:${PORT}`);
  console.log(`Data file: ${store.dbFile}`);
  if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) console.log(`App: open http://localhost:${PORT}`);
});

// Save any pending change before the process stops
const shutdown = () => {
  store.flushSync();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
