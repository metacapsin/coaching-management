// Keeps a secret (the app password of the Gmail of a coaching) in the database in a form that is useless without the server's own secret.
// The key comes from APP_SECRET, or else from the database address (MONGODB_URI): both live in the server settings, never in the database
// itself, so a copy of the database alone does not show the password. AES-256-GCM (it also notices a changed value).

import crypto from 'node:crypto';

function key(): Buffer {
  return crypto.createHash('sha256').update(`academiaos-mail:${process.env.APP_SECRET || process.env.MONGODB_URI || 'development-only'}`).digest();
}

/** text -> "iv.tag.data" (base64url) */
export function seal(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

/** The text again, or null when the value was changed or the server secret is another one. */
export function open(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}
