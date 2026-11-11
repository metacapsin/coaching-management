// Ported from server_py/tests/test_api.py: the daily flow of one institute, robustness, the features,
// the password hashes and the import of the old data file.
// Run with:  npm test     (an in-memory MongoDB is used; no real database and no real email)

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { basicHash, hashPassword } from '../src/auth.ts';
import { importLegacy } from '../src/legacy.ts';
import { snapshotIfDue } from '../src/scheduler.ts';
import { Store } from '../src/store.ts';
import { Api, BATCHES, EXAM, PASSWORD, SEED, STUDENTS, batch, dropDb, makeApi, newDb, startMongo, stopMongo, student } from './helpers.ts';

before(startMongo);
after(stopMongo);

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Flow: a day at the institute', () => {
  let db: ReturnType<typeof newDb>;
  let api: Api;
  const tokens: Record<string, string> = {};
  let teacherId = '';
  const call = (...a: Parameters<Api['call']>) => api.call(...a);

  before(async () => {
    db = newDb();
    api = await makeApi(db);
  });
  after(async () => {
    await api.close();
    await dropDb(db);
  });

  it('00 security headers', async () => {
    const res = await api.raw('/api/health');
    assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  it('01 setup creates the principal once', async () => {
    assert.equal((await call('GET', '/api/auth/status'))[1].hasUsers, false);
    assert.equal((await call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: 'short' }))[0], 400);
    const [status, data] = await call('POST', '/api/auth/setup', { name: 'Principal', email: 'P@X.com', password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(data.user.role, 'admin');
    assert.equal(data.user.email, 'p@x.com');
    tokens.admin = data.token;
    assert.equal((await call('POST', '/api/auth/setup', { name: 'Evil', email: 'e@x.com', password: PASSWORD }))[0], 409);
    assert.equal((await call('GET', '/api/auth/status'))[1].hasUsers, true);
  });

  it('02 data needs a session and hides passwords', async () => {
    assert.equal((await call('GET', '/api/sync'))[0], 401);
    assert.equal((await call('GET', '/api/sync', null, 'nonsense'))[0], 401);
    assert.equal((await call('PUT', '/api/institute', { changes: {} }))[0], 401);
    const [status, data] = await call('GET', '/api/sync', null, tokens.admin);
    assert.equal(status, 200);
    const text = JSON.stringify(data);
    assert.ok(!text.includes('passwordHash'));
    assert.ok(!text.includes('salt'));
    assert.equal((await call('GET', `/api/sync?since=${data.version}`, null, tokens.admin))[1].changed, false);
  });

  it('03 login rules and throttling', async () => {
    assert.equal((await call('POST', '/api/auth/login', { email: 'p@x.com', password: 'Wrong1234', portal: 'admin' }))[0], 401);
    const [status, data] = await call('POST', '/api/auth/login', { email: 'p@x.com', password: PASSWORD, portal: 'student' });
    assert.equal(status, 403);
    assert.ok(data.error.includes('Coaching Admin'));
    assert.equal((await call('POST', '/api/auth/login', { email: 'p@x.com', password: PASSWORD, portal: 'admin' }))[0], 200);

    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' });
    assert.equal((await call('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' }))[0], 429);
    // behind a proxy on this computer every caller has its own address: another address is not locked
    const other = await call('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'Wrong1234', portal: 'admin' }, null, { 'X-Forwarded-For': '203.0.113.9' });
    assert.equal(other[0], 401);
    // the real password is also refused for that email while it is locked
    assert.equal((await call('POST', '/api/auth/login', { email: 'nobody@x.com', password: PASSWORD, portal: 'admin' }))[0], 429);
  });

  it('04 principal saves and reads the institute', async () => {
    const admin = tokens.admin;
    assert.equal((await call('PUT', '/api/institute', { changes: SEED }, admin))[0], 200);
    const data = (await call('GET', '/api/sync', null, admin))[1].institute;
    assert.deepEqual(data.students.map((s: any) => s.id), ['s1', 's2', 's3']); // order is kept
    assert.equal(data.profile.name, 'Test Institute');
    assert.equal(data.courses.length, 1);
    assert.deepEqual(data.timetable, []); // an empty list that exists is sent as empty
    // update one record and remove another without touching the rest
    await call('PUT', '/api/institute', { changes: { students: { upsert: [{ ...STUDENTS[0], name: 'Alice B' }], remove: ['s3'] } } }, admin);
    const after = (await call('GET', '/api/sync', null, admin))[1].institute.students;
    assert.deepEqual(after.map((s: any) => s.name), ['Alice B', 'Bob']);
    await call('PUT', '/api/institute', { changes: { students: { upsert: STUDENTS } } }, admin);
    assert.equal((await call('GET', '/api/sync', null, admin))[1].institute.students.length, 3);
    // bad input
    assert.equal((await call('PUT', '/api/institute', { changes: { hackers: {} } }, admin))[0], 400);
    assert.equal((await call('PUT', '/api/institute', { changes: { students: { upsert: [{ name: 'no id' }] } } }, admin))[0], 400);
  });

  it('05 new records are put in front in the order sent', async () => {
    const admin = tokens.admin;
    const added = [student('s-n2', '07', 'N2', 'b2', '+91 98000 00072'), student('s-n1', '06', 'N1', 'b2', '+91 98000 00071')];
    await call('PUT', '/api/institute', { changes: { students: { upsert: added } } }, admin);
    const rolls = (await call('GET', '/api/sync', null, admin))[1].institute.students.map((s: any) => s.id);
    // (s3 was removed and added again in the test before, so it counts as the newest of the old ones)
    assert.deepEqual(rolls, ['s-n2', 's-n1', 's3', 's1', 's2']);
    await call('PUT', '/api/institute', { changes: { students: { remove: ['s-n1', 's-n2'] } } }, admin);
    // lists that are added at the end (batches) keep that order
    await call('PUT', '/api/institute', { changes: { batches: { upsert: [batch('b3', 'C', 'Batch C', 5, 0)] } } }, admin);
    const ids = (await call('GET', '/api/sync', null, admin))[1].institute.batches.map((b: any) => b.id);
    assert.deepEqual(ids, ['b1', 'b2', 'b3']);
    await call('PUT', '/api/institute', { changes: { batches: { remove: ['b3'] } } }, admin);
  });

  it('06 same roll or receipt number is renumbered', async () => {
    const admin = tokens.admin;
    const [status, data] = await call('PUT', '/api/institute', { changes: { students: { upsert: [student('s-clash', '03', 'Clash', 'b2', '+91 98000 00099')] } } }, admin);
    assert.equal(status, 200);
    assert.equal(data.adjusted, 1); // the browser is told, so it fetches the new number
    const students = (await call('GET', '/api/sync', null, admin))[1].institute.students;
    const rolls = students.map((s: any) => s.rollNo);
    assert.equal(new Set(rolls).size, rolls.length);
    assert.equal(students.find((s: any) => s.id === 's3').rollNo, '03'); // the first one keeps its number
    assert.equal(students.find((s: any) => s.id === 's-clash').rollNo, '04');
    await call('PUT', '/api/institute', { changes: { students: { remove: ['s-clash'] } } }, admin);

    const tx = { id: 'tx-clash', receiptNo: 'REC-2026-0001', studentId: 's2', studentName: 'Bob', studentRollNo: '02', batchName: 'Batch A', amount: 100, paymentMethod: 'Cash', date: '2026-01-03', installmentNo: 1 };
    await call('PUT', '/api/institute', { changes: { transactions: { upsert: [tx] } } }, admin);
    const txs = (await call('GET', '/api/sync', null, admin))[1].institute.transactions;
    assert.equal(txs.find((t: any) => t.id === 'tx-clash').receiptNo, 'REC-2026-0002');
    await call('PUT', '/api/institute', { changes: { transactions: { remove: ['tx-clash'] } } }, admin);
  });

  it('07 teacher sees and changes only own batches', async () => {
    const admin = tokens.admin;
    assert.equal((await call('POST', '/api/auth/register-teacher', { name: 'Tina', phone: '9800000010', subject: 'Maths', email: 't@x.com', password: PASSWORD }))[0], 200);
    let [status, data] = await call('POST', '/api/auth/login', { email: 't@x.com', password: PASSWORD, portal: 'teacher' });
    assert.equal(status, 403);
    assert.ok(data.error.includes('approval'));

    const users = (await call('GET', '/api/sync', null, admin))[1].users;
    teacherId = users.find((u: any) => u.email === 't@x.com').id;
    assert.equal((await call('POST', `/api/users/${teacherId}/approve`, { batchIds: ['b1'] }, admin))[0], 200);

    [status, data] = await call('POST', '/api/auth/login', { email: 't@x.com', password: PASSWORD, portal: 'teacher' });
    assert.equal(status, 200);
    const teacher = data.token;
    tokens.teacher = teacher;

    data = (await call('GET', '/api/sync', null, teacher))[1];
    assert.ok(!('users' in data));
    assert.deepEqual(data.institute.batches.map((b: any) => b.id), ['b1']);
    assert.deepEqual(data.institute.students.map((s: any) => s.id).sort(), ['s1', 's2']);
    assert.deepEqual(data.institute.transactions, []);
    assert.deepEqual(data.institute.notificationLogs, []);

    const att = (i: string, b: string) => ({ changes: { attendance: { upsert: [{ id: i, date: '2026-02-02', batchId: b, records: { s1: 'present' }, markedBy: 't', updatedAt: '' }] } } });
    assert.equal((await call('PUT', '/api/institute', att('att2', 'b1'), teacher))[0], 200);
    assert.equal((await call('PUT', '/api/institute', att('att3', 'b2'), teacher))[0], 403);
    assert.equal((await call('PUT', '/api/institute', { changes: { students: { upsert: [{ ...STUDENTS[0], feePaid: 0 }] } } }, teacher))[0], 403);
    assert.equal((await call('PUT', '/api/institute', { changes: { profile: { name: 'Mine' } } }, teacher))[0], 403);
    assert.equal((await call('PUT', '/api/institute', { changes: { attendance: { remove: ['att1'] } } }, teacher))[0], 403);

    const hacked = { ...EXAM, title: 'Hacked', results: { s1: { marksObtained: 95 }, s2: { marksObtained: 60 } } };
    assert.equal((await call('PUT', '/api/institute', { changes: { exams: { upsert: [hacked] } } }, teacher))[0], 200);
    const exams = (await call('GET', '/api/sync', null, admin))[1].institute.exams;
    assert.equal(exams[0].title, 'Test 1'); // only marks and status changed
    assert.equal(exams[0].results.s1.marksObtained, 95);
    assert.equal((await call('GET', '/api/sync', null, admin))[1].institute.students.length, 3);
    assert.equal((await call('GET', '/api/audit', null, teacher))[0], 403);
    assert.equal((await call('POST', '/api/users', {}, teacher))[0], 403);
  });

  it('08 student sees only own data with rank', async () => {
    const admin = tokens.admin;
    const [status] = await call('POST', '/api/users', { name: 'Alice B', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin);
    assert.equal(status, 200);
    assert.equal((await call('POST', '/api/users', { name: 'Dup', email: 'dup@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin))[0], 409);

    const [s2, login] = await call('POST', '/api/auth/login', { email: 'alice@x.com', password: PASSWORD, portal: 'student' });
    assert.equal(s2, 200);
    const token = login.token;
    tokens.student = token;

    const data = (await call('GET', '/api/sync', null, token))[1];
    const inst = data.institute;
    assert.deepEqual(inst.students.map((s: any) => s.id), ['s1']);
    assert.equal(inst.transactions.length, 1);
    assert.deepEqual(inst.notificationLogs, []); // the message to the parent is for the parent account, not for the student
    const e = inst.exams[0];
    assert.deepEqual(Object.keys(e.results), ['s1']);
    assert.equal(e.results.s1.rank, 1);
    assert.equal(e.results.s1.totalGraded, 2);
    assert.equal(e.results.s1.highest, 95);
    assert.ok(!JSON.stringify(data).includes('Bob')); // a classmate's name is not sent
    assert.deepEqual(inst.attendance[0].records, { s1: 'present' });
    assert.equal((await call('PUT', '/api/institute', { changes: { students: { upsert: [{ ...STUDENTS[0], feePaid: 1000 }] } } }, token))[0], 403);
  });

  it('09 public registration', async () => {
    const [, options] = await call('GET', '/api/public/registration-options');
    assert.equal(options.courses.length, 1);
    assert.equal(options.batches[0].facultyName, undefined); // faculty and room are not public
    assert.equal(options.courses[0].standardFee, undefined);
    const b1 = options.batches.find((b: any) => b.id === 'b1');
    assert.equal(b1.filled, 2);
    assert.equal(options.nextRollNo, '04');

    const form = { name: 'New Kid', phone: '9811111111', parentName: 'Parent', parentPhone: '9822222222', grade: 'Class 12', courseId: 'c1', batchId: 'b2', email: 'kid@x.com', password: PASSWORD };
    assert.equal((await call('POST', '/api/auth/register-new-student', { ...form, batchId: 'b1' }))[0], 409); // b1 is full
    const [status, res] = await call('POST', '/api/auth/register-new-student', form);
    assert.equal(status, 200);
    assert.equal(res.user.role, 'student');
    const mine = (await call('GET', '/api/sync', null, res.token))[1].institute.students[0];
    assert.equal(mine.rollNo, '04');
    assert.equal(mine.status, 'trial');
    assert.equal(mine.phone, '+91 98111 11111'); // stored in one format
    assert.equal((await call('POST', '/api/auth/register-new-student', { ...form, email: 'kid2@x.com' }))[0], 409); // same name + phone
    const batches = (await call('GET', '/api/sync', null, tokens.admin))[1].institute.batches;
    assert.equal(batches.find((b: any) => b.id === 'b2').enrolledCount, 2);

    const bad = await call('POST', '/api/auth/register-student', { rollNo: '02', phone: '9999999999', email: 'bob@x.com', password: PASSWORD });
    assert.equal(bad[0], 400);
    const [s2, good] = await call('POST', '/api/auth/register-student', { rollNo: ' 2 ', phone: '98000 00002', email: 'bob@x.com', password: PASSWORD });
    assert.equal(s2, 200);
    assert.equal(good.user.name, 'Bob');
  });

  it('10 passwords: change, reset and sign out everywhere', async () => {
    const admin = tokens.admin;
    const studentToken = tokens.student;
    const second = (await call('POST', '/api/auth/login', { email: 'alice@x.com', password: PASSWORD, portal: 'student' }))[1].token;
    const wrong = await call('POST', '/api/auth/change-password', { currentPassword: 'Nope12345', newPassword: 'Another123' }, studentToken);
    assert.equal(wrong[0], 400);
    assert.equal((await call('POST', '/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Another123' }, studentToken))[0], 200);
    assert.equal((await call('GET', '/api/auth/me', null, studentToken))[0], 200); // this device stays signed in
    assert.equal((await call('GET', '/api/auth/me', null, second))[0], 401); // the other one does not
    assert.equal((await call('POST', '/api/auth/login', { email: 'alice@x.com', password: PASSWORD, portal: 'student' }))[0], 401);
    assert.equal((await call('POST', '/api/auth/login', { email: 'alice@x.com', password: 'Another123', portal: 'student' }))[0], 200);

    // forgot password: same answer for known and unknown emails, the principal sees the request
    assert.deepEqual(await call('POST', '/api/auth/forgot-password', { email: 'nobody@x.com' }), [200, { ok: true }]);
    assert.deepEqual(await call('POST', '/api/auth/forgot-password', { email: 'ALICE@x.com' }), [200, { ok: true }]);
    let users = (await call('GET', '/api/sync', null, admin))[1].users;
    const alice = users.find((u: any) => u.email === 'alice@x.com');
    assert.ok(alice.resetRequestedAt);
    assert.equal((await call('POST', `/api/users/${alice.id}/reset-password`, { newPassword: 'weak' }, admin))[0], 400);
    assert.equal((await call('POST', `/api/users/${alice.id}/reset-password`, { newPassword: 'Reset12345' }, admin))[0], 200);
    assert.equal((await call('GET', '/api/auth/me', null, studentToken))[0], 401); // reset signs the account out
    users = (await call('GET', '/api/sync', null, admin))[1].users;
    assert.ok(!users.find((u: any) => u.email === 'alice@x.com').resetRequestedAt);
  });

  it('11 principal rules', async () => {
    const admin = tokens.admin;
    const teacher = tokens.teacher;
    const me = (await call('GET', '/api/auth/me', null, admin))[1].user;
    assert.equal((await call('DELETE', `/api/users/${me.id}`, null, admin))[0], 400);
    // there is no front desk staff role and no second principal: those accounts cannot be made
    for (const role of ['staff', 'admin']) {
      assert.equal((await call('POST', '/api/users', { name: 'Desk', email: 'desk@x.com', password: 'Desk12345pw', role }, admin))[0], 400);
    }

    assert.equal((await call('GET', '/api/auth/me', null, teacher))[0], 200);
    assert.equal((await call('DELETE', `/api/users/${teacherId}`, null, admin))[0], 200);
    assert.equal((await call('GET', '/api/auth/me', null, teacher))[0], 401);

    const log = (await call('GET', '/api/audit', null, admin))[1].entries;
    const actions = log.map((e: any) => e.action);
    assert.ok(actions.includes('login'));
    assert.ok(actions.includes('user-remove'));
    assert.ok(log.some((e: any) => e.action === 'data' && e.detail.includes('students')));
  });

  it('12 sign out ends the session', async () => {
    const token = (await call('POST', '/api/auth/login', { email: 'p@x.com', password: PASSWORD, portal: 'admin', remember: false }))[1].token;
    assert.equal((await call('POST', '/api/auth/logout', null, token))[0], 200);
    assert.equal((await call('GET', '/api/auth/me', null, token))[0], 401);
  });

  it('13 everything survives a restart', async () => {
    const again = await makeApi(db); // a new server on the same database
    try {
      const [status, data] = await again.call('GET', '/api/sync', null, tokens.admin);
      assert.equal(status, 200);
      assert.equal(data.institute.students.length, 4);
      assert.ok(data.users.length >= 3);
    } finally {
      await again.close();
    }
  });
});

describe('Robustness', () => {
  let db: ReturnType<typeof newDb>;
  let api: Api;
  let admin = '';

  before(async () => {
    db = newDb();
    api = await makeApi(db);
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
  });
  after(async () => {
    await api.close();
    await dropDb(db);
  });

  it('ids must be text', async () => {
    // An object where an id is expected (for example {"$ne": null}) is refused, not used in a query.
    const body = { name: 'S', email: 's@x.com', password: PASSWORD, role: 'student', studentId: { $ne: null } };
    assert.equal((await api.call('POST', '/api/users', body, admin))[0], 400);
  });

  it('a database problem is a clear 503', async () => {
    const original = api.root.version;
    api.root.version = async () => {
      throw Object.assign(new Error('no servers'), { name: 'MongoServerSelectionError' });
    };
    try {
      const [status, data] = await api.call('GET', '/api/health');
      assert.equal(status, 503);
      assert.ok(data.error.includes('database'));
    } finally {
      api.root.version = original;
    }
  });

  it('broken requests get JSON answers', async () => {
    const res = await api.raw('/api/auth/login', { method: 'POST', body: 'not json', headers: { 'Content-Type': 'application/json' } });
    assert.equal(res.status, 401); // treated as an empty form, not a crash
    assert.equal((await api.call('DELETE', '/api/health'))[0], 405);
    assert.equal((await api.call('GET', '/api/does-not-exist'))[0], 404);
  });
});

describe('Features: photos, notices, material, enquiries, backups, own details', () => {
  let db: ReturnType<typeof newDb>;
  let api: Api;
  let admin = '';
  let teacher = '';
  let alice = '';
  let carol = '';

  // every test starts with fresh data, like setUp in the Python tests
  async function setUp() {
    db = newDb();
    api = await makeApi(db);
    const call = api.call.bind(api);
    admin = (await call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    await call('PUT', '/api/institute', { changes: SEED }, admin);

    await call('POST', '/api/auth/register-teacher', { name: 'Tina', phone: '9800000010', subject: 'Maths', email: 't@x.com', password: PASSWORD });
    const users = (await call('GET', '/api/sync', null, admin))[1].users;
    const teacherId = users.find((u: any) => u.email === 't@x.com').id;
    await call('POST', `/api/users/${teacherId}/approve`, { batchIds: ['b1'] }, admin);
    teacher = (await call('POST', '/api/auth/login', { email: 't@x.com', password: PASSWORD, portal: 'teacher' }))[1].token;

    await call('POST', '/api/users', { name: 'Alice', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin);
    await call('POST', '/api/users', { name: 'Carol', email: 'carol@x.com', password: PASSWORD, role: 'student', studentId: 's3' }, admin);
    alice = (await call('POST', '/api/auth/login', { email: 'alice@x.com', password: PASSWORD, portal: 'student' }))[1].token;
    carol = (await call('POST', '/api/auth/login', { email: 'carol@x.com', password: PASSWORD, portal: 'student' }))[1].token;
  }
  async function tearDown() {
    await api.close();
    await dropDb(db);
  }
  const feature = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      await setUp();
      try {
        await fn();
      } finally {
        await tearDown();
      }
    });

  const institute = async (token: string) => (await api.call('GET', '/api/sync', null, token))[1].institute;
  const push = (token: string, changes: any) => api.call('PUT', '/api/institute', { changes }, token);

  feature('photos are kept apart from the records', async () => {
    const [status, data] = await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: TINY_PNG }] } });
    assert.equal(status, 200);
    assert.equal(data.adjusted, 1); // the browser must fetch the new address
    const alice1 = (await institute(admin)).students.find((x: any) => x.id === 's1');
    assert.ok(alice1.photoUrl.startsWith('/api/photos/s1/'));
    assert.ok(!JSON.stringify(await institute(admin)).includes('data:image')); // the lists stay small

    const res = await api.raw(alice1.photoUrl); // no sign-in needed: an <img> cannot send one
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.ok(res.headers.get('cache-control')!.includes('immutable'));
    assert.equal((await api.raw('/api/photos/s1/wrong-token')).status, 404);
    assert.equal((await api.raw('/api/photos/s2/anything')).status, 404);

    // a new photo gets a new address
    await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: TINY_PNG }] } });
    const again = (await institute(admin)).students.find((x: any) => x.id === 's1');
    assert.notEqual(again.photoUrl, alice1.photoUrl);

    // removing the student removes the photo
    await push(admin, { students: { remove: ['s1'] } });
    assert.equal((await api.raw(again.photoUrl)).status, 404);
  });

  feature('bad photos are refused', async () => {
    const bad = await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: 'data:text/html;base64,PGI+aGk8L2I+' }] } });
    assert.equal(bad[0], 400);
    const broken = await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: 'data:image/png;base64,@@@' }] } });
    assert.equal(broken[0], 400);
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(1_600_000, 'x').toString('base64');
    assert.equal((await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: big }] } }))[0], 413);
  });

  feature('photos inside old records are moved at start', async () => {
    await db.collection('students').updateOne({ _id: 's2' as any }, { $set: { photoUrl: TINY_PNG } });
    const restarted = await makeApi(db); // a restart
    await restarted.close();
    const bob = (await institute(admin)).students.find((x: any) => x.id === 's2');
    assert.ok(bob.photoUrl.startsWith('/api/photos/s2/'));
  });

  feature('notices reach the right people', async () => {
    const notice = (nid: string, audience: string, batchId: string | null = null, extra: any = {}) => ({
      id: nid, title: nid, body: 'text', audience, batchId, createdAt: '2026-10-24T10:00:00Z', ...extra,
    });
    assert.equal((await push(admin, { announcements: { upsert: [notice('n-all', 'all'), notice('n-b1', 'batch', 'b1'), notice('n-b2', 'batch', 'b2')] } }))[0], 200);
    const ids = async (token: string) => (await institute(token)).announcements.map((a: any) => a.id).sort();
    assert.deepEqual(await ids(admin), ['n-all', 'n-b1', 'n-b2']);
    assert.deepEqual(await ids(teacher), ['n-all', 'n-b1']); // teacher of b1
    assert.deepEqual(await ids(alice), ['n-all', 'n-b1']); // student of b1
    assert.deepEqual(await ids(carol), ['n-all', 'n-b2']); // student of b2

    // a teacher can post to an own batch only, and the notice carries the teacher as author
    assert.equal((await push(teacher, { announcements: { upsert: [notice('t1', 'batch', 'b1', { authorId: 'someone-else' })] } }))[0], 200);
    const mine = (await institute(admin)).announcements.find((a: any) => a.id === 't1');
    assert.equal(mine.authorName, 'Tina');
    assert.notEqual(mine.authorId, 'someone-else');
    assert.equal((await push(teacher, { announcements: { upsert: [notice('t2', 'batch', 'b2')] } }))[0], 403); // not her batch
    assert.equal((await push(teacher, { announcements: { upsert: [notice('t3', 'all')] } }))[0], 403); // not for everybody
    // only her own notices can be changed or removed
    assert.equal((await push(teacher, { announcements: { remove: ['n-b1'] } }))[0], 403);
    assert.equal((await push(teacher, { announcements: { upsert: [notice('n-b1', 'batch', 'b1')] } }))[0], 403);
    assert.equal((await push(teacher, { announcements: { remove: ['t1'] } }))[0], 200);
    assert.equal((await push(alice, { announcements: { upsert: [notice('s1', 'all')] } }))[0], 403);
  });

  feature('study material', async () => {
    const material = (mid: string, batchId: string) => ({
      id: mid, title: mid, description: '', type: 'link', url: 'https://example.com', batchId, batchName: batchId, subject: 'Maths',
      createdAt: '2026-10-24T10:00:00Z', authorId: 'x', authorName: 'x',
    });
    assert.equal((await push(teacher, { materials: { upsert: [material('m1', 'b1')] } }))[0], 200);
    assert.equal((await push(teacher, { materials: { upsert: [material('m2', 'b2')] } }))[0], 403); // not her batch
    assert.equal((await push(admin, { materials: { upsert: [material('m3', 'b2')] } }))[0], 200);
    const ids = async (token: string) => (await institute(token)).materials.map((m: any) => m.id).sort();
    assert.deepEqual(await ids(admin), ['m1', 'm3']);
    assert.deepEqual(await ids(teacher), ['m1']);
    assert.deepEqual(await ids(alice), ['m1']);
    assert.deepEqual(await ids(carol), ['m3']);
    assert.equal((await push(teacher, { materials: { remove: ['m3'] } }))[0], 403); // not her batch
    assert.equal((await push(teacher, { materials: { remove: ['m1'] } }))[0], 200);
    assert.equal((await push(alice, { materials: { upsert: [material('m9', 'b1')] } }))[0], 403);
  });

  feature('enquiries are for the office only', async () => {
    const enquiry = { id: 'q1', name: 'Rahul', phone: '9811111111', source: 'walk-in', status: 'new', notes: '', createdAt: '2026-10-24T10:00:00Z' };
    assert.equal((await push(admin, { enquiries: { upsert: [enquiry] } }))[0], 200);
    assert.equal((await push(teacher, { enquiries: { upsert: [{ ...enquiry, id: 'q2' }] } }))[0], 403);
    assert.equal((await push(alice, { enquiries: { upsert: [{ ...enquiry, id: 'q3' }] } }))[0], 403);
    assert.deepEqual((await institute(admin)).enquiries.map((q: any) => q.id), ['q1']);
    assert.deepEqual((await institute(teacher)).enquiries, []);
    assert.deepEqual((await institute(alice)).enquiries, []);
  });

  feature('backup and restore', async () => {
    await push(admin, { students: { upsert: [{ ...STUDENTS[0], photoUrl: TINY_PNG }] } });
    const res = await api.raw('/api/backup', { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-disposition')!.includes('attachment'));
    const backup: any = await res.json();
    assert.equal(backup.format, 'academiaos-backup');
    assert.equal(backup.institute.students.length, 3);
    assert.equal(backup.photos.length, 1);
    assert.ok(backup.users.some((u: any) => u.email === 'p@x.com' && 'passwordHash' in u));
    assert.equal((await api.call('GET', '/api/backup', null, teacher))[0], 403);

    // change things, then restore
    await push(admin, { students: { remove: ['s2', 's3'] } });
    assert.equal((await institute(admin)).students.length, 1);
    assert.equal((await api.call('POST', '/api/backup/restore', { backup }, admin))[0], 400); // needs the confirmation
    const [status, report] = await api.call('POST', '/api/backup/restore', { backup, confirm: 'RESTORE' }, admin);
    assert.equal(status, 200);
    assert.equal(report.lists.students, 3);
    assert.equal((await institute(admin)).students.length, 3);
    assert.equal((await api.call('GET', '/api/auth/me', null, admin))[0], 200); // still signed in
    assert.equal((await api.call('POST', '/api/backup/restore', { backup: { nothing: 1 }, confirm: 'RESTORE' }, admin))[0], 400);

    // the restore took a safety snapshot first
    const backups = (await api.call('GET', '/api/backups', null, admin))[1].backups;
    assert.ok(backups.some((b: any) => b.label === 'before restore'));
  });

  feature('stored snapshots', async () => {
    assert.deepEqual((await api.call('GET', '/api/backups', null, admin))[1].backups, []);
    const [status, created] = await api.call('POST', '/api/backups', { label: 'manual' }, admin);
    assert.equal(status, 200);
    const listed = (await api.call('GET', '/api/backups', null, admin))[1].backups;
    assert.deepEqual(listed.map((b: any) => b.id), [created.id]);
    assert.equal((await api.call('POST', '/api/backups', {}, teacher))[0], 403);

    await push(admin, { students: { remove: ['s1', 's2', 's3'] } });
    assert.deepEqual((await institute(admin)).students, []);
    assert.equal((await api.call('POST', `/api/backups/${created.id}/restore`, {}, admin))[0], 400);
    assert.equal((await api.call('POST', `/api/backups/${created.id}/restore`, { confirm: 'RESTORE' }, admin))[0], 200);
    assert.equal((await institute(admin)).students.length, 3);
    assert.equal((await api.call('POST', '/api/backups/nope/restore', { confirm: 'RESTORE' }, admin))[0], 404);
    const download = await api.raw(`/api/backups/${created.id}`, { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal(((await download.json()) as any).format, 'academiaos-backup');
  });

  feature('only the newest snapshots are kept', async () => {
    for (let i = 0; i < 17; i++) {
      await db.collection('backups').insertOne({ _id: `old-${String(i).padStart(2, '0')}` as any, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)), label: 'automatic', size: 1, payload: Buffer.alloc(0) });
    }
    await api.root.pruneBackups(14);
    assert.equal(await db.collection('backups').countDocuments({}), 14);
  });

  feature('the daily snapshot is made when due', async () => {
    const first = await snapshotIfDue(api.root);
    assert.notEqual(first, null); // none yet: made at once
    assert.equal(await snapshotIfDue(api.root), null); // less than a day later: nothing
    const later = new Date(Date.now() + 25 * 3600 * 1000);
    assert.notEqual(await snapshotIfDue(api.root, undefined, later), null); // a day later: a new one
    assert.equal((await api.call('GET', '/api/backups', null, admin))[1].backups.length, 2);
  });

  feature('own details', async () => {
    // a teacher and a student change the mobile number only (the email and the password have their own routes)
    const [status, data] = await api.call('PUT', '/api/auth/profile', { phone: '9800000099' }, teacher);
    assert.equal(status, 200);
    assert.equal(data.user.phone, '9800000099');
    const users = (await api.call('GET', '/api/sync', null, admin))[1].users;
    assert.equal(users.find((u: any) => u.email === 't@x.com').phone, '9800000099');
    assert.equal((await api.call('PUT', '/api/auth/profile', { phone: '123' }, teacher))[0], 400);
    // the name and the subject are not theirs to change (the principal does it)
    assert.equal((await api.call('PUT', '/api/auth/profile', { name: 'Tina T' }, teacher))[0], 403);
    assert.equal((await api.call('PUT', '/api/auth/profile', { subject: 'Physics' }, teacher))[0], 403);
    const [, d2] = await api.call('PUT', '/api/auth/profile', { phone: '9800000088' }, alice);
    assert.deepEqual([d2.user.name, d2.user.phone], ['Alice', '9800000088']);
    assert.equal((await api.call('PUT', '/api/auth/profile', { name: 'Hacker', phone: '9800000077' }, alice))[0], 403);
    assert.equal((await api.call('GET', '/api/auth/me', null, alice))[1].user.phone, '9800000088'); // nothing of the refused change
    assert.equal((await api.call('PUT', '/api/auth/profile', { phone: '9800000088' }))[0], 401);
    // the principal changes the name of the own login
    const [st3, d3] = await api.call('PUT', '/api/auth/profile', { name: 'Principal P' }, admin);
    assert.deepEqual([st3, d3.user.name], [200, 'Principal P']);
    assert.equal((await api.call('PUT', '/api/auth/profile', { name: '' }, admin))[0], 400);
  });
});

