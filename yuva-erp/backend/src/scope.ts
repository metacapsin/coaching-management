// Who may see and change which institute data.
//
//   admin    everything
//   teacher  only their own batches: attendance and test marks, study material and notices for those batches
//   student  only their own record, attendance, fees, results, timetable, notices and study material (read only)
//
// Reading and writing are checked here on the server, so the browser never receives data it is not allowed to see.

import { HttpError } from './errors.ts';
import type { Store } from './store.ts';
import { LISTS } from './store.ts';
import { checkName } from './validate.ts';

const MAX_ITEMS_PER_REQUEST = 200000;

// Lists only the principal may see and change
export const PRINCIPAL_ONLY = new Set(['expenses', 'salaries', 'staffAttendance']);

export const isDict = (v: any): boolean => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Equal marks share a rank (1, 2, 2, 4). */
const rankOf = (score: number, scores: number[]): number => scores.filter((s) => s > score).length + 1;

const jsRound = (x: number): number => Math.floor(x + 0.5); // like Math.round (halves go up)

const orNull = (v: any) => (v === undefined ? null : v);

// ---------- who is told about a new student ----------

const subjectKey = (v: any): string => String(v ?? '').trim().toLowerCase();

/** "Class 12", "12th", "12" -> "12". Anything else is compared as lower case text. */
export function gradeKey(v: any): string {
  const t = String(v ?? '').trim().toLowerCase();
  const m = t.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\b/);
  return m ? String(Number(m[1])) : t;
}

/** The class written in the name of a batch ("Class 10 Board Champions"), when it says one. */
const gradeOfBatchName = (name: any): string | null => {
  const t = String(name ?? '');
  const m = t.match(/class\s*(\d{1,2})\b/i) || t.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)\b/i);
  return m ? String(Number(m[1])) : null;
};

/**
 * Does this teacher get the line "a new student joined" in the bell? Only when the teacher teaches the subject of the student
 * (the subjects of the batch the student joined; an English student is told to the English teacher) AND the class of the student
 * (a student of class 12 is told to the teachers of class 12, known from the classes of their own batches). When the batch has no
 * subject, or the teacher no subject / class on record, the teacher is told if the batch is one of theirs.
 */
export function teacherGetsNewStudent(teacher: any, log: any, batch: any, teacherBatches: any[], teacherStudents: any[]): boolean {
  const mine = (teacher.batchIds || []).includes(log.batchId);
  const mySubject = subjectKey(teacher.subject);
  const batchSubjects: string[] = (batch?.subjects || []).map(subjectKey).filter(Boolean);
  const subjectOk =
    mySubject && batchSubjects.length ? batchSubjects.some((s) => s.includes(mySubject) || mySubject.includes(s)) : mine;

  const myGrades = new Set<string>();
  for (const st of teacherStudents) if (st.id !== log.studentId && st.grade) myGrades.add(gradeKey(st.grade));
  for (const b of teacherBatches) {
    const g = gradeOfBatchName(b.name);
    if (g) myGrades.add(g);
  }
  const classOk = log.grade && myGrades.size ? myGrades.has(gradeKey(log.grade)) : mine;
  return subjectOk && classOk;
}

// ---------- reading ----------

/** May this teacher confirm this test / homework? It is his (or nobody's) and of his subject (when he has one on record). */
const mayConfirm = (user: any, item: any): boolean => {
  if (item.teacherId && item.teacherId !== user.id) return false;
  const mine = String(user.subject ?? '').trim().toLowerCase();
  if (!mine) return true;
  const subject = String(item.subject ?? '').trim().toLowerCase();
  return !!subject && (subject.includes(mine) || mine.includes(subject));
};

const teacherIds = async (store: Store): Promise<string[]> => (await store.usersAll()).filter((u) => u.role === 'teacher').map((u) => u.id);

/** For a parent: leave out the notices that a teacher wrote (also the old ones that have no author role: the author is known). */
const parentOnly = (user: any, teachers: string[], query: any): any =>
  user.isParent ? { $and: [query, { authorRole: { $ne: 'teacher' } }, { authorId: { $nin: teachers } }] } : query;

