// node backend/src/migrate.ts [path]
//
// Moves the accounts and the institute data of the older Node server (server/data/db.json) into MongoDB.
// The old file is only read, never changed. It refuses to run when MongoDB already has accounts,
// so nothing is overwritten by mistake (use --force to add the old data anyway).

import fs from 'node:fs';
import { connect } from './app.ts';
import { settings } from './config.ts';
import { importLegacy } from './legacy.ts';
import { Store } from './store.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const cfg = settings();
  const file = args[0] || cfg.legacyFile;

  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.log(`Could not read ${file}: ${(err as Error).message}`);
    process.exit(1);
  }

  const { db, client } = await connect(cfg);
  const store = new Store(db);
  await store.ensureIndexes();
  if ((await store.userCount()) > 0 && !force) {
    console.log('MongoDB already has accounts. Nothing was changed. (Use --force to add the old data anyway.)');
    await client.close();
    process.exit(1);
  }

  const report = await importLegacy(store, raw);
  console.log(`Accounts moved: ${report.users} (skipped: ${report.skipped_users})`);
  for (const [name, count] of Object.entries(report.lists)) console.log(`  ${name}: ${count}`);
  if (report.renumbered) console.log(`Roll numbers changed to plain numbers (01, 02, ...): ${report.renumbered}`);
  console.log('Done. Start the server with: npm run server');
  await client.close();
}

void main();
