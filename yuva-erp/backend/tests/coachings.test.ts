// Ported from server_py/tests/test_api.py: several coachings in one database, managed by a Super Admin,
// and the emails the routes write (captured, never sent).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as mailer from '../src/mailer.ts';
import { Store } from '../src/store.ts';
import { Api, PASSWORD, SEED, STUDENTS, captureMail, dropDb, makeApi, newDb, startMongo, stopMongo } from './helpers.ts';

before(startMongo);
after(stopMongo);

describe('Coachings', () => {
  let db: ReturnType<typeof newDb>;
  let api: Api;
  let sup = '';
  let adminA = '';
  let adminB = '';
  let orgA = '';
  let orgB = '';
  const call = (...a: Parameters<Api['call']>) => api.call(...a);

  before(async () => {
    db = newDb();
    api = await makeApi(db);
  });
  after(async () => {
    await api.close();
    await dropDb(db);
  });

  const login = (email: string, password = PASSWORD, portal = 'admin') => call('POST', '/api/auth/login', { email, password, portal });
  const loginTo = (email: string, orgId: string, password = PASSWORD) => call('POST', '/api/auth/login', { email, password, portal: 'admin', orgId });
  const coaching = (name: string, email: string) => ({ coachingName: name, city: 'Bijainagar', adminName: `${name} Admin`, email, phone: '+91 98000 11111', password: PASSWORD });
  const orgs = async () => (await call('GET', '/api/super/orgs', null, sup))[1].orgs as any[];
  const orgId = async (name: string) => (await orgs()).find((o) => o.name === name).id as string;

  it('01 super admin setup and limits', async () => {
    assert.equal((await call('GET', '/api/super/status'))[1].hasSuper, false);
    const [status, data] = await call('POST', '/api/super/setup', { name: 'Super', email: 'super@x.com', password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(data.user.role, 'super');
    sup = data.token;
    assert.equal((await call('POST', '/api/super/setup', { name: 'Evil', email: 'e@x.com', password: PASSWORD }))[0], 409);
    // nobody can create a coaching principal through the first-run page, bypassing the approval
    assert.equal((await call('GET', '/api/auth/status'))[1].hasUsers, true);
    assert.equal((await call('POST', '/api/auth/setup', { name: 'Evil', email: 'e2@x.com', password: PASSWORD }))[0], 409);
    // one login page with two tabs: the super admin has its own, the principals use the other
    assert.equal((await login('super@x.com', PASSWORD, 'super'))[0], 200);
    const [s2, d2] = await login('super@x.com', PASSWORD, 'admin');
    assert.equal(s2, 403);
    assert.ok(d2.error.includes('Super Admin'));
    assert.equal((await call('GET', '/api/auth/status'))[1].hasSuper, true);
    // the super admin cannot open the data of a coaching
    assert.equal((await call('GET', '/api/sync', null, sup))[0], 403);
    for (const [method, url] of [['GET', '/api/backups'], ['GET', '/api/backup'], ['GET', '/api/audit'], ['POST', '/api/users'], ['PUT', '/api/institute']]) {
      assert.equal((await call(method, url, {}, sup))[0], 403, url);
    }
    assert.equal((await call('GET', '/api/auth/me', null, sup))[0], 200);
  });

  it('02 a new coaching waits for approval', async () => {
    assert.equal((await call('POST', '/api/public/register-coaching', coaching('Alpha', 'a@x.com')))[0], 200);
    assert.equal((await call('POST', '/api/public/register-coaching', coaching('Dup', 'a@x.com')))[0], 409);
    const [status, data] = await login('a@x.com');
    assert.equal(status, 403);
    assert.ok(data.error.includes('super admin'));
    const alpha = (await orgs()).find((o) => o.name === 'Alpha');
    assert.equal(alpha.status, 'pending');
    assert.equal(alpha.admin.email, 'a@x.com');
    assert.equal((await call('POST', `/api/super/orgs/${alpha.id}/approve`, null, sup))[0], 200);
    const [s2, d2] = await login('a@x.com');
    assert.equal(s2, 200);
    adminA = d2.token;
    orgA = alpha.id;
    assert.equal((await call('GET', '/api/super/orgs', null, adminA))[0], 403); // a principal is not a super admin
    assert.equal((await call('GET', '/api/super/audit', null, adminA))[0], 403);
    const actions = (await call('GET', '/api/super/audit', null, sup))[1].entries.map((e: any) => e.action);
    assert.ok(actions.includes('coaching-approve'));
    assert.ok(actions.includes('coaching-requested'));
  });

  it('02b the principal is told about the decision', async () => {
    // approved: an email goes to the principal
    await call('POST', '/api/public/register-coaching', coaching('Mailco', 'mail@x.com'));
    const mail = captureMail();
    let status: number, data: any;
    try {
      [status, data] = await call('POST', `/api/super/orgs/${await orgId('Mailco')}/approve`, null, sup);
    } finally {
      mail.stop();
    }
    assert.deepEqual([status, data.notified], [200, 'sent']);
    const [to, subject, body, html] = mail.sent[mail.sent.length - 1];
    assert.ok(html!.includes('<html')); // a good looking version next to the plain text
    assert.equal(to, 'mail@x.com');
    assert.ok(subject.includes('approved'));
    assert.ok(body.includes('You can sign in now'));

    // rejected with a reason, and email is not set up: the same words come back to be sent on WhatsApp
    await call('POST', '/api/public/register-coaching', coaching('Nomail', 'no@x.com'));
    mailer.overrideSend(() => false);
    try {
      [status, data] = await call('POST', `/api/super/orgs/${await orgId('Nomail')}/reject`, { reason: 'Wrong city' }, sup);
    } finally {
      mailer.overrideSend(null);
    }
    assert.deepEqual([status, data.notified], [200, 'no-email']);
    assert.ok(data.message.includes('not approved'));
    assert.ok(data.message.includes('Reason: Wrong city'));
    assert.equal(data.phone, '+91 98000 11111');
    // the request is gone, so that email can register again
    assert.equal((await call('POST', '/api/public/register-coaching', coaching('Nomail', 'no@x.com')))[0], 200);
    await call('POST', `/api/super/orgs/${await orgId('Nomail')}/reject`, {}, sup);
    // the two coachings of this test are removed again, the next tests count on the coachings that were there
    await call('DELETE', `/api/super/orgs/${await orgId('Mailco')}`, { confirmName: 'Mailco', password: PASSWORD }, sup);
  });

  it('02c without an email service nothing is sent and nothing breaks', () => {
    mailer.setDelivery(null);
    try {
      assert.equal(mailer.configured(), false);
      assert.equal(mailer.send('a@b.com', 'hi', 'text'), false);
    } finally {
      mailer.setDelivery(() => true, 0);
    }
  });

  it('02d a forgotten password is set with the emailed code', async () => {
    const mail = captureMail();
    try {
      assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'a@x.com' }))[0], 200);
      assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'nobody@x.com' }))[0], 200); // the same answer, nobody can search emails
      assert.deepEqual(mail.sent.map((m) => m[0]), ['a@x.com']);
      let code = /Your code: (\d{6})/.exec(mail.sent[0][2])![1];
      const wrong = code !== '000000' ? '000000' : '111111';
      assert.equal((await call('POST', '/api/auth/reset-with-code', { email: 'a@x.com', code: wrong, password: 'NewPass#456' }))[0], 400);
      assert.equal((await call('POST', '/api/auth/reset-with-code', { email: 'a@x.com', code, password: 'short' }))[0], 400); // a weak password is refused
      assert.equal((await call('POST', '/api/auth/reset-with-code', { email: 'a@x.com', code, password: 'NewPass#456' }))[0], 200);
      assert.equal((await login('a@x.com'))[0], 401); // the old password is gone
      assert.equal((await call('POST', '/api/auth/login', { email: 'a@x.com', password: 'NewPass#456', remember: false, portal: 'admin' }))[0], 200);
      // a code works once
      assert.equal((await call('POST', '/api/auth/reset-with-code', { email: 'a@x.com', code, password: 'Other#7890' }))[0], 400);
      // put the password back for the tests that follow
      await call('POST', '/api/auth/forgot-password', { email: 'a@x.com' });
      code = /Your code: (\d{6})/.exec(mail.sent[mail.sent.length - 1][2])![1];
      assert.equal((await call('POST', '/api/auth/reset-with-code', { email: 'a@x.com', code, password: PASSWORD }))[0], 200);
    } finally {
      mail.stop();
    }
    const [status, data] = await login('a@x.com');
    assert.equal(status, 200);
    adminA = data.token; // the reset signed the old sessions out
  });

  it('02e a new request is told to the principal and the super admin', async () => {
    const mail = captureMail();
    try {
      assert.equal((await call('POST', '/api/public/register-coaching', coaching('Zeta', 'z@x.com')))[0], 200);
    } finally {
      mail.stop();
    }
    const to = mail.sent.map((m) => m[0]);
    assert.ok(to.includes('z@x.com'));
    assert.ok(to.includes('super@x.com'));
    const superMail = mail.sent.find((m) => m[0] === 'super@x.com')!;
    assert.ok(superMail[2].includes('z@x.com')); // who asked
    assert.ok(superMail[2].includes('Approve or Reject')); // what to do
    assert.ok(superMail[2].includes('http')); // where to go
    await call('POST', `/api/super/orgs/${await orgId('Zeta')}/reject`, {}, sup);
  });

  it('02f the people of a coaching get their emails', async () => {
    const mail = captureMail();
    try {
      // the principal adds a teacher: the teacher is told the email, the first password and where to sign in
      const added = await call('POST', '/api/users', { name: 'Tina Teacher', email: 'tina@x.com', password: 'Teach#12345', role: 'teacher', subject: 'Physics', batchIds: [] }, adminA);
      assert.equal(added[0], 200);
      // a teacher asks to join by the sign up form: the teacher and the principal are told
      const asked = await call('POST', '/api/auth/register-teacher', { orgId: orgA, name: 'Rita Teacher', email: 'rita@x.com', phone: '9876500077', password: 'Teach#12345', subject: 'Maths' });
      assert.equal(asked[0], 200);
    } finally {
      mail.stop();
    }
    const tina = mail.sent.find((m) => m[0] === 'tina@x.com')!;
    assert.ok(tina[1].includes('Your AcademiaOS account'));
    assert.ok(tina[2].includes('teacher'));
    assert.ok(tina[2].includes('Teach#12345')); // the first password the principal chose
    assert.ok(tina[2].includes('portal=member')); // the button opens the teacher / student form
    assert.ok(mail.sent.map((m) => m[0]).includes('rita@x.com')); // "we received your request"
    for (const m of mail.sent) assert.ok(m[2].includes('http'), m[1]); // every email has a link (and a button)
    assert.ok(mail.sent.map((m) => m[0]).includes('a@x.com')); // the principal: "a teacher asks to join"
    // the principal approves her: she is told
    const ritaId = (await call('GET', '/api/sync', null, adminA))[1].users.find((u: any) => u.email === 'rita@x.com').id;
    const mail2 = captureMail();
    try {
      assert.equal((await call('POST', `/api/users/${ritaId}/approve`, { batchIds: [] }, adminA))[0], 200);
    } finally {
      mail2.stop();
    }
    assert.deepEqual(mail2.sent.map((m) => m[0]), ['rita@x.com']);
    assert.ok(mail2.sent[0][1].includes('approved'));
    assert.ok(mail2.sent[0][2].includes('http')); // every email has a link
  });

  it('02h the office emails the parent a fee notice, with a Pay now button when the UPI id is written', async () => {
    const base = { id: 'fs1', rollNo: '01', name: 'Fee Student', email: '', phone: '9811122233', parentName: 'Fee Parent', parentEmail: 'feeparent@x.com', parentPhone: '9811100000', grade: 'Class 12', courseId: 'c1', batchId: 'b1', targetExam: 'JEE', dateOfAdmission: '2026-11-01', status: 'active', photoUrl: '/avatar.svg', address: '', totalFees: 50000, discount: 0, feePaid: 10000 };
    assert.equal((await call('PUT', '/api/institute', { changes: { students: { upsert: [base] } } }, adminA))[0], 200);
    let mail = captureMail();
    try {
      const [status, data] = await call('POST', '/api/fees/notice-email', { studentId: 'fs1' }, adminA);
      assert.deepEqual([status, data.notified], [200, 'sent']);
    } finally {
      mail.stop();
    }
    assert.deepEqual(mail.sent.map((m) => m[0]), ['feeparent@x.com']);
    assert.ok(mail.sent[0][2].includes('40,000'), 'the pending amount');
    assert.ok(!mail.sent[0][2].includes('/pay?'), 'no UPI id yet: no Pay now link');
    // the principal writes the UPI id: the email has the Pay now button
    assert.equal((await call('PUT', '/api/institute', { changes: { profile: { name: 'Alpha', currencySymbol: '₹', upiId: 'alpha@okbank' } } }, adminA))[0], 200);
    mail = captureMail();
    try {
      await call('POST', '/api/fees/notice-email', { studentId: 'fs1' }, adminA);
    } finally {
      mail.stop();
    }
    assert.ok(/\/pay\?pa=alpha%40okbank&pn=.*&am=40000/.test(mail.sent[0][2]), 'the Pay now link carries the UPI id and the amount');
    // a student without a parent email, a fully paid student, and a person who may not send it
    await call('PUT', '/api/institute', { changes: { students: { upsert: [{ ...base, id: 'fs2', parentEmail: '' }, { ...base, id: 'fs3', feePaid: 50000 }] } } }, adminA);
    assert.equal((await call('POST', '/api/fees/notice-email', { studentId: 'fs2' }, adminA))[1].notified, 'none');
    assert.equal((await call('POST', '/api/fees/notice-email', { studentId: 'fs3' }, adminA))[0], 400);
    assert.equal((await call('POST', '/api/fees/notice-email', { studentId: 'fs1' }, null))[0], 401);
    // the test leaves the coaching as it found it (the next tests count its students)
    await call('PUT', '/api/institute', { changes: { students: { remove: ['fs1', 'fs2', 'fs3'] } } }, adminA);
  });

  it('02i the parents of a batch are emailed about a test that is coming', async () => {
    const kid = (id: string, parentEmail: string) => ({ id, rollNo: id, name: 'Kid ' + id, email: '', phone: '9811122233', parentName: 'Parent ' + id, parentEmail, parentPhone: '9811100000', grade: 'Class 12', courseId: 'c1', batchId: 'bx', targetExam: 'JEE', dateOfAdmission: '2026-11-01', status: 'active', photoUrl: '/avatar.svg', address: '', totalFees: 1000, discount: 0, feePaid: 0 });
    const exam = { id: 'ex9', code: 'EX9', title: 'Unit Test 9', batchId: 'bx', batchName: 'Batch X', subject: 'Physics', date: '2026-12-01', maxMarks: 100, passMarks: 35, status: 'scheduled', syllabusTopics: ['Motion', 'Force'], results: {} };
    await call('PUT', '/api/institute', { changes: { students: { upsert: [kid('k1', 'k1parent@x.com'), kid('k2', '')] }, exams: { upsert: [exam] } } }, adminA);
    const mail = captureMail();
    let data: any;
    try {
      data = (await call('POST', '/api/exams/notice-email', { examId: 'ex9' }, adminA))[1];
    } finally {
      mail.stop();
    }
    assert.deepEqual([data.sent, data.noEmail], [1, 1]);
    assert.deepEqual(mail.sent.map((m) => m[0]), ['k1parent@x.com']);
    assert.ok(mail.sent[0][2].includes('Unit Test 9') && mail.sent[0][2].includes('Motion, Force') && mail.sent[0][2].includes('2026-12-01'));
    assert.ok(mail.sent[0][2].includes('/parent'), 'the button opens the Parent sign in');
    assert.equal((await call('POST', '/api/exams/notice-email', { examId: 'nope' }, adminA))[0], 404);
    assert.equal((await call('POST', '/api/exams/notice-email', { examId: 'ex9' }, null))[0], 401);
    await call('PUT', '/api/institute', { changes: { students: { remove: ['k1', 'k2'] }, exams: { remove: ['ex9'] } } }, adminA);
  });

  it('02j the parent is emailed when the child is marked absent, once for each day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const kid = { id: 'ab1', rollNo: 'ab1', name: 'Absent Kid', email: '', phone: '9811122233', parentName: 'Absent Parent', parentEmail: 'abparent@x.com', parentPhone: '9811100000', grade: 'Class 12', courseId: 'c1', batchId: 'bq', targetExam: 'JEE', dateOfAdmission: '2026-11-01', status: 'active', photoUrl: '/avatar.svg', address: '', totalFees: 1000, discount: 0, feePaid: 0 };
    await call('PUT', '/api/institute', { changes: { students: { upsert: [kid] } } }, adminA);
    const roll = (status: string) => ({ changes: { attendance: { upsert: [{ id: 'att-bq-today', date: today, batchId: 'bq', records: { ab1: status }, markedBy: 'x', updatedAt: today + 'T10:00:00' }] } } });
    let mail = captureMail();
    try {
      await call('PUT', '/api/institute', roll('present'), adminA);
      await call('PUT', '/api/institute', roll('absent'), adminA);
    } finally {
      mail.stop();
    }
    assert.deepEqual(mail.sent.map((m) => m[0]), ['abparent@x.com']);
    assert.ok(mail.sent[0][2].includes('Absent Kid') && mail.sent[0][2].includes(today) && mail.sent[0][2].includes('/parent'));
    mail = captureMail();
    try {
      await call('PUT', '/api/institute', roll('present'), adminA);
      await call('PUT', '/api/institute', roll('absent'), adminA); // absent again the same day: not mailed again
    } finally {
      mail.stop();
    }
    assert.equal(mail.sent.length, 0);
    await call('PUT', '/api/institute', { changes: { students: { remove: ['ab1'] }, attendance: { remove: ['att-bq-today'] } } }, adminA);
  });

  it('02g a coaching added by the super admin tells its principal', async () => {
    const mail = captureMail();
    let status: number, data: any;
    try {
      [status, data] = await call('POST', '/api/super/orgs', { coachingName: 'Eta', city: 'Kota', adminName: 'Eta Admin', email: 'eta@x.com', phone: '+91 98000 11111', password: PASSWORD }, sup);
    } finally {
      mail.stop();
    }
    assert.deepEqual([status, data.notified], [200, 'sent']);
    assert.deepEqual(mail.sent.map((m) => m[0]), ['eta@x.com']);
    assert.ok(mail.sent[0][1].includes('added'));
    assert.ok(mail.sent[0][2].includes('http'));
    await call('POST', `/api/super/orgs/${data.org.id}/reject`, {}, sup);
  });

  it('03 an added coaching waits for the approval', async () => {
    // "Add coaching" only sends a request: nobody can sign in before the Approve
    const [status, data] = await call('POST', '/api/super/orgs', coaching('Beta', 'b@x.com'), sup);
    assert.deepEqual([status, data.org.status], [200, 'pending']);
    orgB = data.org.id;
    const [s2, err] = await login('b@x.com');
    assert.equal(s2, 403);
    assert.ok(err.error.includes('approval'));
    assert.equal((await call('POST', '/api/super/orgs', coaching('Beta2', 'b@x.com'), sup))[0], 409);
    // a principal cannot approve anything, only the Super Admin can
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/approve`, {}, adminA))[0], 403);
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/approve`, {}, sup))[0], 200);
    const [s3, d3] = await login('b@x.com');
    assert.equal(s3, 200);
    adminB = d3.token;
    // a request that is turned down is gone
    const [, waiting] = await call('POST', '/api/super/orgs', coaching('Waiting Co', 'w@x.com'), sup);
    assert.equal((await call('POST', `/api/super/orgs/${waiting.org.id}/reject`, {}, sup))[0], 200);
    assert.equal((await login('w@x.com'))[0], 401);
  });

  it('03b subscription of a coaching', async () => {
    // monthly fee, payments and the paid-until date (money between the platform and a coaching)
    const org = orgB;
    const [status, data] = await call('PUT', `/api/super/orgs/${org}`, { name: 'Beta', city: 'Bijainagar', monthlyFee: 1500 }, sup);
    assert.deepEqual([status, data.org.monthlyFee, data.org.subscription], [200, 1500, 'due']);
    assert.equal((await call('PUT', `/api/super/orgs/${org}`, { name: 'Beta', monthlyFee: -5 }, sup))[0], 400);
    assert.equal((await call('POST', `/api/super/orgs/${org}/payments`, { amount: 0 }, sup))[0], 400);
    const [s2, d2] = await call('POST', `/api/super/orgs/${org}/payments`, { amount: 3000, months: 2 }, sup);
    assert.deepEqual([s2, d2.org.subscription], [200, 'paid']);
    const first = d2.org.paidUntil;
    // paying again before the date adds on top of what is paid
    const d3 = (await call('POST', `/api/super/orgs/${org}/payments`, { amount: 1500, months: 1 }, sup))[1];
    assert.ok(d3.org.paidUntil > first);
    assert.equal(d3.org.payments.length, 2);
    const listing = (await call('GET', '/api/super/orgs', null, sup))[1];
    assert.equal(listing.income.total, 4500);
    assert.equal(listing.income.thisMonth, 4500);
    // only the Super Admin deals with this money
    assert.equal((await call('POST', `/api/super/orgs/${org}/payments`, { amount: 10 }, adminB))[0], 403);
  });

  it('04 no coaching sees the data of another', async () => {
    const seed = Object.fromEntries(Object.entries(SEED).filter(([k]) => k !== 'profile'));
    assert.equal((await call('PUT', '/api/institute', { changes: seed }, adminA))[0], 200);
    const mine = (await call('GET', '/api/sync', null, adminA))[1];
    assert.equal(mine.institute.students.length, 3);
    const other = (await call('GET', '/api/sync', null, adminB))[1];
    assert.deepEqual(other.institute.students ?? [], []);
    assert.deepEqual(new Set(other.users.map((u: any) => u.email)), new Set(['b@x.com'])); // only its own accounts
    // the same record ids in two coachings do not clash
    assert.equal((await call('PUT', '/api/institute', { changes: { students: { upsert: [{ ...STUDENTS[0], name: 'Zed' }] } } }, adminB))[0], 200);
    const names = Object.fromEntries((await call('GET', '/api/sync', null, adminA))[1].institute.students.map((x: any) => [x.id, x.name]));
    assert.equal(names.s1, 'Alice');
    // an account of another coaching cannot be reached by its id
    const usersA = (await call('GET', '/api/sync', null, adminA))[1].users;
    const uidA = usersA.find((u: any) => u.email === 'a@x.com').id;
    assert.equal((await call('POST', `/api/users/${uidA}/reset-password`, { newPassword: 'Hacked12345' }, adminB))[0], 404);
    assert.equal((await call('DELETE', `/api/users/${uidA}`, null, adminB))[0], 404);
    assert.equal((await login('a@x.com'))[0], 200);
    // backups and activity logs are separate too
    assert.equal((await call('POST', '/api/backups', { label: 'x' }, adminA))[0], 200);
    assert.deepEqual((await call('GET', '/api/backups', null, adminB))[1].backups, []);
    assert.ok(!(await call('GET', '/api/audit', null, adminB))[1].entries.some((e: any) => e.detail.includes('Alice')));
  });

  it('05 students sign up to the chosen coaching', async () => {
    const reg = { rollNo: '01', phone: '+91 98000 00001', email: 'alice@x.com', password: PASSWORD };
    assert.equal((await call('POST', '/api/auth/register-student', reg))[0], 400); // two coachings: choose one
    const coachings = (await call('GET', '/api/public/coachings'))[1].coachings;
    assert.deepEqual(new Set(coachings.map((c: any) => c.name)), new Set(['Alpha', 'Beta']));
    // roll 01 with that phone is Alice of Alpha; Beta has another student with roll 01 and a different phone
    assert.equal((await call('POST', '/api/auth/register-student', { ...reg, orgId: orgB, phone: '+91 90000 99999' }))[0], 400);
    const [status, data] = await call('POST', '/api/auth/register-student', { ...reg, orgId: orgA });
    assert.equal(status, 200);
    assert.equal(data.user.orgId, orgA);
    const me = (await call('GET', '/api/sync', null, data.token))[1];
    assert.equal(me.institute.students[0].name, 'Alice');
  });

  it('05b a coaching card lets in only its own principal', async () => {
    // signing in from the card of Alpha: Alpha's principal enters, Beta's principal does not
    assert.equal((await loginTo('a@x.com', orgA))[0], 200);
    const [status, data] = await loginTo('b@x.com', orgA);
    assert.deepEqual([status, data.error], [401, 'Incorrect email or password.']);
    assert.equal((await loginTo('a@x.com', orgB))[0], 401);
    assert.equal((await loginTo('super@x.com', orgA))[0], 401); // the super admin needs the principal's login too
    assert.equal((await loginTo('a@x.com', 'no-such-coaching'))[0], 401);
  });

  it('06 switching a coaching off and on', async () => {
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/suspend`, null, sup))[0], 200);
    assert.equal((await call('GET', '/api/sync', null, adminB))[0], 401); // signed out
    const [status, data] = await login('b@x.com');
    assert.equal(status, 403);
    assert.ok(data.error.includes('switched off'));
    assert.equal((await call('GET', '/api/public/coachings'))[1].coachings.length, 1);
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/activate`, null, sup))[0], 200);
    assert.equal((await login('b@x.com'))[0], 200);
    assert.ok([400, 404].includes((await call('POST', '/api/super/orgs/default/suspend', null, sup))[0]));
  });

  it('07 reset, reject and delete', async () => {
    // a principal can never delete, switch off, approve or edit any coaching, not even its own
    for (const org of [orgA, orgB]) {
      assert.equal((await call('DELETE', `/api/super/orgs/${org}`, { confirmName: 'Alpha' }, adminA))[0], 403);
      assert.equal((await call('POST', `/api/super/orgs/${org}/suspend`, {}, adminA))[0], 403);
      assert.equal((await call('POST', `/api/super/orgs/${org}/approve`, {}, adminA))[0], 403);
      assert.equal((await call('PUT', `/api/super/orgs/${org}`, { name: 'Hacked' }, adminA))[0], 403);
    }
    const names = new Set((await orgs()).map((o) => o.name));
    assert.ok(names.has('Alpha') && names.has('Beta'));
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/reset-admin-password`, { newPassword: 'weak' }, sup))[0], 400);
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/reset-admin-password`, { newPassword: 'Fresh12345' }, sup))[0], 200);
    assert.equal((await login('b@x.com'))[0], 401);
    const [status, data] = await login('b@x.com', 'Fresh12345');
    assert.equal(status, 200);
    // the Super Admin knows this password, so the principal has to choose an own one
    assert.ok(data.user.mustChangePassword);
    const token = data.token;
    assert.equal((await call('POST', '/api/auth/change-password', { currentPassword: 'Fresh12345', newPassword: 'Own12345pw' }, token))[0], 200);
    assert.ok(!(await call('GET', '/api/auth/me', null, token))[1].user.mustChangePassword);
    assert.equal((await login('b@x.com', 'Own12345pw'))[0], 200);
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/reset-admin-password`, { newPassword: 'Fresh12345' }, sup))[0], 200);

    await call('POST', '/api/public/register-coaching', coaching('Gamma', 'g@x.com'));
    const gamma = (await orgs()).find((o) => o.name === 'Gamma');
    assert.equal((await call('POST', `/api/super/orgs/${orgB}/reject`, null, sup))[0], 400); // active, not pending
    assert.equal((await call('POST', `/api/super/orgs/${gamma.id}/reject`, null, sup))[0], 200);
    assert.equal((await login('g@x.com'))[0], 401); // the request and its account are gone

    assert.equal((await call('DELETE', `/api/super/orgs/${orgB}`, { confirmName: 'wrong' }, sup))[0], 400);
    // the name is right but the password is missing or wrong: nothing is deleted
    assert.equal((await call('DELETE', `/api/super/orgs/${orgB}`, { confirmName: 'Beta' }, sup))[0], 403);
    assert.equal((await call('DELETE', `/api/super/orgs/${orgB}`, { confirmName: 'Beta', password: 'Wrong#12345' }, sup))[0], 403);
    assert.equal((await call('DELETE', `/api/super/orgs/${orgB}`, { confirmName: 'Beta', password: PASSWORD }, sup))[0], 200);
    assert.equal((await login('b@x.com', 'Fresh12345'))[0], 401);
    assert.ok([400, 404].includes((await call('DELETE', '/api/super/orgs/default', { confirmName: 'x' }, sup))[0]));
  });

  it('08 the first coaching keeps the old data', async () => {
    // accounts without a coaching (made before this feature) belong to the first one
    const db2 = newDb();
    try {
      await db2.collection('users').insertOne({ _id: 'u1' as any, id: 'u1', name: 'Old', email: 'old@x.com', role: 'admin', status: 'active', createdAt: '' });
      const store = new Store(db2);
      await store.migrateToCoachings();
      assert.equal((await store.userById('u1')).orgId, 'default');
      assert.equal((await store.orgGet('default')).status, 'active');
    } finally {
      await dropDb(db2);
    }
  });
});