async function newStudentLogsFor(user: any, store: Store, ids: string[]): Promise<any[]> {
  const logs = await store.find('notificationLogs', { type: 'new_student', batchId: { $exists: true } });
  if (!logs.length) return [];
  const [allBatches, myBatches, myStudents] = [await store.find('batches'), await store.find('batches', { _id: { $in: ids } }), await store.find('students', { batchId: { $in: ids } })];
  return logs.filter((l) => teacherGetsNewStudent(user, l, allBatches.find((b) => b.id === l.batchId), myBatches, myStudents));
}

export async function scopeInstitute(user: any, store: Store): Promise<any> {
  const role = user.role;
  const present = await store.present();
  const profile = await store.profile();

  if (role === 'admin') {
    // Only what exists. A missing list lets the first admin browser add the starting data.
    const out: any = {};
    if (profile !== null) out.profile = profile;
    for (const name of LISTS) {
      if (present.has(name)) out[name] = await store.find(name);
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
      // only the lines "a new student joined" for the subject and the class of this teacher
      notificationLogs: await newStudentLogsFor(user, store, ids),
      enquiries: [],
      expenses: [],
      salaries: [],
      staffAttendance: [],
      books: await store.find('books'),
      // for everybody, for the teachers (a meeting) and for the own batches
      announcements: await store.find('announcements', { $or: [{ audience: 'all' }, { audience: 'teachers' }, { batchId: { $in: ids } }] }),
      materials,
      submissions: await store.find('submissions', { materialId: { $in: (await store.find('materials', { batchId: { $in: ids } })).map((m) => m.id) } }),
      // a teacher gets only the own leave requests (never the leave of a student)
      leaveRequests: await store.find('leaveRequests', { teacherId: user.id }),
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
    leaveRequests: [],
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

  // The messages that the principal sends to the parent of this student (absent, fee, result...) are for the PARENT account: the
  // student does not get them. Never the lines of the bell of the principal and the teachers (a new student, a new teacher).
  // The notices about homework and tests are written twice: for the parent (channel whatsapp) and for the student (channel 'student').
  const logs = (await store.find('notificationLogs')).filter((log) => {
    const mine = log.studentId ? log.studentId === me.id : log.studentName === me.name;
    if (!mine || log.channel === 'app') return false;
    return user.isParent ? log.channel !== 'student' : log.channel === 'student';
  });

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
    // never the notices for the teachers only; and a PARENT does not get the notices that a teacher wrote (a holiday, anything else): a
    // teacher tells the parents only about homework and tests (those are messages, above)
    announcements: await store.find('announcements', parentOnly(user, await teacherIds(store), { $or: [{ audience: 'all' }, { audience: 'batch', batchId: orNull(me.batchId) }] })),
    materials: await store.find('materials', { batchId: orNull(me.batchId) }),
    books: await store.find('books'),
    submissions: await store.find('submissions', { studentId: me.id }),
    // leave is for the student only (the principal decides it): not for a teacher and not for a parent account
    leaveRequests: user.isParent ? [] : await store.find('leaveRequests', { studentId: me.id }),
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

// which fields of which list are names (of a person, a program, a batch...): they must have no symbol
const NAME_FIELDS: Record<string, [string, string][]> = {
  students: [['name', 'student name'], ['parentName', 'parent name']],
  enquiries: [['name', 'name'], ['parentName', 'parent name']],
  courses: [['name', 'name of the program']],
  batches: [['name', 'name of the batch'], ['facultyName', 'name of the teacher']],
  timetable: [['facultyName', 'name of the teacher']],
  salaries: [['name', 'name']],
};

/** A new or a changed name of a student / parent / enquiry / program / batch must have no symbol. A name that is the same as the saved one is left alone, so a
 * record with an old name can still be edited (a fee, a batch...). */
async function checkNamesOf(list: string, plan: { upsert: any[] }, store: Store): Promise<void> {
  const before = await store.getMany(list, plan.upsert.map((i) => i.id));
  for (const item of plan.upsert) {
    for (const [field, label] of NAME_FIELDS[list] ?? []) {
      const value = item[field];
      if (typeof value !== 'string' || !value.trim()) continue;
      if (before[item.id] && before[item.id][field] === value) continue;
      checkName(value.trim(), label);
    }
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
      // a homework that the principal made for a teacher is confirmed by THAT teacher only (of that subject)
      const was = existing[m.id];
      if (was && was.confirmed === false && m.confirmed === true && !mayConfirm(user, was)) {
        throw new HttpError(403, 'Only the teacher of this homework can confirm it.');
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
      upsert.push({ ...a, authorId: user.id, authorName: user.name, authorRole: 'teacher' });
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
        // For an existing test only the marks and the status can change, and the teacher can CONFIRM a test that the principal made
        // for him (the date): only the teacher of that test, of that subject.
        const confirming = existing.confirmed === false && e.confirmed === true && mayConfirm(user, existing);
        upsert.push({
          ...existing,
          results: e.results !== undefined && e.results !== null ? e.results : existing.results,
          status: e.status !== undefined && e.status !== null ? e.status : existing.status,
          ...(confirming ? { confirmed: true } : {}),
        });
      } else {
        if (!ids.includes(e.batchId)) throw new HttpError(403, 'You can only add tests for your own batches.');
        upsert.push(e);
      }
    }
    return { upsert, remove: [] };
  }

  if (name === 'notificationLogs') {
    // Messages can be added, never changed. A teacher tells the parents ONLY about homework and tests (of the own batches); a holiday
    // or any other notice, an absent alert, a fee reminder... is for the principal. (The "line for the principal" is allowed too.)
    const known = await store.getMany('notificationLogs', change.upsert.map((l) => l.id));
    const fresh = change.upsert.filter((l) => !(l.id in known));
    const kids = new Set((await store.find('students', { batchId: { $in: ids } })).map((s) => s.id));
    // absent and late students: ONLY the CLASS TEACHER of the batch (the principal chooses it on the batch) tells the parents. Where no
    // class teacher is chosen, the principal does it.
    const classBatchIds = (await store.find('batches', { _id: { $in: ids } })).filter((b) => b.classTeacherId === user.id).map((b) => b.id);
    const classKids = new Set((await store.find('students', { batchId: { $in: classBatchIds } })).map((s) => s.id));
    // homework and tests: only the teacher of THAT SUBJECT (when the teacher has a subject on record), for the own batches
    const mySubject = String(user.subject ?? '').trim().toLowerCase();
    const ofMySubject = (l: any) => {
      if (!mySubject) return true;
      const subject = String(l.subject ?? '').trim().toLowerCase();
      return !!subject && (subject.includes(mySubject) || mySubject.includes(subject));
    };
    for (const l of fresh) {
      const kind = (l.type === 'homework' || l.type === 'test_notice' || l.type === 'exam_result') && ofMySubject(l);
      const mine = l.channel === 'app' || (typeof l.studentId === 'string' && kids.has(l.studentId));
      const attendance = (l.type === 'attendance_absent' || l.type === 'attendance_late') && l.channel !== 'app' && typeof l.studentId === 'string' && classKids.has(l.studentId);
      if (!(kind && mine) && !attendance) {
        throw new HttpError(403, 'A teacher tells the parents only about the homework, tests and results of the own subject, for the own batches. Absent and late students: only the class teacher of the batch (or the principal).');
      }
    }
    return { upsert: fresh, remove: [] };
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
      // the name of the institute (a name that is not changed can stay)
      if (typeof change.name === 'string' && change.name.trim() && change.name !== (await store.profile())?.name) checkName(change.name.trim(), 'name of the institute');
      continue;
    }
    let parsed = parseChange(name, change);
    if (NAME_FIELDS[name]) await checkNamesOf(name, parsed, store);
    if (name === 'submissions') throw new HttpError(403, 'Homework is marked as done by the students themselves.');
    if (name === 'leaveRequests') throw new HttpError(403, 'Leave is asked by the student and decided by the principal on the leave page.');
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
