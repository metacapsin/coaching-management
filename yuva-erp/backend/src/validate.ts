// Input rules shared by the routes. They are the same rules the sign-up screens show.

import crypto from 'node:crypto';
import { HttpError } from './errors.ts';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 200; // very long passwords would only slow the server down

export function passwordProblem(pw: any): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > MAX_PASSWORD_LENGTH) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  return null;
}

export const text = (value: any, maxLen = 200): string => (typeof value === 'string' ? value.trim().slice(0, maxLen) : '');

export const last10 = (value: any): string => String(value ?? '').replace(/\D/g, '').slice(-10);

/** '05', '5' and '005' all become the same key (older numbers like 'APEX-25-0105' too). */
export function normRoll(value: any): string {
  let s = String(value || '').toUpperCase().trim();
  s = s.replace(/(\d+)(?=\D*$)/, (m) => BigInt(m).toString());
  return s.replace(/[^A-Z0-9]/g, '');
}

/** One format for stored phones: '+91 98765 43210' for 10-digit Indian numbers. */
export function normalizePhone(value: any): string {
  const raw = String(value ?? '');
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : '';
  if (ten && (digits.length === 10 || digits.startsWith('91') || digits.startsWith('0'))) return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  return raw.trim();
}

export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const newId = (prefix: string): string => `${prefix}-${Date.now()}-${crypto.randomInt(1_000_000)}`;

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Principal (Administrator)',
    teacher: 'Teacher',
    student: 'Student',
    super: 'Super Admin',
  };
  return labels[role] ?? 'User';
}

/** Which login tab a role belongs to. */
export function portalLabel(role: string, isParent = false): string {
  if (role === 'super') return 'Super Admin';
  if (role === 'student' && isParent) return 'Parent';
  return role === 'student' || role === 'teacher' ? 'Teacher / Student' : 'Coaching Admin';
}

// The name of a PERSON (a student, a parent, a teacher, a principal, the Super Admin): letters of any language (with their marks, like the
// signs of Hindi), digits, spaces, and only a dot, an apostrophe and a hyphen (Md. Sahil, D'Souza, Mary-Ann). No other symbol: @ # $ % ^ & * ! ...
const NAME_OK = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .'\u2019-]*$/u;

export function isPersonName(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 120 && NAME_OK.test(value);
}

/** Refuses a name with a symbol. `label` says which name it is. */
export function checkName(value: unknown, label = 'name'): void {
  if (!isPersonName(value)) {
    throw new HttpError(400, `The ${label} can have only letters, numbers and spaces (and . ' -). Symbols like @ # $ % ^ & * ! are not allowed.`);
  }
}
