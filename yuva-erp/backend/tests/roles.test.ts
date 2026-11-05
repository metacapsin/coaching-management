// Ported from server_py/tests/test_api.py: expenses, homework, library, parents, the website, and the Super Admins.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Api, BATCHES, PASSWORD, STUDENTS, dropDb, makeApi, newDb, startMongo, stopMongo } from './helpers.ts';

before(startMongo);
after(stopMongo);

/** A fresh server and database for one group of tests; closes and drops them afterwards. */
function withServer(setUp: (api: Api) => Promise<void>) {
  const holder: { api: Api; db: ReturnType<typeof newDb> } = {} as any;
  before(async () => {
    holder.db = newDb();
    holder.api = await makeApi(holder.db);
    await setUp(holder.api);
  });
  after(async () => {
    await holder.api.close();
    await dropDb(holder.db);
  });
  return holder;
}

const tokenOf = async (api: Api, email: string, portal: string, password = PASSWORD) =>
  (await api.call('POST', '/api/auth/login', { email, password, portal }))[1].token as string;

describe('Expenses: for the principal only', () => {
  let admin = '';
  let teacher = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    for (const [role, email] of [['teacher', 't@x.com']]) {
      await api.call('POST', '/api/users', { name: role, email, password: PASSWORD, role, batchIds: ['b1'] }, admin);
    }
    teacher = await tokenOf(api, 't@x.com', 'teacher');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);

  it('1 the principal keeps the expenses', async () => {
    const rent = { id: 'x1', date: '2026-10-01', title: 'Rent', category: 'rent', amount: 40000, createdAt: '' };
    assert.equal((await call('PUT', '/api/institute', { changes: { expenses: { upsert: [rent] } } }, admin))[0], 200);
    const seen = (await call('GET', '/api/sync', null, admin))[1].institute;
    assert.deepEqual(seen.expenses.map((e: any) => e.title), ['Rent']);
    const pay = { id: 'sal1', name: 'Teacher One', role: 'teacher', monthlySalary: 30000, active: true };
    assert.equal((await call('PUT', '/api/institute', { changes: { salaries: { upsert: [pay] } } }, admin))[0], 200);
    assert.equal((await call('GET', '/api/sync', null, admin))[1].institute.salaries.length, 1);
  });

  it('2 teachers neither see nor change them', async () => {
    assert.deepEqual((await call('GET', '/api/sync', null, teacher))[1].institute.salaries, []);
    assert.equal((await call('PUT', '/api/institute', { changes: { salaries: { remove: ['sal1'] } } }, teacher))[0], 403);
    assert.deepEqual((await call('GET', '/api/sync', null, teacher))[1].institute.expenses, []);
    const change = { changes: { expenses: { remove: ['x1'] } } };
    assert.equal((await call('PUT', '/api/institute', change, teacher))[0], 403);
    assert.equal((await call('GET', '/api/sync', null, admin))[1].institute.expenses.length, 1);
  });

  it('2b staff attendance is for the principal only', async () => {
    const row = { id: 'sat1', date: '2026-10-29', records: { sal1: 'leave' }, updatedAt: '' };
    assert.equal((await call('PUT', '/api/institute', { changes: { staffAttendance: { upsert: [row] } } }, admin))[0], 200);
    assert.deepEqual((await call('GET', '/api/sync', null, admin))[1].institute.staffAttendance[0].records, { sal1: 'leave' });
    assert.deepEqual((await call('GET', '/api/sync', null, teacher))[1].institute.staffAttendance, []);
    const change = { changes: { staffAttendance: { remove: ['sat1'] } } };
    assert.equal((await call('PUT', '/api/institute', change, teacher))[0], 403);
  });

  it('3 the teacher / student tab is for teachers and students only', async () => {
    const login = (email: string, portal: string) => call('POST', '/api/auth/login', { email, password: PASSWORD, portal });
    assert.equal((await login('t@x.com', 'member'))[0], 200); // a teacher on the Teacher / Student tab
    const [status, data] = await login('p@x.com', 'member'); // the principal is not a member
    assert.equal(status, 403);
    assert.ok(data.error.includes('Coaching Admin'));
    assert.equal((await login('t@x.com', 'admin'))[0], 403); // and a teacher is not an admin
  });

  it('3b everybody can change the own login email', async () => {
    const login = (email: string, portal = 'member', pw = PASSWORD) => call('POST', '/api/auth/login', { email, password: pw, portal });
    const token = (await login('t@x.com'))[1].token;
    const change = (body: any, tok = token) => call('POST', '/api/auth/change-email', body, tok);
    assert.equal((await change({ currentPassword: 'wrong', newEmail: 'new@x.com' }))[0], 400); // the password is asked
    assert.equal((await change({ currentPassword: PASSWORD, newEmail: 'not-an-email' }))[0], 400);
    assert.equal((await change({ currentPassword: PASSWORD, newEmail: 'p@x.com' }))[0], 409); // taken by the principal
    assert.equal((await change({ currentPassword: PASSWORD, newEmail: 'T@x.com' }))[0], 400); // the same
    const [status, data] = await change({ currentPassword: PASSWORD, newEmail: 'Teacher.New@X.com' });
    assert.deepEqual([status, data.user.email], [200, 'teacher.new@x.com']);
    assert.equal((await login('t@x.com'))[0], 401); // the old email does not work anymore
    assert.equal((await login('teacher.new@x.com'))[0], 200);
    // and back, for the next tests
    const back = (await login('teacher.new@x.com'))[1].token;
    assert.equal((await change({ currentPassword: PASSWORD, newEmail: 't@x.com' }, back))[0], 200);
  });

  it('4 an account the principal made has to change its password', async () => {
    const [status, data] = await call('POST', '/api/auth/login', { email: 't@x.com', password: PASSWORD, portal: 'member' });
    assert.equal(status, 200);
    assert.ok(data.user.mustChangePassword); // the principal chose it, so the teacher chooses an own one
    const token = data.token;
    assert.equal((await call('POST', '/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Mine12345pw' }, token))[0], 200);
    assert.ok(!(await call('GET', '/api/auth/me', null, token))[1].user.mustChangePassword);
  });
});

