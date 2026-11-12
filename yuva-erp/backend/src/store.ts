// Everything that is stored in MongoDB (same collections and document shapes as the Python server).
//
// Several coachings (organisations) share one database. Every coaching has its own data; the first one
// ("default", the data that existed before) keeps the plain collection names, the others get a prefix
// ("o_<id>_students"). The accounts, sessions and the list of coachings are shared, and each account says
// which coaching it belongs to (orgId). The super admins belong to the "platform" pseudo coaching.
//
// Collections:
//   users, sessions, orgs, leads  shared
//   meta ("version", "profile", "present"), audit, photos, backups and one collection per list (below)  per coaching

import crypto from 'node:crypto';
import zlib from 'node:zlib';
import type { Collection, Db } from 'mongodb';
import { parsePhotoDataUrl } from './scope.ts';
import { logoTokenOf } from './logo.ts';

export const LISTS = [
  'courses',
  'batches',
  'students',
  'attendance',
  'transactions',
  'exams',
  'timetable',
  'templates',
  'notificationLogs',
  'enquiries',
  'announcements',
  'materials',
  'expenses',
  'salaries', // who gets how much every month (principal only)
  'staffAttendance', // the daily attendance of the teachers and staff (principal only)
  'books', // the library: books the institute shares to read online (everybody reads)
  'submissions', // homework marked as done: written only by the students themselves
  'leaveRequests', // a student asks the principal for leave: written only by the leave routes (student asks, principal decides)
];

// The app shows the newest first for these lists
const NEWEST_FIRST = new Set(['students', 'attendance', 'transactions', 'exams', 'notificationLogs', 'enquiries', 'announcements', 'materials', 'expenses', 'salaries', 'leaveRequests']);

export const DEFAULT_ORG = 'default'; // the coaching whose data lives in the plain collection names
export const PLATFORM_ORG = '__platform__'; // the super admins (they have no institute data)

const MAX_AUDIT = 3000;
const MAX_BACKUP_BYTES = 15 * 1024 * 1024; // one MongoDB document can hold 16 MB

const isoSeconds = (d = new Date()) => d.toISOString().slice(0, 19) + 'Z';

/** A stored document without MongoDB's own fields. */
export function clean(doc: any): any {
  if (!doc) return null;
  const { _id, _pos, ...rest } = doc;
  return rest;
}

function prefixOf(org: string): string {
  if (org === DEFAULT_ORG) return '';
  if (org === PLATFORM_ORG) return 'platform_';
  return `o_${org}_`;
}

/** A backup file that cannot be used (the answer to the browser is a 400). */
export class BackupError extends Error {}

const bytesOf = (value: any): Buffer => (Buffer.isBuffer(value) ? value : Buffer.from(value?.buffer ?? value));

/** The data of ONE coaching (`org`). `forOrg` gives the store of another coaching. */
export class Store {
  db: Db;
  org: string;
  tenants: Map<string, Store>;
  users: Collection<any>;
  sessions: Collection<any>;
  orgs: Collection<any>;
  leads: Collection<any>;
  meta: Collection<any>;
  auditCol: Collection<any>;
  photos: Collection<any>;
  backups: Collection<any>;
  lists: Record<string, Collection<any>>;

  constructor(db: Db, org = DEFAULT_ORG, tenants?: Map<string, Store>) {
    this.db = db;
    this.org = org;
    const prefix = prefixOf(org);
    this.tenants = tenants ?? new Map();
    this.tenants.set(org, this);
    // shared by all coachings
    this.users = db.collection('users');
    this.sessions = db.collection('sessions');
    this.orgs = db.collection('orgs');
    this.leads = db.collection('leads'); // "Book a demo" requests from the public website
    // the data of this coaching
    this.meta = db.collection(prefix + 'meta');
    this.auditCol = db.collection(prefix + 'audit');
    this.photos = db.collection(prefix + 'photos');
    this.backups = db.collection(prefix + 'backups');
    this.lists = Object.fromEntries(LISTS.map((name) => [name, db.collection(prefix + name)]));
  }

