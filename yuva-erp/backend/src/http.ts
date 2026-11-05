// The small web framework around Express: who may call a route (access), the request context, error answers,
// and the helpers that several routes share (email checks, the emails themselves).
//
// Access of a route:
//   public   anybody (sign in, sign up)
//   user     any signed-in account (not the super admin)
//   admin    principal only (of one coaching)
//   super    the super admin only (manages the coachings, never sees their data)
//   any      any signed-in account, also the super admin

import type { Request, Response } from 'express';
import * as auth from './auth.ts';
import * as emailTemplate from './emailTemplate.ts';
import { HttpError } from './errors.ts';
import * as mailer from './mailer.ts';
import { DEFAULT_ORG, PLATFORM_ORG } from './store.ts';
import type { Store } from './store.ts';
import { EMAIL_REGEX, passwordProblem, last10 } from './validate.ts';

export type Access = 'public' | 'user' | 'admin' | 'super' | 'any';

export const MINUTE = 60;
export const SMALL_BODY = 256 * 1024;
export const INSTITUTE_BODY = 100 * 1024 * 1024; // student photos are stored inside the data

export interface Limiters {
  login: auth.Limiter;
  ip: auth.Limiter;
  register: auth.Limiter;
}

export function makeLimiters(): Limiters {
  return {
    login: new auth.Limiter(5, 15 * MINUTE, 15 * MINUTE),
    ip: new auth.Limiter(40, 15 * MINUTE, 15 * MINUTE),
    register: new auth.Limiter(20, 60 * MINUTE, 60 * MINUTE),
  };
}

export interface Deps {
  root: Store;
  limiters: Limiters;
}

/** A handler may return this for answers that are not JSON (photos, downloads). */
export class RawResponse {
  body: Buffer | string;
  contentType: string;
  headers: Record<string, string>;
  constructor(body: Buffer | string, contentType: string, headers: Record<string, string> = {}) {
    this.body = body;
    this.contentType = contentType;
    this.headers = headers;
  }
}

export class Ctx {
  req: Request;
  res: Response;
  deps: Deps;
  token = '';
  user: any = null;
  private chosen: Store | null = null;

  constructor(req: Request, res: Response, deps: Deps) {
    this.req = req;
    this.res = res;
    this.deps = deps;
  }

  /** The store that knows all coachings (and the accounts, which are shared). */
  get root(): Store {
    return this.deps.root;
  }

  get limiters(): Limiters {
    return this.deps.limiters;
  }

  /** The data of the coaching this request is about (set by the route, or the first coaching). */
  get store(): Store {
    return this.chosen ?? this.root;
  }

  set store(s: Store) {
    this.chosen = s;
  }

  get hasChosenStore(): boolean {
    return this.chosen !== null;
  }

  get method(): string {
    return this.req.method;
  }

  query(name: string): string | undefined {
    const v = this.req.query[name];
    return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined;
  }