describe('Password hashes', () => {
  // The same hashes the Python server makes (and the older Node server), so accounts work on both servers.
  it('scrypt matches', () => {
    assert.equal(
      hashPassword('Passw0rd123', '0123456789abcdef0123456789abcdef'),
      '9d7ea5f5b8f4c371d86189d7968ba9da64af00c4229c4ff0a36dce6fa8dd03a40c4d49ea097eae8b92bd5ce4748efd1ecff217f6b5fe1d51c15b5a72536a7040',
    );
  });

  it('the old weak hash matches', () => {
    assert.equal(basicHash('abc123:Passw0rd123'), '4480d2790cf9c');
    assert.equal(basicHash('sañlt:päss\u{1F600}wd1'), '3357dc0d9ce8c');
    assert.equal(basicHash(''), 'bdcb81aee8d83');
  });
});

describe('Old data import', () => {
  it('the old file is moved and old accounts sign in', async () => {
    const salt = 'abc123';
    const legacyUser = {
      id: 'u-1', name: 'Old Principal', email: 'old@x.com', role: 'admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', salt, alg: 'sha256',
      passwordHash: crypto.createHash('sha256').update(`${salt}:${PASSWORD}`).digest('hex'),
    };
    const oldStudents = STUDENTS.map((s, i) => ({ ...s, rollNo: `APEX-25-010${i + 1}` })); // the old roll numbers
    const oldReceipt = { id: 'tx-old', receiptNo: 'REC-2025-0001', studentId: 's2', studentName: 'Bob', studentRollNo: 'APEX-25-0102', batchName: 'Batch A', amount: 100, paymentMethod: 'Cash', date: '2025-01-01', installmentNo: 1 };
    const institute = { profile: { name: 'Old Institute' }, students: oldStudents, batches: BATCHES, courses: [], attendance: [], transactions: [oldReceipt], exams: [], timetable: [], templates: [], notificationLogs: [] };
    const raw = { version: 3, data: { academia_os_users_v1: JSON.stringify([legacyUser]), academia_os_institute_data_v1: JSON.stringify(institute) } };

    const db = newDb();
    try {
      const report = await importLegacy(new Store(db), raw);
      assert.equal(report.users, 1);
      assert.equal(report.renumbered, 3);

      const api = await makeApi(db);
      try {
        assert.equal((await api.call('POST', '/api/auth/login', { email: 'old@x.com', password: 'Wrong12345', portal: 'admin' }))[0], 401);
        const [status, login] = await api.call('POST', '/api/auth/login', { email: 'old@x.com', password: PASSWORD, portal: 'admin' });
        assert.equal(status, 200);
        const data = (await api.call('GET', '/api/sync', null, login.token))[1].institute;
        assert.equal(data.profile.name, 'Old Institute');
        assert.deepEqual(data.students.map((s: any) => s.rollNo), ['01', '02', '03']); // plain running numbers
        assert.equal(data.transactions[0].studentRollNo, '02');
        assert.equal((await db.collection('users').findOne({ email: 'old@x.com' }))!.alg, 'scrypt'); // the hash was upgraded at sign in
      } finally {
        await api.close();
      }
    } finally {
      await dropDb(db);
    }
  });
});