describe('Homework: a student marks it as done, nobody can fake it', () => {
  let admin = '';
  let student = '';
  let teacher = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    const hw = { id: 'hw1', title: 'Chapter 3', description: '', type: 'homework', batchId: 'b1', batchName: 'Batch A', subject: 'Maths', createdAt: '', authorId: 'x', authorName: 'P' };
    const other = { ...hw, id: 'hw2', batchId: 'b2' };
    await api.call('PUT', '/api/institute', { changes: { batches: { upsert: BATCHES }, students: { upsert: STUDENTS }, materials: { upsert: [hw, other] } } }, admin);
    await api.call('POST', '/api/users', { name: 'Alice', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin);
    await api.call('POST', '/api/users', { name: 'T', email: 't@x.com', password: PASSWORD, role: 'teacher', batchIds: ['b1'] }, admin);
    student = await tokenOf(api, 'alice@x.com', 'member');
    teacher = await tokenOf(api, 't@x.com', 'member');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);

  it('1 the student marks and unmarks', async () => {
    assert.equal((await call('PUT', '/api/homework/hw1', { done: true }, student))[0], 200);
    const mine = (await call('GET', '/api/sync', null, student))[1].institute.submissions;
    assert.deepEqual(mine.map((x: any) => [x.materialId, x.studentId]), [['hw1', 's1']]);
    // the teacher of the batch sees who did it
    const seen = (await call('GET', '/api/sync', null, teacher))[1].institute.submissions;
    assert.equal(seen.length, 1);
    assert.equal((await call('PUT', '/api/homework/hw1', { done: false }, student))[0], 200);
    assert.deepEqual((await call('GET', '/api/sync', null, student))[1].institute.submissions, []);
  });

  it('2 nobody can fake it', async () => {
    assert.equal((await call('PUT', '/api/homework/hw2', { done: true }, student))[0], 404); // another batch
    assert.equal((await call('PUT', '/api/homework/nope', { done: true }, student))[0], 404);
    assert.equal((await call('PUT', '/api/homework/hw1', { done: true }, teacher))[0], 403); // only a student
    assert.equal((await call('PUT', '/api/homework/hw1', { done: true }, admin))[0], 403);
    const fake = { id: 'x', materialId: 'hw1', studentId: 's2', doneAt: '' };
    assert.equal((await call('PUT', '/api/institute', { changes: { submissions: { upsert: [fake] } } }, admin))[0], 403);
    assert.equal((await call('PUT', '/api/institute', { changes: { submissions: { upsert: [fake] } } }, student))[0], 403);
  });
});

