// The details that the principal writes down when a teacher joins (a registration form of a coaching): personal and contact data, the
// qualification and the work history, and the agreement (how the teacher is paid, the date of registration).
// They are kept inside the account of the teacher, are never sent in the list of the accounts, and only the principal can read them.

import { HttpError } from './errors.ts';
import { checkName, text, todayLocal } from './validate.ts';

const MAX_ID_IMAGE = 700_000; // characters of the data address (about 500 KB of picture)
export const PAY_TYPES = ['monthly', 'per_lecture', 'per_hour', 'honorarium'] as const;
export { COUNTRIES } from './countryData.ts';
import { COUNTRIES } from './countryData.ts';

/** A contact number: exactly 10 digits. For India it is kept as the 10 digits; for another country the dial code is written before them. */
export function cleanTeacherPhone(raw: unknown, countryCode: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length !== 10) throw new HttpError(400, 'The contact number must have exactly 10 digits.');
  return countryCode === '+91' ? digits : `${countryCode} ${digits}`;
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

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

  const country = text(b.country, 60) || 'India';
  if (!Object.prototype.hasOwnProperty.call(COUNTRIES, country)) throw new HttpError(400, 'Choose the country from the list.');
  const india = country === 'India';
  out.country = country;
  out.countryCode = COUNTRIES[country];

  const alt = String(b.alternatePhone ?? '').replace(/\D/g, '');
  if (alt && alt.length !== 10) throw new HttpError(400, 'The alternate contact number must have exactly 10 digits.');
  out.alternatePhone = alt;

  const address = b.address && typeof b.address === 'object' ? b.address : {};
  const pin = String(address.pin ?? '').trim();
  // India: a PIN code of 6 digits. Another country: a postal code of 3 to 10 letters or digits.
  if (pin && india && !/^\d{6}$/.test(pin)) throw new HttpError(400, 'The PIN code must have 6 digits.');
  if (pin && !india && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(pin)) throw new HttpError(400, 'The postal code must have 3 to 10 letters or digits.');
  out.address = { line: text(address.line, 200), district: text(address.district, 80), state: text(address.state, 80), pin };

  if (b.dateOfBirth) {
    if (!isDate(b.dateOfBirth)) throw new HttpError(400, 'Please choose a valid date of birth.');
    const age = (Date.now() - Date.parse(`${b.dateOfBirth}T00:00:00Z`)) / (365.25 * 86400000);
    if (age < 18 || age > 80) throw new HttpError(400, 'The date of birth is not right: a teacher must be between 18 and 80 years old.');
  }
  out.dateOfBirth = b.dateOfBirth || '';

  // the photo of the identity card (Aadhaar card, passport...): a small picture (the form makes it small). There is no identity number: only the photo.
  const image = b.idImage;
  if (image !== undefined && image !== null && image !== '') {
    if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'The photo of the ID must be a picture (JPG, PNG or WebP).');
    if (image.length > MAX_ID_IMAGE) throw new HttpError(400, 'The photo of the ID is too big. Please choose a smaller picture.');
  }
  out.idImage = typeof image === 'string' ? image : '';

  // ---- qualification and work history
  // the degrees: the first is the highest one, and the teacher can have more (up to 8)
  const list = Array.isArray(b.qualifications) ? b.qualifications : b.qualification ? [b.qualification] : [];
  out.qualifications = list.map((d: unknown) => text(d, 150)).filter(Boolean).slice(0, 8);
  out.qualification = out.qualifications[0] ?? '';
  out.workHistory = text(b.workHistory, 1200);

  // ---- the agreement
  if (b.termsAccepted !== true) throw new HttpError(400, 'The teacher must agree to the terms and conditions of the coaching.');
  out.termsAccepted = true;
  out.termsAcceptedOn = todayLocal();
  out.availability = 'online'; // (every class is online: the platform works on the website, so there is nothing to choose)

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

  // the date of registration is the day the teacher is added: the server writes it, it cannot be chosen or changed
  out.registeredOn = todayLocal();
  return out;
}
