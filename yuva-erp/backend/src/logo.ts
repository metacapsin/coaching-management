// The logo of a coaching: a picture in the profile (a data URL). It is shown on the card of the Super Admin and served from its own address.
// Any picture the principal could set is shown (the card scales it down by itself). An SVG is served with a header that forbids scripts.

import crypto from 'node:crypto';

const LOGO_TYPES = new Map([
  ['image/png', 'image/png'],
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/webp', 'image/webp'],
  ['image/gif', 'image/gif'],
  ['image/svg+xml', 'image/svg+xml'],
]);
export const MAX_LOGO_BYTES = 12_000_000;

/** The picture of a logo with the token of its address, or null when it is not a real picture. */
export function logoOf(value: unknown): { contentType: string; data: Buffer; token: string } | null {
  if (typeof value !== 'string') return null;
  const comma = value.indexOf(',');
  if (comma < 0 || comma > 80) return null;
  const head = /^data:(image\/[a-z0-9+.-]+);base64$/i.exec(value.slice(0, comma).trim());
  const contentType = head ? LOGO_TYPES.get(head[1].toLowerCase()) : undefined;
  if (!contentType) return null;
  const data = Buffer.from(value.slice(comma + 1).replace(/\s+/g, ''), 'base64'); // (a line break inside the code does no harm)
  if (!data.length || data.length > MAX_LOGO_BYTES) return null;
  return { contentType, data, token: crypto.createHash('sha256').update(data).digest('hex').slice(0, 16) };
}

/** The small token of a logo ('' when there is none). It is kept next to the profile when this is saved, so a list of coachings never has to load the picture. */
export const logoTokenOf = (value: unknown): string => logoOf(value)?.token ?? '';
