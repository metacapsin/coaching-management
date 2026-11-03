// Automatic daily backup: a snapshot of the data is kept inside MongoDB (the last 14 are kept).

import type { Store } from './store.ts';

const CHECK_EVERY_MS = 30 * 60 * 1000;
const DAILY_MS = 24 * 60 * 60 * 1000;

/** Makes an automatic snapshot when the last one is older than `everyMs`. Returns its id, or null. */
export async function snapshotIfDue(store: Store, everyMs = DAILY_MS, now = new Date()): Promise<string | null> {
  const last = await store.latestBackupTime('automatic');
  if (last !== null && now.getTime() - last.getTime() < everyMs) return null;
  return store.snapshot('automatic');
}

async function checkAll(store: Store): Promise<void> {
  let orgs: string[];
  try {
    orgs = (await store.orgList()).filter((o) => o.status !== 'pending').map((o) => o.id);
    if (!orgs.length) orgs = [store.org];
  } catch (err) {
    console.log('Could not list the coachings:', err);
    orgs = [store.org];
  }
  for (const org of orgs) {
    // every coaching gets its own daily backup
    try {
      await snapshotIfDue(store.forOrg(org));
    } catch (err) {
      // a failed backup must never stop the server
      console.log('Automatic backup failed:', err);
    }
  }
}

/** Checks every half hour in the background (a day without a snapshot is caught up at start). */
export function startDailySnapshots(store: Store): NodeJS.Timeout {
  void checkAll(store);
  const timer = setInterval(() => void checkAll(store), CHECK_EVERY_MS);
  timer.unref();
  return timer;
}
