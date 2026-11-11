// Shared helpers of the server tests: an in-memory MongoDB, the real app on a free port, and a small client.
// The tests never send an email (the mailer is cut off here) and never read the real .env files.

process.env.NODE_ENV = 'test';
process.env.ACADEMIA_NO_DOTENV = '1';
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_LOG', 'MONGODB_URI', 'PUBLIC_URL', 'TRUST_PROXY']) delete process.env[key];

import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.ts';
import * as mailer from '../src/mailer.ts';
import type { Store } from '../src/store.ts';

export const PASSWORD = 'Passw0rd123';

// Every email that is "sent" during a test run lands here, never on a mail server.
mailer.setDelivery(() => true, 0);

let mongo: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

/** Starts the in-memory MongoDB (once per test file). */
export async function startMongo(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  client = new MongoClient(mongo.getUri());
  await client.connect();
}

export async function stopMongo(): Promise<void> {
  await client?.close();
  await mongo?.stop();
}

export function newDb(): Db {
  return (client as MongoClient).db(`academia_test_${crypto.randomBytes(4).toString('hex')}`);
}

export const dropDb = (db: Db) => db.dropDatabase();

export class Api {
  base: string;
  server: Server;
  root: Store;

  constructor(server: Server, root: Store) {
    this.server = server;
    this.root = root;
    const address = server.address() as { port: number };
    this.base = `http://127.0.0.1:${address.port}`;
  }

  /** Like the app does it: JSON in, [status, JSON out] back. */
  async call(method: string, url: string, body?: any, token?: string | null, headers: Record<string, string> = {}): Promise<[number, any]> {
    const h: Record<string, string> = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const init: RequestInit = { method, headers: h };
    if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
      h['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(this.base + url, init);
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return [res.status, json ?? {}];
  }

  /** The raw answer (for photos and downloads). */
  raw(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.base + url, init);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.closeAllConnections();
      this.server.close(() => resolve());
    });
  }
}

/** The real app on a free port, working on `db`. */
export async function makeApi(db: Db, distDir = 'no-dist'): Promise<Api> {
  const { app, root } = await createApp(db, distDir);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return new Api(server, root);
}

// ---------- sample institute data ----------

export const batch = (bid: string, code: string, name: string, capacity: number, enrolled: number) => ({
  id: bid, code, name, courseId: 'c1', courseName: 'JEE', subjects: [], facultyName: 'secret faculty', classroom: 'r1',
  scheduleDays: ['Mon'], startTime: '04:00 PM', endTime: '05:00 PM', maxCapacity: capacity, enrolledCount: enrolled, status: 'ongoing',
});

export const student = (sid: string, roll: string, name: string, batchId: string, phone: string) => ({
  id: sid, rollNo: roll, name, email: `${sid}@x.com`, phone, parentName: 'P', parentPhone: phone, grade: 'Class 12', courseId: 'c1',
  batchId, targetExam: 'JEE', dateOfAdmission: '2026-01-01', status: 'active', photoUrl: '', address: '', totalFees: 1000, discount: 0, feePaid: 500,
});

export const BATCHES = [batch('b1', 'A', 'Batch A', 2, 2), batch('b2', 'B', 'Batch B', 30, 1)];
export const STUDENTS = [
  student('s1', '01', 'Alice', 'b1', '+91 98000 00001'),
  student('s2', '02', 'Bob', 'b1', '+91 98000 00002'),
  student('s3', '03', 'Carol', 'b2', '+91 98000 00003'),
];
export const EXAM = {
  id: 'e1', code: 'T1', title: 'Test 1', batchId: 'b1', batchName: 'Batch A', subject: 'Maths', date: '2026-02-01', maxMarks: 100, passMarks: 35,
  status: 'published', syllabusTopics: [], results: { s1: { marksObtained: 90 }, s2: { marksObtained: 60 } },
};
export const COURSE = { id: 'c1', code: 'J', name: 'JEE', category: 'Engineering', duration: '1y', standardFee: 1000, description: '' };
export const SEED: Record<string, any> = {
  profile: { name: 'Test Institute' },
  courses: { upsert: [COURSE] },
  batches: { upsert: BATCHES },
  students: { upsert: STUDENTS },
  attendance: { upsert: [{ id: 'att1', date: '2026-02-01', batchId: 'b1', records: { s1: 'present', s2: 'absent' }, markedBy: 'x', updatedAt: '' }] },
  transactions: {
    upsert: [
      { id: 'tx1', receiptNo: 'REC-2026-0001', studentId: 's1', studentName: 'Alice', studentRollNo: '01', batchName: 'Batch A', amount: 500, paymentMethod: 'Cash', date: '2026-01-02', installmentNo: 1 },
    ],
  },
  exams: { upsert: [EXAM] },
  timetable: { upsert: [] },
  templates: { upsert: [] },
  notificationLogs: {
    upsert: [
      { id: 'l1', timestamp: '', type: 'fee_due', channel: 'whatsapp', recipientName: 'P', recipientPhone: '1', studentName: 'Alice', studentId: 's1', content: 'hi', status: 'delivered' },
    ],
  },
};

/** Collects the emails the routes write (instead of sending them). */
export function captureMail() {
  // [to, subject, text, html, sender]: the sender is the person it comes from ({ name, replyTo }), or undefined for AcademiaOS itself
  const sent: [string, string, string, string | null, { name: string; replyTo?: string } | undefined][] = [];
  mailer.overrideSend((to, subject, body, html, sender) => {
    sent.push([to, subject, body, html, sender]);
    return true;
  });
  return { sent, stop: () => mailer.overrideSend(null) };
}
