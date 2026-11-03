// Passwords, sessions and login throttling.
// Passwords are stored with scrypt (the same settings the Python server used), so existing accounts keep working.

import crypto from 'node:crypto';
import type { Store } from './store.ts';

export const SESSION_REMEMBER_SEC = 30 * 24 * 60 * 60;
export const SESSION_SHORT_SEC = 12 * 60 * 60;

// ---------- passwords ----------

export const newSalt = (): string => crypto.randomBytes(16).toString('hex');

export const sha256Hex = (value: string): string => crypto.createHash('sha256').update(value, 'utf-8').digest('hex');

export function hashPassword(password: string, salt: string): string {
  return crypto
    .scryptSync(Buffer.from(password, 'utf-8'), Buffer.from(salt, 'utf-8'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    .toString('hex');
}

/** Weak hash an old version of the app used when the browser had no crypto.subtle.
 * Kept only so those accounts can still sign in once (they are upgraded right after). */
export function basicHash(value: string): string {
  let h1 = 0xdeadbeef | 0;
  let h2 = 0x41c6ce57 | 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function safeEqual(a: unknown, b: unknown): boolean {
  const x = Buffer.from(String(a), 'utf-8');
  const y = Buffer.from(String(b), 'utf-8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function verifyPassword(user: any, password: string): boolean {
  const alg = user.alg;
  if (alg === 'scrypt') return safeEqual(hashPassword(password, user.salt), user.passwordHash);
  const salted = `${user.salt}:${password}`;
  if (alg === 'sha256') return safeEqual(sha256Hex(salted), user.passwordHash);
  if (alg === 'basic') return safeEqual(basicHash(salted), user.passwordHash);
  return false;
}

/** Accounts that were created with an older hash are moved to scrypt at their next sign in. */
export const needsUpgrade = (user: any): boolean => user.alg !== 'scrypt';

export function setPassword(user: any, password: string): void {
  user.salt = newSalt();
  user.alg = 'scrypt';
  user.passwordHash = hashPassword(password, user.salt);
}

export function buildUser(data: any, status: string): any {
  const user: any = {
    id: `u-${Date.now()}-${crypto.randomInt(100000)}`,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    status,
    createdAt: new Date().toISOString(),
  };
  for (const key of ['phone', 'subject']) {
    const value = String(data[key] || '').trim();
    if (value) user[key] = value;
  }
  if (data.studentId) user.studentId = data.studentId;
  if (data.isParent) user.isParent = true; // a parent's login: it sees the child's data, read only
  if (data.role === 'teacher') user.batchIds = [...(data.batchIds || [])];
  setPassword(user, data.password);
  return user;
}

const PUBLIC_FIELDS = ['id', 'name', 'email', 'role', 'status', 'createdAt', 'phone', 'subject', 'studentId', 'batchIds', 'resetRequestedAt', 'orgId', 'mustChangePassword', 'isParent'];

/** What the browser may see about an account (never the hash). */
export function publicUser(u: any): any {
  const out: any = {};
  for (const k of PUBLIC_FIELDS) if (k in u && u[k] !== null && u[k] !== undefined) out[k] = u[k];
  out.status = u.status || 'active';
  return out;
}

// ---------- sessions ----------

export async function createSession(store: Store, userId: string, remember: boolean): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await store.addSession(sha256Hex(token), userId, remember ? SESSION_REMEMBER_SEC : SESSION_SHORT_SEC);
  return token;
}

/** Returns the signed-in, active account for a token (or null). */
export async function userForToken(store: Store, token: string): Promise<any> {
  if (!token) return null;
  const session = await store.getSession(sha256Hex(token));
  if (!session || store.sessionExpired(session)) return null;
  const user = await store.userByIdAny(session.userId);
  return user && (user.status || 'active') === 'active' ? user : null;
}

export const destroySession = (store: Store, token: string) => store.deleteSession(sha256Hex(token));

/** Signs an account out everywhere (optionally keeping one session, for example the current one). */
export const destroySessionsOf = (store: Store, userId: string, keepToken?: string | null) =>
  store.deleteSessionsOf(userId, keepToken ? sha256Hex(keepToken) : undefined);

// ---------- throttling ----------

/** Counts failures per key; after `max` failures inside `window` seconds the key is blocked for `lockSec` seconds. */
export class Limiter {
  max: number;
  window: number;
  lockSec: number;
  entries = new Map<string, { count: number; first: number; lockedUntil: number }>();

  constructor(max: number, windowSec: number, lockSec: number) {
    this.max = max;
    this.window = windowSec;
    this.lockSec = lockSec;
  }

  /** Returns null when allowed, otherwise the seconds to wait. */
  check(key: string): number | null {
    const now = Date.now() / 1000;
    const e = this.entries.get(key);
    if (e && e.lockedUntil > now) return Math.floor(e.lockedUntil - now) + 1;
    return null;
  }

  fail(key: string): void {
    const now = Date.now() / 1000;
    if (this.entries.size > 5000) {
      for (const [k, v] of this.entries) if (v.lockedUntil <= now && now - v.first > this.window) this.entries.delete(k);
    }
    let e = this.entries.get(key);
    if (!e || now - e.first > this.window) e = { count: 0, first: now, lockedUntil: 0 };
    e.count += 1;
    if (e.count >= this.max) {
      e.lockedUntil = now + this.lockSec;
      e.count = 0;
      e.first = now;
    }
    this.entries.set(key, e);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}
