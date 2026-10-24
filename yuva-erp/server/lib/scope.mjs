// Who may see and change which institute data.
//
//   admin    everything
//   staff    everything except the institute profile (settings)
//   teacher  only their own batches: attendance and test marks (can add tests and messages)
//   student  only their own record, attendance, fees, results and timetable (read only)
//
// Reading and writing are checked here on the server, so the browser never receives data
// it is not allowed to see.

import { HttpError } from './http.mjs';

export const COLLECTIONS = [
  'courses',
  'batches',
  'students',
  'attendance',
  'transactions',
  'exams',
  'timetable',
  'templates',
  'notificationLogs'
];

// The app shows the newest first for these lists
const NEWEST_FIRST = new Set(['students', 'attendance', 'transactions', 'exams', 'notificationLogs']);

const MAX_ITEMS_PER_REQUEST = 200000;

const list = value => (Array.isArray(value) ? value : []);

// Equal marks share a rank (1, 2, 2, 4)
const rankOf = (score, scores) => scores.filter(s => s > score).length + 1;

// ---------- reading ----------

export const scopeInstitute = (user, institute) => {
  const data = institute || {};

  if (user.role === 'admin' || user.role === 'staff') {
    // Only what exists. A missing list lets the first admin browser add the starting data.
    const out = {};
    for (const key of ['profile', ...COLLECTIONS]) if (data[key] !== undefined) out[key] = data[key];
    return out;
  }

  const base = {};
  if (data.profile !== undefined) base.profile = data.profile;

  if (user.role === 'teacher') {
    const ids = user.batchIds || [];
    return {
      ...base,
      courses: list(data.courses),
      templates: list(data.templates),
      batches: list(data.batches).filter(b => ids.includes(b.id)),
      students: list(data.students).filter(s => ids.includes(s.batchId)),
      attendance: list(data.attendance).filter(a => ids.includes(a.batchId)),
      exams: list(data.exams).filter(e => ids.includes(e.batchId)),
      timetable: list(data.timetable).filter(t => ids.includes(t.batchId)),
      transactions: [],
      notificationLogs: []
    };
  }

  // student
  const students = list(data.students);
  const me = students.find(s => s.id === user.studentId);
  const empty = {
    ...base,
    courses: [],
    templates: [],
    students: [],
    batches: [],
    attendance: [],
    exams: [],
    timetable: [],
    transactions: [],
    notificationLogs: []
  };
  if (!me) return empty;

  const exams = list(data.exams)
    .filter(e => e.batchId === me.batchId)
    .map(e => {
      const own = e.results?.[me.id];
      // Results are visible only after the exam is published
      if (e.status !== 'published' || !own) return { ...e, results: {} };

      // Classmates' marks are used for the rank and average only, they are never sent
      const scores = Object.values(e.results)
        .filter(r => !r.absent)
        .map(r => r.marksObtained);
      const scored = own.absent
        ? { ...own }
        : {
            ...own,
            rank: rankOf(own.marksObtained, scores),
            totalGraded: scores.length,
            highest: Math.max(...scores),
            average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          };
      return { ...e, results: { [me.id]: scored } };
    });

  const attendance = list(data.attendance)
    .filter(a => a.batchId === me.batchId && a.records?.[me.id])
    .map(a => ({ ...a, records: { [me.id]: a.records[me.id] } }));

  return {
    ...empty,
    courses: list(data.courses).filter(c => c.id === me.courseId),
    students: [me],
    batches: list(data.batches).filter(b => b.id === me.batchId),
    attendance,
    exams,
    timetable: list(data.timetable).filter(t => t.batchId === me.batchId),
    transactions: list(data.transactions).filter(t => t.studentId === me.id),
    notificationLogs: list(data.notificationLogs).filter(l => (l.studentId ? l.studentId === me.id : l.studentName === me.name))
  };
};

// ---------- writing ----------

const checkItems = (name, items) => {
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, `${name}: every item must be an object.`);
    }
    if (typeof item.id !== 'string' || !item.id || item.id.length > 200) {
      throw new HttpError(400, `${name}: every item needs an id.`);
    }
  }
};

const parseChange = (name, change) => {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    throw new HttpError(400, `${name}: invalid change.`);
  }
  const upsert = change.upsert === undefined ? [] : change.upsert;
  const remove = change.remove === undefined ? [] : change.remove;
  if (!Array.isArray(upsert) || !Array.isArray(remove)) throw new HttpError(400, `${name}: invalid change.`);
  if (upsert.length + remove.length > MAX_ITEMS_PER_REQUEST) throw new HttpError(413, `${name}: too many changes.`);
  checkItems(name, upsert);
  if (remove.some(id => typeof id !== 'string')) throw new HttpError(400, `${name}: remove needs ids.`);
  return { upsert, remove };
};

