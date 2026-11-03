// Moves the data of the older Node server (server/data/db.json) into MongoDB.

import { renumberLegacyRolls } from './rollno.ts';
import { isDict } from './scope.ts';
import type { Store } from './store.ts';
import { LISTS } from './store.ts';

const LEGACY_USERS_KEY = 'academia_os_users_v1';
const LEGACY_INSTITUTE_KEY = 'academia_os_institute_data_v1';

function parse(value: any, fallback: any): any {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return parsed === null || parsed === undefined ? fallback : parsed;
}

/** Returns [accounts, institute data] from either layout of the old data file. */
export function extract(raw: any): [any[], any] {
  let users: any;
  let institute: any;
  if (isDict(raw) && raw.format === 2) {
    users = raw.users || [];
    institute = raw.institute || {};
  } else {
    const data = (raw || {}).data || {};
    users = parse(data[LEGACY_USERS_KEY], []);
    institute = parse(data[LEGACY_INSTITUTE_KEY], {});
  }
  return [Array.isArray(users) ? users : [], isDict(institute) ? institute : {}];
}

/** Adds the accounts and institute data of the old file. Returns a short report. */
export async function importLegacy(store: Store, raw: any): Promise<any> {
  const [users, institute] = extract(raw);
  const report: any = { users: 0, skipped_users: 0, lists: {}, renumbered: 0 };

  for (let user of users) {
    const { _id, ...rest } = user;
    user = rest;
    if (!user.id || !user.email || (await store.userByEmail(user.email)) || (await store.userById(user.id))) {
      report.skipped_users += 1;
      continue;
    }
    if (user.status === undefined) user.status = 'active';
    await store.addUser(user);
    report.users += 1;
  }

  if (isDict(institute.profile)) await store.setProfile(institute.profile);

  // Older data used roll numbers like APEX-25-0101: they become plain running numbers (01, 02, ...)
  const students = Array.isArray(institute.students) ? institute.students : null;
  const newRoll = students && students.length ? renumberLegacyRolls(students) : {};
  if (Object.keys(newRoll).length) {
    institute.students = students!.map((s: any) => (s.id in newRoll ? { ...s, rollNo: newRoll[s.id] } : s));
    if (Array.isArray(institute.transactions)) {
      institute.transactions = institute.transactions.map((t: any) => (t.studentId in newRoll ? { ...t, studentRollNo: newRoll[t.studentId] } : t));
    }
    report.renumbered = Object.keys(newRoll).length;
  }

  for (const name of LISTS) {
    // (lists the old file does not have are left alone)
    let items = institute[name];
    if (Array.isArray(items)) {
      items = items.filter((i: any) => isDict(i) && typeof i.id === 'string');
      await store.replaceList(name, items);
      report.lists[name] = items.length;
    }
  }

  await store.bump();
  return report;
}