describe('Library: the principal adds the books, everybody reads them', () => {
  let admin = '';
  let teacher = '';
  let student = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    await api.call('PUT', '/api/institute', { changes: { batches: { upsert: BATCHES }, students: { upsert: STUDENTS } } }, admin);
    for (const [role, email] of [['teacher', 't@x.com']]) {
      await api.call('POST', '/api/users', { name: role, email, password: PASSWORD, role, batchIds: ['b1'] }, admin);
    }
    await api.call('POST', '/api/users', { name: 'Alice', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin);
    teacher = await tokenOf(api, 't@x.com', 'member');
    student = await tokenOf(api, 'alice@x.com', 'member');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);

  it('1 the principal adds books and everybody reads them', async () => {
    const book = { id: 'bk1', title: 'Physics', author: 'A', category: 'Physics', description: '', url: 'https://example.com/physics.pdf' };
    assert.equal((await call('PUT', '/api/institute', { changes: { books: { upsert: [book] } } }, admin))[0], 200);
    const second = { ...book, id: 'bk2', title: 'Chemistry' };
    assert.equal((await call('PUT', '/api/institute', { changes: { books: { upsert: [second] } } }, admin))[0], 200);
    for (const token of [admin, teacher, student]) {
      const view = (await call('GET', '/api/sync', null, token))[1].institute;
      assert.deepEqual(view.books.map((b: any) => b.title).sort(), ['Chemistry', 'Physics']);
    }
  });

  it('2 teachers and students cannot change books', async () => {
    for (const token of [teacher, student]) {
      for (const change of [{ remove: ['bk1'] }, { upsert: [{ id: 'bk9', title: 'Fake', url: 'https://x.com' }] }]) {
        assert.equal((await call('PUT', '/api/institute', { changes: { books: change } }, token))[0], 403);
      }
    }
    assert.equal((await call('GET', '/api/sync', null, admin))[1].institute.books.length, 2);
  });

  it('3 a book can be deleted', async () => {
    assert.equal((await call('PUT', '/api/institute', { changes: { books: { remove: ['bk2'] } } }, admin))[0], 200);
    assert.deepEqual((await call('GET', '/api/sync', null, student))[1].institute.books.map((b: any) => b.id), ['bk1']);
  });

  it('4 the removed lists are gone', async () => {
    const change = { transportRoutes: { upsert: [{ id: 'r1' }] } };
    assert.equal((await call('PUT', '/api/institute', { changes: change }, admin))[0], 400);
  });
});

