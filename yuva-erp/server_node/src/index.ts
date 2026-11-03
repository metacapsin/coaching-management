// node server_node/src/index.ts   starts the server on http://localhost:3001 (the same address the Python server used).

import fs from 'node:fs';
import { createApp, connect } from './app.ts';
import { settings } from './config.ts';
import { startDailySnapshots } from './scheduler.ts';

async function main(): Promise<void> {
  const cfg = settings();
  let connection;
  try {
    connection = await connect(cfg);
  } catch (err) {
    console.log('Could not start: cannot connect to MongoDB.');
    console.log(`  ${(err as Error).name}: ${String((err as Error).message).slice(0, 300)}`);
    console.log('Check MONGODB_URI in server_node/.env and, for MongoDB Atlas, Network Access (allow your IP address).');
    process.exit(1);
  }
  const { app, root } = await createApp(connection.db, cfg.distDir);

  const server = app.listen(cfg.port, cfg.host);
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      console.log(`Cannot start: port ${cfg.port} is already in use by another program.`);
      console.log('  Probably an older copy of this server is still running. Close it (Ctrl+C in its terminal),');
      console.log('  or start this one on another port (DB_PORT=3002).');
    } else {
      console.log('Server error:', err.message);
    }
    process.exit(1);
  });
  server.on('listening', async () => {
    console.log(`AcademiaOS (Node + MongoDB) running on http://${cfg.host}:${cfg.port}`);
    console.log(`Database: ${cfg.mongodbDb}`);
    if (fs.existsSync(`${cfg.distDir}/index.html`)) console.log(`App: open http://localhost:${cfg.port}`);
    startDailySnapshots(root); // one backup a day, kept inside MongoDB (Settings shows them)
  });
  server.requestTimeout = 0;

  const stop = () => {
    server.close();
    void connection.client.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

void main();