// Adds / replaces / removes items by id. New items keep the order they were sent in.
const mergeById = (name, current, { upsert, remove }) => {
  const items = [...current];
  const index = new Map(items.map((item, i) => [item.id, i]));
  const added = [];
  const addedIds = new Set();
  let updated = 0;

  for (const item of upsert) {
    if (index.has(item.id)) {
      items[index.get(item.id)] = item;
      updated += 1;
    } else if (!addedIds.has(item.id)) {
      added.push(item);
      addedIds.add(item.id);
    }
  }

  const removeSet = new Set(remove);
  const kept = removeSet.size ? items.filter(item => !removeSet.has(item.id)) : items;
  const removed = items.length - kept.length;

  return {
    items: NEWEST_FIRST.has(name) ? [...added, ...kept] : [...kept, ...added],
    added: added.length,
    addedIds,
    updated,
    removed
  };
};

// Two computers can pick the same roll / receipt number at the same moment.
// The record that arrived second gets the next free number, so no data is lost.
const UNIQUE_FIELD = { students: 'rollNo', transactions: 'receiptNo' };

const makeUnique = (name, items, addedIds) => {
  const field = UNIQUE_FIELD[name];
  if (!field || addedIds.size === 0) return 0;

  const split = value => {
    const m = String(value).match(/^(.*?)(\d+)$/);
    return m ? { prefix: m[1], digits: m[2] } : null;
  };

  let renumbered = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!addedIds.has(item.id) || typeof item[field] !== 'string') continue;
    const taken = items.some(other => other.id !== item.id && other[field] === item[field]);
    if (!taken) continue;

    const parts = split(item[field]);
    if (!parts) continue;
    let highest = 0;
    for (const other of items) {
      const o = split(other[field] || '');
      if (o && o.prefix === parts.prefix) highest = Math.max(highest, parseInt(o.digits, 10));
    }
    items[i] = { ...item, [field]: `${parts.prefix}${String(highest + 1).padStart(parts.digits.length, '0')}` };
    renumbered += 1;
  }
  return renumbered;
};

const teacherMerge = (name, current, change, user) => {
  const ids = user.batchIds || [];
  if (change.remove.length > 0) throw new HttpError(403, 'Teachers cannot delete records.');

  if (name === 'attendance') {
    for (const a of change.upsert) {
      if (!ids.includes(a.batchId)) throw new HttpError(403, 'You can only mark attendance for your own batches.');
    }
    return mergeById(name, current, change);
  }

  if (name === 'exams') {
    const byId = new Map(current.map(e => [e.id, e]));
    const upsert = change.upsert.map(e => {
      const existing = byId.get(e.id);
      if (existing) {
        if (!ids.includes(existing.batchId)) throw new HttpError(403, 'You can only change tests of your own batches.');
        // For an existing test only the marks and the status can change
        return { ...existing, results: e.results ?? existing.results, status: e.status ?? existing.status };
      }
      if (!ids.includes(e.batchId)) throw new HttpError(403, 'You can only add tests for your own batches.');
      return e;
    });
    return mergeById(name, current, { upsert, remove: [] });
  }

  if (name === 'notificationLogs') {
    // Messages can be added, never changed
    const known = new Set(current.map(l => l.id));
    return mergeById(name, current, { upsert: change.upsert.filter(l => !known.has(l.id)), remove: [] });
  }

  throw new HttpError(403, `Teachers cannot change ${name}.`);
};

// Applies a set of changes to `institute` (it is changed in place only if every part is allowed).
// changes: { profile?: object, [collection]: { upsert?: object[], remove?: string[] } }
// Returns a short description for the activity log.
export const applyChanges = (user, institute, changes) => {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new HttpError(400, 'Invalid changes.');
  }
  if (user.role === 'student') throw new HttpError(403, 'Students cannot change institute data.');

  const names = Object.keys(changes);
  for (const name of names) {
    if (name !== 'profile' && !COLLECTIONS.includes(name)) throw new HttpError(400, `Unknown data: ${name}`);
  }

  const next = {};
  const summary = [];

  for (const name of names) {
    if (name === 'profile') {
      if (user.role !== 'admin') throw new HttpError(403, 'Only the principal can change the institute profile.');
      const profile = changes.profile;
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new HttpError(400, 'profile: invalid.');
      next.profile = profile;
      summary.push('profile');
      continue;
    }

    const change = parseChange(name, changes[name]);
    const current = list(institute[name]);
    const result = user.role === 'teacher' ? teacherMerge(name, current, change, user) : mergeById(name, current, change);
    const renumbered = makeUnique(name, result.items, result.addedIds);
    next[name] = result.items;
    if (result.added || result.updated || result.removed) {
      summary.push(`${name} +${result.added} ~${result.updated} -${result.removed}${renumbered ? ` (${renumbered} renumbered)` : ''}`);
    }
  }

  Object.assign(institute, next);
  return summary;
};
