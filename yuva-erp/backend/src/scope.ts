// Who may see and change which institute data.
//
//   admin    everything
//   staff    everything except the institute profile (settings) and the expenses (money the coaching spends)
//   teacher  only their own batches: attendance and test marks, study material and notices for those batches
//   student  only their own record, attendance, fees, results, timetable, notices and study material (read only)
//
// Reading and writing are checked here on the server, so the browser never receives data it is not allowed to see.

import { HttpError } from './errors.ts';
import type { Store } from './store.ts';
import { LISTS } from './store.ts';

const MAX_ITEMS_PER_REQUEST = 200000;

// Lists only the principal may see and change
export const PRINCIPAL_ONLY = new Set(['expenses', 'salaries', 'staffAttendance']);

export const isDict = (v: any): boolean => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Equal marks share a rank (1, 2, 2, 4). */
const rankOf = (score: number, scores: number[]): number => scores.filter((s) => s > score).length + 1;

const jsRound = (x: number): number => Math.floor(x + 0.5); // like Math.round (halves go up)

const orNull = (v: any) => (v === undefined ? null : v);

// ---------- reading ----------

export async function scopeInstitute(user: any, store: Store): Promise<any> {
  const role = user.role;
  const present = await store.present();
  const profile = await store.profile();

  if (role === 'admin' || role === 'staff') {
    // Only what exists. A missing list lets the first admin browser add the starting data.
    const out: any = {};
    if (profile !== null) out.profile = profile;
    for (const name of LISTS) {
      if (present.has(name) && (role === 'admin' || !PRINCIPAL_ONLY.has(name))) out[name] = await store.find(name);
    }
    return out;
  }

  const base = profile !== null ? { profile } : {};

  if (role === 'teacher') {
    const ids: string[] = user.batchIds || [];
    const materials = await store.find('materials', { batchId: { $in: ids } });
    return {
      ...base,
      courses: await store.find('courses'),
      templates: await store.find('templates'),
      batches: await store.find('batches', { _id: { $in: ids } }),
      students: await store.find('students', { batchId: { $in: ids } }),
      attendance: await store.find('attendance', { batchId: { $in: ids } }),
      exams: await store.find('exams', { batchId: { $in: ids } }),
      timetable: await store.find('timetable', { batchId: { $in: ids } }),
      transactions: [],
      notificationLogs: [],
      enquiries: [],
      expenses: [],
      salaries: [],
      staffAttendance: [],
      books: await store.find('books'),
      announcements: await store.find('announcements', { $or: [{ audience: 'all' }, { batchId: { $in: ids } }] }),
      materials,
      submissions: await store.find('submissions', { materialId: { $in: (await store.find('materials', { batchId: { $in: ids } })).map((m) => m.id) } }),
    };
  }

  // student
  const empty: any = {
    ...base,
    courses: [],
    templates: [],
    students: [],
    batches: [],
    attendance: [],
    exams: [],
    timetable: [],
    transactions: [],
    notificationLogs: [],
    enquiries: [],
    expenses: [],
    salaries: [],
    staffAttendance: [],
    books: [],
    announcements: [],
    materials: [],
    submissions: [],
  };
  const me = user.studentId ? await store.getItem('students', user.studentId) : null;
  if (!me) return empty;

  const exams: any[] = [];
  for (const e of await store.find('exams', { batchId: orNull(me.batchId) })) {
    const results = e.results || {};
    const own = results[me.id];
    // Results are visible only after the exam is published
    if (e.status !== 'published' || !own) {
      exams.push({ ...e, results: {} });
      continue;
    }
    // Classmates' marks are used for the rank and average only, they are never sent
    const scores: number[] = Object.values<any>(results)
      .filter((r) => !r.absent)
      .map((r) => r.marksObtained);
    let scored: any;
    if (own.absent) {
      scored = { ...own };
    } else {
      scored = {
        ...own,
        rank: rankOf(own.marksObtained, scores),
        totalGraded: scores.length,
        highest: Math.max(...scores),
        average: jsRound(scores.reduce((a, b) => a + b, 0) / scores.length),
      };
    }
    exams.push({ ...e, results: { [me.id]: scored } });
  }

  const attendance = (await store.find('attendance', { batchId: orNull(me.batchId) }))
    .filter((a) => (a.records || {})[me.id])
    .map((a) => ({ ...a, records: { [me.id]: a.records[me.id] } }));

  const logs = (await store.find('notificationLogs')).filter((log) => (log.studentId ? log.studentId === me.id : log.studentName === me.name));

  return {
    ...empty,
    courses: await store.find('courses', { _id: orNull(me.courseId) }),
    students: [me],
    batches: await store.find('batches', { _id: orNull(me.batchId) }),
    attendance,
    exams,
    timetable: await store.find('timetable', { batchId: orNull(me.batchId) }),
    transactions: await store.find('transactions', { studentId: me.id }),
    notificationLogs: logs,
    announcements: await store.find('announcements', { $or: [{ audience: 'all' }, { batchId: orNull(me.batchId) }] }),
    materials: await store.find('materials', { batchId: orNull(me.batchId) }),
    books: await store.find('books'),
    submissions: await store.find('submissions', { studentId: me.id }),
  };
}

