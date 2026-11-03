// AcademiaOS server (Express + MongoDB).

import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';
import { HttpError } from './errors.ts';
import { makeLimiters, mountRoutes } from './http.ts';
import './routes.ts';
import './routesSuper.ts';
import { Store } from './store.ts';

export interface Settings {
  mongodbUri: string;
  mongodbDb: string;
  distDir: string;
}

/**
 * A MongoDB Atlas address (mongodb+srv://...) is looked up by DNS. On some computers the DNS server that Node is given
 * (for example 127.0.0.1) does not answer that kind of question (the error is "querySrv ECONNREFUSED"), while Python and the
 * browser work. Then the public DNS servers are used for the lookup. DNS_SERVERS=1.1.1.1,8.8.8.8 chooses them by hand.
 */
async function prepareDns(uri: string): Promise<void> {
  if (!uri.startsWith('mongodb+srv://')) return;
  const host = uri.slice('mongodb+srv://'.length).replace(/^[^@]*@/, '').split(/[/?]/)[0];
  const lookup = () => dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  const chosen = (process.env.DNS_SERVERS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (chosen.length) {
    dns.setServers(chosen);
    return;
  }
  try {
    await lookup();
  } catch {
    dns.setServers(['8.8.8.8', '1.1.1.1']); // the system DNS cannot answer: ask a public one instead
  }
}

/** Opens the MongoDB database named in the settings. */
export async function connect(cfg: Settings): Promise<{ db: Db; client: MongoClient }> {
  if (!cfg.mongodbUri) throw new Error('MONGODB_URI is not set. Put it in server_node/.env (see .env.example).');
  await prepareDns(cfg.mongodbUri);
  const client = new MongoClient(cfg.mongodbUri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  await client.db('admin').command({ ping: 1 }); // fails early with a clear error when the database cannot be reached
  return { db: client.db(cfg.mongodbDb), client };
}

/** `db` is a MongoDB Db (tests pass one of an in-memory server). Returns the app and its root store. */
export async function createApp(db: Db, distDir: string) {
  const root = new Store(db);
  await root.ensureIndexes();
  await root.migrateToCoachings(); // data from before the coachings belongs to the first one
  await root.moveInlinePhotos(); // older data keeps photos inside the records
  const limiters = makeLimiters();

  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY'); // nobody can show the app inside another website
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.raw({ type: () => true, limit: '100mb' }));

  mountRoutes(app, { root, limiters });

  // The built app (after npm run build): the server shows it too
  const dist = path.resolve(distDir);
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      res.status(404).json({ error: 'Not found. Run "npm run build" to let this server show the app.' });
      return;
    }
    let rel = '';
    try {
      rel = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      rel = '';
    }
    const target = path.resolve(dist, rel);
    const inside = target === dist || target.startsWith(dist + path.sep);
    if (rel && inside && fs.existsSync(target) && fs.statSync(target).isFile()) {
      const immutable = rel.startsWith('assets/');
      res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.sendFile(target, { cacheControl: false });
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'), { cacheControl: false });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err?.type === 'entity.too.large' || err?.status === 413) {
      res.status(413).json({ error: 'Request is too large.' });
    } else if (typeof err?.name === 'string' && err.name.startsWith('Mongo')) {
      console.error('MongoDB problem:', err.message);
      res.status(503).json({ error: 'The database is not reachable right now. Please try again in a moment.' });
    } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: err.message || 'Bad request.' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return { app, root, limiters };
}
