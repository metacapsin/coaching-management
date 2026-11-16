// The details that the principal writes down when a teacher joins (a registration form of a coaching): personal and contact data, the
// qualification and the experience, and the agreement (how the teacher works and is paid, the two signatures, the date).
// They are kept inside the account of the teacher, are never sent in the list of the accounts, and only the principal can read them.

import { HttpError } from './errors.ts';
import { checkName, text, todayLocal } from './validate.ts';

export const AVAILABILITY = ['online', 'offline', 'hybrid'] as const;
export const PAY_TYPES = ['monthly', 'per_lecture', 'per_hour', 'honorarium'] as const;
const MAX_SIGNATURE_BYTES = 90_000; // a drawn signature is a small picture

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** A drawn signature: a small PNG picture as a data address. Nothing else is accepted. */
function signature(value: unknown, label: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)) throw new HttpError(400, `The ${label} must be drawn in the box.`);
  if (value.length > MAX_SIGNATURE_BYTES) throw new HttpError(400, `The ${label} is too big. Please draw it again, smaller.`);
  return value;
}

/** The details of a teacher, checked and cleaned. Everything is optional, but what is written must be right. */
export function cleanTeacherDetails(raw: any): Record<string, any> {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out: Record<string, any> = {};

  // ---- personal and contact
  // the name in three parts (the account has the whole name): first and last name are written, the middle name is optional
  for (const [key, label, needed] of [['firstName', 'first name', true], ['middleName', 'middle name', false], ['lastName', 'last name', true]] as const) {
    const part = text(b[key], 60);
    if (part) checkName(part, label);
    else if (needed && b.firstName !== undefined) throw new HttpError(400, `Please write the ${label}.`);
    out[key] = part;
  }
  const guardian = text(b.guardianName, 120);
  if (guardian) checkName(guardian, 'guardian name');
  out.guardianName = guardian;

  const alt = String(b.alternatePhone ?? '').replace(/\D/g, '');
  if (alt && alt.replace(/^91/, '').length !== 10 && alt.length !== 10) throw new HttpError(400, 'The alternate contact number must have 10 digits.');
  out.alternatePhone = alt ? alt.slice(-10) : '';

  const address = b.address && typeof b.address === 'object' ? b.address : {};
  const pin = String(address.pin ?? '').replace(/\s/g, '');
  if (pin && !/^\d{6}$/.test(pin)) throw new HttpError(400, 'The PIN code must have 6 digits.');
  out.address = { line: text(address.line, 200), district: text(address.district, 80), state: text(address.state, 80), pin };

  if (b.dateOfBirth) {
    if (!isDate(b.dateOfBirth)) throw new HttpError(400, 'Please choose a valid date of birth.');
    const age = (Date.now() - Date.parse(`${b.dateOfBirth}T00:00:00Z`)) / (365.25 * 86400000);
    if (age < 18 || age > 80) throw new HttpError(400, 'The date of birth is not right: a teacher must be between 18 and 80 years old.');
  }
  out.dateOfBirth = b.dateOfBirth || '';

  const id = String(b.idNumber ?? '').replace(/\s|-/g, '');
  if (id && !/^\d{12}$/.test(id)) throw new HttpError(400, 'The Aadhaar number must have 12 digits.');
  out.idType = id ? 'Aadhaar' : '';
  out.idNumber = id;

  // ---- qualification and experience
  out.qualification = text(b.qualification, 150);
  if (b.experienceYears !== undefined && b.experienceYears !== '' && b.experienceYears !== null) {
    const years = Number(b.experienceYears);
    if (!Number.isFinite(years) || years < 0 || years > 60) throw new HttpError(400, 'The years of experience must be a number between 0 and 60.');
    out.experienceYears = Math.round(years * 10) / 10;
  } else {
    out.experienceYears = null;
  }
  out.workHistory = text(b.workHistory, 1200);
  const reference = text(b.referenceName, 120);
  if (reference) checkName(reference, 'reference name');
  out.referenceName = reference;

  // ---- the agreement
  const availability = text(b.availability, 20) || 'offline';
  if (!(AVAILABILITY as readonly string[]).includes(availability)) throw new HttpError(400, 'Choose online, offline or hybrid classes.');
  out.availability = availability;

  const payType = text(b.payType, 20) || 'monthly';
  if (!(PAY_TYPES as readonly string[]).includes(payType)) throw new HttpError(400, 'Choose how the teacher is paid.');
  out.payType = payType;
  if (b.payAmount !== undefined && b.payAmount !== '' && b.payAmount !== null) {
    const amount = Number(b.payAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) throw new HttpError(400, 'The amount must be a number (0 or more).');
    out.payAmount = Math.round(amount * 100) / 100;
  } else {
    out.payAmount = null;
  }
  out.payNotes = text(b.payNotes, 600);

  out.facultySignature = signature(b.facultySignature, 'signature of the teacher');
  out.managementSignature = signature(b.managementSignature, 'signature of the management');

  if (b.registeredOn && !isDate(b.registeredOn)) throw new HttpError(400, 'Please choose a valid date of registration.');
  out.registeredOn = b.registeredOn || todayLocal();
  return out;
}