// ---------- writing ----------

function checkItems(name: string, items: any[]): void {
  for (const item of items) {
    if (!isDict(item)) throw new HttpError(400, `${name}: every item must be an object.`);
    const id = item.id;
    if (typeof id !== 'string' || !id || id.length > 200) throw new HttpError(400, `${name}: every item needs an id.`);
  }
}

interface Plan {
  upsert: any[];
  remove: string[];
}

function parseChange(name: string, change: any): Plan {
  if (!isDict(change)) throw new HttpError(400, `${name}: invalid change.`);
  const upsert = change.upsert ?? [];
  const remove = change.remove ?? [];
  if (!Array.isArray(upsert) || !Array.isArray(remove)) throw new HttpError(400, `${name}: invalid change.`);
  if (upsert.length + remove.length > MAX_ITEMS_PER_REQUEST) throw new HttpError(413, `${name}: too many changes.`);
  checkItems(name, upsert);
  if (remove.some((i) => typeof i !== 'string')) throw new HttpError(400, `${name}: remove needs ids.`);
  return { upsert, remove };
}

async function teacherPlan(name: string, change: Plan, user: any, store: Store): Promise<Plan> {
  const ids: string[] = user.batchIds || [];

  if (name === 'materials') {
    // Study material of their own batches: add, change and remove
    const existing = await store.getMany('materials', [...change.upsert.map((m) => m.id), ...change.remove]);
    for (const m of change.upsert) {
      if (!ids.includes(m.batchId) || (m.id in existing && !ids.includes(existing[m.id].batchId))) {
        throw new HttpError(403, 'You can only post study material for your own batches.');
      }
    }
    for (const rid of change.remove) {
      if (rid in existing && !ids.includes(existing[rid].batchId)) throw new HttpError(403, 'You can only remove study material of your own batches.');
    }
    return change;
  }

  if (name === 'announcements') {
    // Notices to their own batches; they can only change or remove their own notices
    const existing = await store.getMany('announcements', [...change.upsert.map((a) => a.id), ...change.remove]);
    const upsert: any[] = [];
    for (const a of change.upsert) {
      if (a.audience !== 'batch' || !ids.includes(a.batchId)) throw new HttpError(403, 'You can only post notices to your own batches.');
      if (a.id in existing && existing[a.id].authorId !== user.id) throw new HttpError(403, 'You can only change your own notices.');
      upsert.push({ ...a, authorId: user.id, authorName: user.name });
    }
    for (const rid of change.remove) {
      if (rid in existing && existing[rid].authorId !== user.id) throw new HttpError(403, 'You can only remove your own notices.');
    }
    return { upsert, remove: change.remove };
  }

  if (change.remove.length) throw new HttpError(403, 'Teachers cannot delete records.');

  if (name === 'attendance') {
    for (const a of change.upsert) {
      if (!ids.includes(a.batchId)) throw new HttpError(403, 'You can only mark attendance for your own batches.');
    }
    return change;
  }

  if (name === 'exams') {
    const byId = await store.getMany('exams', change.upsert.map((e) => e.id));
    const upsert: any[] = [];
    for (const e of change.upsert) {
      const existing = byId[e.id];
      if (existing) {
        if (!ids.includes(existing.batchId)) throw new HttpError(403, 'You can only change tests of your own batches.');
        // For an existing test only the marks and the status can change
        upsert.push({
          ...existing,
          results: e.results !== undefined && e.results !== null ? e.results : existing.results,
          status: e.status !== undefined && e.status !== null ? e.status : existing.status,
        });
      } else {
        if (!ids.includes(e.batchId)) throw new HttpError(403, 'You can only add tests for your own batches.');
        upsert.push(e);
      }
    }
    return { upsert, remove: [] };
  }

  if (name === 'notificationLogs') {
    // Messages can be added, never changed
    const known = await store.getMany('notificationLogs', change.upsert.map((l) => l.id));
    return { upsert: change.upsert.filter((l) => !(l.id in known)), remove: [] };
  }

  throw new HttpError(403, `Teachers cannot change ${name}.`);
}

// Two computers can pick the same roll / receipt number at the same moment.
// The record that arrived second gets the next free number, so no data is lost.
const UNIQUE_FIELD: Record<string, string> = { students: 'rollNo', transactions: 'receiptNo' };
const SPLIT = /^([\s\S]*?)(\d+)$/;

