// Passwords, sessions and login throttling.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_SHORT_MS = 12 * 60 * 60 * 1000;

// ---------- passwords ----------

export const newSalt = () => crypto.randomBytes(16).toString('hex');

export const sha256Hex = value => crypto.createHash('sha256').update(value).digest('hex');

// Weak hash an old version of the app used when the browser had no crypto.subtle.
// Kept only so those accounts can still sign in once (they are upgraded right after).
const basicHash = str => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const hashPassword = async (password, salt) => (await scrypt(password, salt, 64)).toString('hex');

export const verifyPassword = async (user, password) => {
  if (user.alg === 'scrypt') return safeEqual(await hashPassword(password, user.salt), user.passwordHash);
  const salted = `${user.salt}:${password}`;
  if (user.alg === 'sha256') return safeEqual(sha256Hex(salted), user.passwordHash);
  if (user.alg === 'basic') return safeEqual(basicHash(salted), user.passwordHash);
  return false;
};

// Accounts that were created with an older hash are moved to scrypt at their next sign in
export const needsUpgrade = user => user.alg !== 'scrypt';

export const setPassword = async (user, password) => {
  user.salt = newSalt();
  user.alg = 'scrypt';
  user.passwordHash = await hashPassword(password, user.salt);
};

export const buildUser = async (input, status) => {
  const user = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status,
    createdAt: new Date().toISOString(),
    phone: input.phone?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    studentId: input.studentId,
    batchIds: input.role === 'teacher' ? input.batchIds || [] : undefined
  };
  await setPassword(user, input.password);
  return user;
};

// What the browser may see about an account (never the hash)
export const publicUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status || 'active',
  createdAt: u.createdAt,
  phone: u.phone,
  subject: u.subject,
  studentId: u.studentId,
  batchIds: u.batchIds
});

// ---------- sessions ----------

export const createSession = (state, userId, remember) => {
  const token = crypto.randomBytes(32).toString('base64url');
  state.sessions[sha256Hex(token)] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (remember ? SESSION_REMEMBER_MS : SESSION_SHORT_MS)
  };
  return token;
};

// Returns the signed-in, active account for a token (or null)
export const userForToken = (state, token) => {
  if (!token) return null;
  const session = state.sessions[sha256Hex(token)];
  if (!session || session.expiresAt <= Date.now()) return null;
  const user = state.users.find(u => u.id === session.userId);
  return user && (user.status || 'active') === 'active' ? user : null;
};

export const destroySession = (state, token) => {
  delete state.sessions[sha256Hex(token)];
};

// Signs an account out everywhere (optionally keeping one session, for example the current one)
export const destroySessionsOf = (state, userId, keepToken) => {
  const keep = keepToken ? sha256Hex(keepToken) : null;
  for (const [key, session] of Object.entries(state.sessions)) {
    if (session.userId === userId && key !== keep) delete state.sessions[key];
  }
};

// ---------- throttling ----------

// Counts failures per key; after `max` failures inside `windowMs` the key is blocked for `lockMs`.
export const createLimiter = ({ max, windowMs, lockMs }) => {
  const entries = new Map();

  const prune = now => {
    if (entries.size < 5000) return;
    for (const [key, e] of entries) {
      if (e.lockedUntil <= now && now - e.first > windowMs) entries.delete(key);
    }
  };

  return {
    // { ok: true } or { ok: false, retryAfterSec }
    check(key) {
      const now = Date.now();
      const e = entries.get(key);
      if (e && e.lockedUntil > now) return { ok: false, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) };
      return { ok: true };
    },
    fail(key) {
      const now = Date.now();
      prune(now);
      let e = entries.get(key);
      if (!e || now - e.first > windowMs) e = { count: 0, first: now, lockedUntil: 0 };
      e.count += 1;
      if (e.count >= max) {
        e.lockedUntil = now + lockMs;
        e.count = 0;
        e.first = now;
      }
      entries.set(key, e);
    },
    reset(key) {
      entries.delete(key);
    }
  };
};
