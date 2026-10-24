// All API routes. Each route says who may call it:
//   public  anybody (sign in, sign up)
//   user    any signed-in account
//   manager principal or front desk staff
//   admin   principal only

import { HttpError } from './http.mjs';
import {
  buildUser,
  createLimiter,
  createSession,
  destroySession,
  destroySessionsOf,
  hashPassword,
  needsUpgrade,
  publicUser,
  setPassword,
  verifyPassword
} from './auth.mjs';
import { applyChanges, scopeInstitute } from './scope.mjs';
import { nextRollNumber } from './rollno.mjs';
import {
  EMAIL_REGEX,
  last10,
  newId,
  normRoll,
  normalizePhone,
  passwordProblem,
  portalLabel,
  roleLabel,
  text,
  todayLocal
} from './validate.mjs';

const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
const MINUTE = 60 * 1000;

export const createRoutes = store => {
  const state = store.state;

  const loginLimiter = createLimiter({ max: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });
  const ipLimiter = createLimiter({ max: 40, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });
  const registerLimiter = createLimiter({ max: 20, windowMs: 60 * MINUTE, lockMs: 60 * MINUTE });

  const students = () => (Array.isArray(state.institute?.students) ? state.institute.students : []);
  const admins = () => state.users.filter(u => u.role === 'admin');
  const findUser = id => state.users.find(u => u.id === id);

  const requireSetup = () => {
    if (state.users.length === 0) {
      throw new HttpError(
        409,
        'The institute is not set up yet. Please ask the principal to create the administrator account first.'
      );
    }
  };

  // Public sign-up forms are limited per address so nobody can flood the server
  const limitRegistrations = ctx => {
    const gate = registerLimiter.check(ctx.ip);
    if (!gate.ok) throw new HttpError(429, 'Too many sign-up attempts. Please try again later.');
    registerLimiter.fail(ctx.ip);
  };

  const startSession = (user, remember = true) => {
    const token = createSession(state, user.id, remember);
    store.touch();
    return { token, user: publicUser(user) };
  };

  const checkEmail = email => {
    if (!EMAIL_REGEX.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  };
  const checkPassword = pw => {
    const problem = passwordProblem(pw);
    if (problem) throw new HttpError(400, problem);
  };
  const emailTaken = email => state.users.some(u => u.email === email);

  const routes = [];
  const route = (method, pattern, access, handler) => routes.push({ method, pattern, access, handler });

  // ---------- public ----------

  route('GET', '/api/health', 'public', () => ({ ok: true, version: state.version }));

  route('GET', '/api/auth/status', 'public', () => ({ hasUsers: state.users.length > 0 }));

  // First start: creates the principal. Only works while there is no account at all.
  route('POST', '/api/auth/setup', 'public', async ctx => {
    if (state.users.length > 0) {
      throw new HttpError(409, 'Setup is already complete. Please sign in, or register as a student or teacher.');
    }
    const name = text(ctx.body.name);
    const email = text(ctx.body.email).toLowerCase();
    const password = ctx.body.password;
    if (!name) throw new HttpError(400, 'Please enter your full name.');
    checkEmail(email);
    checkPassword(password);

    const user = await buildUser({ name, email, password, role: 'admin' }, 'active');
    state.users.push(user);
    store.bump();
    store.audit(user, 'setup', 'Principal account created');
    return startSession(user);
  });

  route('POST', '/api/auth/login', 'public', async ctx => {
    const email = text(ctx.body.email).toLowerCase();
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const portal = ctx.body.portal;
    const remember = ctx.body.remember !== false;
    const invalid = new HttpError(401, 'Incorrect email or password.');

    const keyEmail = `${ctx.ip}|${email}`;
    for (const gate of [loginLimiter.check(keyEmail), ipLimiter.check(ctx.ip)]) {
      if (!gate.ok) {
        const minutes = Math.max(1, Math.ceil(gate.retryAfterSec / 60));
        throw new HttpError(429, `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      }
    }
    const fail = () => {
      loginLimiter.fail(keyEmail);
      ipLimiter.fail(ctx.ip);
    };

    const found = state.users.find(u => u.email === email);
    if (!found || password.length > 200) {
      await hashPassword(password.slice(0, 200), '0'.repeat(32)); // same time whether or not the email exists
      fail();
      store.audit(null, 'login-failed', email);
      throw invalid;
    }
    if (!(await verifyPassword(found, password))) {
      fail();
      store.audit(found, 'login-failed', 'wrong password');
      throw invalid;
    }

    if ((found.status || 'active') === 'pending') {
      throw new HttpError(403, 'Your account is waiting for the principal’s approval. Please try again after it is approved.');
    }

    const portalOk = portal === 'admin' ? found.role === 'admin' || found.role === 'staff' : found.role === portal;
    if (!portalOk) {
      throw new HttpError(
        403,
        `This is a ${roleLabel(found.role)} account. Please use the “${portalLabel(found.role)}” tab to sign in.`
      );
    }

    if (needsUpgrade(found)) {
      await setPassword(found, password);
      store.touch();
    }
    loginLimiter.reset(keyEmail);
    store.audit(found, 'login');
    return startSession(found, remember);
  });

  route('POST', '/api/auth/register-teacher', 'public', async ctx => {
    requireSetup();
    limitRegistrations(ctx);
    const name = text(ctx.body.name);
    const email = text(ctx.body.email).toLowerCase();
    const subject = text(ctx.body.subject);
    if (!name) throw new HttpError(400, 'Please enter your full name.');
    if (last10(ctx.body.phone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
    checkEmail(email);
    checkPassword(ctx.body.password);
    if (emailTaken(email)) throw new HttpError(409, 'An account with this email already exists.');

    const user = await buildUser(
      { name, email, password: ctx.body.password, role: 'teacher', phone: text(ctx.body.phone, 30), subject, batchIds: [] },
      'pending'
    );
    state.users.push(user);
    store.bump();
    store.audit(user, 'register-teacher', 'Waiting for approval');
    return { ok: true };
  });

  // A student that was admitted by the office creates a login (checked against the admission record)
  route('POST', '/api/auth/register-student', 'public', async ctx => {
    requireSetup();
    limitRegistrations(ctx);
    const rollInput = text(ctx.body.rollNo, 50);
    const email = text(ctx.body.email).toLowerCase();
    const phone10 = last10(ctx.body.phone);

    if (!rollInput) throw new HttpError(400, 'Please enter your roll number.');
    if (phone10.length < 10) throw new HttpError(400, 'Enter the 10-digit mobile number registered at admission.');
    checkEmail(email);
    checkPassword(ctx.body.password);

    const records = students();
    const rollKey = normRoll(rollInput);
    let student = records.find(s => normRoll(s.rollNo || '') === rollKey);
    // Only the number was typed (for example "101"): accept it when it points to exactly one student
    if (!student && /^\d{1,6}$/.test(rollInput)) {
      const typed = parseInt(rollInput, 10);
      const matches = records.filter(s => {
        const tail = String(s.rollNo || '').match(/(\d+)\D*$/);
        return !!tail && parseInt(tail[1], 10) === typed;
      });
      if (matches.length === 1) student = matches[0];
    }
    const verified = !!student && (last10(student.phone) === phone10 || last10(student.parentPhone) === phone10);
    if (!student || !verified) {
      throw new HttpError(
        400,
        `We could not verify these details. Check your roll number (it looks like ${
          records[0]?.rollNo || '05'
        }) and the mobile number registered at admission.`
      );
    }
    if (state.users.some(u => u.studentId === student.id)) {
      throw new HttpError(
        409,
        'An account already exists for this student. Please sign in, or ask the principal to reset your password.'
      );
    }
    if (emailTaken(email)) throw new HttpError(409, 'An account with this email already exists.');

    const user = await buildUser(
      { name: student.name, email, password: ctx.body.password, role: 'student', phone: text(ctx.body.phone, 30), studentId: student.id },
      'active'
    );
    state.users.push(user);
    store.bump();
    store.audit(user, 'register-student', student.rollNo);
    return startSession(user);
  });

  route('GET', '/api/public/registration-options', 'public', () => {
    const data = state.institute || {};
    const all = students();
    const batches = (Array.isArray(data.batches) ? data.batches : [])
      .filter(b => b.status !== 'completed')
      .map(b => ({ ...b, filled: all.filter(s => s.batchId === b.id).length }));
    return {
      courses: Array.isArray(data.courses) ? data.courses : [],
      batches,
      nextRollNo: nextRollNumber(all)
    };
  });

  // A new student registers on the portal: the student record gets an automatic roll number
  route('POST', '/api/auth/register-new-student', 'public', async ctx => {
    requireSetup();
    limitRegistrations(ctx);
    const b = ctx.body;
    const name = text(b.name);
    const email = text(b.email).toLowerCase();
    const phone10 = last10(b.phone);

    if (!name) throw new HttpError(400, 'Please enter your full name.');
    if (phone10.length < 10) throw new HttpError(400, 'Please enter a valid 10-digit student mobile number.');
    if (!text(b.parentName)) throw new HttpError(400, 'Please enter the parent or guardian name.');
    if (last10(b.parentPhone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit parent mobile number.');
    checkEmail(email);
    checkPassword(b.password);

    const data = state.institute || {};
    const course = (Array.isArray(data.courses) ? data.courses : []).find(c => c.id === b.courseId);
    const batch = (Array.isArray(data.batches) ? data.batches : []).find(
      x => x.id === b.batchId && x.courseId === b.courseId && x.status !== 'completed'
    );
    if (!course || !batch) throw new HttpError(400, 'Please choose a program and one of its batches.');

    const records = students();
    if (records.filter(s => s.batchId === batch.id).length >= batch.maxCapacity) {
      throw new HttpError(409, 'This batch is full. Please choose another batch.');
    }
    const alreadyRegistered = records.some(
      s =>
        String(s.name).trim().toLowerCase() === name.toLowerCase() &&
        (last10(s.phone) === phone10 || last10(s.parentPhone) === phone10)
    );
    if (alreadyRegistered) {
      throw new HttpError(
        409,
        'A student with this name and mobile number is already registered. Use the “Already Admitted” option to create your login.'
      );
    }
    if (emailTaken(email)) throw new HttpError(409, 'An account with this email already exists.');

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
      notes: 'Self-registered through the student portal. Fee structure pending confirmation.'
    };

    const user = await buildUser(
      { name, email, password: b.password, role: 'student', phone: text(b.phone, 30), studentId: student.id },
      'active'
    );

    state.institute = state.institute || {};
    state.institute.students = [student, ...records];
    state.institute.batches = (state.institute.batches || []).map(x =>
      x.id === batch.id ? { ...x, enrolledCount: (x.enrolledCount || 0) + 1 } : x
    );
    state.users.push(user);
    store.bump();
    store.audit(user, 'register-student', `New registration ${student.rollNo}`);
    return startSession(user);
  });

  // ---------- any signed-in account ----------

  route('POST', '/api/auth/logout', 'user', ctx => {
    destroySession(state, ctx.token);
    store.touch();
    return { ok: true };
  });

  route('GET', '/api/auth/me', 'user', ctx => ({ user: publicUser(ctx.user) }));

  route('POST', '/api/auth/change-password', 'user', async ctx => {
    const current = typeof ctx.body.currentPassword === 'string' ? ctx.body.currentPassword : '';
    const next = ctx.body.newPassword;
    if (!(await verifyPassword(ctx.user, current))) throw new HttpError(400, 'Current password is incorrect.');
    checkPassword(next);
    if (next === current) throw new HttpError(400, 'New password must be different from the current one.');

    await setPassword(ctx.user, next);
    destroySessionsOf(state, ctx.user.id, ctx.token); // other devices must sign in again
    store.touch();
    store.audit(ctx.user, 'change-password');
    return { ok: true };
  });

  // The browser asks for changes since the version it already has
  route('GET', '/api/sync', 'user', ctx => {
    const since = Number(ctx.query.get('since'));
    if (Number.isFinite(since) && since === state.version) return { changed: false, version: state.version };

    const manager = ctx.user.role === 'admin' || ctx.user.role === 'staff';
    return {
      changed: true,
      version: state.version,
      user: publicUser(ctx.user),
      users: manager ? state.users.map(publicUser) : undefined,
      institute: scopeInstitute(ctx.user, state.institute)
    };
  });

  // The browser sends what changed: { students: { upsert: [...], remove: [ids] }, profile: {...} }
  route('PUT', '/api/institute', 'user', ctx => {
    state.institute = state.institute || {};
    const summary = applyChanges(ctx.user, state.institute, ctx.body.changes);
    if (summary.length > 0) {
      store.bump();
      store.audit(ctx.user, 'data', summary.join(', '));
    }
    return { version: state.version };
  });

  // ---------- accounts (principal only) ----------

  route('POST', '/api/users', 'admin', async ctx => {
    const b = ctx.body;
    const email = text(b.email).toLowerCase();
    const role = b.role;
    if (!['admin', 'staff', 'teacher', 'student'].includes(role)) throw new HttpError(400, 'Choose a valid role.');
    if (!text(b.name)) throw new HttpError(400, 'Please enter the full name.');
    checkEmail(email);
    checkPassword(b.password);
    if (emailTaken(email)) throw new HttpError(409, 'An account with this email already exists.');

    if (role === 'student') {
      if (!b.studentId) throw new HttpError(400, 'Please choose the student record for this account.');
      if (state.users.some(u => u.studentId === b.studentId)) throw new HttpError(409, 'This student already has an account.');
      if (!students().some(s => s.id === b.studentId)) throw new HttpError(400, 'That student record does not exist.');
    }

    const user = await buildUser(
      {
        name: text(b.name),
        email,
        password: b.password,
        role,
        phone: text(b.phone, 30),
        subject: text(b.subject),
        batchIds: Array.isArray(b.batchIds) ? b.batchIds.filter(id => typeof id === 'string') : [],
        studentId: role === 'student' ? b.studentId : undefined
      },
      'active'
    );
    state.users.push(user);
    store.bump();
    store.audit(ctx.user, 'user-add', `${user.email} (${roleLabel(role)})`);
    return { user: publicUser(user) };
  });

  route('POST', '/api/users/:id/approve', 'admin', ctx => {
    const target = findUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'Request not found.');
    target.status = 'active';
    if (target.role === 'teacher') {
      const ids = Array.isArray(ctx.body.batchIds) ? ctx.body.batchIds.filter(id => typeof id === 'string') : target.batchIds || [];
      target.batchIds = ids;
    }
    store.bump();
    store.audit(ctx.user, 'user-approve', target.email);
    return { ok: true };
  });

  route('POST', '/api/users/:id/reject', 'admin', ctx => {
    const target = findUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'Request not found.');
    if ((target.status || 'active') !== 'pending') throw new HttpError(400, 'Only pending requests can be rejected.');
    state.users = state.users.filter(u => u.id !== target.id);
    store.bump();
    store.audit(ctx.user, 'user-reject', target.email);
    return { ok: true };
  });

  route('PUT', '/api/users/:id/batches', 'admin', ctx => {
    const target = findUser(ctx.params.id);
    if (!target || target.role !== 'teacher') throw new HttpError(404, 'Teacher account not found.');
    if (!Array.isArray(ctx.body.batchIds)) throw new HttpError(400, 'batchIds must be a list.');
    target.batchIds = ctx.body.batchIds.filter(id => typeof id === 'string');
    store.bump();
    store.audit(ctx.user, 'user-batches', target.email);
    return { ok: true };
  });

  route('PUT', '/api/users/:id/role', 'admin', ctx => {
    const role = ctx.body.role;
    if (role !== 'admin' && role !== 'staff') {
      throw new HttpError(400, 'Only Administrator or Front Desk Staff can be assigned here.');
    }
    const target = findUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'User not found.');
    if (target.role === 'teacher' || target.role === 'student') {
      throw new HttpError(400, 'Teacher and student roles cannot be changed.');
    }
    if (target.id === ctx.user.id) throw new HttpError(400, 'You cannot change your own role.');
    if (target.role === 'admin' && role !== 'admin' && admins().length <= 1) {
      throw new HttpError(400, 'At least one administrator is required.');
    }
    target.role = role;
    store.bump();
    store.audit(ctx.user, 'user-role', `${target.email} -> ${roleLabel(role)}`);
    return { ok: true };
  });

  route('POST', '/api/users/:id/reset-password', 'admin', async ctx => {
    checkPassword(ctx.body.newPassword);
    const target = findUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'User not found.');
    await setPassword(target, ctx.body.newPassword);
    if (target.id === ctx.user.id) destroySessionsOf(state, target.id, ctx.token);
    else destroySessionsOf(state, target.id);
    store.touch();
    store.audit(ctx.user, 'user-reset-password', target.email);
    return { ok: true };
  });

  route('DELETE', '/api/users/:id', 'admin', ctx => {
    const target = findUser(ctx.params.id);
    if (!target) throw new HttpError(404, 'User not found.');
    if (target.id === ctx.user.id) throw new HttpError(400, 'You cannot remove your own account.');
    if (target.role === 'admin' && admins().length <= 1) throw new HttpError(400, 'At least one administrator is required.');
    state.users = state.users.filter(u => u.id !== target.id);
    destroySessionsOf(state, target.id);
    store.bump();
    store.audit(ctx.user, 'user-remove', target.email);
    return { ok: true };
  });

  route('GET', '/api/audit', 'admin', ctx => {
    const limit = Math.min(1000, Math.max(1, Number(ctx.query.get('limit')) || 200));
    return { entries: state.audit.slice(-limit).reverse() };
  });

  return routes;
};
