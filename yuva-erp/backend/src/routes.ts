// The API routes, part 1: public pages, sign in, sign up, the institute data and the accounts of one coaching.
// (The Super Admin routes, photos and backups are in routesSuper.ts.)

import crypto from 'node:crypto';
import * as auth from './auth.ts';
import { HttpError } from './errors.ts';
import {
  INSTITUTE_BODY,
  addUserOrConflict,
  checkEmail,
  checkPassword,
  chooseOrg,
  coachingName,
  emailTaken,
  isDuplicateKey,
  limitRegistrations,
  mail,
  nowIso,
  ok,
  portalOf,
  requireSetup,
  route,
  startSession,
  tellPrincipals,
  welcomeMail,
} from './http.ts';
import { nextRollNumber } from './rollno.ts';
import { applyChanges, scopeInstitute } from './scope.ts';
import { DEFAULT_ORG, PLATFORM_ORG } from './store.ts';
import { GREEN, RED } from './emailTemplate.ts';
import { last10, newId, normRoll, normalizePhone, portalLabel, roleLabel, text, todayLocal } from './validate.ts';

const DEFAULT_PHOTO = '/avatar.svg'; // a local picture (the app has it in public/)

/** Python's int() for a query value: whole numbers only, otherwise null. */
export function intParam(value: string | undefined): number | null {
  return value !== undefined && /^\s*[+-]?\d+\s*$/.test(value) ? parseInt(value, 10) : null;
}

// ---------- public ----------

route('/api/health', ['GET'], 'public', async (c) => ({ ok: true, version: await c.store.version() }));

/** Marks that somebody forgot the password, so the principal sees it in Team & Access and sets a new one.
 * The answer is always the same, so nobody can find out which emails have an account. */
route('/api/auth/forgot-password', ['POST'], 'public', async (c) => {
  limitRegistrations(c);
  const email = text(c.body().email).toLowerCase();
  const target = email ? await c.root.userByEmail(email) : null;
  if (target && (target.status || 'active') === 'active') {
    const s = c.root.forOrg(target.orgId || DEFAULT_ORG);
    target.resetRequestedAt = nowIso();
    let code: string | null = null;
    if (target.role !== 'super') {
      // the Super Admin has an own way (on the server computer)
      code = String(crypto.randomInt(1_000_000)).padStart(6, '0');
      target.resetCodeHash = auth.sha256Hex(`${code}:${target.id}`);
      target.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 19) + '+00:00';
      target.resetCodeTries = 0;
    }
    await s.saveUser(target);
    await s.bump();
    await s.audit(null, 'password-reset-requested', email);
    if (code) {
      // also by email: the person can set a new password at once with this code
      mail(target.email, 'Your AcademiaOS password reset code', 'Your password reset code', ['Use this code to set a new password. It works for 15 minutes.'], {
        code,
        button: ['Open the sign in page', c.loginLink(target.role === 'teacher' || target.role === 'student' ? 'member' : 'admin')],
        note: 'If you did not ask for it, you can ignore this email.',
        name: target.name,
      });
    }
  }
  return ok();
});

/** Sets a new password with the code that was emailed. The same answer for every wrong input. */
route('/api/auth/reset-with-code', ['POST'], 'public', async (c) => {
  limitRegistrations(c);
  const b = c.body();
  const email = text(b.email).toLowerCase();
  const code = text(b.code, 12);
  const target = email ? await c.root.userByEmail(email) : null;
  const wrong = () => new HttpError(400, 'The code is wrong or has expired. Ask for a new code.');
  if (!target || !target.resetCodeHash || target.role === 'super') throw wrong();
  const expires = new Date(target.resetCodeExpires || '1970-01-01T00:00:00+00:00').getTime();
  const expired = !(expires >= Date.now());
  const s = c.root.forOrg(target.orgId || DEFAULT_ORG);
  const tries = parseInt(target.resetCodeTries || 0, 10);
  const good = auth.safeEqual(auth.sha256Hex(`${code}:${target.id}`), target.resetCodeHash);
  if (expired || tries >= 5 || !good) {
    target.resetCodeTries = tries + 1;
    if (expired || tries + 1 >= 5) {
      // too many tries or too late: this code is dead
      for (const key of ['resetCodeHash', 'resetCodeExpires', 'resetCodeTries']) delete target[key];
    }
    await s.saveUser(target);
    throw wrong();
  }
  checkPassword(b.password);
  auth.setPassword(target, b.password);
  for (const key of ['resetCodeHash', 'resetCodeExpires', 'resetCodeTries', 'resetRequestedAt', 'mustChangePassword']) delete target[key];
  await s.saveUser(target);
  await auth.destroySessionsOf(c.root, target.id);
  c.limiters.login.reset(`${c.ip()}|${email}`);
  await s.bump();
  await s.audit(target, 'password-reset-by-email', email);
  return ok();
});

