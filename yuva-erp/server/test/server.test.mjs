// Run with:  npm test
// Starts the real server on a free port with a temporary data folder and calls it like the app does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverFile = path.join(here, '..', 'db-server.mjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const freePort = () =>
  new Promise(resolve => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const startServer = async (dir, port) => {
  const proc = spawn('node', [serverFile], {
    env: { ...process.env, DB_PORT: String(port), DB_HOST: '127.0.0.1', DB_DIR: dir, DIST_DIR: path.join(dir, 'no-dist') },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  return {
    base,
    async stop() {
      proc.kill('SIGINT');
      await new Promise(r => proc.once('exit', r));
    }
  };
};

const makeClient = base => {
  const call = async (method, url, { token, body } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
  return { call };
};

const PASSWORD = 'Passw0rd123';

// ---------- sample institute data ----------

const batches = [
  { id: 'b1', code: 'A', name: 'Batch A', courseId: 'c1', courseName: 'JEE', subjects: [], facultyName: 'x', classroom: 'r1', scheduleDays: ['Mon'], startTime: '04:00 PM', endTime: '05:00 PM', maxCapacity: 2, enrolledCount: 2, status: 'ongoing' },
  { id: 'b2', code: 'B', name: 'Batch B', courseId: 'c1', courseName: 'JEE', subjects: [], facultyName: 'y', classroom: 'r2', scheduleDays: ['Tue'], startTime: '04:00 PM', endTime: '05:00 PM', maxCapacity: 30, enrolledCount: 1, status: 'ongoing' }
];
const mkStudent = (id, rollNo, name, batchId, phone) => ({
  id, rollNo, name, email: `${id}@x.com`, phone, parentName: 'P', parentPhone: phone, grade: 'Class 12', courseId: 'c1', batchId,
  targetExam: 'JEE', dateOfAdmission: '2026-01-01', status: 'active', photoUrl: '', address: '', totalFees: 1000, discount: 0, feePaid: 500
});
const studentsList = [
  mkStudent('s1', '01', 'Alice', 'b1', '+91 98000 00001'),
  mkStudent('s2', '02', 'Bob', 'b1', '+91 98000 00002'),
  mkStudent('s3', '03', 'Carol', 'b2', '+91 98000 00003')
];
const exam = {
  id: 'e1', code: 'T1', title: 'Test 1', batchId: 'b1', batchName: 'Batch A', subject: 'Maths', date: '2026-02-01', maxMarks: 100, passMarks: 35,
  status: 'published', syllabusTopics: [], results: { s1: { marksObtained: 90 }, s2: { marksObtained: 60 } }
};
const seed = {
  profile: { name: 'Test Institute' },
  courses: [{ id: 'c1', code: 'J', name: 'JEE', category: 'Engineering', duration: '1y', standardFee: 1000, description: '' }],
  batches: { upsert: batches },
  students: { upsert: studentsList },
  attendance: { upsert: [{ id: 'att1', date: '2026-02-01', batchId: 'b1', records: { s1: 'present', s2: 'absent' }, markedBy: 'x', updatedAt: '' }] },
  transactions: { upsert: [{ id: 'tx1', receiptNo: 'REC-2026-0001', studentId: 's1', studentName: 'Alice', studentRollNo: '01', batchName: 'Batch A', amount: 500, paymentMethod: 'Cash', date: '2026-01-02', installmentNo: 1 }] },
  exams: { upsert: [exam] },
  timetable: { upsert: [] },
  templates: { upsert: [] },
  notificationLogs: { upsert: [{ id: 'l1', timestamp: '', type: 'fee_due', channel: 'whatsapp', recipientName: 'P', recipientPhone: '1', studentName: 'Alice', studentId: 's1', content: 'hi', status: 'delivered' }] }
};
// "courses" is sent like the other lists
seed.courses = { upsert: [{ id: 'c1', code: 'J', name: 'JEE', category: 'Engineering', duration: '1y', standardFee: 1000, description: '' }] };

test('server', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academia-test-'));
  const port = await freePort();
  let server = await startServer(dir, port);
  let { call } = makeClient(server.base);

  let adminToken;
  let teacherToken;
  let teacherId;
  let studentToken;

  await t.test('first start: setup creates the principal once', async () => {
    assert.equal((await call('GET', '/api/auth/status')).data.hasUsers, false);
    assert.equal((await call('POST', '/api/auth/setup', { body: { name: 'P', email: 'p@x.com', password: 'short' } })).status, 400);
    const res = await call('POST', '/api/auth/setup', { body: { name: 'Principal', email: 'P@X.com', password: PASSWORD } });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'admin');
    assert.equal(res.data.user.email, 'p@x.com');
    adminToken = res.data.token;
    assert.equal((await call('POST', '/api/auth/setup', { body: { name: 'Evil', email: 'e@x.com', password: PASSWORD } })).status, 409);
    assert.equal((await call('GET', '/api/auth/status')).data.hasUsers, true);
  });

  await t.test('data needs a session; passwords never leave the server', async () => {
    assert.equal((await call('GET', '/api/sync')).status, 401);
    assert.equal((await call('GET', '/api/sync', { token: 'nonsense' })).status, 401);
    assert.equal((await call('PUT', '/api/institute', { body: { changes: {} } })).status, 401);
    const res = await call('GET', '/api/sync', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(JSON.stringify(res.data).includes('passwordHash'), false);
    assert.equal(JSON.stringify(res.data).includes('salt'), false);
    assert.equal((await call('GET', `/api/sync?since=${res.data.version}`, { token: adminToken })).data.changed, false);
  });

  await t.test('login: wrong password, wrong tab, and throttling', async () => {
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'p@x.com', password: 'Wrong1234', portal: 'admin' } })).status, 401);
    const wrongTab = await call('POST', '/api/auth/login', { body: { email: 'p@x.com', password: PASSWORD, portal: 'student' } });
    assert.equal(wrongTab.status, 403);
    assert.match(wrongTab.data.error, /Administration/);
    const ok = await call('POST', '/api/auth/login', { body: { email: 'p@x.com', password: PASSWORD, portal: 'admin' } });
    assert.equal(ok.status, 200);

    for (let i = 0; i < 5; i++) {
      await call('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' } });
    }
    const locked = await call('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' } });
    assert.equal(locked.status, 429);
    // behind a proxy on this computer every caller has its own address: another address is not locked
    const otherCaller = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' },
      body: JSON.stringify({ email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' })
    });
    assert.equal(otherCaller.status, 401);
    // the real password is also refused for that email while it is locked
    const stillLocked = await call('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: PASSWORD, portal: 'admin' } });
    assert.equal(stillLocked.status, 429);
  });

  await t.test('principal saves the institute data and reads it back', async () => {
    const put = await call('PUT', '/api/institute', { token: adminToken, body: { changes: seed } });
    assert.equal(put.status, 200);
    const res = await call('GET', '/api/sync', { token: adminToken });
    assert.equal(res.data.institute.students.length, 3);
    assert.equal(res.data.institute.students[0].id, 's1'); // order is kept
    assert.equal(res.data.institute.profile.name, 'Test Institute');
    // update one record and remove another without touching the rest
    await call('PUT', '/api/institute', { token: adminToken, body: { changes: { students: { upsert: [{ ...studentsList[0], name: 'Alice B' }], remove: ['s3'] } } } });
    const after = await call('GET', '/api/sync', { token: adminToken });
    assert.deepEqual(after.data.institute.students.map(s => s.name), ['Alice B', 'Bob']);
    // put it back
    await call('PUT', '/api/institute', { token: adminToken, body: { changes: { students: { upsert: studentsList } } } });
    const again = await call('GET', '/api/sync', { token: adminToken });
    assert.equal(again.data.institute.students.length, 3);
    // bad input
    assert.equal((await call('PUT', '/api/institute', { token: adminToken, body: { changes: { hackers: {} } } })).status, 400);
    assert.equal((await call('PUT', '/api/institute', { token: adminToken, body: { changes: { students: { upsert: [{ name: 'no id' }] } } } })).status, 400);
  });

  await t.test('same roll / receipt number from two computers: the later one is renumbered', async () => {
    const clash = { ...mkStudent('s-clash', '03', 'Clash', 'b2', '+91 98000 00099') };
    const put = await call('PUT', '/api/institute', { token: adminToken, body: { changes: { students: { upsert: [clash] } } } });
    assert.equal(put.status, 200);
    assert.equal(put.data.renumbered, 1); // the browser is told, so it fetches the new number
    const list = (await call('GET', '/api/sync', { token: adminToken })).data.institute.students;
    const rolls = list.map(s => s.rollNo);
    assert.equal(new Set(rolls).size, rolls.length);
    assert.equal(list.find(s => s.id === 's3').rollNo, '03'); // the first one keeps its number
    assert.equal(list.find(s => s.id === 's-clash').rollNo, '04');
    await call('PUT', '/api/institute', { token: adminToken, body: { changes: { students: { remove: ['s-clash'] } } } });

    const tx = { id: 'tx-clash', receiptNo: 'REC-2026-0001', studentId: 's2', studentName: 'Bob', studentRollNo: '02', batchName: 'Batch A', amount: 100, paymentMethod: 'Cash', date: '2026-01-03', installmentNo: 1 };
    await call('PUT', '/api/institute', { token: adminToken, body: { changes: { transactions: { upsert: [tx] } } } });
    const txs = (await call('GET', '/api/sync', { token: adminToken })).data.institute.transactions;
    assert.equal(txs.find(t => t.id === 'tx-clash').receiptNo, 'REC-2026-0002');
    await call('PUT', '/api/institute', { token: adminToken, body: { changes: { transactions: { remove: ['tx-clash'] } } } });
  });

  await t.test('teacher: request, approval and own-batch access only', async () => {
    const reg = await call('POST', '/api/auth/register-teacher', {
      body: { name: 'Tina', phone: '9800000010', subject: 'Maths', email: 't@x.com', password: PASSWORD }
    });
    assert.equal(reg.status, 200);
    const pending = await call('POST', '/api/auth/login', { body: { email: 't@x.com', password: PASSWORD, portal: 'teacher' } });
    assert.equal(pending.status, 403);
    assert.match(pending.data.error, /approval/);

    const users = (await call('GET', '/api/sync', { token: adminToken })).data.users;
    teacherId = users.find(u => u.email === 't@x.com').id;
    assert.equal((await call('POST', `/api/users/${teacherId}/approve`, { token: adminToken, body: { batchIds: ['b1'] } })).status, 200);

    const login = await call('POST', '/api/auth/login', { body: { email: 't@x.com', password: PASSWORD, portal: 'teacher' } });
    assert.equal(login.status, 200);
    teacherToken = login.data.token;

    const data = (await call('GET', '/api/sync', { token: teacherToken })).data;
    assert.equal(data.users, undefined);
    assert.deepEqual(data.institute.batches.map(b => b.id), ['b1']);
    assert.deepEqual(data.institute.students.map(s => s.id).sort(), ['s1', 's2']);
    assert.deepEqual(data.institute.transactions, []);
    assert.deepEqual(data.institute.notificationLogs, []);

    // may mark attendance for own batch, not for another one
    const mark = await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { attendance: { upsert: [{ id: 'att2', date: '2026-02-02', batchId: 'b1', records: { s1: 'present' }, markedBy: 't', updatedAt: '' }] } } } });
    assert.equal(mark.status, 200);
    const other = await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { attendance: { upsert: [{ id: 'att3', date: '2026-02-02', batchId: 'b2', records: {}, markedBy: 't', updatedAt: '' }] } } } });
    assert.equal(other.status, 403);
    // cannot change students, fees, profile or delete anything
    assert.equal((await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { students: { upsert: [{ ...studentsList[0], feePaid: 0 }] } } } })).status, 403);
    assert.equal((await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { profile: { name: 'Mine' } } } })).status, 403);
    assert.equal((await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { attendance: { remove: ['att1'] } } } })).status, 403);
    // can enter marks: only results and status of an existing test change
    const marks = await call('PUT', '/api/institute', { token: teacherToken, body: { changes: { exams: { upsert: [{ ...exam, title: 'Hacked', results: { s1: { marksObtained: 95 }, s2: { marksObtained: 60 } } }] } } } });
    assert.equal(marks.status, 200);
    const exams = (await call('GET', '/api/sync', { token: adminToken })).data.institute.exams;
    assert.equal(exams[0].title, 'Test 1');
    assert.equal(exams[0].results.s1.marksObtained, 95);
    // the principal's other data was not touched by the teacher's change
    assert.equal((await call('GET', '/api/sync', { token: adminToken })).data.institute.students.length, 3);
    // teacher cannot use the account endpoints
    assert.equal((await call('GET', '/api/audit', { token: teacherToken })).status, 403);
    assert.equal((await call('POST', '/api/users', { token: teacherToken, body: {} })).status, 403);
  });

  await t.test('student: sees only own data, with rank, and cannot write', async () => {
    const create = await call('POST', '/api/users', {
      token: adminToken,
      body: { name: 'Alice B', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }
    });
    assert.equal(create.status, 200);
    assert.equal((await call('POST', '/api/users', { token: adminToken, body: { name: 'Dup', email: 'dup@x.com', password: PASSWORD, role: 'student', studentId: 's1' } })).status, 409);

    const login = await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: PASSWORD, portal: 'student' } });
    assert.equal(login.status, 200);
    studentToken = login.data.token;

    const data = (await call('GET', '/api/sync', { token: studentToken })).data;
    assert.deepEqual(data.institute.students.map(s => s.id), ['s1']);
    assert.equal(data.institute.transactions.length, 1);
    assert.equal(data.institute.transactions[0].studentId, 's1');
    assert.deepEqual(data.institute.notificationLogs.map(l => l.id), ['l1']);
    const e = data.institute.exams[0];
    assert.deepEqual(Object.keys(e.results), ['s1']);
    assert.equal(e.results.s1.rank, 1);
    assert.equal(e.results.s1.totalGraded, 2);
    assert.equal(e.results.s1.highest, 95);
    assert.equal(JSON.stringify(data).includes('Bob'), false); // classmate's name is not sent
    assert.deepEqual(data.institute.attendance[0].records, { s1: 'present' });

    assert.equal((await call('PUT', '/api/institute', { token: studentToken, body: { changes: { students: { upsert: [{ ...studentsList[0], feePaid: 1000 }] } } } })).status, 403);
  });

  await t.test('public registration: options and a new student', async () => {
    const options = await call('GET', '/api/public/registration-options');
    assert.equal(options.data.courses.length, 1);
    assert.equal(options.data.batches[0].facultyName, undefined); // faculty and room are not public
    assert.equal(options.data.courses[0].standardFee, undefined);
    const b1 = options.data.batches.find(b => b.id === 'b1');
    assert.equal(b1.filled, 2);
    assert.equal(options.data.nextRollNo, '04');

    const form = { name: 'New Kid', phone: '9811111111', parentName: 'Parent', parentPhone: '9822222222', grade: 'Class 12', courseId: 'c1', batchId: 'b2', email: 'kid@x.com', password: PASSWORD };
    const full = await call('POST', '/api/auth/register-new-student', { body: { ...form, batchId: 'b1' } });
    assert.equal(full.status, 409); // b1 is full (2 of 2)
    const res = await call('POST', '/api/auth/register-new-student', { body: form });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'student');
    const mine = (await call('GET', '/api/sync', { token: res.data.token })).data.institute.students[0];
    assert.equal(mine.rollNo, '04');
    assert.equal(mine.status, 'trial');
    assert.equal(mine.phone, '+91 98111 11111'); // stored in one format
    assert.equal((await call('POST', '/api/auth/register-new-student', { body: { ...form, email: 'kid2@x.com' } })).status, 409); // same name + phone

    // existing admission: needs the roll number and a registered phone
    const bad = await call('POST', '/api/auth/register-student', { body: { rollNo: '02', phone: '9999999999', email: 'bob@x.com', password: PASSWORD } });
    assert.equal(bad.status, 400);
    const good = await call('POST', '/api/auth/register-student', { body: { rollNo: ' 2 ', phone: '98000 00002', email: 'bob@x.com', password: PASSWORD } });
    assert.equal(good.status, 200);
    assert.equal(good.data.user.name, 'Bob');
  });

  await t.test('passwords: change, reset and sign-out everywhere', async () => {
    const second = await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: PASSWORD, portal: 'student' } });
    const wrong = await call('POST', '/api/auth/change-password', { token: studentToken, body: { currentPassword: 'Nope12345', newPassword: 'Another123' } });
    assert.equal(wrong.status, 400);
    const changed = await call('POST', '/api/auth/change-password', { token: studentToken, body: { currentPassword: PASSWORD, newPassword: 'Another123' } });
    assert.equal(changed.status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: studentToken })).status, 200); // this device stays signed in
    assert.equal((await call('GET', '/api/auth/me', { token: second.data.token })).status, 401); // the other one does not
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: PASSWORD, portal: 'student' } })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: 'Another123', portal: 'student' } })).status, 200);

    const users = (await call('GET', '/api/sync', { token: adminToken })).data.users;
    const alice = users.find(u => u.email === 'alice@x.com');
    assert.equal((await call('POST', `/api/users/${alice.id}/reset-password`, { token: adminToken, body: { newPassword: 'weak' } })).status, 400);
    assert.equal((await call('POST', `/api/users/${alice.id}/reset-password`, { token: adminToken, body: { newPassword: 'Reset12345' } })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: studentToken })).status, 401); // reset signs the account out
  });

  await t.test('principal rules: last admin, own role, removal ends sessions', async () => {
    const me = (await call('GET', '/api/auth/me', { token: adminToken })).data.user;
    assert.equal((await call('DELETE', `/api/users/${me.id}`, { token: adminToken })).status, 400);
    assert.equal((await call('PUT', `/api/users/${me.id}/role`, { token: adminToken, body: { role: 'staff' } })).status, 400);
    assert.equal((await call('PUT', `/api/users/${teacherId}/role`, { token: adminToken, body: { role: 'staff' } })).status, 400);

    assert.equal((await call('GET', '/api/auth/me', { token: teacherToken })).status, 200);
    assert.equal((await call('DELETE', `/api/users/${teacherId}`, { token: adminToken })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: teacherToken })).status, 401);

    const log = (await call('GET', '/api/audit', { token: adminToken })).data.entries;
    assert.ok(log.some(e => e.action === 'login'));
    assert.ok(log.some(e => e.action === 'user-remove'));
    assert.ok(log.some(e => e.action === 'data' && /students/.test(e.detail)));
  });

  await t.test('sign out ends the session', async () => {
    const login = await call('POST', '/api/auth/login', { body: { email: 'p@x.com', password: PASSWORD, portal: 'admin', remember: false } });
    assert.equal((await call('POST', '/api/auth/logout', { token: login.data.token })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: login.data.token })).status, 401);
  });

  await t.test('everything survives a restart (including sessions)', async () => {
    await sleep(500);
    await server.stop();
    server = await startServer(dir, port);
    ({ call } = makeClient(server.base));
    const res = await call('GET', '/api/sync', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.institute.students.length, 4);
    assert.ok(res.data.users.length >= 3);
  });

  await server.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('upgrade from the old data file keeps accounts and data', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academia-legacy-'));
  const salt = 'abc123';
  const legacyUser = {
    id: 'u-1', name: 'Old Principal', email: 'old@x.com', role: 'admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
    salt, alg: 'sha256', passwordHash: crypto.createHash('sha256').update(`${salt}:${PASSWORD}`).digest('hex')
  };
  // the old data used roll numbers like APEX-25-0101
  const oldStudents = studentsList.map((st, i) => ({ ...st, rollNo: `APEX-25-010${i + 1}` }));
  const oldReceipt = { id: 'tx-old', receiptNo: 'REC-2025-0001', studentId: 's2', studentName: 'Bob', studentRollNo: 'APEX-25-0102', batchName: 'Batch A', amount: 100, paymentMethod: 'Cash', date: '2025-01-01', installmentNo: 1 };
  const institute = { profile: { name: 'Old Institute' }, students: oldStudents, batches, courses: [], attendance: [], transactions: [oldReceipt], exams: [], timetable: [], templates: [], notificationLogs: [] };
  fs.writeFileSync(
    path.join(dir, 'db.json'),
    JSON.stringify({ version: 3, data: { academia_os_users_v1: JSON.stringify([legacyUser]), academia_os_institute_data_v1: JSON.stringify(institute) } })
  );

  const port = await freePort();
  const server = await startServer(dir, port);
  const { call } = makeClient(server.base);

  await t.test('old account signs in and its data is there', async () => {
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'old@x.com', password: 'Wrong12345', portal: 'admin' } })).status, 401);
    const login = await call('POST', '/api/auth/login', { body: { email: 'old@x.com', password: PASSWORD, portal: 'admin' } });
    assert.equal(login.status, 200);
    const data = (await call('GET', '/api/sync', { token: login.data.token })).data;
    assert.equal(data.institute.profile.name, 'Old Institute');
    assert.equal(data.institute.students.length, 3);
    // roll numbers became plain running numbers, receipts follow their student
    assert.deepEqual(data.institute.students.map(st => st.rollNo), ['01', '02', '03']);
    assert.equal(data.institute.transactions[0].studentRollNo, '02');
  });

  await t.test('the old file is kept and the password hash is upgraded', async () => {
    await sleep(500);
    await server.stop();
    assert.ok(fs.readdirSync(dir).some(f => f.startsWith('db.before-upgrade-')));
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
    assert.equal(saved.format, 2);
    assert.equal(saved.users[0].alg, 'scrypt');
  });

  fs.rmSync(dir, { recursive: true, force: true });
});