async function makeUnique(name: string, plan: Plan, store: Store): Promise<number> {
  const field = UNIQUE_FIELD[name];
  if (!field || !plan.upsert.length) return 0;

  const values = await store.fieldValues(name, field); // record id -> number
  const existingIds = new Set(values.keys());
  for (const rid of plan.remove) values.delete(rid);

  const newIds: string[] = [];
  const latest = new Map<string, any>();
  for (const item of plan.upsert) {
    const id = item.id;
    if (!existingIds.has(id) && !latest.has(id)) newIds.push(id);
    latest.set(id, item);
    values.set(id, item[field] ?? null);
  }
  for (const rid of plan.remove) values.delete(rid);

  const fixed = new Map<string, any>();
  for (const id of newIds) {
    const item = latest.get(id);
    const value = item[field];
    if (typeof value !== 'string' || !values.has(id)) continue;
    let clash = false;
    for (const [other, ov] of values) if (other !== id && ov === value) clash = true;
    if (!clash) continue;
    const parts = SPLIT.exec(value);
    if (!parts) continue;
    const [, prefix, digits] = parts;
    let highest = 0;
    for (const ov of values.values()) {
      const o = typeof ov === 'string' ? SPLIT.exec(ov) : null;
      if (o && o[1] === prefix) highest = Math.max(highest, parseInt(o[2], 10));
    }
    const newValue = `${prefix}${String(highest + 1).padStart(digits.length, '0')}`;
    fixed.set(id, { ...item, [field]: newValue });
    values.set(id, newValue);
  }

  if (fixed.size) {
    // only the first (new) copy of a record is renumbered
    const done = new Set<string>();
    const out: any[] = [];
    for (const item of plan.upsert) {
      if (fixed.has(item.id) && !done.has(item.id)) {
        out.push(fixed.get(item.id));
        done.add(item.id);
      } else {
        out.push(item);
      }
    }
    plan.upsert = out;
  }
  return fixed.size;
}

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PHOTO_BYTES = 1_500_000;
const DATA_URL = /^data:(image\/[a-z+.-]+);base64,([\s\S]*)$/;

/** 'data:image/jpeg;base64,...' -> content type and bytes. Throws HttpError for anything else. */
export function parsePhotoDataUrl(url: string): { contentType: string; data: Buffer } {
  const match = DATA_URL.exec(url);
  if (!match || !PHOTO_TYPES.has(match[1])) throw new HttpError(400, 'The photo must be a JPG, PNG, WebP or GIF image.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(match[2]) || match[2].length % 4 !== 0) throw new HttpError(400, 'The photo could not be read.');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'The photo is too big (the limit is 1.5 MB).');
  return { contentType: match[1], data };
}

/** A photo sent as a data URL is saved apart and replaced by a short address, so the lists stay small.
 * Returns how many photos were moved. */
async function storePhotos(plan: Plan, store: Store): Promise<number> {
  let moved = 0;
  const upsert: any[] = [];
  for (let item of plan.upsert) {
    const url = item.photoUrl;
    if (typeof url === 'string' && url.startsWith('data:')) {
      const { contentType, data } = parsePhotoDataUrl(url);
      const token = await store.savePhoto(item.id, contentType, data);
      item = { ...item, photoUrl: store.photoUrl(item.id, token) };
      moved += 1;
    }
    upsert.push(item);
  }
  plan.upsert = upsert;
  return moved;
}

/** Applies a set of changes. Nothing is written unless every part is allowed.
 * changes: { profile?: object, <list name>: { upsert?: [...], remove?: [ids] } }
 * Returns [summary for the activity log, how many things the server adjusted]. */
export async function applyChanges(user: any, store: Store, changes: any): Promise<[string[], number]> {
  if (!isDict(changes)) throw new HttpError(400, 'Invalid changes.');
  if (user.role === 'student') throw new HttpError(403, 'Students cannot change institute data.');

  for (const name of Object.keys(changes)) {
    if (name !== 'profile' && !LISTS.includes(name)) throw new HttpError(400, `Unknown data: ${name}`);
  }

  let hasProfile = false;
  let profile: any = null;
  const plans: [string, Plan][] = [];

  for (const [name, change] of Object.entries<any>(changes)) {
    if (name === 'profile') {
      if (user.role !== 'admin') throw new HttpError(403, 'Only the principal can change the institute profile.');
      if (!isDict(change)) throw new HttpError(400, 'profile: invalid.');
      hasProfile = true;
      profile = change;
      continue;
    }
    let parsed = parseChange(name, change);
    if (name === 'submissions') throw new HttpError(403, 'Homework is marked as done by the students themselves.');
    if (PRINCIPAL_ONLY.has(name) && user.role !== 'admin') throw new HttpError(403, 'Only the principal can change the expenses.');
    if (user.role === 'teacher') parsed = await teacherPlan(name, parsed, user, store);
    plans.push([name, parsed]);
  }

  let adjustedTotal = 0; // things the server changed for the browser (renumbered, photos moved): it must fetch them
  for (const [name, plan] of plans) {
    adjustedTotal += await makeUnique(name, plan, store);
    if (name === 'students') adjustedTotal += await storePhotos(plan, store);
  }

  const summary: string[] = [];
  if (hasProfile) {
    await store.setProfile(profile);
    summary.push('profile');
  }

  for (const [name, plan] of plans) {
    const [added, updated, removed] = await store.applyList(name, plan.upsert, plan.remove);
    if (name === 'students') await store.deletePhotos(plan.remove);
    if (added || updated || removed) summary.push(`${name} +${added} ~${updated} -${removed}`);
  }
  if (adjustedTotal && summary.length) summary[summary.length - 1] += ` (${adjustedTotal} adjusted)`;
  return [summary, adjustedTotal];
}