route('/api/auth/status', ['GET'], 'public', async (c) => ({
  // any account in the database (also a super admin or another coaching) means the first-run set-up is over
  hasUsers: (await c.root.users.countDocuments({})) > 0,
  hasSuper: (await c.root.forOrg(PLATFORM_ORG).userCount()) > 0,
}));

/** First start: creates the principal. Only works while there is no account at all. */
route('/api/auth/setup', ['POST'], 'public', async (c) => {
  const s = c.store;
  if ((await c.root.users.countDocuments({})) > 0) {
    throw new HttpError(409, 'Setup is already complete. Please sign in, or register as a student or teacher.');
  }
  const b = c.body();
  const name = text(b.name);
  const email = text(b.email).toLowerCase();
  const password = b.password;
  if (!name) throw new HttpError(400, 'Please enter your full name.');
  checkEmail(email);
  checkPassword(password);

  const user = auth.buildUser({ name, email, password, role: 'admin' }, 'active');
  await addUserOrConflict(c, user);
  await c.root.ensureDefaultOrg();
  await s.bump();
  await s.audit(user, 'setup', 'Principal account created');
  return startSession(c, user);
});

route('/api/auth/login', ['POST'], 'public', async (c) => {
  let s = c.store;
  const b = c.body();
  const email = text(b.email).toLowerCase();
  const password: string = typeof b.password === 'string' ? b.password : '';
  const portal = b.portal;
  const remember = b.remember !== false;
  const ip = c.ip();
  const invalid = () => new HttpError(401, 'Incorrect email or password.');

  const loginLimiter = c.limiters.login;
  const ipLimiter = c.limiters.ip;
  const keyEmail = `${ip}|${email}`;
  for (const wait of [loginLimiter.check(keyEmail), ipLimiter.check(ip)]) {
    if (wait !== null) {
      const minutes = Math.max(1, Math.ceil(wait / 60));
      throw new HttpError(429, `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
  }

  const fail = () => {
    loginLimiter.fail(keyEmail);
    ipLimiter.fail(ip);
  };

  const found = await s.userByEmail(email);
  if (found) s = s.forOrg(found.role === 'super' ? PLATFORM_ORG : found.orgId || DEFAULT_ORG);
  if (!found || password.length > 200) {
    auth.hashPassword(password.slice(0, 200), '0'.repeat(32)); // same time whether or not the email exists
    fail();
    await s.audit(null, 'login-failed', email);
    throw invalid();
  }
  if (!auth.verifyPassword(found, password)) {
    fail();
    await s.audit(found, 'login-failed', 'wrong password');
    throw invalid();
  }

  if (found.role !== 'super') {
    const org = await c.root.orgGet(found.orgId || DEFAULT_ORG);
    if (!org || org.status === 'pending') {
      throw new HttpError(403, 'Your coaching is waiting for the super admin’s approval. Please try again after it is approved.');
    }
    if (org.status === 'suspended') {
      throw new HttpError(403, 'This coaching has been switched off by the super admin. Please contact the super admin.');
    }
  }

  if ((found.status || 'active') === 'pending') {
    throw new HttpError(403, 'Your account is waiting for the principal’s approval. Please try again after it is approved.');
  }

  // Signing in to one chosen coaching (from its card): only an account of THAT coaching is let in.
  // The answer is the same as for a wrong password, so nothing is revealed about other coachings.
  const wanted = b.orgId;
  if (typeof wanted === 'string' && wanted && (found.orgId !== wanted || !['admin', 'staff'].includes(found.role))) {
    fail();
    await s.audit(found, 'login-failed', 'wrong coaching');
    throw invalid();
  }

  // three logins: 'super' (super admin), 'admin' (principal and office staff of a coaching), 'member' (teacher, student)
  let portalOk: boolean;
  if (portal === 'admin') portalOk = ['admin', 'staff'].includes(found.role);
  else if (portal === 'member') portalOk = ['teacher', 'student'].includes(found.role); // the "Teacher / Student" tab: accounts the principal made for them
  else portalOk = found.role === portal;
  if (!portalOk) {
    throw new HttpError(403, `This is a ${roleLabel(found.role)} account. Please use the “${portalLabel(found.role)}” tab to sign in.`);
  }

  if (auth.needsUpgrade(found)) {
    auth.setPassword(found, password);
    await s.saveUser(found);
  }
  loginLimiter.reset(keyEmail);
  await s.audit(found, 'login');
  return startSession(c, found, remember);
});

route('/api/auth/register-teacher', ['POST'], 'public', async (c) => {
  const s = await chooseOrg(c);
  await requireSetup(c);
  limitRegistrations(c);
  const b = c.body();
  const name = text(b.name);
  const email = text(b.email).toLowerCase();
  const subject = text(b.subject);
  if (!name) throw new HttpError(400, 'Please enter your full name.');
  if (last10(b.phone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  checkEmail(email);
  checkPassword(b.password);
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  const user = auth.buildUser({ name, email, password: b.password, role: 'teacher', phone: text(b.phone, 30), subject, batchIds: [] }, 'pending');
  await addUserOrConflict(c, user);
  await s.bump();
  await s.audit(user, 'register-teacher', 'Waiting for approval');
  const coaching = await coachingName(c, s);
  mail(
    user.email,
    `We received your request for ${coaching}`,
    'We received your request',
    [`Thank you! The principal of ${coaching} will check your request to join as a teacher. You will get an email when it is approved.`],
    {
      details: [
        ['Coaching', coaching],
        ['Subject', user.subject],
      ],
      button: ['Visit AcademiaOS', c.siteUrl()],
      name: user.name,
    },
  );
  await tellPrincipals(
    c,
    s,
    `A teacher asks to join ${coaching}`,
    'A teacher asks to join',
    ['Sign in, open Team & Access and press Approve or Reject.'],
    [
      ['Name', user.name],
      ['Email', user.email],
      ['Mobile', user.phone],
      ['Subject', user.subject],
    ],
  );
  return ok();
});

/** A student that was admitted by the office creates a login (checked against the admission record). */
route('/api/auth/register-student', ['POST'], 'public', async (c) => {
  const s = await chooseOrg(c);
  await requireSetup(c);
  limitRegistrations(c);
  const b = c.body();
  const rollInput = text(b.rollNo, 50);
  const email = text(b.email).toLowerCase();
  const phone10 = last10(b.phone);

  if (!rollInput) throw new HttpError(400, 'Please enter your roll number.');
  if (phone10.length < 10) throw new HttpError(400, 'Enter the 10-digit mobile number registered at admission.');
  checkEmail(email);
  checkPassword(b.password);

  const records = await s.find('students');
  const rollKey = normRoll(rollInput);
  let student = records.find((x) => normRoll(x.rollNo || '') === rollKey);
  // Only the number was typed (for example "101"): accept it when it points to exactly one student
  if (!student && /^\d+$/.test(rollInput) && rollInput.length <= 6) {
    const typed = parseInt(rollInput, 10);
    const matches = records.filter((x) => {
      const tail = /(\d+)\D*$/.exec(String(x.rollNo || ''));
      return tail && parseInt(tail[1], 10) === typed;
    });
    if (matches.length === 1) student = matches[0];
  }
  const verified = Boolean(student) && (last10(student.phone) === phone10 || last10(student.parentPhone) === phone10);
  if (!student || !verified) {
    const sample = records.length ? records[0].rollNo : '05';
    throw new HttpError(
      400,
      `We could not verify these details. Check your roll number (it looks like ${sample}) and the mobile number registered at admission.`,
    );
  }
  if (await s.userByStudent(student.id)) {
    throw new HttpError(409, 'An account already exists for this student. Please sign in, or ask the principal to reset your password.');
  }
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  const user = auth.buildUser(
    { name: student.name, email, password: b.password, role: 'student', phone: text(b.phone, 30), studentId: student.id },
    'active',
  );
  await addUserOrConflict(c, user);
  await s.bump();
  await s.audit(user, 'register-student', student.rollNo);
  const coaching = await coachingName(c, s);
  mail(user.email, `Your AcademiaOS account for ${coaching}`, `Welcome to ${coaching}`, ['Your account is ready. You can see your attendance, fees, results, notices and study material.'], {
    details: [
      ['Coaching', coaching],
      ['Sign in with', user.email],
    ],
    button: ['Sign in', c.loginLink('member')],
    name: user.name,
  });
  return startSession(c, user);
});

route('/api/public/registration-options', ['GET'], 'public', async (c) => {
  const s = await chooseOrg(c);
  const students = await s.find('students');
  const batches = (await s.find('batches'))
    .filter((b) => b.status !== 'completed')
    .map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      courseId: b.courseId,
      courseName: b.courseName,
      startTime: b.startTime,
      endTime: b.endTime,
      maxCapacity: b.maxCapacity,
      status: b.status,
      filled: students.filter((x) => x.batchId === b.id).length,
    }));
  const courses = (await s.find('courses')).map((x) => ({ id: x.id, code: x.code, name: x.name }));
  return { courses, batches, nextRollNo: nextRollNumber(students) };
});

/** A new student registers on the portal: the student record gets an automatic roll number. */
route('/api/auth/register-new-student', ['POST'], 'public', async (c) => {
  const s = await chooseOrg(c);
  await requireSetup(c);
  limitRegistrations(c);
  const b = c.body();
  const name = text(b.name);
  const email = text(b.email).toLowerCase();
  const phone10 = last10(b.phone);

  if (!name) throw new HttpError(400, 'Please enter your full name.');
  if (phone10.length < 10) throw new HttpError(400, 'Please enter a valid 10-digit student mobile number.');
  if (!text(b.parentName)) throw new HttpError(400, 'Please enter the parent or guardian name.');
  if (last10(b.parentPhone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit parent mobile number.');
  checkEmail(email);
  checkPassword(b.password);

  const course = typeof b.courseId === 'string' ? await s.getItem('courses', b.courseId) : null;
  const batch = typeof b.batchId === 'string' ? await s.getItem('batches', b.batchId) : null;
  if (!course || !batch || batch.courseId !== b.courseId || batch.status === 'completed') {
    throw new HttpError(400, 'Please choose a program and one of its batches.');
  }

  const records = await s.find('students');
  if (records.filter((x) => x.batchId === batch.id).length >= (batch.maxCapacity || 0)) {
    throw new HttpError(409, 'This batch is full. Please choose another batch.');
  }
  const already = records.some(
    (x) => String(x.name ?? '').trim().toLowerCase() === name.toLowerCase() && (last10(x.phone) === phone10 || last10(x.parentPhone) === phone10),
  );
  if (already) {
    throw new HttpError(409, 'A student with this name and mobile number is already registered. Use the “Already Admitted” option to create your login.');
  }
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  const student = {
    id: newId('s'),
    rollNo: nextRollNumber(records), // automatic, the student cannot choose it
    name,
    email,
    phone: normalizePhone(b.phone),
    parentName: text(b.parentName),
    parentPhone: normalizePhone(b.parentPhone),
    grade: text(b.grade, 40) || 'Class 12',
    courseId: course.id,
    batchId: batch.id,
    targetExam: course.name,
    dateOfAdmission: todayLocal(),
    status: 'trial', // waits for the principal to confirm the admission and set the fee
    photoUrl: DEFAULT_PHOTO,
    address: '',
    totalFees: 0,
    discount: 0,
    feePaid: 0,
    notes: 'Self-registered through the student portal. Fee structure pending confirmation.',
  };
  const user = auth.buildUser({ name, email, password: b.password, role: 'student', phone: text(b.phone, 30), studentId: student.id }, 'active');

  await addUserOrConflict(c, user);
  await s.applyList('students', [student], []);
  await s.incField('batches', batch.id, 'enrolledCount', 1);
  await s.bump();
  await s.audit(user, 'register-student', `New registration ${student.rollNo}`);
  return startSession(c, user);
});

// ---------- any signed-in account ----------

route('/api/auth/logout', ['POST'], 'any', async (c) => {
  await auth.destroySession(c.store, c.token);
  return ok();
});

route('/api/auth/me', ['GET'], 'any', (c) => ({ user: auth.publicUser(c.user) }));

route('/api/auth/change-password', ['POST'], 'any', async (c) => {
  const s = c.store;
  const b = c.body();
  const current: string = typeof b.currentPassword === 'string' ? b.currentPassword : '';
  const next = b.newPassword;
  if (!auth.verifyPassword(c.user, current)) throw new HttpError(400, 'Current password is incorrect.');
  checkPassword(next);
  if (next === current) throw new HttpError(400, 'New password must be different from the current one.');

  auth.setPassword(c.user, next);
  delete c.user.mustChangePassword; // a password reset by somebody else has to be replaced by an own one
  await s.saveUser(c.user);
  await auth.destroySessionsOf(s, c.user.id, c.token); // other devices must sign in again
  await s.audit(c.user, 'change-password');
  return ok();
});

/** The browser asks for changes since the version it already has. */
route('/api/sync', ['GET'], 'user', async (c) => {
  const s = c.store;
  const version = await s.version();
  const since = intParam(c.query('since'));
  if (since !== null && since === version) return { changed: false, version };

  const out: any = { changed: true, version, user: auth.publicUser(c.user), institute: await scopeInstitute(c.user, s) };
  const org = await c.root.orgGet(s.org);
  if (org) out.org = { id: org.id, name: org.name, city: org.city ?? '' };
  if (c.user.role === 'admin' || c.user.role === 'staff') out.users = (await s.usersAll()).map(auth.publicUser);
  return out;
});

/** The browser sends what changed: { students: { upsert: [...], remove: [ids] }, profile: {...} } */
route('/api/institute', ['PUT'], 'user', async (c) => {
  const s = c.store;
  const b = c.body(INSTITUTE_BODY);
  const [summary, adjusted] = await applyChanges(c.user, s, b.changes);
  if (summary.length) {
    await s.bump();
    await s.audit(c.user, 'data', summary.join(', '));
  }
  // adjusted: how many things the server changed itself (renumbered, photo moved): the browser must fetch them
  return { version: await s.version(), adjusted };
});

// ---------- accounts (principal only) ----------

const batchIdsOf = (value: any): string[] => (Array.isArray(value) ? value.filter((i) => typeof i === 'string') : []);

route('/api/users', ['POST'], 'admin', async (c) => {
  const s = c.store;
  const b = c.body();
  const email = text(b.email).toLowerCase();
  const role = b.role;
  if (!['admin', 'staff', 'teacher', 'student'].includes(role)) throw new HttpError(400, 'Choose a valid role.');
  if (!text(b.name)) throw new HttpError(400, 'Please enter the full name.');
  checkEmail(email);
  checkPassword(b.password);
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  const isParent = role === 'student' && b.isParent === true;
  if (role === 'student') {
    const studentId = b.studentId;
    if (!studentId || typeof studentId !== 'string') throw new HttpError(400, 'Please choose the student record for this account.');
    if (await s.userByStudent(studentId, isParent)) {
      throw new HttpError(409, isParent ? 'This student already has a parent login.' : 'This student already has an account.');
    }
    if (!(await s.getItem('students', studentId))) throw new HttpError(400, 'That student record does not exist.');
  }

  const user = auth.buildUser(
    {
      name: text(b.name),
      email,
      password: b.password,
      role,
      phone: text(b.phone, 30),
      subject: text(b.subject),
      batchIds: batchIdsOf(b.batchIds),
      studentId: role === 'student' ? b.studentId : null,
      isParent,
    },
    'active',
  );
  user.mustChangePassword = true; // the principal chose this password, so the person has to choose an own one
  await addUserOrConflict(c, user);
  await s.bump();
  await s.audit(c.user, 'user-add', `${user.email} (${roleLabel(role)})`);
  await welcomeMail(c, s, user, b.password);
  return { user: auth.publicUser(user) };
});

route('/api/users/<user_id>/approve', ['POST'], 'admin', async (c) => {
  const s = c.store;
  const target = await s.userById(c.req.params.user_id);
  if (!target) throw new HttpError(404, 'Request not found.');
  const b = c.body();
  target.status = 'active';
  if (target.role === 'teacher') target.batchIds = Array.isArray(b.batchIds) ? batchIdsOf(b.batchIds) : target.batchIds || [];
  await s.saveUser(target);
  await s.bump();
  await s.audit(c.user, 'user-approve', target.email);
  const coaching = await coachingName(c, s);
  mail(target.email, `Your account for ${coaching} is approved`, 'Your account is approved', ['You can sign in now with your email and the password you chose.'], {
    details: [
      ['Coaching', coaching],
      ['Sign in with', target.email],
    ],
    button: ['Sign in', c.loginLink(portalOf(target.role))],
    accent: GREEN,
    name: target.name,
  });
  return ok();
});

route('/api/users/<user_id>/reject', ['POST'], 'admin', async (c) => {
  const s = c.store;
  const userId = c.req.params.user_id as string;
  const target = await s.userById(userId);
  if (!target) throw new HttpError(404, 'Request not found.');
  if ((target.status || 'active') !== 'pending') throw new HttpError(400, 'Only pending requests can be rejected.');
  await s.removeUser(userId);
  await s.bump();
  await s.audit(c.user, 'user-reject', target.email);
  const coaching = await coachingName(c, s);
  mail(
    target.email,
    `Your request for ${coaching} was not approved`,
    'Your request was not approved',
    ['Sorry, the principal could not approve your request. You can ask the principal of the coaching for help.'],
    { details: [['Coaching', coaching]], button: ['Visit AcademiaOS', c.siteUrl()], accent: RED, name: target.name },
  );
  return ok();
});

route('/api/users/<user_id>/batches', ['PUT'], 'admin', async (c) => {
  const s = c.store;
  const target = await s.userById(c.req.params.user_id);
  if (!target || target.role !== 'teacher') throw new HttpError(404, 'Teacher account not found.');
  const b = c.body();
  if (!Array.isArray(b.batchIds)) throw new HttpError(400, 'batchIds must be a list.');
  target.batchIds = batchIdsOf(b.batchIds);
  await s.saveUser(target);
  await s.bump();
  await s.audit(c.user, 'user-batches', target.email);
  return ok();
});

route('/api/users/<user_id>/role', ['PUT'], 'admin', async (c) => {
  const s = c.store;
  const role = c.body().role;
  if (!['admin', 'staff'].includes(role)) throw new HttpError(400, 'Only Administrator or Front Desk Staff can be assigned here.');
  const target = await s.userById(c.req.params.user_id);
  if (!target) throw new HttpError(404, 'User not found.');
  if (['teacher', 'student'].includes(target.role)) throw new HttpError(400, 'Teacher and student roles cannot be changed.');
  if (target.id === c.user.id) throw new HttpError(400, 'You cannot change your own role.');
  if (target.role === 'admin' && role !== 'admin' && (await s.adminCount()) <= 1) throw new HttpError(400, 'At least one administrator is required.');
  target.role = role;
  await s.saveUser(target);
  await s.bump();
  await s.audit(c.user, 'user-role', `${target.email} -> ${roleLabel(role)}`);
  return ok();
});

route('/api/users/<user_id>/reset-password', ['POST'], 'admin', async (c) => {
  const s = c.store;
  const next = c.body().newPassword;
  checkPassword(next);
  const target = await s.userById(c.req.params.user_id);
  if (!target) throw new HttpError(404, 'User not found.');
  auth.setPassword(target, next);
  delete target.resetRequestedAt;
  if (target.id !== c.user.id) target.mustChangePassword = true; // the person has to choose an own password at the next sign in
  await s.saveUser(target);
  if (target.id === c.user.id) await auth.destroySessionsOf(s, target.id, c.token);
  else await auth.destroySessionsOf(s, target.id);
  await s.audit(c.user, 'user-reset-password', target.email);
  return ok();
});

route('/api/users/<user_id>', ['DELETE'], 'admin', async (c) => {
  const s = c.store;
  const userId = c.req.params.user_id as string;
  const target = await s.userById(userId);
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.id === c.user.id) throw new HttpError(400, 'You cannot remove your own account.');
  if (target.role === 'admin' && (await s.adminCount()) <= 1) throw new HttpError(400, 'At least one administrator is required.');
  await s.removeUser(userId);
  await auth.destroySessionsOf(s, userId);
  await s.bump();
  await s.audit(c.user, 'user-remove', target.email);
  return ok();
});

route('/api/audit', ['GET'], 'admin', async (c) => {
  const limit = Math.min(1000, Math.max(1, intParam(c.query('limit')) || 200));
  return { entries: await c.store.auditRecent(limit) };
});

/** A student marks a homework of the own batch as done (or takes the mark back). Only the student can do it. */
route('/api/homework/<material_id>', ['PUT'], 'user', async (c) => {
  if (c.user.role !== 'student' || c.user.isParent) throw new HttpError(403, 'Only a student marks homework as done.');
  const s = c.store;
  const materialId = c.req.params.material_id as string;
  const me = c.user.studentId ? await s.getItem('students', c.user.studentId) : null;
  const material = await s.getItem('materials', materialId);
  if (!me || !material || material.batchId !== me.batchId || material.type !== 'homework') throw new HttpError(404, 'Homework not found.');
  const subId = `${materialId}:${me.id}`;
  if (c.body().done === false) await s.applyList('submissions', [], [subId]);
  else await s.applyList('submissions', [{ id: subId, materialId, studentId: me.id, doneAt: nowIso() }], []);
  await s.bump();
  return ok();
});

/** Everybody can change the email they sign in with. The current password has to be typed (somebody who finds a
 * signed-in screen cannot take the account over). One email, one account, over all coachings. */
route('/api/auth/change-email', ['POST'], 'any', async (c) => {
  const b = c.body();
  const current: string = typeof b.currentPassword === 'string' ? b.currentPassword : '';
  const next = text(b.newEmail).toLowerCase();
  if (!auth.verifyPassword(c.user, current)) throw new HttpError(400, 'Current password is incorrect.');
  checkEmail(next);
  if (next === c.user.email) throw new HttpError(400, 'This is already your email.');
  if (await emailTaken(c, next)) throw new HttpError(409, 'An account with this email already exists.');
  const old = c.user.email;
  c.user.email = next;
  try {
    await c.store.saveUser(c.user);
  } catch (err) {
    if (isDuplicateKey(err)) throw new HttpError(409, 'An account with this email already exists.');
    throw err;
  }
  await c.store.audit(c.user, 'change-email', `${old} -> ${next}`);
  return { user: auth.publicUser(c.user) };
});

/** Everybody can change their own phone number; everybody except students also their name
 * (a student's name belongs to the admission record). */
route('/api/auth/profile', ['PUT'], 'user', async (c) => {
  const s = c.store;
  const b = c.body();
  const user = c.user;
  if (user.role !== 'student' && 'name' in b) {
    const name = text(b.name);
    if (!name) throw new HttpError(400, 'Please enter your name.');
    user.name = name;
  }
  if ('phone' in b) {
    const phone = text(b.phone, 30);
    if (phone && last10(phone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
    if (phone) user.phone = phone;
    else delete user.phone;
  }
  if ('subject' in b && user.role === 'teacher') {
    const subject = text(b.subject);
    if (subject) user.subject = subject;
    else delete user.subject;
  }
  await s.saveUser(user);
  await s.bump();
  await s.audit(c.user, 'profile', 'Own details changed');
  return { user: auth.publicUser(user) };
});
