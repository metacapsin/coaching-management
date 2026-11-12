// The API routes, part 2: the Super Admin (coachings, payments; there is only ONE Super Admin), student photos and backups.

import * as auth from './auth.ts';
import { logoOf } from './logo.ts';
import * as mailer from './mailer.ts';
import { seal } from './secretBox.ts';
import { GREEN, RED } from './emailTemplate.ts';
import { HttpError } from './errors.ts';
import {
  INSTITUTE_BODY,
  RawResponse,
  addUserOrConflict,
  checkEmail,
  checkPassword,
  emailTaken,
  fromPerson,
  limitRegistrations,
  mail,
  nowIso,
  ok,
  route,
  startSession,
} from './http.ts';
import type { Ctx } from './http.ts';
import { intParam } from './routes.ts';
import { BackupError, DEFAULT_ORG, PLATFORM_ORG } from './store.ts';
import { checkName, last10, newId, text, todayLocal } from './validate.ts';

const isNumber = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);
const round2 = (x: number): number => Math.round(x * 100) / 100;

// ---------- creating a coaching ----------

/** Creates a coaching and its principal account. status: 'pending' (waits for the super admin) or 'active'. */
async function newCoaching(c: Ctx, b: any, status: string): Promise<[any, any]> {
  const r = c.root;
  const name = text(b.coachingName, 120);
  const adminName = text(b.adminName);
  const email = text(b.email).toLowerCase();
  if (!name) throw new HttpError(400, 'Please enter the name of the coaching.');
  checkName(name, 'name of the coaching');
  if (!adminName) throw new HttpError(400, 'Please enter the name of the administrator.');
  checkName(adminName, 'name of the principal');
  if (last10(b.phone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  checkEmail(email);
  checkPassword(b.password);
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');

  // The own Gmail of the coaching, right when it is made (optional): the principal gives the app password of the email he gives here.
  // It is checked first, so nothing is made when it is wrong. Then every email of this coaching goes out from this address.
  const appPassword = String(typeof b.appPassword === 'string' ? b.appPassword : '').replace(/\s+/g, '');
  let mailAccount: any = null;
  if (appPassword) {
    if (!/@(gmail|googlemail)\.com$/i.test(email)) throw new HttpError(400, 'Only a Gmail address can be connected for now. Leave the app password empty, or use a Gmail address.');
    if (appPassword.length < 8) throw new HttpError(400, 'Write the app password of this Gmail (16 letters; it is not the normal password).');
    try {
      await mailer.verifyAccount({ email, password: appPassword, host: 'smtp.gmail.com', port: 587 });
    } catch (err) {
      throw new HttpError(400, `Gmail did not accept this email and app password (${String((err as Error).message || err).slice(0, 100)}). Check them, or leave the app password empty and connect it later.`);
    }
    mailAccount = { email, host: 'smtp.gmail.com', port: 587, fromName: name, passwordSealed: seal(appPassword) };
  }

  const org = { id: newId('org'), name, city: text(b.city, 80), status, createdAt: nowIso() };
  const user = auth.buildUser(
    { name: adminName, email, password: b.password, role: 'admin', phone: text(b.phone, 30) },
    status === 'active' ? 'active' : 'pending',
  );
  await r.orgSave(org);
  const tenant = r.forOrg(org.id);
  try {
    await tenant.addUser(user);
  } catch (err: any) {
    if (err?.code === 11000) {
      await r.orgRemove(org.id);
      throw new HttpError(409, 'An account with this email already exists.');
    }
    throw err;
  }
  if (mailAccount) {
    await tenant.setMailSettings(mailAccount);
    mailer.forgetOrgMail(org.id);
  }
  await tenant.bump();
  return [org, user];
}

route('/api/public/coachings', ['GET'], 'public', async (c) => ({
  // the coachings a student or teacher can sign up to
  coachings: (await c.root.orgActiveList()).map((o) => ({ id: o.id, name: o.name, city: o.city ?? '' })),
}));

/** A coaching asks to join. The super admin has to approve it before its principal can sign in. */
route('/api/public/register-coaching', ['POST'], 'public', async (c) => {
  limitRegistrations(c);
  const [org, user] = await newCoaching(c, c.body(), 'pending');
  await c.root.forOrg(PLATFORM_ORG).audit(null, 'coaching-requested', `${org.name} (${user.email})`);
  // the principal knows the request arrived, and the Super Admin knows there is something to approve
  mail(user.email, `We received your request for ${org.name}`, 'We received your request', ['Thank you! The Super Admin will check your request now.'], {
    details: [
      ['Coaching', org.name],
      ['City', org.city],
    ],
    button: ['Visit AcademiaOS', c.siteUrl()],
    note: 'You will get an email as soon as your request is approved or rejected.',
    name: user.name,
  });
  for (const admin of await c.root.forOrg(PLATFORM_ORG).usersAll()) {
    if (admin.role === 'super') {
      mail(
        admin.email,
        `New coaching request: ${org.name}`,
        'New coaching request',
        ['A new coaching asked to join AcademiaOS and waits for your decision. Sign in as Super Admin and press Approve or Reject on the Coachings page.'],
        {
          details: [
            ['Coaching', org.name],
            ['City', org.city],
            ['Principal', user.name],
            ['Email', user.email],
            ['Mobile', user.phone],
          ],
          button: ['Sign in as Super Admin', c.loginLink('super')],
          note: 'The principal is told by email about your decision.',
          name: admin.name,
          from: fromPerson(user, org.name), // the person who asked for the coaching
        },
      );
    }
  }
  return ok();
});

/** A visitor of the website asks for a demo. The Super Admin sees the request on the platform page. */
route('/api/public/demo-request', ['POST'], 'public', async (c) => {
  limitRegistrations(c);
  const b = c.body();
  const name = text(b.name, 100);
  const email = text(b.email, 150).toLowerCase();
  if (!name) throw new HttpError(400, 'Please write your name.');
  checkName(name, 'name');
  checkEmail(email);
  if (last10(b.phone).length < 10) throw new HttpError(400, 'Please write a 10-digit mobile number.');
  const lead = {
    id: newId('lead'),
    name,
    email,
    phone: text(b.phone, 30),
    coaching: text(b.coaching, 120),
    message: text(b.message, 1000),
    createdAt: nowIso(),
  };
  await c.root.leadAdd(lead);
  await c.root.forOrg(PLATFORM_ORG).audit(null, 'demo-requested', `${name} (${email})`);
  return ok();
});

// ---------- the super admin ----------

route('/api/super/status', ['GET'], 'public', async (c) => ({ hasSuper: (await c.root.forOrg(PLATFORM_ORG).userCount()) > 0 }));

/** The first super admin. Only from the server computer itself, and only while there is none. */
route('/api/super/setup', ['POST'], 'public', async (c) => {
  const platform = c.root.forOrg(PLATFORM_ORG);
  if ((await platform.userCount()) > 0) throw new HttpError(409, 'The super admin already exists. Please sign in.');
  if (!c.loopback()) throw new HttpError(403, 'The first super admin can only be created on the server computer itself.');
  const b = c.body();
  const name = text(b.name);
  const email = text(b.email).toLowerCase();
  if (!name) throw new HttpError(400, 'Please enter your full name.');
  checkName(name, 'name');
  checkEmail(email);
  checkPassword(b.password);
  if (await emailTaken(c, email)) throw new HttpError(409, 'An account with this email already exists.');
  const user = auth.buildUser({ name, email, password: b.password, role: 'super' }, 'active');
  await addUserOrConflict(c, user, platform);
  await platform.audit(user, 'super-setup', 'Super admin created');
  c.store = platform;
  return startSession(c, user);
});

/** What a coaching pays the platform: the monthly fee, how long it is paid for, and the last payments. */
function plan(org: any) {
  const fee = org.monthlyFee || 0;
  const paidUntil = org.paidUntil;
  const today = todayLocal();
  let state: string;
  if (!fee) state = 'free';
  else if (paidUntil && paidUntil >= today) state = 'paid';
  else state = 'due';
  return { monthlyFee: fee, paidUntil, subscription: state, payments: (org.payments || []).slice(0, 6) };
}

/** A date plus whole months (the day is kept, or the last day of a shorter month). */
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const p = (n: number, w: number) => String(n).padStart(w, '0');
  return `${p(year, 4)}-${p(month, 2)}-${p(Math.min(d, last), 2)}`;
}

/** The Super Admin forgot the password. Nobody is above the Super Admin to reset it, so this works only on the
 * server computer itself (like creating the Super Admin): somebody who sits at the server may set a new password. */
route('/api/super/forgot-password', ['POST'], 'public', async (c) => {
  limitRegistrations(c);
  if (!c.loopback()) throw new HttpError(403, 'The Super Admin password can only be reset on the server computer itself.');
  const b = c.body();
  const email = text(b.email).toLowerCase();
  const next = b.newPassword;
  checkPassword(next);
  const platform = c.root.forOrg(PLATFORM_ORG);
  const target = email ? await c.root.userByEmail(email) : null;
  if (!target || target.role !== 'super') throw new HttpError(404, 'There is no Super Admin with this email. Check the spelling of the email.');
  auth.setPassword(target, next);
  delete target.mustChangePassword;
  await platform.saveUser(target);
  await auth.destroySessionsOf(c.root, target.id);
  await platform.audit(target, 'super-password-reset', 'On the server computer');
  return ok();
});

/** The logo of a coaching. It is the public face of the coaching; the address has a token of the picture, so an old address stops working
 * when the logo changes. Nothing else of the profile is reachable here. */
route('/api/logo/<org_id>/<token>', ['GET'], 'public', async (c) => {
  const orgId = c.req.params.org_id as string;
  if ((await c.root.orgGet(orgId)) === null) throw new HttpError(404, 'Not found');
  const logo = logoOf((await c.root.forOrg(orgId).profile())?.logo);
  if (!logo || !auth.safeEqual(logo.token, c.req.params.token)) throw new HttpError(404, 'Not found');
  return new RawResponse(logo.data, logo.contentType, { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
});

/** What the super admin may see of a coaching: who runs it and how big it is. Never its data. */
async function orgSummary(c: Ctx, org: any): Promise<any> {
  const tenant = c.root.forOrg(org.id);
  const everybody = await tenant.usersAll();
  const admins = everybody.filter((u) => u.role === 'admin');
  const admin = admins.length ? admins[0] : null;
  const { payments: _payments, ...rest } = org;
  // the logo of the coaching is its public face, so it is shown on the card (nothing else of the profile). The list only has the ADDRESS of
  // the picture (it changes when the logo changes, so the browser can keep it)
  const logoToken = await tenant.logoToken(); // (only the small token: the picture itself is not loaded here)
  // Has the principal ever signed in? A coaching that is approved but whose principal never came in is not active yet. (An older coaching
  // that has no mark yet: the sign in of its principal is searched in its log, and the mark is kept from now on.)
  let seen: boolean = Boolean(org.principalSeenAt);
  if (!seen && admins.length) {
    const first = await tenant.auditCol.findOne({ action: 'login', userId: { $in: admins.map((u) => u.id) } }, { sort: { at: 1 } });
    if (first) {
      seen = true;
      org.principalSeenAt = first.at;
      await c.root.orgSave(org);
    }
  }
  return {
    ...rest,
    ...plan(org),
    principalSeen: seen,
    logoUrl: logoToken ? `/api/logo/${encodeURIComponent(org.id)}/${logoToken}` : '',
    admin: admin ? { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone ?? '', resetRequestedAt: admin.resetRequestedAt ?? null } : null,
    students: await tenant.lists.students.countDocuments({}),
    teachers: everybody.filter((u) => u.role === 'teacher' && (u.status || 'active') === 'active').length,
    principals: admins.length, // (the card shows it as "Accounts": the principal's own login)
    accounts: everybody.length, // all the logins (the sentence of the delete box)
  };
}

async function getOrg(c: Ctx, orgId: any): Promise<any> {
  const org = await c.root.orgGet(orgId);
  if (!org) throw new HttpError(404, 'Coaching not found.');
  return org;
}

/** What happened on the platform: coachings requested, approved, switched off, passwords reset... */
route('/api/super/audit', ['GET'], 'super', async (c) => {
  const limit = Math.min(500, Math.max(1, intParam(c.query('limit')) || 100));
  return { entries: await c.store.auditRecent(limit) };
});

/** The demo requests of the public website. */
route('/api/super/leads', ['GET'], 'super', async (c) => ({ leads: await c.root.leadList() }));

route('/api/super/leads/<lead_id>', ['DELETE'], 'super', async (c) => {
  if (!(await c.root.leadRemove(c.req.params.lead_id as string))) throw new HttpError(404, 'Request not found.');
  return ok();
});

route('/api/super/orgs', ['GET'], 'super', async (c) => {
  const orgs = await c.root.orgList();
  const month = todayLocal().slice(0, 7);
  const payments: any[] = orgs.flatMap((o) => o.payments || []);
  const income = {
    thisMonth: payments.filter((p) => String(p.date ?? '').slice(0, 7) === month).reduce((a, p) => a + p.amount, 0),
    total: payments.reduce((a, p) => a + p.amount, 0),
  };
  const summaries: any[] = [];
  for (const o of orgs) summaries.push(await orgSummary(c, o));
  return { orgs: summaries, income };
});

/** The Super Admin adds a coaching. It never becomes active by itself: it goes to the requests that wait for
 * approval, and only the Approve of the Super Admin makes it work (like a coaching that asked to join). */
route('/api/super/orgs', ['POST'], 'super', async (c) => {
  const [org, user] = await newCoaching(c, c.body(), 'pending');
  await c.store.audit(c.user, 'coaching-requested', `${org.name} (${user.email}) added by the Super Admin`);
  const [sent] = mail(
    user.email,
    `Your coaching ${org.name} was added on AcademiaOS`,
    'Your coaching was added',
    [`The Super Admin added ${org.name} on AcademiaOS for you. It is ready to be approved; you can sign in as soon as it is approved.`],
    {
      details: [
        ['Coaching', org.name],
        ['City', org.city],
        ['Sign in with', user.email],
      ],
      button: ['Visit AcademiaOS', c.siteUrl()],
      from: fromPerson(c.user), // the Super Admin who added it
      note: 'You will get another email when it is approved. The password was chosen by the Super Admin; you will be asked to choose your own at the first sign in.',
      name: user.name,
    },
  );
  return { org: await orgSummary(c, org), notified: sent ? 'sent' : 'no-email' };
});

route('/api/super/orgs/<org_id>', ['PUT'], 'super', async (c) => {
  const org = await getOrg(c, c.req.params.org_id);
  const b = c.body();
  const name = text(b.name, 120);
  if (!name) throw new HttpError(400, 'Please enter the name of the coaching.');
  if (name !== org.name) checkName(name, 'name of the coaching'); // (a name that is not changed can stay)
  org.name = name;
  org.city = text(b.city, 80);
  if ('monthlyFee' in b) {
    const fee = b.monthlyFee;
    if (!isNumber(fee) || fee < 0 || fee > 10_000_000) throw new HttpError(400, 'The monthly fee must be a number, 0 or more.');
    org.monthlyFee = round2(fee);
  }
  await c.root.orgSave(org);
  await c.store.audit(c.user, 'coaching-edit', org.name);
  return { org: await orgSummary(c, org) };
});

async function setOrgStatus(c: Ctx, orgId: any, status: string, onlyFrom?: string[]): Promise<any> {
  const org = await getOrg(c, orgId);
  if (onlyFrom && !onlyFrom.includes(org.status)) throw new HttpError(400, 'This coaching is not in the right state for this action.');
  if (org.id === DEFAULT_ORG && status === 'suspended') throw new HttpError(400, 'The first coaching cannot be switched off.');
  org.status = status;
  await c.root.orgSave(org);
  const tenant = c.root.forOrg(org.id);
  if (status === 'active') {
    // its principal can sign in now
    for (const u of await tenant.usersAll()) {
      if (u.role === 'admin' && (u.status || 'active') === 'pending') {
        u.status = 'active';
        await tenant.saveUser(u);
      }
    }
  }
  if (status === 'suspended') {
    // everybody is signed out
    for (const u of await tenant.usersAll()) await auth.destroySessionsOf(c.root, u.id);
  }
  await tenant.bump();
  return org;
}

/** A coaching paid its subscription to the platform: the paid-until date moves on by the months paid for. */
route('/api/super/orgs/<org_id>/payments', ['POST'], 'super', async (c) => {
  const org = await getOrg(c, c.req.params.org_id);
  const b = c.body();
  const amount = b.amount;
  const months = b.months === undefined ? 1 : b.months;
  if (!isNumber(amount) || amount <= 0 || amount > 100_000_000) throw new HttpError(400, 'Enter the amount that was paid.');
  if (!Number.isInteger(months) || months < 1 || months > 36) throw new HttpError(400, 'Months must be between 1 and 36.');
  const today = todayLocal();
  const paid = org.paidUntil || today;
  const start = paid > today ? paid : today; // paying early adds to what is already paid
  org.paidUntil = addMonths(start, months);
  const payment = { id: newId('pay'), date: today, amount: round2(amount), months, note: text(b.note, 200) };
  org.payments = [payment, ...(org.payments || [])].slice(0, 60);
  await c.root.orgSave(org);
  await c.store.audit(c.user, 'coaching-payment', `${org.name}: ${payment.amount} for ${months} month(s)`);
  return { org: await orgSummary(c, org) };
});

/** The first principal (administrator) of a coaching: the person who asked for it. */
async function principalOf(c: Ctx, org: any): Promise<any> {
  for (const u of await c.root.forOrg(org.id).usersAll()) if (u.role === 'admin') return u;
  return null;
}

/** Emails the principal about the decision. Returns 'sent', 'no-email' (email is not set up on the server) or 'none'. */
function tellPrincipal(principal: any, subject: string, heading: string, lines: string[], look: any): any {
  if (!principal) return { notified: 'none' };
  const [sent, plain] = mail(principal.email || '', subject, heading, lines, { name: principal.name, ...look });
  // `message` and `phone` let the Super Admin send the same words on WhatsApp when no email could be sent
  return { notified: sent ? 'sent' : 'no-email', message: plain, phone: principal.phone || '' };
}

route('/api/super/orgs/<org_id>/approve', ['POST'], 'super', async (c) => {
  const org = await setOrgStatus(c, c.req.params.org_id, 'active', ['pending']);
  await c.store.audit(c.user, 'coaching-approve', org.name);
  const notified = tellPrincipal(
    await principalOf(c, org),
    `Your coaching ${org.name} is approved`,
    'Your coaching is approved',
    ['Good news! You can sign in now with your email and password as Coaching Admin. Start with a program and a batch, then admit your first student.', 'Also open Institute Profile and connect your own Gmail (Emails). Then every email of your coaching goes out from your address.'],
    {
      details: [
        ['Coaching', org.name],
        ['City', org.city],
      ],
      button: ['Sign in as Coaching Admin', c.loginLink('admin')],
      accent: GREEN,
      from: fromPerson(c.user),
    },
  );
  return { org: await orgSummary(c, org), ...notified };
});

route('/api/super/orgs/<org_id>/activate', ['POST'], 'super', async (c) => {
  const org = await setOrgStatus(c, c.req.params.org_id, 'active', ['suspended']);
  await c.store.audit(c.user, 'coaching-activate', org.name);
  return { org: await orgSummary(c, org) };
});

route('/api/super/orgs/<org_id>/suspend', ['POST'], 'super', async (c) => {
  const org = await setOrgStatus(c, c.req.params.org_id, 'suspended', ['active']);
  await c.store.audit(c.user, 'coaching-suspend', org.name);
  return { org: await orgSummary(c, org) };
});

/** A request that is turned down is removed (nothing was ever stored for it). */
route('/api/super/orgs/<org_id>/reject', ['POST'], 'super', async (c) => {
  const org = await getOrg(c, c.req.params.org_id);
  if (org.status !== 'pending') throw new HttpError(400, 'Only a request that is waiting can be rejected.');
  const principal = await principalOf(c, org); // found before the request is removed
  const reason = text(c.body().reason, 300);
  await c.root.forOrg(org.id).dropOrgData();
  await c.root.orgRemove(org.id);
  await c.store.audit(c.user, 'coaching-reject', org.name);
  const notified = tellPrincipal(
    principal,
    `Your coaching request for ${org.name} was not approved`,
    'Your request was not approved',
    ['Sorry, the Super Admin could not approve your request. You can register again with correct details, or contact us for help.'],
    {
      details: [
        ['Coaching', org.name],
        ['Reason', reason],
      ],
      button: ['Register again', c.loginLink('admin')],
      accent: RED,
      from: fromPerson(c.user),
    },
  );
  return { ok: true, ...notified };
});

/** Deletes a coaching with ALL its data. The Super Admin has to type the name of the coaching and the own password
 * (so somebody who finds a signed in screen cannot delete a coaching), and every Super Admin gets an email about it. */
route('/api/super/orgs/<org_id>', ['DELETE'], 'super', async (c) => {
  const org = await getOrg(c, c.req.params.org_id);
  if (org.id === DEFAULT_ORG) throw new HttpError(400, 'The first coaching cannot be deleted.');
  if (text(c.body().confirmName) !== org.name) throw new HttpError(400, 'Type the exact name of the coaching to delete it.');
  const limiter = c.limiters.login;
  const key = `delete|${c.user.id}`;
  if (limiter.check(key) !== null) throw new HttpError(429, 'Too many wrong passwords. Please wait a few minutes.');
  const password = c.body().password;
  if (typeof password !== 'string' || !auth.verifyPassword(c.user, password)) {
    limiter.fail(key);
    throw new HttpError(403, 'Your password is wrong. Type the password you sign in with.');
  }
  limiter.reset(key);
  const tenant = c.root.forOrg(org.id);
  for (const u of await tenant.usersAll()) await auth.destroySessionsOf(c.root, u.id);
  await tenant.dropOrgData();
  await c.root.orgRemove(org.id);
  await c.store.audit(c.user, 'coaching-delete', org.name);
  for (const admin of await c.root.forOrg(PLATFORM_ORG).usersAll()) {
    if (admin.role === 'super') {
      mail(
        admin.email,
        `Coaching deleted: ${org.name}`,
        'A coaching was deleted',
        ['A coaching and all its data were deleted. If this was not you or another Super Admin, change your password now.'],
        {
          details: [
            ['Coaching', org.name],
            ['Deleted by', c.user.name],
            ['Account', c.user.email],
          ],
          button: ['Sign in as Super Admin', c.loginLink('super')],
          accent: RED,
          name: admin.name,
          from: fromPerson(c.user),
        },
      );
    }
  }
  return ok();
});

route('/api/super/orgs/<org_id>/reset-admin-password', ['POST'], 'super', async (c) => {
  const org = await getOrg(c, c.req.params.org_id);
  const next = c.body().newPassword;
  checkPassword(next);
  const tenant = c.root.forOrg(org.id);
  const admin = (await tenant.usersAll()).find((u) => u.role === 'admin');
  if (!admin) throw new HttpError(404, 'This coaching has no administrator.');
  auth.setPassword(admin, next);
  delete admin.resetRequestedAt;
  admin.mustChangePassword = true; // the Super Admin knows this password, so the principal must replace it
  await tenant.saveUser(admin);
  await auth.destroySessionsOf(c.root, admin.id);
  await c.store.audit(c.user, 'coaching-admin-password', `${org.name} (${admin.email})`);
  return ok();
});

// ---------- student photos ----------

/** The address contains a random token, so only people who were sent the record can open a photo
 * (a browser <img> cannot send the sign-in token). */
route('/api/photos/<student_id>/<token>', ['GET'], 'public', async (c) => {
  const orgId = c.query('o') || DEFAULT_ORG;
  const r = c.root;
  if ((await r.orgGet(orgId)) === null) throw new HttpError(404, 'Not found');
  const doc = await r.forOrg(orgId).getPhoto(c.req.params.student_id as string);
  if (!doc || !auth.safeEqual(doc.token ?? '', c.req.params.token)) throw new HttpError(404, 'Not found');
  return new RawResponse(doc.data, doc.contentType || 'image/jpeg', { 'Cache-Control': 'public, max-age=31536000, immutable' }); // a new photo gets a new address
});

// ---------- backups (principal only) ----------

function download(data: any, filename: string): RawResponse {
  return new RawResponse(JSON.stringify(data), 'application/json', { 'Content-Disposition': `attachment; filename="${filename}"` });
}

function requireConfirm(b: any): void {
  if (b.confirm !== 'RESTORE') throw new HttpError(400, 'Restoring replaces the current data. Confirm it by sending confirm: "RESTORE".');
}

/** Puts a backup back. A snapshot of the current data is taken first, so a restore can be undone. */
async function restore(c: Ctx, payload: any, accounts: boolean): Promise<any> {
  const s = c.store;
  const before = await s.snapshot('before restore');
  let report: any;
  try {
    report = await s.restoreData(payload, accounts);
  } catch (err) {
    if (err instanceof BackupError) throw new HttpError(400, err.message);
    throw err;
  }
  const records = Object.values<number>(report.lists).reduce((a, n) => a + n, 0);
  await s.audit(c.user, 'restore', `${records} records, ${report.accounts_added} accounts added`);
  report.safety_snapshot = before;
  return report;
}

/** Everything in one file: data, accounts (with password hashes), photos. Keep it safe. */
route('/api/backup', ['GET'], 'admin', async (c) => {
  const s = c.store;
  const data = await s.exportData(true, true);
  await s.audit(c.user, 'backup-download');
  return download(data, `academiaos-backup-${data.exportedAt.slice(0, 10)}.json`);
});

route('/api/backup/restore', ['POST'], 'admin', async (c) => {
  const b = c.body(INSTITUTE_BODY);
  requireConfirm(b);
  return restore(c, b.backup, b.accounts !== false);
});

route('/api/backups', ['GET'], 'admin', async (c) => ({ backups: await c.store.listBackups() }));

route('/api/backups', ['POST'], 'admin', async (c) => {
  const s = c.store;
  const snapshotId = await s.snapshot(text(c.body().label) || 'manual');
  if (!snapshotId) throw new HttpError(413, 'The data is too big for a stored backup. Use "Download backup" instead.');
  await s.audit(c.user, 'backup-create', snapshotId);
  return { id: snapshotId };
});

route('/api/backups/<backup_id>', ['GET'], 'admin', async (c) => {
  const id = c.req.params.backup_id as string;
  const data = await c.store.getBackup(id);
  if (data === null) throw new HttpError(404, 'Backup not found.');
  return download(data, `academiaos-backup-${id}.json`);
});

route('/api/backups/<backup_id>/restore', ['POST'], 'admin', async (c) => {
  const b = c.body();
  requireConfirm(b);
  const data = await c.store.getBackup(c.req.params.backup_id as string);
  if (data === null) throw new HttpError(404, 'Backup not found.');
  return restore(c, data, b.accounts !== false);
});
