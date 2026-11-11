// Sends an email through any SMTP service (a free Gmail account works: SMTP_HOST=smtp.gmail.com and an "app password").
//
// Settings (environment or backend/.env): SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM (default SMTP_USER).
// Without them nothing is sent and `configured()` is false, so the app tells the person that no email was sent.
//
// Emails are sent one after the other by one background worker (a service like Gmail can refuse two logins at the same moment),
// and an email that fails is tried once more.
//
// WHO sends: Gmail (and most services) only lets an email go out from the account that signs in, so the address in "From" is always
// the one of SMTP_USER / SMTP_FROM (a different address would be rewritten or end in spam). What CAN show the real person is the
// NAME in "From" (for example "Danish Imam (Student, Improve Knowledge Center)") and "Reply-To" (the email of that person): the inbox
// shows the name, and the button Reply writes to the person. Emails without a person (a reset code...) show AcademiaOS.
//
// For development and tests nothing has to be sent: MAIL_LOG=<file> writes every email into that file instead,
// and the tests plug in their own delivery with `setDelivery` (so a test run can never send a real email).

import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import nodemailer from 'nodemailer';
import { loadEnvFiles } from './config.ts';
import { open } from './secretBox.ts';

/** The person an email comes from: the name shown as sender, and the address that Reply writes to. */
export interface Sender {
  name: string;
  replyTo?: string;
}

/** The own Gmail (or other SMTP account) of a coaching: its emails go out FROM this address. */
export interface OrgMail {
  email: string;
  password: string;
  host: string;
  port: number;
  fromName: string; // the name shown for an email that has no person (the coaching)
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  sender?: Sender;
  org?: OrgMail | null;
}

// ---- which coaching an email belongs to: the request that writes it says so (AsyncLocalStorage), and the settings of that coaching
// are kept in memory (loaded once; changed when the principal changes them)
const requestOrg = new AsyncLocalStorage<{ org: string }>();
const orgCache = new Map<string, OrgMail | null>();

type SettingsSource = { org: string; getMailSettings(): Promise<any> };

/** Loads the mail settings of a coaching (once). Call enterOrg() after it, in the same function that handles the request. */
export async function loadOrgMail(store: SettingsSource): Promise<void> {
  if (orgCache.has(store.org)) return;
  const v = await store.getMailSettings();
  const password = v?.passwordSealed ? open(v.passwordSealed) : null;
  orgCache.set(store.org, v && password ? { email: v.email, password, host: v.host, port: v.port, fromName: v.fromName || '' } : null);
}

/** Marks the rest of this request as belonging to a coaching (its emails go out from its own Gmail). It must be called WITHOUT await
 * in the function of the request itself: then everything that function starts afterwards belongs to that coaching. */
export function enterOrg(org: string): void {
  requestOrg.enterWith({ org });
}

/** The principal changed (or removed) the settings: they are loaded again at the next request. */
export function forgetOrgMail(org: string): void {
  orgCache.delete(org);
}

type VerifyFn = (settings: { email: string; password: string; host: string; port: number }) => Promise<void>;
let verifyOverride: VerifyFn | null = null;

/** Replaces the check of the Gmail login (tests). Pass null to go back. */
export function overrideVerify(fn: VerifyFn | null): void {
  verifyOverride = fn;
}

/** Tries to sign in to the mail account. Throws with a plain message when it does not work. */
export async function verifyAccount(settings: { email: string; password: string; host: string; port: number }): Promise<void> {
  if (verifyOverride) return verifyOverride(settings);
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    auth: { user: settings.email, pass: settings.password },
    connectionTimeout: 15000,
    socketTimeout: 15000,
  });
  await transport.verify();
}

type Delivery = (mail: Mail) => Promise<boolean> | boolean;

let delivery: Delivery | null = null;
let retryDelayMs = 3000;

/** Replaces the real delivery (tests). Pass null to go back. */
export function setDelivery(fn: Delivery | null, retryMs = 3000): void {
  delivery = fn;
  retryDelayMs = retryMs;
}

type SendFn = (to: string, subject: string, text: string, html: string | null, sender?: Sender) => boolean;
let sendOverride: SendFn | null = null;

