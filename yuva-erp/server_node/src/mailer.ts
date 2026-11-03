// Sends an email through any SMTP service (a free Gmail account works: SMTP_HOST=smtp.gmail.com and an "app password").
//
// Settings (environment or server_node/.env): SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM (default SMTP_USER).
// Without them nothing is sent and `configured()` is false, so the app tells the person that no email was sent.
//
// Emails are sent one after the other by one background worker (a service like Gmail can refuse two logins at the same moment),
// and an email that fails is tried once more.
//
// For development and tests nothing has to be sent: MAIL_LOG=<file> writes every email into that file instead,
// and the tests plug in their own delivery with `setDelivery` (so a test run can never send a real email).

import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { loadEnvFiles } from './config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  from?: string;
}

type Delivery = (mail: Mail) => Promise<boolean> | boolean;

let delivery: Delivery | null = null;
let retryDelayMs = 3000;

/** Replaces the real delivery (tests). Pass null to go back. */
export function setDelivery(fn: Delivery | null, retryMs = 3000): void {
  delivery = fn;
  retryDelayMs = retryMs;
}

type SendFn = (to: string, subject: string, text: string, html: string | null) => boolean;
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
  if (process.env.MAIL_LOG) return true;
  if (process.env.NODE_ENV === 'test') return false; // a test run never reaches a real mail server
  const s = smtpSettings();
  return Boolean(s.host && s.user && s.password);
}

function writeToLog(mail: Mail): boolean {
  const entry = { at: new Date().toISOString(), to: mail.to, subject: mail.subject, text: mail.text, hasHtml: Boolean(mail.html) };
  fs.appendFileSync(process.env.MAIL_LOG as string, JSON.stringify(entry) + '\n', 'utf-8');
  console.log(`[mail] logged for ${mail.to}: ${mail.subject}`);
  return true;
}

/** Sends one email now. Returns true when the service took it; a failure is written to the log, never thrown. */
async function deliver(mail: Mail): Promise<boolean> {
  try {
    if (delivery) return Boolean(await delivery(mail));
    if (process.env.MAIL_LOG) return writeToLog(mail);
    const s = smtpSettings();
    const transport = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      requireTLS: s.port !== 465,
      auth: { user: s.user, pass: s.password },
      connectionTimeout: 20000,
      socketTimeout: 20000,
    });
    await transport.sendMail({ from: s.sender, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html || undefined });
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
export function send(to: string, subject: string, text: string, html: string | null = null): boolean {
  if (sendOverride) return sendOverride(to, subject, text, html);
  if (!to || !configured()) return false;
  const mail: Mail = { to, subject, text, html };
  line = line.then(async () => {
    if (!(await deliver(mail))) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      await deliver(mail); // one more try
    }
  });
  return true;
}

/** Resolves when every email in the line has been handled (used by the tests). */
export const idle = (): Promise<void> => line;