  /** The store of another coaching (the same database). */
  forOrg(org: string): Store {
    return this.tenants.get(org) ?? new Store(this.db, org, this.tenants);
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.users.createIndex('email', { unique: true });
      await this.sessions.createIndex('expiresAt', { expireAfterSeconds: 0 });
      await this.auditCol.createIndex('at');
      await this.sessions.createIndex('userId');
    } catch (err) {
      // a read-only account can still run the server
      console.log('Could not create indexes:', err);
    }
  }

  // ---------- coachings ----------

  async orgList(): Promise<any[]> {
    return (await this.orgs.find({}).sort('createdAt', 1).toArray()).map(clean);
  }

  async orgGet(orgId: any): Promise<any> {
    return typeof orgId === 'string' ? clean(await this.orgs.findOne({ _id: orgId })) : null;
  }

  async orgSave(org: any): Promise<void> {
    await this.orgs.replaceOne({ _id: org.id }, { ...org, _id: org.id }, { upsert: true });
  }

  async orgRemove(orgId: string): Promise<void> {
    await this.orgs.deleteOne({ _id: orgId });
  }

  // ---------- demo requests (the public website) ----------

  async leadAdd(lead: any): Promise<void> {
    await this.leads.insertOne({ ...lead, _id: lead.id });
    if ((await this.leads.countDocuments({})) > 2000) {
      // keep the list small
      const old = (await this.leads.find({}, { projection: { _id: 1 } }).sort('createdAt', 1).limit(200).toArray()).map((d) => d._id);
      await this.leads.deleteMany({ _id: { $in: old } });
    }
  }

  async leadList(limit = 200): Promise<any[]> {
    return (await this.leads.find({}).sort('createdAt', -1).limit(limit).toArray()).map(clean);
  }

  async leadRemove(leadId: string): Promise<number> {
    return (await this.leads.deleteOne({ _id: leadId })).deletedCount;
  }

  async orgActiveList(): Promise<any[]> {
    return (await this.orgList()).filter((o) => o.status === 'active');
  }

  /** Deletes everything of this coaching (never the first one or the platform). */
  async dropOrgData(): Promise<void> {
    if (this.org === DEFAULT_ORG || this.org === PLATFORM_ORG) throw new Error('This coaching cannot be deleted.');
    const names = new Set((await this.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const col of [this.meta, this.auditCol, this.photos, this.backups, ...Object.values(this.lists)]) {
      if (names.has(col.collectionName)) await col.drop();
    }
    await this.users.deleteMany({ orgId: this.org });
    this.tenants.delete(this.org);
  }

  /** Data from before the coachings existed: accounts get the first coaching, which gets a record. */
  async migrateToCoachings(): Promise<void> {
    await this.users.updateMany({ orgId: { $exists: false }, role: { $ne: 'super' } }, { $set: { orgId: DEFAULT_ORG } });
    const def = this.forOrg(DEFAULT_ORG);
    // a database that never had data of its own (only super admins and new coachings) has no first coaching
    if ((await def.userCount()) > 0 || (await def.profile()) !== null) await this.ensureDefaultOrg();
  }

  /** The first coaching (the plain collections). Created when the first principal is set up, or for old data. */
  async ensureDefaultOrg(): Promise<void> {
    if ((await this.orgGet(DEFAULT_ORG)) === null) {
      const profile = (await this.forOrg(DEFAULT_ORG).profile()) || {};
      await this.orgSave({
        id: DEFAULT_ORG,
        name: String(profile.name || 'My Coaching'),
        city: '',
        status: 'active',
        createdAt: isoSeconds(),
      });
    }
  }

  // ---------- version ----------

  /** Remembers that the absence of a student on a day was mailed. True the first time, false when it was done before. */
  async claimAbsenceMail(key: string): Promise<boolean> {
    const r = await this.meta.updateOne({ _id: 'absenceMailed' }, { $addToSet: { keys: key } }, { upsert: true });
    return r.modifiedCount === 1 || r.upsertedCount === 1;
  }

  async version(): Promise<number> {
    const doc = await this.meta.findOne({ _id: 'version' });
    return doc ? doc.value : 0;
  }

  /** Something other clients must see changed (accounts or institute data). */
  async bump(): Promise<number> {
    const doc = await this.meta.findOneAndUpdate({ _id: 'version' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
    return doc.value;
  }

  // ---------- accounts ----------

  async usersAll(): Promise<any[]> {
    return (await this.users.find({ orgId: this.org }).sort('createdAt', 1).toArray()).map(clean);
  }

  userCount(): Promise<number> {
    return this.users.countDocuments({ orgId: this.org });
  }

  adminCount(): Promise<number> {
    return this.users.countDocuments({ orgId: this.org, role: 'admin' });
  }

  /** An account of THIS coaching (another coaching's account is never found). */
  async userById(userId: any): Promise<any> {
    return clean(await this.users.findOne({ _id: userId, orgId: this.org }));
  }

  /** An account of any coaching (to find out who a session belongs to). */
  async userByIdAny(userId: any): Promise<any> {
    return clean(await this.users.findOne({ _id: userId }));
  }

  /** Emails are unique over all coachings, so everybody signs in with the email only. */
  async userByEmail(email: string): Promise<any> {
    return clean(await this.users.findOne({ email }));
  }

  /** The student's own login (parent=false) or the parent's login (parent=true) of a student record. */
  async userByStudent(studentId: string, parent = false): Promise<any> {
    return clean(await this.users.findOne({ studentId, orgId: this.org, isParent: parent ? true : { $ne: true } }));
  }

  async addUser(user: any): Promise<void> {
    user.orgId = this.org;
    await this.users.insertOne({ ...user, _id: user.id });
  }

  async saveUser(user: any): Promise<void> {
    await this.users.replaceOne({ _id: user.id }, { ...user, _id: user.id });
  }

  async removeUser(userId: string): Promise<void> {
    await this.users.deleteOne({ _id: userId, orgId: this.org });
  }

  // ---------- sessions ----------

  async addSession(tokenHash: string, userId: string, lifetimeSec: number): Promise<void> {
    const now = new Date();
    await this.sessions.insertOne({ _id: tokenHash, userId, createdAt: now, expiresAt: new Date(now.getTime() + lifetimeSec * 1000) });
  }

  getSession(tokenHash: string): Promise<any> {
    return this.sessions.findOne({ _id: tokenHash });
  }

  sessionExpired(session: any): boolean {
    return new Date(session.expiresAt).getTime() <= Date.now();
  }

  /** Is somebody of these accounts signed in right now (a session that is not over)? */
  async anySignedIn(userIds: string[]): Promise<boolean> {
    if (!userIds.length) return false;
    return (await this.sessions.countDocuments({ userId: { $in: userIds }, expiresAt: { $gt: new Date() } }, { limit: 1 })) > 0;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.sessions.deleteOne({ _id: tokenHash });
  }

  async deleteSessionsOf(userId: string, keepHash?: string): Promise<void> {
    const query: any = { userId };
    if (keepHash) query._id = { $ne: keepHash };
    await this.sessions.deleteMany(query);
  }

  // ---------- activity log ----------

  async audit(user: any, action: string, detail: any = ''): Promise<void> {
    await this.auditCol.insertOne({
      at: new Date().toISOString(),
      userId: user ? user.id : null,
      name: user ? user.name : null,
      action,
      detail: String(detail).slice(0, 300),
    });
    if (Math.random() < 0.02) {
      // now and then remove the oldest entries
      const extra = (await this.auditCol.countDocuments({})) - MAX_AUDIT;
      if (extra > 0) {
        const old = (await this.auditCol.find({}, { projection: { _id: 1 } }).sort('at', 1).limit(extra).toArray()).map((d) => d._id);
        await this.auditCol.deleteMany({ _id: { $in: old } });
      }
    }
  }

  async auditRecent(limit: number): Promise<any[]> {
    const docs = await this.auditCol.find({}).sort('at', -1).limit(limit).toArray();
    return docs.map(({ _id, ...rest }) => rest);
  }

  // ---------- institute data ----------

  /** Names of the lists that were ever written. A list that is not there yet lets the first
   * principal's browser add the starting data. */
  async present(): Promise<Set<string>> {
    const doc = await this.meta.findOne({ _id: 'present' });
    return new Set(doc ? doc.names : []);
  }

  async markPresent(names: string[]): Promise<void> {
    if (names.length) await this.meta.updateOne({ _id: 'present' }, { $addToSet: { names: { $each: names } } }, { upsert: true });
  }

  async profile(): Promise<any> {
    const doc = await this.meta.findOne({ _id: 'profile' });
    return doc ? doc.value : null;
  }

  async setProfile(value: any): Promise<void> {
    await this.meta.replaceOne({ _id: 'profile' }, { _id: 'profile', value, logoToken: logoTokenOf(value?.logo) }, { upsert: true });
  }

  /** The small token of the logo ('' when there is none); the address of the picture changes with it. Reading it does NOT load the logo
   * (a logo can be some MB), so the list of the Super Admin stays fast. */
  async logoToken(): Promise<string> {
    const doc = await this.meta.findOne({ _id: 'profile' }, { projection: { logoToken: 1 } });
    if (!doc) return '';
    if (typeof doc.logoToken === 'string') return doc.logoToken;
    // a profile that was saved before the token existed: it is made once, now
    const full = await this.meta.findOne({ _id: 'profile' });
    const token = logoTokenOf(full?.value?.logo);
    await this.meta.updateOne({ _id: 'profile' }, { $set: { logoToken: token } });
    return token;
  }

  async find(name: string, query: any = {}): Promise<any[]> {
    return (await this.lists[name].find(query).sort('_pos', 1).toArray()).map(clean);
  }

  async getItem(name: string, itemId: any): Promise<any> {
    return clean(await this.lists[name].findOne({ _id: itemId }));
  }

  async getMany(name: string, ids: string[]): Promise<Record<string, any>> {
    if (!ids.length) return {};
    const out: Record<string, any> = Object.create(null);
    for (const d of await this.lists[name].find({ _id: { $in: ids } }).toArray()) out[d._id] = clean(d);
    return out;
  }

  /** { record id: value of one field } for the whole list. */
  async fieldValues(name: string, field: string): Promise<Map<string, any>> {
    const out = new Map<string, any>();
    for (const d of await this.lists[name].find({}, { projection: { [field]: 1 } }).toArray()) out.set(d._id, d[field]);
    return out;
  }

  private async write(col: Collection<any>, replaces: [string, any][], deleteIds: string[]): Promise<void> {
    const ops: any[] = replaces.map(([id, doc]) => ({ replaceOne: { filter: { _id: id }, replacement: doc, upsert: true } }));
    if (deleteIds.length) ops.push({ deleteMany: { filter: { _id: { $in: deleteIds } } } });
    if (ops.length) await col.bulkWrite(ops, { ordered: true });
  }

  /** Adds / replaces / removes records by id. New records keep the order they were sent in.
   * Returns [added, updated, removed]. */
  async applyList(name: string, upserts: any[], removes: string[]): Promise<[number, number, number]> {
    const col = this.lists[name];

    const latest = new Map<string, any>(); // a record sent twice: the last one wins
    for (const item of upserts) latest.set(item.id, item);
    const ids = [...latest.keys()];

    const existing = new Map<string, number>();
    if (ids.length) for (const d of await col.find({ _id: { $in: ids } }, { projection: { _pos: 1 } }).toArray()) existing.set(d._id, d._pos ?? 0);
    const newIds: string[] = [];
    const seen = new Set<string>();
    for (const item of upserts) {
      // new records, in the order they were sent
      if (!existing.has(item.id) && !seen.has(item.id)) {
        newIds.push(item.id);
        seen.add(item.id);
      }
    }

    let start: number;
    if (NEWEST_FIRST.has(name)) {
      const first = await col.findOne({}, { sort: { _pos: 1 } });
      start = first ? first._pos - newIds.length : 0;
    } else {
      const last = await col.findOne({}, { sort: { _pos: -1 } });
      start = last ? last._pos + 1 : 0;
    }
    const position = new Map(newIds.map((id, i) => [id, start + i]));

    const removeIds = [...removes];
    const removed = removeIds.length ? await col.countDocuments({ _id: { $in: removeIds } }) : 0;

    const replaces: [string, any][] = [];
    for (const [itemId, item] of latest) {
      const pos = existing.get(itemId) ?? position.get(itemId) ?? 0;
      replaces.push([itemId, { ...item, _id: itemId, _pos: pos }]);
    }
    await this.write(col, replaces, removeIds);

    await this.markPresent([name]);
    return [newIds.length, existing.size, removed];
  }

  /** Replaces a whole list, keeping the order of `items` (used when importing old data). */
  async replaceList(name: string, items: any[]): Promise<void> {
    const col = this.lists[name];
    await col.deleteMany({});
    await this.write(col, items.map((it, i) => [it.id, { ...it, _id: it.id, _pos: i }] as [string, any]), []);
    await this.markPresent([name]);
  }

  async setField(name: string, itemId: string, field: string, value: any): Promise<void> {
    await this.lists[name].updateOne({ _id: itemId }, { $set: { [field]: value } });
  }

  async incField(name: string, itemId: string, field: string, amount: number): Promise<void> {
    await this.lists[name].updateOne({ _id: itemId }, { $inc: { [field]: amount } });
  }

  // ---------- the own Gmail of a coaching (the emails of the coaching go out from it) ----------

  /** { email, host, port, fromName, passwordSealed } or null. The password is sealed (see secretBox.ts). */
  async getMailSettings(): Promise<any> {
    const doc = await this.meta.findOne({ _id: 'mail' });
    return doc ? doc.value : null;
  }

  async setMailSettings(value: any): Promise<void> {
    await this.meta.replaceOne({ _id: 'mail' }, { _id: 'mail', value }, { upsert: true });
  }

  async clearMailSettings(): Promise<void> {
    await this.meta.deleteOne({ _id: 'mail' });
  }

  // ---------- photos ----------

  /** Stores a student photo. Returns the token that makes the photo address (a new photo = a new address). */
  async savePhoto(studentId: string, contentType: string, data: Buffer): Promise<string> {
    const token = crypto.randomBytes(12).toString('base64url');
    await this.photos.replaceOne({ _id: studentId }, { _id: studentId, contentType, data, token }, { upsert: true });
    return token;
  }

  /** Address of a student photo. The address says which coaching it belongs to. */
  photoUrl(studentId: string, token: string): string {
    const base = `/api/photos/${studentId}/${token}`;
    return this.org === DEFAULT_ORG ? base : `${base}?o=${this.org}`;
  }

  /** The stored photo with its bytes as a Buffer (or null). */
  async getPhoto(studentId: string): Promise<{ contentType: string; data: Buffer; token: string } | null> {
    const doc = await this.photos.findOne({ _id: studentId });
    return doc ? { contentType: doc.contentType, data: bytesOf(doc.data), token: doc.token } : null;
  }

  async deletePhotos(studentIds: string[]): Promise<void> {
    if (studentIds.length) await this.photos.deleteMany({ _id: { $in: studentIds } });
  }

  // ---------- backups ----------

  /** Everything as one JSON-ready object (used by the backup download and the automatic snapshots). */
  async exportData(accounts = true, photos = true): Promise<any> {
    const institute: any = {};
    const profile = await this.profile();
    if (profile !== null) institute.profile = profile;
    const present = await this.present();
    for (const name of LISTS) if (present.has(name)) institute[name] = await this.find(name);
    const out: any = { format: 'academiaos-backup', version: 1, exportedAt: isoSeconds(), institute };
    if (accounts) out.users = await this.usersAll(); // with the password hashes, so accounts can be restored
    if (photos) {
      out.photos = (await this.photos.find({}).toArray()).map((d) => ({
        id: d._id,
        contentType: d.contentType || 'image/jpeg',
        token: d.token,
        data: bytesOf(d.data).toString('base64'),
      }));
    }
    return out;
  }

  /** Puts a backup back. The lists in the backup replace the current ones; accounts of the backup that do
   * not exist yet are added (nobody is removed, so the principal cannot be locked out). Returns a short report. */
  async restoreData(payload: any, accounts = true): Promise<any> {
    const institute = payload && typeof payload === 'object' ? payload.institute : null;
    if (!institute || typeof institute !== 'object' || Array.isArray(institute)) throw new BackupError('This is not an AcademiaOS backup file.');

    const report: any = { lists: {}, accounts_added: 0, photos: 0 };
    if (institute.profile && typeof institute.profile === 'object' && !Array.isArray(institute.profile)) await this.setProfile(institute.profile);
    for (const name of LISTS) {
      let items = institute[name];
      if (Array.isArray(items)) {
        items = items.filter((i: any) => i && typeof i === 'object' && typeof i.id === 'string' && i.id);
        await this.replaceList(name, items);
        report.lists[name] = items.length;
      }
    }

    if (Array.isArray(payload.photos)) {
      await this.photos.deleteMany({});
      for (const p of payload.photos) {
        if (!p || typeof p.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(p.data) || p.data.length % 4 !== 0 || p.id === undefined) continue;
        const data = Buffer.from(p.data, 'base64');
        await this.photos.replaceOne(
          { _id: p.id },
          { _id: p.id, contentType: p.contentType || 'image/jpeg', data, token: p.token || crypto.randomBytes(12).toString('base64url') },
          { upsert: true },
        );
        report.photos += 1;
      }
    }

    if (accounts && Array.isArray(payload.users)) {
      for (let user of payload.users) {
        if (!user || typeof user !== 'object' || !user.id || !user.email) continue;
        const { _id, ...rest } = user;
        user = rest;
        if ((await this.userByEmail(user.email)) || (await this.userById(user.id))) continue;
        if (user.status === undefined) user.status = 'active';
        await this.addUser(user);
        report.accounts_added += 1;
      }
    }
    await this.bump();
    return report;
  }

  /** Saves a compressed copy of the data (without photos, which stay where they are).
   * Returns the snapshot's id, or null when it is too big for one document. */
  async snapshot(label = 'automatic'): Promise<string | null> {
    const raw = Buffer.from(JSON.stringify(await this.exportData(true, false)), 'utf-8');
    const packed = zlib.deflateSync(raw, { level: 6 });
    if (packed.length > MAX_BACKUP_BYTES) return null;
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    const snapshotId = `${stamp}-${crypto.randomBytes(2).toString('hex')}`; // two in one second must not clash
    await this.backups.insertOne({ _id: snapshotId as any, createdAt: now, label, size: raw.length, payload: packed });
    await this.pruneBackups();
    return snapshotId;
  }

  async pruneBackups(keep = 14): Promise<void> {
    const old = (await this.backups.find({}, { projection: { _id: 1 } }).sort('createdAt', -1).skip(keep).toArray()).map((d) => d._id);
    if (old.length) await this.backups.deleteMany({ _id: { $in: old } });
  }

  async listBackups(): Promise<any[]> {
    const docs = await this.backups.find({}, { projection: { payload: 0 } }).sort('createdAt', -1).toArray();
    return docs.map((d) => ({ id: d._id, createdAt: new Date(d.createdAt).toISOString().slice(0, 19) + 'Z', label: d.label || '', size: d.size || 0 }));
  }

  async getBackup(backupId: string): Promise<any> {
    const doc = await this.backups.findOne({ _id: backupId });
    if (!doc) return null;
    return JSON.parse(zlib.inflateSync(bytesOf(doc.payload)).toString('utf-8'));
  }

  async latestBackupTime(label = 'automatic'): Promise<Date | null> {
    const doc = await this.backups.findOne({ label }, { sort: { createdAt: -1 } });
    return doc ? new Date(doc.createdAt) : null;
  }

  /** Older data keeps photos inside the student records (data URLs). Moves them to the photos collection.
   * Returns how many were moved. */
  async moveInlinePhotos(): Promise<number> {
    const col = this.lists.students;
    let moved = 0;
    for (const doc of await col.find({ photoUrl: { $regex: '^data:' } }).toArray()) {
      let parsed;
      try {
        parsed = parsePhotoDataUrl(doc.photoUrl);
      } catch {
        continue; // a photo that cannot be read stays as it is
      }
      const token = await this.savePhoto(doc._id, parsed.contentType, parsed.data);
      await col.updateOne({ _id: doc._id }, { $set: { photoUrl: this.photoUrl(doc._id, token) } });
      moved += 1;
    }
    if (moved) await this.bump();
    return moved;
  }
}