describe('Parents: the child\'s data only, read only', () => {
  let admin = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    const hw = { id: 'hw1', title: 'Chapter 3', description: '', type: 'homework', batchId: 'b1', batchName: 'Batch A', subject: 'Maths', createdAt: '', authorId: 'x', authorName: 'P' };
    await api.call('PUT', '/api/institute', { changes: { batches: { upsert: BATCHES }, students: { upsert: STUDENTS }, materials: { upsert: [hw] } } }, admin);
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);
  const make = (email: string, parent: boolean) => {
    const body: any = { name: parent ? 'Parent of Alice' : 'Alice', email, password: PASSWORD, role: 'student', studentId: 's1' };
    if (parent) body.isParent = true;
    return call('POST', '/api/users', body, admin);
  };
  const login = (email: string) => tokenOf(s.api, email, 'parent');

  it('1 a parent and a student login live side by side', async () => {
    assert.equal((await make('alice@x.com', false))[0], 200);
    const [status, data] = await make('mum@x.com', true);
    assert.equal(status, 200);
    assert.ok(data.user.isParent);
    assert.equal((await make('dad@x.com', true))[0], 409); // one parent login per student
    assert.equal((await make('alice2@x.com', false))[0], 409); // and one student login
    const users = (await call('GET', '/api/sync', null, admin))[1].users;
    const pairs = users.filter((u: any) => u.role === 'student').map((u: any) => [u.email, Boolean(u.isParent)]).sort();
    assert.deepEqual(pairs, [['alice@x.com', false], ['mum@x.com', true]]);
  });

  it('2 the parent sees the child only', async () => {
    const token = await login('mum@x.com');
    const view = (await call('GET', '/api/sync', null, token))[1];
    assert.ok(view.user.isParent);
    assert.deepEqual(view.institute.students.map((x: any) => x.id), ['s1']);
    assert.deepEqual(view.institute.expenses, []);
    assert.deepEqual(view.institute.enquiries, []);
  });

  it('3 the parent cannot change anything or mark homework', async () => {
    const token = await login('mum@x.com');
    const change = { changes: { students: { remove: ['s1'] } } };
    assert.equal((await call('PUT', '/api/institute', change, token))[0], 403);
    assert.equal((await call('PUT', '/api/homework/hw1', { done: true }, token))[0], 403);
    assert.ok([401, 403, 404, 405].includes((await call('GET', '/api/users', null, token))[0]));
    // the student can still mark it
    assert.equal((await call('PUT', '/api/homework/hw1', { done: true }, await tokenOf(s.api, 'alice@x.com', 'member')))[0], 200);
    // and the parent sees that the child did it
    const seen = (await call('GET', '/api/sync', null, token))[1].institute.submissions;
    assert.deepEqual(seen.map((x: any) => x.studentId), ['s1']);
  });

  it('4 a parent signs in on the Parent tab, the others on their own tabs', async () => {
    const login = (email: string, portal: string) => call('POST', '/api/auth/login', { email, password: PASSWORD, portal });
    assert.equal((await login('mum@x.com', 'parent'))[0], 200);
    const [status, data] = await login('mum@x.com', 'member');
    assert.equal(status, 403);
    assert.ok(data.error.includes('Parent'), 'the message names the Parent tab');
    assert.equal((await login('alice@x.com', 'parent'))[0], 403);
    assert.equal((await login('alice@x.com', 'member'))[0], 200);
  });

  it('5 a parent creates an own account with the roll number of the child and the parent mobile of the admission', async () => {
    const body = { rollNo: '02', phone: '9800000002', email: 'bobmum@x.com', password: PASSWORD };
    assert.equal((await call('POST', '/api/auth/register-parent', { ...body, phone: '9111111111' }))[0], 400); // not the number of the admission
    assert.equal((await call('POST', '/api/auth/register-parent', { ...body, rollNo: '99' }))[0], 400); // no such child
    assert.equal((await call('POST', '/api/auth/register-parent', { ...body, password: 'short' }))[0], 400);
    const [status, data] = await call('POST', '/api/auth/register-parent', body);
    assert.equal(status, 200);
    assert.ok(data.user.isParent);
    assert.equal((await call('POST', '/api/auth/register-parent', { ...body, email: 'other@x.com' }))[0], 409); // one parent account for each child
    // the new parent sees the child only
    const token = await tokenOf(s.api, 'bobmum@x.com', 'parent');
    assert.deepEqual((await call('GET', '/api/sync', null, token))[1].institute.students.map((x: any) => x.id), ['s2']);
  });
});

