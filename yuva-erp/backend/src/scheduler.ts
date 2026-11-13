// Automatic daily backup: a snapshot of the data is kept inside MongoDB (the last 14 are kept).

import type { Store } from './store.ts';
import * as mailer from './mailer.ts';
import { previousMonth, sendMonthlyAttendance } from './attendanceMail.ts';

const CHECK_EVERY_MS = 30 * 60 * 1000;
const DAILY_MS = 24 * 60 * 60 * 1000;

/** Makes an automatic snapshot when the last one is older than `everyMs`. Returns its id, or null. */
export async function snapshotIfDue(store: Store, everyMs = DAILY_MS, now = new Date()): Promise<string | null> {
  const last = await store.latestBackupTime('automatic');
  if (last !== null && now.getTime() - last.getTime() < everyMs) return null;
  return store.snapshot('automatic');
}

/** When a new month has started, the parents get the attendance percentage of the last month (once for each coaching and month; the
 * students that already got it by the button of the principal are skipped). A coaching that is not active is left out. */
export async function monthlyAttendanceIfDue(base: Store, orgId: string, now = new Date()): Promise<void> {
  const tenant = base.forOrg(orgId);
  const month = previousMonth(now);
  const runKey = `att-month-run:${month}`;
  if (!(await tenant.claimAbsenceMail(runKey))) return;
  try {
    const org = await base.orgGet(orgId);
    if (!org || org.status !== 'active') {
      await tenant.unclaimAbsenceMail(runKey); // (it waits until the coaching is active)
      return;
    }
    const principal = (await tenant.usersAll()).find((u: any) => u.role === 'admin' && (u.status || 'active') === 'active');
    await mailer.loadOrgMail(tenant);
    mailer.enterOrg(orgId); // (the emails go out from the own Gmail of this coaching, when it has one)
    const site = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
    await sendMonthlyAttendance(tenant, org.name || 'your coaching', month, principal, site ? `${site}/parent` : '');
  } catch (err) {
    await tenant.unclaimAbsenceMail(runKey); // (tried again at the next check)
    console.log('Monthly attendance emails failed:', err);
  }
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
    await monthlyAttendanceIfDue(store, org);
  }
}

/** Checks every half hour in the background (a day without a snapshot is caught up at start). */
export function startDailySnapshots(store: Store): NodeJS.Timeout {
  void checkAll(store);
  const timer = setInterval(() => void checkAll(store), CHECK_EVERY_MS);
  timer.unref();
  return timer;
}
