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
  notifyNewPerson,
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
        button: ['Open the sign in page', c.loginLink(portalOf(target.role, Boolean(target.isParent)))],
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
  if (typeof wanted === 'string' && wanted && (found.orgId !== wanted || found.role !== 'admin')) {
    fail();
    await s.audit(found, 'login-failed', 'wrong coaching');
    throw invalid();
  }

  // four logins: 'super' (super admin), 'admin' (principal of a coaching), 'member' (teacher, student),
  // 'parent' (the parent of a student, an own page /parent)
  const isParent = found.role === 'student' && Boolean(found.isParent);
  let portalOk: boolean;
  if (portal === 'admin') portalOk = found.role === 'admin';
  else if (portal === 'member') portalOk = ['teacher', 'student'].includes(found.role) && !isParent; // the "Teacher / Student" tab
  else if (portal === 'parent') portalOk = isParent; // the "Parent" tab
  else portalOk = found.role === portal;
  if (!portalOk) {
    throw new HttpError(
      403,
      found.role === 'staff'
        ? 'This kind of account (front desk staff) does not exist anymore. Please ask the principal to make you a new account.'
        : isParent
        ? 'This is a Parent account. Please use the Parent login page (the “Parent login” button under the sign in form).'
        : `This is a ${roleLabel(found.role)} account. Please use the “${portalLabel(found.role, isParent)}” tab to sign in.`,
    );
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
  await notifyNewPerson(s, 'new_teacher', user.name, `${user.name} asked to join as a teacher${user.subject ? ` (${user.subject})` : ''}. Approve the request in Team & Access.`);
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
/** A parent creates an own account. It is checked against the admission record: the roll number of the child and the mobile
 * number of the parent that was given at admission. One parent account for each child. */
route('/api/auth/register-parent', ['POST'], 'public', async (c) => {
  const s = await chooseOrg(c);
  await requireSetup(c);
  limitRegistrations(c);
  const b = c.body();
  const rollInput = text(b.rollNo, 50);
  const email = text(b.email).toLowerCase();
  const phone10 = last10(b.phone);
  if (!rollInput) throw new HttpError(400, 'Please enter the roll number of your child.');
  if (phone10.length < 10) throw new HttpError(400, 'Enter the 10-digit mobile number of the parent that was given at admission.');
  checkEmail(email);
  checkPassword(b.password);

  const records = await s.find('students');
  const rollKey = normRoll(rollInput);
  const student = records.find((x) => normRoll(x.rollNo || '') === rollKey);
  const verified = Boolean(student) && last10(student.parentPhone) === phone10;
  if (!student || !verified) {
    const sample = records.length ? records[0].rollNo : '05';
    throw new HttpError(
      400,
      `We could not verify these details. Check the roll number of your child (it looks like ${sample}) and the parent's mobile number given at admission.`,
    );
  }
  if (await s.userByStudent(student.id, true)) {
    throw new HttpError(409, 'A parent account already exists for this child. Please sign in, or ask the principal to reset the password.');
  }
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  const user = auth.buildUser(
    {
      name: text(student.parentName, 100) || `Parent of ${student.name}`,
      email,
      password: b.password,
      role: 'student',
      isParent: true,
      phone: text(b.phone, 30),
      studentId: student.id,
    },
    'active',
  );
  await addUserOrConflict(c, user);
  await s.bump();
  await s.audit(user, 'register-parent', student.rollNo);
  const coaching = await coachingName(c, s);
  mail(user.email, `Your AcademiaOS account for ${coaching}`, `Welcome to ${coaching}`, [`Your parent account is ready. You can follow the attendance, fees, tests and results of ${student.name} (read only).`], {
    details: [
      ['Coaching', coaching],
      ['Child', student.name],
      ['Sign in with', user.email],
    ],
    button: ['Sign in', c.loginLink('parent')],
    name: user.name,
  });
  return startSession(c, user, true);
});

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
  await notifyNewPerson(s, 'new_student', student.name, `${student.name} (Roll No: ${student.rollNo}) registered for ${batch.name}. Confirm the admission and set the fee.`, { id: batch.id, name: batch.name, grade: student.grade, studentId: student.id });
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

// ---------- fee notice ----------

const UPI_ID = /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/;

/** The office emails the parent of a student that the fee is not fully paid. When the coaching wrote its UPI id (Institute
 * Profile) the email has a "Pay now" button: it opens the pay page of the site, which opens the UPI app with the amount filled. */
route('/api/fees/notice-email', ['POST'], 'user', async (c) => {
  if (c.user.role !== 'admin') throw new HttpError(403, 'Only the principal can send a fee notice.');
  const s = c.store;
  const student = (await s.find('students')).find((x: any) => x.id === c.body().studentId);
  if (!student) throw new HttpError(404, 'Student not found.');
  const parentEmail = text(student.parentEmail, 150).toLowerCase();
  if (!parentEmail) return { notified: 'none' };
  const due = Math.max(0, (Number(student.totalFees) || 0) - (Number(student.discount) || 0) - (Number(student.feePaid) || 0));
  if (due <= 0) throw new HttpError(400, 'This student has no pending fee.');

  const profile = (await s.profile()) || {};
  const coaching = await coachingName(c, s);
  const upi = text(profile.upiId, 80);
  const symbol = text(profile.currencySymbol, 5) || '₹';
  const amount = `${symbol}${due.toLocaleString('en-IN')}`;
  const payLink = UPI_ID.test(upi)
    ? `${c.siteUrl()}/pay?${new URLSearchParams({ pa: upi, pn: coaching, am: String(due), sn: String(student.name || '') }).toString()}`
    : '';

  const [sent] = mail(
    parentEmail,
    `Fee notice for ${student.name}`,
    'The fee is not fully paid',
    [`The fee of ${student.name} at ${coaching} is not fully paid. Please pay the pending amount at the earliest.`],
    {
      details: [
        ['Student', student.name],
        ['Pending amount', amount],
        ['Coaching', coaching],
      ],
      button: payLink ? [`Pay ${amount} now`, payLink] : ['Visit AcademiaOS', c.siteUrl()],
      note: payLink
        ? 'The button opens your UPI app (GPay, PhonePe, Paytm...) with the amount already filled. After you pay, the office gives you a receipt.'
        : 'Please pay at the coaching office.',
      name: student.parentName,
    },
  );
  await s.audit(c.user, 'fee-notice-email', `${student.name}: ${amount}`);
  return { notified: sent ? 'sent' : 'no-email' };
});

/** The office tells the parents of a batch about a test that is coming (date, subject, marks, what it covers). Every parent with
 * an email gets it; the others are counted, the office tells them by WhatsApp. */
route('/api/exams/notice-email', ['POST'], 'user', async (c) => {
  if (c.user.role !== 'admin') throw new HttpError(403, 'Only the principal can send a test notice.');
  const s = c.store;
  const exam = (await s.find('exams')).find((x: any) => x.id === c.body().examId);
  if (!exam) throw new HttpError(404, 'Test not found.');
  const coaching = await coachingName(c, s);
  const students = (await s.find('students')).filter((x: any) => x.batchId === exam.batchId && x.status !== 'inactive');
  let sent = 0;
  let noEmail = 0;
  for (const st of students) {
    const to = text(st.parentEmail, 150).toLowerCase();
    if (!to) {
      noEmail++;
      continue;
    }
    const topics = Array.isArray(exam.syllabusTopics) ? exam.syllabusTopics.filter(Boolean).join(', ') : '';
    const [ok] = mail(
      to,
      `Test of ${st.name} on ${exam.date}`,
      'A test is coming',
      [`${st.name} has a test at ${coaching}. Please make sure the preparation is done.`],
      {
        details: [
          ['Student', st.name],
          ['Test', exam.title],
          ['Subject', exam.subject],
          ['Date', exam.date],
          ['Maximum marks', String(exam.maxMarks ?? '')],
          ['It covers', topics],
        ],
        button: ['Sign in as Parent', c.loginLink('parent')],
        note: 'In the parent login you see the tests, the results, the attendance and the fees of your child.',
        name: st.parentName,
      },
    );
    if (ok) sent++;
  }
  await s.audit(c.user, 'test-notice-email', `${exam.title}: ${sent} email(s)`);
  return { sent, noEmail };
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
  if (c.user.role === 'admin') out.users = (await s.usersAll()).map(auth.publicUser);
  return out;
});

/** The browser sends what changed: { students: { upsert: [...], remove: [ids] }, profile: {...} } */
/** A child was marked absent: the parent (with an email) is told at once. Once for each student and day, so saving the roll
 * call again or changing it back and forth does not mail again. Roll calls of old days are not mailed. */
async function mailAbsences(c: any, s: any, saved: any[], before: Map<string, any>): Promise<void> {
  const today = new Date(todayLocal() + 'T00:00:00').getTime();
  const students = new Map<string, any>((await s.find('students')).map((x: any) => [x.id, x]));
  const coaching = await coachingName(c, s);
  for (const rec of saved) {
    if (!rec || typeof rec.date !== 'string' || !rec.records || typeof rec.records !== 'object') continue;
    const age = (today - new Date(rec.date + 'T00:00:00').getTime()) / 86400000;
    if (!(age >= 0 && age <= 2)) continue;
    const old = before.get(rec.id)?.records || {};
    for (const [sid, status] of Object.entries<any>(rec.records)) {
      if (status !== 'absent' || old[sid] === 'absent') continue;
      const st = students.get(sid);
      const to = text(st?.parentEmail, 150).toLowerCase();
      if (!st || !to || st.status === 'inactive') continue;
      if (!(await s.claimAbsenceMail(`${rec.date}:${sid}`))) continue;
      mail(to, `${st.name} was absent on ${rec.date}`, 'Your child was absent', [`${st.name} was marked absent at ${coaching}. If this is a mistake, please tell the office.`], {
        details: [
          ['Student', st.name],
          ['Date', rec.date],
          ['Batch', (st.batchName as string) || ''],
        ],
        button: ['Sign in as Parent', c.loginLink('parent')],
        note: 'In the parent login you see the attendance of your child day by day.',
        name: st.parentName,
      });
    }
  }
}

route('/api/institute', ['PUT'], 'user', async (c) => {
  const s = c.store;
  const b = c.body(INSTITUTE_BODY);
  const saved: any[] = Array.isArray(b.changes?.attendance?.upsert) ? b.changes.attendance.upsert : [];
  const ids = saved.map((a) => a?.id).filter((i) => typeof i === 'string');
  const before = new Map<string, any>(ids.length ? (await s.find('attendance', { _id: { $in: ids } })).map((x: any) => [x.id, x]) : []);
  const [summary, adjusted] = await applyChanges(c.user, s, b.changes);
  if (summary.length) {
    await s.bump();
    await s.audit(c.user, 'data', summary.join(', '));
  }
  if (saved.length) {
    try {
      await mailAbsences(c, s, saved, before); // a mail that fails never breaks the saving of the roll call
    } catch {
      /* the roll call is saved all the same */
    }
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
  // one coaching has one principal: nobody can add another one
  if (!['teacher', 'student'].includes(role)) throw new HttpError(400, 'Choose a valid role. A coaching has only one principal.');
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
  // A new TEACHER is told to the bell. A student is not: the admission form already put "new student" in the bell, and it makes the
  // login right after (this route), so a second line would show every new student twice.
  if (!isParent && role === 'teacher') {
    await notifyNewPerson(s, 'new_teacher', user.name, `${user.name} was added as a teacher.`);
  }
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
    button: ['Sign in', c.loginLink(portalOf(target.role, Boolean(target.isParent)))],
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

// ---------- leave of a student and of a teacher ----------
// A student asks the principal for leave (dates + the full reason). The principal calls the parent to check the reason and then
// approves or rejects it. Only an APPROVED leave is a leave. Nobody writes this list through the normal data sync.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MIN_REASON = 15;
const LEAVE_KINDS = {
  student: ['Sick', 'Family function', 'Travel', 'Exam / other class', 'Other'],
  teacher: ['Sick', 'Casual', 'Family function', 'Travel', 'Other'],
};
const MAX_LEAVE_DAYS = 30;
const dayNumber = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDay = (iso: string): string => `${parseInt(iso.slice(8, 10), 10)} ${MONTHS[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}`;
const leaveDays = (l: any): string => (l.fromDate === l.toDate ? `on ${niceDay(l.fromDate)}` : `from ${niceDay(l.fromDate)} to ${niceDay(l.toDate)}`);

/** The same news that the principal gets goes to the PARENT of the student as a text (in the bell and on the Notice Board of the
 * parent login): the child asked for leave / the principal answered. A courtesy: a failure never breaks the leave itself. */
async function tellParentAboutLeave(c: any, leave: any, kind: 'asked' | 'approved' | 'rejected'): Promise<void> {
  try {
    const s = c.store;
    const coaching = await coachingName(c, s);
    const hello = `Dear ${leave.parentName || 'Parent'}, `;
    const who = `your ward ${leave.studentName}${leave.rollNo ? ` (Roll No: ${leave.rollNo})` : ''}`;
    const content =
      kind === 'asked'
        ? `${hello}${who} has sent a notice to the principal: ${leave.studentName} wants to take leave ${leaveDays(leave)} (${leave.kind ? `${leave.kind}; ` : ''}reason given: "${leave.reason}"). The principal may call you to confirm it. If this is not true, please tell him. - ${coaching}`
        : kind === 'approved'
        ? `${hello}the principal has approved the leave of ${who} ${leaveDays(leave)}, after confirming the reason. - ${coaching}`
        : `${hello}the principal did not give the leave to ${who} ${leaveDays(leave)}.${leave.decisionNote ? ` Reason: ${leave.decisionNote}.` : ''} Please send ${leave.studentName} to the class. - ${coaching}`;
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    await s.applyList(
      'notificationLogs',
      [
        {
          id: `log-leave-${leave.id}-${kind}`,
          timestamp,
          type: 'leave',
          channel: 'whatsapp',
          recipientName: leave.parentName || 'Parent',
          recipientPhone: leave.parentPhone || '',
          studentId: leave.studentId,
          studentName: leave.studentName,
          content,
          status: 'sent',
        },
      ],
      [],
    );
    await s.bump();
  } catch {
    /* a courtesy */
  }
}

/** The same news also goes by EMAIL (a courtesy: a failed email never breaks the leave). Who gets what:
 *   a student asks    the principal (to answer it), the parent, and the teachers of the batch of the student (so they know why the student
 *                     is not in the class)
 *   a teacher asks    the principal only
 *   the answer        the person who asked (the student / the teacher), the parent of the student and, when the leave is approved, the
 *                     teachers of the batch */
async function emailAboutLeave(c: any, leave: any, stage: 'asked' | 'approved' | 'rejected'): Promise<void> {
  try {
    const s = c.store;
    const coaching = await coachingName(c, s);
    const users = (await s.usersAll()).filter((u: any) => (u.status || 'active') === 'active');
    const isTeacherLeave = leave.role === 'teacher';
    const days = leaveDays(leave);
    const who: string = leave.studentName;
    const sent = new Set<string>(); // one email per address
    const send = (to: string | undefined, subject: string, heading: string, lines: string[], look: any) => {
      const address = String(to ?? '').trim().toLowerCase();
      if (!address.includes('@') || sent.has(address)) return;
      sent.add(address);
      mail(to as string, subject, heading, lines, look);
    };
    const detailRows: [string, any][] = isTeacherLeave
      ? [['Teacher', who], ['Subject', leave.subject], ['Leave', `${days.replace(/^(on|from) /, '')}`], ['Type', leave.kind], ['Certificate / proof', leave.hasProof ? 'Can be shown' : ''], ['Coaching', coaching]]
      : [['Student', who], ['Batch', leave.batchName], ['Roll No', leave.rollNo], ['Leave', `${days.replace(/^(on|from) /, '')}`], ['Type', leave.kind], ['Parent', [leave.parentName, leave.parentPhone].filter(Boolean).join(' · ')], ['Certificate / proof', leave.hasProof ? 'Can be shown' : ''], ['Coaching', coaching]];
    const reasonLine = `Reason: ${leave.reason}`;

    const admins = users.filter((u: any) => u.role === 'admin');
    // the parent: the email on the admission form and the email of the parent login
    const student = !isTeacherLeave && leave.studentId ? await s.getItem('students', leave.studentId) : null;
    const parentLogin = !isTeacherLeave ? users.find((u: any) => u.role === 'student' && u.isParent && u.studentId === leave.studentId) : null;
    const parents = [{ email: student?.parentEmail, name: leave.parentName }, { email: parentLogin?.email, name: parentLogin?.name || leave.parentName }];
    // the teachers of the batch of the student
    const teachers = isTeacherLeave ? [] : users.filter((u: any) => u.role === 'teacher' && (u.batchIds || []).includes(leave.batchId));
    // the person who asked
    const asker = isTeacherLeave ? users.find((u: any) => u.id === leave.teacherId) : users.find((u: any) => u.role === 'student' && !u.isParent && u.studentId === leave.studentId);

    if (stage === 'asked') {
      for (const a of admins) {
        send(a.email, `Leave request: ${who} wants leave ${days}`, `${isTeacherLeave ? 'Teacher ' : ''}${who} has asked for leave ${days}`, [reasonLine, isTeacherLeave ? 'Please approve the leave or write why it is not given.' : 'Please call the parent to check the reason, then approve the leave or write why it is not given. You find the request on the Notice Board.'], { details: detailRows, button: ['Open the Notice Board', c.loginLink('admin')], name: a.name });
      }
      if (!isTeacherLeave) {
        for (const pr of parents) {
          send(pr.email, `${who} has asked for leave ${days}`, `${who} has sent a notice to the principal and wants to take leave ${days}`, [reasonLine, 'The principal may call you to confirm the reason. If this is not true, please tell him.'], { details: detailRows, button: ['Open AcademiaOS', c.loginLink('parent')], name: pr.name });
        }
        for (const t of teachers) {
          send(t.email, `${who} (${leave.batchName}) has asked for leave ${days}`, `${who} of ${leave.batchName || 'your batch'} may not be in the class ${days}`, [`${who} has asked the principal for leave. ${reasonLine}`, 'The principal has not answered yet. You get another email when he does.'], { details: detailRows, button: ['Open AcademiaOS', c.loginLink('member')], name: t.name });
        }
      }
      return;
    }

    const approved = stage === 'approved';
    const answer = approved ? 'approved' : 'not given';
    const note = leave.decisionNote ? `Note of the principal: ${leave.decisionNote}` : '';
    const look = (name: string, portal: string) => ({ details: detailRows, accent: approved ? GREEN : RED, button: ['Open AcademiaOS', c.loginLink(portal)] as [string, string], name });
    // the person who asked
    send(asker?.email, `Your leave ${days} is ${answer}`, approved ? `Your leave ${days} is approved` : `Your leave ${days} is not given`, [note || (approved ? 'You can take the leave.' : 'Please come as usual.')].filter(Boolean), look(asker?.name || who, isTeacherLeave ? 'member' : 'member'));
    if (!isTeacherLeave) {
      for (const pr of parents) {
        send(pr.email, `Leave of ${who} ${days} is ${answer}`, approved ? `The principal approved the leave of ${who} ${days}` : `The principal did not give the leave of ${who} ${days}`, [reasonLine, note].filter(Boolean), look(pr.name, 'parent'));
      }
      if (approved) {
        for (const t of teachers) {
          send(t.email, `${who} (${leave.batchName}) is on leave ${days}`, `${who} of ${leave.batchName || 'your batch'} will not be in the class ${days}`, [`The principal approved the leave. ${reasonLine}`], look(t.name, 'member'));
        }
      }
    }
  } catch {
    /* a courtesy */
  }
}

route('/api/leaves', ['POST'], 'user', async (c) => {
  // a student or a teacher asks (a parent only reads); the form is the same, the teacher has no parent and no batch
  const isStudent = c.user.role === 'student' && !c.user.isParent;
  const isTeacher = c.user.role === 'teacher';
  if (!isStudent && !isTeacher) throw new HttpError(403, 'Only a student or a teacher asks for leave.');
  const s = c.store;
  const me = isStudent && c.user.studentId ? await s.getItem('students', c.user.studentId) : null;
  if (isStudent && !me) throw new HttpError(404, 'Student not found.');
  const b = c.body();
  const fromDate = text(b.fromDate, 10);
  const toDate = text(b.toDate, 10) || fromDate;
  const reason = text(b.reason, 600);
  const kinds = isStudent ? LEAVE_KINDS.student : LEAVE_KINDS.teacher;
  const kind = kinds.includes(text(b.kind, 30)) ? text(b.kind, 30) : '';
  const signature = text(b.signature, 80);
  if (!ISO_DAY.test(fromDate) || !ISO_DAY.test(toDate) || Number.isNaN(Date.parse(fromDate)) || Number.isNaN(Date.parse(toDate))) throw new HttpError(400, 'Choose the dates of the leave.');
  if (fromDate < todayLocal()) throw new HttpError(400, 'Ask for leave before the day, not for a day that is already over.');
  if (toDate < fromDate) throw new HttpError(400, 'The last day cannot be before the first day.');
  if (dayNumber(toDate) - dayNumber(fromDate) + 1 > MAX_LEAVE_DAYS) throw new HttpError(400, `One request can be for ${MAX_LEAVE_DAYS} days at most.`);
  if (reason.length < MIN_REASON) throw new HttpError(400, `Write the full reason for the leave (at least ${MIN_REASON} letters): why do you need it?`);
  if (b.declaration !== true) throw new HttpError(400, 'Tick that the details are correct.');
  if (signature.length < 3) throw new HttpError(400, 'Type your full name as the signature.');
  const mine = await s.find('leaveRequests', { ...(isStudent ? { studentId: me.id } : { teacherId: c.user.id }), status: { $in: ['pending', 'approved'] } });
  if (mine.some((l) => l.fromDate <= toDate && fromDate <= l.toDate)) throw new HttpError(409, 'You already have a leave request for these days.');
  const id = newId('leave');
  const common = { id, fromDate, toDate, reason, kind, hasProof: b.hasProof === true, signature, status: 'pending', createdAt: nowIso() };
  let record: any;
  if (isStudent) {
    const batch = me.batchId ? await s.getItem('batches', me.batchId) : null;
    record = {
      ...common,
      role: 'student',
      studentId: me.id,
      studentName: me.name,
      rollNo: me.rollNo ?? '',
      batchId: me.batchId ?? '',
      batchName: batch?.name ?? '',
      parentName: me.parentName ?? '',
      parentPhone: me.parentPhone ?? '',
    };
  } else {
    // studentName holds the NAME of the person for both roles (the old field); a teacher has no roll number, batch or parent here
    record = { ...common, role: 'teacher', teacherId: c.user.id, studentName: c.user.name, subject: c.user.subject ?? '' };
  }
  await s.applyList('leaveRequests', [record], []);
  await s.bump();
  await s.audit(c.user, 'leave-ask', `${record.studentName} ${fromDate}..${toDate}`);
  if (isStudent) await tellParentAboutLeave(c, record, 'asked'); // the parent of a student gets the same news; nobody else
  await emailAboutLeave(c, record, 'asked');
  return { ok: true, id };
});

/** The principal decides (approved / rejected); the person who asked can take back a request that is still waiting (cancelled). */
route('/api/leaves/<leave_id>', ['PUT'], 'user', async (c) => {
  const s = c.store;
  const leave = await s.getItem('leaveRequests', c.req.params.leave_id as string);
  if (!leave) throw new HttpError(404, 'Leave request not found.');
  if (leave.status !== 'pending') throw new HttpError(409, 'This request was already answered.');
  const b = c.body();
  const decision = text(b.decision, 20);
  const isTeacherLeave = leave.role === 'teacher';

  const isStudent = c.user.role === 'student' && !c.user.isParent;
  if (isStudent || c.user.role === 'teacher') {
    const own = isStudent ? leave.studentId === c.user.studentId : leave.teacherId === c.user.id;
    if (!own) throw new HttpError(404, 'Leave request not found.');
    if (decision !== 'cancelled') throw new HttpError(403, 'Only the principal approves or rejects leave.');
    await s.applyList('leaveRequests', [{ ...leave, status: 'cancelled', decidedAt: nowIso() }], []);
    await s.bump();
    return ok();
  }

  if (c.user.role !== 'admin') throw new HttpError(403, 'Only the principal approves or rejects leave.');
  if (decision !== 'approved' && decision !== 'rejected') throw new HttpError(400, 'Approve or reject the leave.');
  const note = text(b.note, 400);
  // a student's reason is checked with the parent by a call; a teacher has no parent to call
  if (decision === 'approved' && !isTeacherLeave && b.parentConfirmed !== true) throw new HttpError(400, 'Call the parent and confirm the reason first, then tick that you did.');
  if (decision === 'rejected' && note.length < 5) throw new HttpError(400, 'Write why the leave is not given.');
  await s.applyList(
    'leaveRequests',
    [{ ...leave, status: decision, decisionNote: note, decidedAt: nowIso(), decidedBy: c.user.name, ...(decision === 'approved' && !isTeacherLeave ? { parentConfirmedBy: c.user.name } : {}) }],
    [],
  );
  await s.bump();
  await s.audit(c.user, `leave-${decision}`, `${leave.studentName} ${leave.fromDate}..${leave.toDate}`);
  if (!isTeacherLeave) await tellParentAboutLeave(c, { ...leave, decisionNote: note }, decision);
  await emailAboutLeave(c, { ...leave, decisionNote: note }, decision);
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