describe('Website: "Book a demo"', () => {
  let sup = '';
  let admin = '';
  const s = withServer(async (api) => {
    sup = (await api.call('POST', '/api/super/setup', { name: 'S', email: 's@x.com', password: PASSWORD }))[1].token;
    const org = (await api.call('POST', '/api/super/orgs', { coachingName: 'Star', adminName: 'P', email: 'p@x.com', password: PASSWORD, phone: '9876543210' }, sup))[1].org;
    await api.call('POST', `/api/super/orgs/${org.id}/approve`, {}, sup);
    admin = await tokenOf(api, 'p@x.com', 'admin');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);

  it('1 a visitor sends a request and wrong ones are refused', async () => {
    const good = { name: 'Ravi Kumar', email: 'Ravi@Example.com', phone: '9876543210', coaching: 'Star Classes', message: 'Show me the fees part' };
    assert.equal((await call('POST', '/api/public/demo-request', good))[0], 200);
    for (const bad of [{ ...good, name: '' }, { ...good, email: 'nope' }, { ...good, phone: '123' }]) {
      assert.equal((await call('POST', '/api/public/demo-request', bad))[0], 400);
    }
  });

  it('2 only the super admin reads and deletes them', async () => {
    const [status, data] = await call('GET', '/api/super/leads', null, sup);
    assert.equal(status, 200);
    assert.deepEqual(data.leads.map((l: any) => [l.name, l.email, l.coaching]), [['Ravi Kumar', 'ravi@example.com', 'Star Classes']]);
    assert.ok([401, 403].includes((await call('GET', '/api/super/leads', null, admin))[0])); // a principal cannot
    assert.equal((await call('GET', '/api/super/leads'))[0], 401); // nor a visitor
    const leadId = data.leads[0].id;
    assert.ok([401, 403].includes((await call('DELETE', `/api/super/leads/${leadId}`, null, admin))[0]));
    assert.equal((await call('DELETE', `/api/super/leads/${leadId}`, null, sup))[0], 200);
    assert.deepEqual((await call('GET', '/api/super/leads', null, sup))[1].leads, []);
    assert.equal((await call('DELETE', `/api/super/leads/${leadId}`, null, sup))[0], 404);
  });

  it('3 the request shows in the activity log', async () => {
    await call('POST', '/api/public/demo-request', { name: 'Mina', email: 'm@example.com', phone: '9876543211' });
    const entries = (await call('GET', '/api/super/audit', null, sup))[1].entries;
    assert.ok(entries.some((e: any) => e.action === 'demo-requested'));
  });
});

describe('Super Admin recovery: only on the server computer', () => {
  let token = '';
  const s = withServer(async (api) => {
    token = (await api.call('POST', '/api/super/setup', { name: 'S', email: 's@x.com', password: PASSWORD }))[1].token;
  });
  const reset = (email: string, password = 'NewPass12345', headers?: Record<string, string>) =>
    s.api.call('POST', '/api/super/forgot-password', { email, newPassword: password }, null, headers);

  it('1 not from another computer', async () => {
    // a request that comes through a proxy from somewhere else is refused
    const [status, data] = await reset('s@x.com', 'NewPass12345', { 'X-Forwarded-For': '8.8.8.8' });
    assert.equal(status, 403);
    assert.ok(data.error.includes('server computer'));
    assert.equal((await s.api.call('GET', '/api/auth/me', null, token))[0], 200); // nothing changed
  });

  it('2 a wrong email or a weak password changes nothing', async () => {
    assert.equal((await reset('nobody@x.com'))[0], 404);
    assert.equal((await reset('s@x.com', 'weak'))[0], 400);
  });

  it('3 on the server computer it works', async () => {
    assert.equal((await reset('S@X.com'))[0], 200);
    assert.equal((await s.api.call('GET', '/api/auth/me', null, token))[0], 401); // signed out everywhere
    const login = (pw: string) => s.api.call('POST', '/api/auth/login', { email: 's@x.com', password: pw, portal: 'super' });
    assert.equal((await login(PASSWORD))[0], 401);
    assert.equal((await login('NewPass12345'))[0], 200);
  });
});

describe('Super Admins: there is only one', () => {
  let one = '';
  let principal = '';
  const s = withServer(async (api) => {
    one = (await api.call('POST', '/api/super/setup', { name: 'One', email: 'one@x.com', password: PASSWORD }))[1].token;
    const org = (await api.call('POST', '/api/super/orgs', { coachingName: 'Alpha', city: 'T', adminName: 'Principal', phone: '+91 98000 11111', email: 'p@x.com', password: PASSWORD }, one))[1].org;
    await api.call('POST', `/api/super/orgs/${org.id}/approve`, {}, one);
    principal = await tokenOf(api, 'p@x.com', 'admin');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);

  it('1 a second Super Admin cannot be created, not by setup and not by the Super Admin', async () => {
    // setup works once only
    const again = await call('POST', '/api/super/setup', { name: 'Two', email: 'two@x.com', password: PASSWORD });
    assert.equal(again[0], 409);
    // the routes that added, reset and removed other Super Admins do not exist anymore
    const added = { name: 'Two', email: 'two@x.com', password: 'Temp12345pw' };
    for (const token of [one, principal, '']) {
      assert.equal((await call('POST', '/api/super/admins', added, token || undefined))[0] >= 400, true);
      assert.notEqual((await call('POST', '/api/super/admins', added, token || undefined))[0], 200);
    }
    assert.equal((await call('GET', '/api/super/admins', null, one))[0], 404);
    // no account with the role super was made
    assert.equal((await call('POST', '/api/auth/login', { email: 'two@x.com', password: 'Temp12345pw', portal: 'super' }))[0], 401);
  });
});

describe('The notification bell: new students and teachers', () => {
  let admin = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    await api.call('PUT', '/api/institute', { changes: { batches: { upsert: BATCHES }, students: { upsert: STUDENTS } } }, admin);
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);
  const bell = async () => ((await call('GET', '/api/sync', null, admin))[1].institute.notificationLogs ?? []).filter((l: any) => l.channel === 'app');

  it('1 a teacher or student added by the principal appears in the bell', async () => {
    assert.equal((await call('POST', '/api/users', { name: 'Neha Teacher', email: 'neha@x.com', password: PASSWORD, role: 'teacher', batchIds: ['b1'] }, admin))[0], 200);
    assert.equal((await call('POST', '/api/users', { name: 'Alice Student', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin))[0], 200);
    const lines = await bell();
    assert.deepEqual(lines.map((l: any) => [l.type, l.studentName]).sort(), [['new_student', 'Alice Student'], ['new_teacher', 'Neha Teacher']]);
    assert.ok(lines.every((l: any) => l.timestamp && l.content));
  });

  it('2 a teacher who asks to join appears in the bell, a parent account does not', async () => {
    const asked = await call('POST', '/api/auth/register-teacher', { name: 'Ravi Joiner', email: 'ravi@x.com', phone: '9876543210', subject: 'Maths', password: PASSWORD });
    assert.equal(asked[0], 200);
    assert.ok((await bell()).some((l: any) => l.type === 'new_teacher' && l.studentName === 'Ravi Joiner'));
    const before = (await bell()).length;
    await call('POST', '/api/users', { name: 'Parent Of S2', email: 'parent2@x.com', password: PASSWORD, role: 'student', studentId: 's2', isParent: true }, admin);
    assert.equal((await bell()).length, before);
  });

  it('3 the principal can delete a notification and clear the list', async () => {
    const lines = await bell();
    const one = lines[0].id;
    assert.equal((await call('PUT', '/api/institute', { changes: { notificationLogs: { remove: [one] } } }, admin))[0], 200);
    assert.equal((await bell()).some((l: any) => l.id === one), false);
    const rest = (await bell()).map((l: any) => l.id);
    assert.equal((await call('PUT', '/api/institute', { changes: { notificationLogs: { remove: rest } } }, admin))[0], 200);
    assert.equal((await bell()).length, 0);
  });
});

describe('Teacher and student bells', () => {
  let admin = '';
  let teacherA = '';
  let teacherB = '';
  let student = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    await api.call('PUT', '/api/institute', { changes: { batches: { upsert: BATCHES }, students: { upsert: STUDENTS } } }, admin);
    await api.call('POST', '/api/users', { name: 'Teacher A', email: 'ta@x.com', password: PASSWORD, role: 'teacher', batchIds: ['b1'] }, admin);
    await api.call('POST', '/api/users', { name: 'Teacher B', email: 'tb@x.com', password: PASSWORD, role: 'teacher', batchIds: ['b2'] }, admin);
    await api.call('POST', '/api/users', { name: 'Alice', email: 'alice@x.com', password: PASSWORD, role: 'student', studentId: 's1' }, admin);
    teacherA = await tokenOf(api, 'ta@x.com', 'member');
    teacherB = await tokenOf(api, 'tb@x.com', 'member');
    student = await tokenOf(api, 'alice@x.com', 'member');
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);
  const seen = async (token: string, list: string) => (await call('GET', '/api/sync', null, token))[1].institute[list] as any[];

  it('1 a notice for the teachers only (a meeting) reaches the teachers and no student', async () => {
    const meeting = { id: 'an1', title: 'Teachers meeting', body: 'Friday 4 pm', audience: 'teachers', createdAt: '2026-11-05T08:00:00.000Z', authorId: 'x', authorName: 'P' };
    const everybody = { id: 'an2', title: 'Holiday', body: 'Closed', audience: 'all', createdAt: '2026-11-05T09:00:00.000Z', authorId: 'x', authorName: 'P' };
    assert.equal((await call('PUT', '/api/institute', { changes: { announcements: { upsert: [meeting, everybody] } } }, admin))[0], 200);
    for (const token of [teacherA, teacherB]) assert.deepEqual((await seen(token, 'announcements')).map((a) => a.id).sort(), ['an1', 'an2']);
    assert.deepEqual((await seen(student, 'announcements')).map((a) => a.id), ['an2']);
  });

  it('2 a teacher cannot post a notice for all the teachers', async () => {
    const note = { id: 'an3', title: 'x', body: 'y', audience: 'teachers', createdAt: '2026-11-05T10:00:00.000Z', authorId: 'x', authorName: 'T' };
    assert.equal((await call('PUT', '/api/institute', { changes: { announcements: { upsert: [note] } } }, teacherA))[0], 403);
  });

  it('3 a new student of a batch is told to the teacher of that batch only', async () => {
    const course = { id: 'c1', code: 'C1', name: 'Course', fee: 1000, durationMonths: 12, status: 'active' };
    await call('PUT', '/api/institute', { changes: { courses: { upsert: [course] }, batches: { upsert: [{ ...BATCHES[1], courseId: 'c1', status: 'active' }] } } }, admin);
    const orgId = (await call('GET', '/api/auth/me', null, admin))[1].user.orgId;
    const joined = await call('POST', '/api/auth/register-new-student', {
      orgId, name: 'Newbie Kid', phone: '9876500001', parentName: 'Pa', parentPhone: '9876500002', email: 'newbie@x.com', password: PASSWORD, courseId: 'c1', batchId: 'b2', grade: 'Class 12',
    });
    assert.equal(joined[0], 200, JSON.stringify(joined[1]));
    const forB = (await seen(teacherB, 'notificationLogs')).filter((l) => l.type === 'new_student');
    assert.deepEqual(forB.map((l) => l.studentName), ['Newbie Kid']);
    assert.ok(forB[0].content.includes('Batch B'));
    assert.deepEqual((await seen(teacherA, 'notificationLogs')).filter((l) => l.type === 'new_student'), []);
    // the principal sees it too, in the own bell
    assert.ok((await seen(admin, 'notificationLogs')).some((l) => l.type === 'new_student' && l.studentName === 'Newbie Kid'));
  });
});

describe('Who is told about a new student: the subject and the class', () => {
  let admin = '';
  let english12 = '';
  let maths12 = '';
  let english10 = '';
  let nobody = '';
  const s = withServer(async (api) => {
    admin = (await api.call('POST', '/api/auth/setup', { name: 'P', email: 'p@x.com', password: PASSWORD }))[1].token;
    const course = { id: 'c1', code: 'C1', name: 'Course', fee: 1000, durationMonths: 12, status: 'active' };
    const b12 = { ...BATCHES[0], id: 'b12', name: 'Class 12 Batch', courseId: 'c1', subjects: ['English', 'Maths'], status: 'ongoing', maxCapacity: 30 };
    const b10 = { ...BATCHES[1], id: 'b10', name: 'Class 10 Batch', courseId: 'c1', subjects: ['English', 'Science'], status: 'ongoing', maxCapacity: 30 };
    const old12 = { ...STUDENTS[0], id: 'o12', batchId: 'b12', grade: 'Class 12' };
    const old10 = { ...STUDENTS[2], id: 'o10', batchId: 'b10', grade: 'Class 10' };
    await api.call('PUT', '/api/institute', { changes: { courses: { upsert: [course] }, batches: { upsert: [b12, b10] }, students: { upsert: [old12, old10] } } }, admin);
    const make = async (name: string, email: string, subject: string, batchIds: string[]) => {
      await api.call('POST', '/api/users', { name, email, password: PASSWORD, role: 'teacher', subject, batchIds }, admin);
      return tokenOf(api, email, 'member');
    };
    english12 = await make('English 12', 'e12@x.com', 'English', ['b12']);
    maths12 = await make('Maths 12', 'm12@x.com', 'Maths', ['b12']);
    english10 = await make('English 10', 'e10@x.com', 'english', ['b10']);
    nobody = await make('No batch', 'nb@x.com', 'English', []);
  });
  const call = (...a: Parameters<Api['call']>) => s.api.call(...a);
  const told = async (token: string) =>
    ((await call('GET', '/api/sync', null, token))[1].institute.notificationLogs as any[]).filter((l) => l.type === 'new_student').map((l) => l.studentName);

  const join = (name: string, email: string, batchId: string, grade: string, subjectsOfBatch?: string[]) =>
    call('POST', '/api/auth/register-new-student', {
      orgId: undefined, name, phone: '9876500010', parentName: 'Pa', parentPhone: '9876500011', email, password: PASSWORD, courseId: 'c1', batchId, grade, subjectsOfBatch,
    });

  it('1 a new student of class 12 with English goes to the English teacher of class 12 and the Maths teacher of the same batch', async () => {
    const orgId = (await call('GET', '/api/auth/me', null, admin))[1].user.orgId;
    const r = await call('POST', '/api/auth/register-new-student', {
      orgId, name: 'Twelfth Kid', phone: '9876500010', parentName: 'Pa', parentPhone: '9876500011', email: 'k12@x.com', password: PASSWORD, courseId: 'c1', batchId: 'b12', grade: 'Class 12',
    });
    assert.equal(r[0], 200, JSON.stringify(r[1]));
    assert.deepEqual(await told(english12), ['Twelfth Kid']); // subject and class match
    assert.deepEqual(await told(maths12), ['Twelfth Kid']); // the batch has Maths too, and the class is the same
    assert.deepEqual(await told(english10), []); // an English teacher, but of class 10
    assert.deepEqual(await told(nobody), []); // no batch, no class on record
  });

  it('2 a new student of class 10 does not go to the teachers of class 12', async () => {
    const orgId = (await call('GET', '/api/auth/me', null, admin))[1].user.orgId;
    const r = await call('POST', '/api/auth/register-new-student', {
      orgId, name: 'Tenth Kid', phone: '9876500020', parentName: 'Pa', parentPhone: '9876500021', email: 'k10@x.com', password: PASSWORD, courseId: 'c1', batchId: 'b10', grade: 'Class 10',
    });
    assert.equal(r[0], 200, JSON.stringify(r[1]));
    assert.deepEqual(await told(english10), ['Tenth Kid']);
    assert.deepEqual(await told(english12), ['Twelfth Kid']); // still only the first one
    assert.deepEqual(await told(maths12), ['Twelfth Kid']);
  });

  it('3 a Maths teacher is not told about a batch that has no Maths', async () => {
    const orgId = (await call('GET', '/api/auth/me', null, admin))[1].user.orgId;
    const mathsTen = (await call('POST', '/api/users', { name: 'Maths 10', email: 'm10@x.com', password: PASSWORD, role: 'teacher', subject: 'Maths', batchIds: ['b10'] }, admin))[0];
    assert.equal(mathsTen, 200);
    const token = await tokenOf(s.api, 'm10@x.com', 'member');
    const r = await call('POST', '/api/auth/register-new-student', {
      orgId, name: 'Tenth Two', phone: '9876500030', parentName: 'Pa', parentPhone: '9876500031', email: 'k10b@x.com', password: PASSWORD, courseId: 'c1', batchId: 'b10', grade: 'Class 10',
    });
    assert.equal(r[0], 200, JSON.stringify(r[1]));
    assert.deepEqual(await told(token), []); // batch b10 teaches English and Science, not Maths
    assert.ok((await told(english10)).includes('Tenth Two'));
  });
});