  /** The JSON body, or null when there is none or it is broken. */
  json(): any {
    const raw = this.req.body;
    if (!Buffer.isBuffer(raw) || !raw.length) return null;
    const type = String(this.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json' && !type.endsWith('+json')) return null;
    try {
      return JSON.parse(raw.toString('utf-8'));
    } catch {
      return null;
    }
  }

  body(limit = SMALL_BODY): any {
    const length = Number(this.req.headers['content-length'] || 0);
    if (length && length > limit) throw new HttpError(413, 'Request is too large.');
    const data = this.json();
    return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  /** Address of the caller. Behind a proxy on this same computer the proxy's own address would be the
   * same for everybody, so the address it forwards is used (only trusted when the proxy is local). */
  ip(): string {
    const peer = (this.req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
    const xff = String(this.req.headers['x-forwarded-for'] || '');
    // On a hosting service (TRUST_PROXY=1) every call comes through its proxy. The proxy adds the real address at the
    // END of X-Forwarded-For; the first entries can be written by the caller, so only the last one is believed.
    if (process.env.TRUST_PROXY === '1') {
      const forwarded = xff.split(',').pop()!.trim();
      if (forwarded) return forwarded.replace('::ffff:', '').slice(0, 64);
    }
    if (peer === '127.0.0.1' || peer === '::1') {
      const forwarded = xff.split(',')[0].trim();
      if (forwarded) return forwarded.replace('::ffff:', '').slice(0, 64);
    }
    return peer;
  }

  loopback(): boolean {
    return ['127.0.0.1', '::1', 'localhost'].includes(this.ip());
  }

  /** The address of this site for the links in emails: PUBLIC_URL if set, else the address the request came to. */
  siteUrl(): string {
    const base = process.env.PUBLIC_URL || `${this.req.protocol}://${this.req.get('host')}/`;
    return base.replace(/\/+$/, '');
  }

  /** The link of the buttons in emails: the website, with the sign in form of that kind of person ready and in view. */
  loginLink(portal = 'admin'): string {
    // the parents have an own page, the others a tab of the main sign in
    if (portal === 'parent') return `${this.siteUrl()}/parent`;
    return `${this.siteUrl()}/?portal=${portal}#signin`;
  }
}

export type Handler = (c: Ctx) => any;

interface RouteDef {
  rule: string;
  methods: string[];
  access: Access;
  handler: Handler;
}

export const routes: RouteDef[] = [];

export function route(rule: string, methods: string[], access: Access, handler: Handler): void {
  routes.push({ rule, methods, access, handler });
}

function bearerToken(req: Request): string {
  const header = String(req.headers.authorization || '');
  return header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
}

/** Checks who calls and which coaching the call is for, then runs the route. */
async function dispatch(def: RouteDef, c: Ctx): Promise<any> {
  c.token = bearerToken(c.req);
  c.user = null;
  if (def.access !== 'public') {
    const r = c.root;
    c.user = await auth.userForToken(r, c.token);
    if (!c.user) throw new HttpError(401, 'Please sign in.');
    const isSuper = c.user.role === 'super';
    if (def.access === 'super' && !isSuper) throw new HttpError(403, 'Only the super admin can do this.');
    if (def.access !== 'super' && def.access !== 'any' && isSuper) {
      throw new HttpError(403, 'The super admin manages the coachings and cannot open their data.');
    }
    const orgId = isSuper ? PLATFORM_ORG : c.user.orgId || DEFAULT_ORG;
    if (!isSuper) {
      const org = await r.orgGet(orgId);
      if (!org || org.status !== 'active') throw new HttpError(403, 'This coaching is not active. Please contact the super admin.');
    }
    c.store = r.forOrg(orgId);
    if (def.access === 'admin' && c.user.role !== 'admin') throw new HttpError(403, 'Only the principal (administrator) can do this.');
  }
  return def.handler(c);
}

/** Registers every route on the Express app. A path that exists with other methods answers 405. */
export function mountRoutes(app: any, deps: Deps): void {
  const byRule = new Map<string, RouteDef[]>();
  for (const def of routes) byRule.set(def.rule, [...(byRule.get(def.rule) ?? []), def]);
  for (const [rule, defs] of byRule) {
    const expressRule = rule.replace(/<(\w+)>/g, ':$1');
    const r = app.route(expressRule);
    for (const def of defs) {
      for (const method of def.methods) {
        r[method.toLowerCase()](async (req: Request, res: Response) => {
          const result = await dispatch(def, new Ctx(req, res, deps));
          if (result instanceof RawResponse) {
            res.type(result.contentType);
            for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
            res.send(result.body);
          } else {
            res.json(result);
          }
        });
      }
    }
    r.all((_req: Request, res: Response) => {
      res.status(405).json({ error: 'Method not allowed' });
    });
  }
}

// ---------- helpers that several routes share ----------

export const ok = () => ({ ok: true });

export function checkEmail(email: string): void {
  if (!EMAIL_REGEX.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
}

export function checkPassword(pw: any): void {
  const problem = passwordProblem(pw);
  if (problem) throw new HttpError(400, problem);
}

export const isDuplicateKey = (err: any): boolean => err?.code === 11000;

export async function emailTaken(c: Ctx, email: string): Promise<boolean> {
  return (await c.root.userByEmail(email)) !== null; // one email, one account, over all coachings
}

export async function addUserOrConflict(c: Ctx, user: any, store: Store = c.store): Promise<void> {
  try {
    await store.addUser(user);
  } catch (err) {
    if (isDuplicateKey(err)) throw new HttpError(409, 'An account with this email already exists.');
    throw err;
  }
}

export function startSession(c: Ctx, user: any, remember = true) {
  return auth.createSession(c.store, user.id, remember).then((token) => ({ token, user: auth.publicUser(user) }));
}

/** Public sign-up forms are limited per address so nobody can flood the server. */
export function limitRegistrations(c: Ctx): void {
  const ip = c.ip();
  if (c.limiters.register.check(ip) !== null) throw new HttpError(429, 'Too many sign-up attempts. Please try again later.');
  c.limiters.register.fail(ip);
}

/** The coaching a public sign-up form is for (the browser sends orgId). When only one coaching
 * exists it is used without asking. */
export async function chooseOrg(c: Ctx): Promise<Store> {
  const r = c.root;
  const data = c.method === 'POST' ? c.json() : null;
  let orgId = (data !== null && typeof data === 'object' && !Array.isArray(data) ? data.orgId : null) || c.query('orgId');
  if (!orgId) {
    const active = await r.orgActiveList();
    if (active.length !== 1) throw new HttpError(400, 'Please choose your coaching.');
    orgId = active[0].id;
  }
  const org = typeof orgId === 'string' ? await r.orgGet(orgId) : null;
  if (!org || org.status !== 'active') throw new HttpError(404, 'This coaching was not found or is not active.');
  c.store = r.forOrg(orgId);
  return c.store;
}

export async function requireSetup(c: Ctx): Promise<void> {
  if ((await c.store.userCount()) === 0) {
    throw new HttpError(409, 'The institute is not set up yet. Please ask the principal to create the administrator account first.');
  }
}

export const nowIso = (): string => new Date().toISOString().slice(0, 19) + 'Z';

// ---------- emails ----------

/** Sends a good looking email (HTML card with the plain text next to it). Returns [handed over, plain text]. */
export function mail(to: string, subject: string, heading: string, lines: string[], look: emailTemplate.RenderOptions = {}): [boolean, string] {
  const [plain, html] = emailTemplate.render(heading, lines, look);
  return [Boolean(mailer.send(to, subject, plain, html)), plain];
}

export async function coachingName(c: Ctx, s: Store): Promise<string> {
  return ((await c.root.orgGet(s.org)) || {}).name || 'your coaching';
}

/** Which tab of the sign in form a kind of person uses. */
/** A line in the notification bell of the principal: a new student or teacher came (or was added). It must never break the
 * request that made it, so a failure is swallowed. */
export async function notifyNewPerson(
  s: any,
  kind: 'new_student' | 'new_teacher',
  name: string,
  content: string,
  batch?: { id: string; name?: string; grade?: string; studentId?: string },
): Promise<void> {
  try {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    await s.applyList(
      'notificationLogs',
      [{ id: `log-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`, timestamp, type: kind, channel: 'app', recipientName: 'Principal', recipientPhone: '', studentName: name, content, status: 'sent', ...(batch ? { batchId: batch.id, batchName: batch.name ?? '', grade: batch.grade ?? '', studentId: batch.studentId } : {}) }],
      [],
    );
    await s.bump();
  } catch {
    /* the notification is a courtesy */
  }
}

export const portalOf = (role: string, isParent = false): string =>
  role === 'student' && isParent ? 'parent' : role === 'teacher' || role === 'student' ? 'member' : 'admin';

const ROLE_WORDS: Record<string, [string, string]> = {
  teacher: ['a teacher', 'You can take the attendance and enter the marks of your batches, and share notices and study material.'],
  student: ['a student', 'You can see your attendance, fees, results, notices and study material.'],
  admin: ['an administrator', 'You can manage the whole coaching.'],
};

/** Tells a person that the principal made an account for them (email, the first password, and where to sign in). */
export async function welcomeMail(c: Ctx, s: Store, user: any, password: string): Promise<void> {
  const role = user.role;
  let label: string;
  let what: string;
  if (role === 'student' && user.isParent) {
    [label, what] = ['a parent', 'You can follow the attendance, fees and results of your child (read only).'];
  } else {
    [label, what] = ROLE_WORDS[role] ?? ['a member', ''];
  }
  const coaching = await coachingName(c, s);
  mail(user.email, `Your AcademiaOS account for ${coaching}`, `Welcome to ${coaching}`, [`The principal added you as ${label}. ${what}`], {
    details: [
      ['Coaching', coaching],
      ['Sign in with', user.email],
      ['First password', password],
    ],
    button: ['Sign in', c.loginLink(portalOf(role, Boolean(user.isParent)))],
    note: 'The principal chose this first password. You will be asked to choose your own at the first sign in. If you did not expect this email, you can ignore it.',
    name: user.name,
  });
}

export async function tellPrincipals(c: Ctx, s: Store, subject: string, heading: string, lines: string[], details?: [string, any][]): Promise<void> {
  for (const p of await s.usersAll()) {
    if (p.role === 'admin' && (p.status || 'active') === 'active') {
      mail(p.email, subject, heading, lines, { details, button: ['Sign in as Coaching Admin', c.loginLink('admin')], name: p.name });
    }
  }
}

export { emailTemplate, last10 };