/** Replaces send() as a whole (tests that look at the emails the routes write). Pass null to go back. */
export function overrideSend(fn: SendFn | null): void {
  sendOverride = fn;
}

function smtpSettings() {
  loadEnvFiles();
  const env = process.env;
  const user = (env.SMTP_USER || '').trim();
  return {
    host: (env.SMTP_HOST || '').trim(),
    port: parseInt(env.SMTP_PORT || '587', 10),
    user,
    password: (env.SMTP_PASSWORD || '').trim(),
    sender: (env.SMTP_FROM || '').trim() || user,
  };
}

export function configured(): boolean {
  if (delivery) return true;
  const org = requestOrg.getStore()?.org;
  if (org && orgCache.get(org)) return true; // the coaching has its own Gmail
  if (process.env.MAIL_LOG) return true;
  if (process.env.NODE_ENV === 'test') return false; // a test run never reaches a real mail server
  const s = smtpSettings();
  return Boolean(s.host && s.user && s.password);
}

function writeToLog(mail: Mail): boolean {
  const entry = { at: new Date().toISOString(), to: mail.to, from: mail.sender?.name ?? mail.org?.fromName ?? 'AcademiaOS', fromAddress: mail.org?.email ?? 'platform account', replyTo: mail.sender?.replyTo ?? null, subject: mail.subject, text: mail.text, hasHtml: Boolean(mail.html) };
  fs.appendFileSync(process.env.MAIL_LOG as string, JSON.stringify(entry) + '\n', 'utf-8');
  console.log(`[mail] logged for ${mail.to}: ${mail.subject}`);
  return true;
}

/** Sends one email now. Returns true when the service took it; a failure is written to the log, never thrown. */
async function deliver(mail: Mail): Promise<boolean> {
  try {
    if (delivery) return Boolean(await delivery(mail));
    if (process.env.MAIL_LOG) return writeToLog(mail);
    const platform = smtpSettings();
    // the own Gmail of the coaching when it has one, else the account of the platform
    const s = mail.org ? { host: mail.org.host, port: mail.org.port, user: mail.org.email, password: mail.org.password, sender: mail.org.email } : platform;
    const transport = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      requireTLS: s.port !== 465,
      auth: { user: s.user, pass: s.password },
      connectionTimeout: 20000,
      socketTimeout: 20000,
    });
    // the address stays the one of the account; the name and Reply-To are the person's
    const address = /<([^>]+)>/.exec(s.sender)?.[1] ?? s.sender;
    // (an email without a person shows the name AcademiaOS, unless SMTP_FROM already has a name)
    const fallbackName = mail.org?.fromName || 'AcademiaOS';
    const from = mail.sender?.name ? { name: mail.sender.name, address } : mail.org || !/<[^>]+>/.test(s.sender) ? { name: fallbackName, address } : s.sender;
    await transport.sendMail({ from, replyTo: mail.sender?.replyTo || undefined, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html || undefined });
    console.log(`[mail] sent to ${mail.to}: ${mail.subject}`);
    return true;
  } catch (err) {
    // a failed email must never break the approval itself
    console.log(`[mail] could not send to ${mail.to}: ${(err as Error).message}`);
    return false;
  }
}

let line: Promise<void> = Promise.resolve();

/** Puts the email in the line of the background worker. Returns true when it was taken, false when email is not set up. */
export function send(to: string, subject: string, text: string, html: string | null = null, sender?: Sender): boolean {
  if (sendOverride) return sendOverride(to, subject, text, html, sender);
  if (!to || !configured()) return false;
  const org = requestOrg.getStore()?.org;
  const mail: Mail = { to, subject, text, html, sender, org: org ? orgCache.get(org) ?? null : null };
  line = line.then(async () => {
    if (!(await deliver(mail))) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      const again = await deliver(mail); // one more try
      // the Gmail of the coaching does not work (for example its app password was removed): the platform account sends it instead
      if (!again && mail.org && smtpSettings().host) await deliver({ ...mail, org: null });
    }
  });
  return true;
}

/** Resolves when every email in the line has been handled (used by the tests). */
export const idle = (): Promise<void> => line;
