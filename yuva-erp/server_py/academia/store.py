"""Everything that is stored in MongoDB.

Several coachings (organisations) share one database. Every coaching has its own data; the first one
("default", the data that existed before) keeps the plain collection names, the others get a prefix
("o_<id>_students"). The accounts, sessions and the list of coachings are shared, and each account says
which coaching it belongs to (orgId). The super admins belong to the "platform" pseudo coaching.

Collections (in the database named by MONGODB_DB):
  users        one document per account (_id = account id, orgId = its coaching)   [shared]
  sessions     one document per signed-in session (_id = hash of the token)        [shared]
  orgs         one document per coaching (name, city, status)                      [shared]
  meta         "version" (counts every change), "profile" (institute profile), "present" (which lists exist)
  audit        the activity log
  courses, batches, students, attendance, transactions, exams, timetable, templates, notificationLogs,
  enquiries, announcements, materials, expenses, salaries, staffAttendance, books
               one document per record (_id = record id); "_pos" keeps the order of the list
  photos       student photos (_id = student id), kept apart so the data stays small
  backups      automatic and manual snapshots of the data (compressed)
"""

import base64
import json
import random
import secrets
import zlib
from datetime import datetime, timedelta, timezone

from pymongo import ASCENDING, DeleteMany, ReplaceOne, ReturnDocument
from pymongo.collection import Collection as MongoCollection
from pymongo.errors import PyMongoError

LISTS = [
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
    'salaries',  # who gets how much every month (principal only)
    'staffAttendance',  # the daily attendance of the teachers and staff (principal only)
    'books',  # the library: books the institute shares to read online (everybody reads)
    'submissions',  # homework marked as done: written only by the students themselves
]

# The app shows the newest first for these lists
NEWEST_FIRST = {
    'students',
    'attendance',
    'transactions',
    'exams',
    'notificationLogs',
    'enquiries',
    'announcements',
    'materials',
    'expenses',
    'salaries',
}

DEFAULT_ORG = 'default'  # the coaching whose data lives in the plain collection names
PLATFORM_ORG = '__platform__'  # the super admins (they have no institute data)

# A coaching is waiting for approval / works / was switched off by the super admin
ORG_STATUSES = ('pending', 'active', 'suspended')

MAX_AUDIT = 3000
MAX_BACKUP_BYTES = 15 * 1024 * 1024  # one MongoDB document can hold 16 MB


def _now_naive_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def clean(doc):
    """A stored document without MongoDB's own fields."""
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k not in ('_id', '_pos')}


def _prefix(org):
    if org == DEFAULT_ORG:
        return ''
    if org == PLATFORM_ORG:
        return 'platform_'
    return f'o_{org}_'


class Store:
    """The data of ONE coaching (`org`). `for_org` gives the store of another coaching."""

    def __init__(self, db, org=DEFAULT_ORG, _tenants=None):
        self.db = db
        self.org = org
        prefix = _prefix(org)
        self._tenants = _tenants if _tenants is not None else {}
        self._tenants[org] = self
        # shared by all coachings
        self.users = db['users']
        self.sessions = db['sessions']
        self.orgs = db['orgs']
        self.leads = db['leads']  # "Book a demo" requests from the public website
        # the data of this coaching
        self.meta = db[prefix + 'meta']
        self.audit_col = db[prefix + 'audit']
        self.photos = db[prefix + 'photos']
        self.backups = db[prefix + 'backups']
        self.lists = {name: db[prefix + name] for name in LISTS}
        self._ensure_indexes()

    def for_org(self, org):
        """The store of another coaching (the same database)."""
        found = self._tenants.get(org)
        return found if found is not None else Store(self.db, org, self._tenants)

    # ---------- coachings ----------

    def org_list(self):
        return [clean(d) for d in self.orgs.find({}).sort('createdAt', ASCENDING)]

    def org_get(self, org_id):
        return clean(self.orgs.find_one({'_id': org_id})) if isinstance(org_id, str) else None

    def org_save(self, org):
        self.orgs.replace_one({'_id': org['id']}, {**org, '_id': org['id']}, upsert=True)

    def org_remove(self, org_id):
        self.orgs.delete_one({'_id': org_id})

    # ---------- demo requests (the public website) ----------

    def lead_add(self, lead):
        self.leads.insert_one({**lead, '_id': lead['id']})
        if self.leads.count_documents({}) > 2000:  # keep the list small
            old = [d['_id'] for d in self.leads.find({}, {'_id': 1}).sort('createdAt', ASCENDING).limit(200)]
            self.leads.delete_many({'_id': {'$in': old}})

    def lead_list(self, limit=200):
        return [clean(d) for d in self.leads.find({}).sort('createdAt', -1).limit(limit)]

    def lead_remove(self, lead_id):
        return self.leads.delete_one({'_id': lead_id}).deleted_count

    def org_active_list(self):
        return [o for o in self.org_list() if o.get('status') == 'active']

    def drop_org_data(self):
        """Deletes everything of this coaching (never the first one or the platform)."""
        if self.org in (DEFAULT_ORG, PLATFORM_ORG):
            raise ValueError('This coaching cannot be deleted.')
        for col in [self.meta, self.audit_col, self.photos, self.backups, *self.lists.values()]:
            col.drop()
        self.users.delete_many({'orgId': self.org})
        self._tenants.pop(self.org, None)

    def migrate_to_coachings(self):
        """Data from before the coachings existed: accounts get the first coaching, which gets a record."""
        self.users.update_many(
            {'orgId': {'$exists': False}, 'role': {'$ne': 'super'}}, {'$set': {'orgId': DEFAULT_ORG}}
        )
        default = self.for_org(DEFAULT_ORG)
        # a database that never had data of its own (only super admins and new coachings) has no first coaching
        if default.user_count() > 0 or default.profile() is not None:
            self.ensure_default_org()

    def ensure_default_org(self):
        """The first coaching (the plain collections). Created when the first principal is set up, or for old data."""
        if self.org_get(DEFAULT_ORG) is None:
            profile = self.for_org(DEFAULT_ORG).profile() or {}
            self.org_save(
                {
                    'id': DEFAULT_ORG,
                    'name': str(profile.get('name') or 'My Coaching'),
                    'city': '',
                    'status': 'active',
                    'createdAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
                }
            )

    def _ensure_indexes(self):
        try:
            self.users.create_index('email', unique=True)
            self.sessions.create_index('expiresAt', expireAfterSeconds=0)
            self.audit_col.create_index('at')
            self.sessions.create_index('userId')
        except PyMongoError as err:  # a read-only account can still run the server
            print('Could not create indexes:', err)

    # ---------- version ----------

    def version(self):
        doc = self.meta.find_one({'_id': 'version'})
        return doc['value'] if doc else 0

    def bump(self):
        """Something other clients must see changed (accounts or institute data)."""
        doc = self.meta.find_one_and_update(
            {'_id': 'version'}, {'$inc': {'value': 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        return doc['value']

    # ---------- accounts ----------

    def users_all(self):
        return [clean(d) for d in self.users.find({'orgId': self.org}).sort('createdAt', ASCENDING)]

    def user_count(self):
        return self.users.count_documents({'orgId': self.org})

    def admin_count(self):
        return self.users.count_documents({'orgId': self.org, 'role': 'admin'})

    def user_by_id(self, user_id):
        """An account of THIS coaching (another coaching's account is never found)."""
        return clean(self.users.find_one({'_id': user_id, 'orgId': self.org}))

    def user_by_id_any(self, user_id):
        """An account of any coaching (to find out who a session belongs to)."""
        return clean(self.users.find_one({'_id': user_id}))

    def user_by_email(self, email):
        """Emails are unique over all coachings, so everybody signs in with the email only."""
        return clean(self.users.find_one({'email': email}))

    def user_by_student(self, student_id, parent=False):
        """The student's own login (parent=False) or the parent's login (parent=True) of a student record."""
        flag = True if parent else {'$ne': True}
        return clean(self.users.find_one({'studentId': student_id, 'orgId': self.org, 'isParent': flag}))

    def add_user(self, user):
        user['orgId'] = self.org
        self.users.insert_one({**user, '_id': user['id']})

    def save_user(self, user):
        self.users.replace_one({'_id': user['id']}, {**user, '_id': user['id']})

    def remove_user(self, user_id):
        self.users.delete_one({'_id': user_id, 'orgId': self.org})

    # ---------- sessions ----------

    def add_session(self, token_hash, user_id, lifetime_sec):
        now = _now_naive_utc()
        self.sessions.insert_one(
            {'_id': token_hash, 'userId': user_id, 'createdAt': now, 'expiresAt': now + timedelta(seconds=lifetime_sec)}
        )

    def get_session(self, token_hash):
        return self.sessions.find_one({'_id': token_hash})

    def session_expired(self, session):
        return session['expiresAt'] <= _now_naive_utc()

    def delete_session(self, token_hash):
        self.sessions.delete_one({'_id': token_hash})

    def delete_sessions_of(self, user_id, keep_hash=None):
        query = {'userId': user_id}
        if keep_hash:
            query['_id'] = {'$ne': keep_hash}
        self.sessions.delete_many(query)

    # ---------- activity log ----------

    def audit(self, user, action, detail=''):
        self.audit_col.insert_one(
            {
                'at': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
                'userId': user['id'] if user else None,
                'name': user['name'] if user else None,
                'action': action,
                'detail': str(detail)[:300],
            }
        )
        if random.random() < 0.02:  # now and then remove the oldest entries
            extra = self.audit_col.count_documents({}) - MAX_AUDIT
            if extra > 0:
                old = [d['_id'] for d in self.audit_col.find({}, {'_id': 1}).sort('at', ASCENDING).limit(extra)]
                self.audit_col.delete_many({'_id': {'$in': old}})

    def audit_recent(self, limit):
        docs = self.audit_col.find({}).sort('at', -1).limit(limit)
        return [{k: v for k, v in d.items() if k != '_id'} for d in docs]

    # ---------- institute data ----------

    def present(self):
        """Names of the lists that were ever written. A list that is not there yet lets the first
        principal's browser add the starting data."""
        doc = self.meta.find_one({'_id': 'present'})
        return set(doc['names']) if doc else set()

    def mark_present(self, names):
        names = list(names)
        if names:
            self.meta.update_one({'_id': 'present'}, {'$addToSet': {'names': {'$each': names}}}, upsert=True)

    def profile(self):
        doc = self.meta.find_one({'_id': 'profile'})
        return doc['value'] if doc else None

    def set_profile(self, value):
        self.meta.replace_one({'_id': 'profile'}, {'_id': 'profile', 'value': value}, upsert=True)

    def find(self, name, query=None):
        cursor = self.lists[name].find(query or {}).sort('_pos', ASCENDING)
        return [clean(d) for d in cursor]

    def get_item(self, name, item_id):
        return clean(self.lists[name].find_one({'_id': item_id}))

    def get_many(self, name, ids):
        ids = list(ids)
        if not ids:
            return {}
        return {d['_id']: clean(d) for d in self.lists[name].find({'_id': {'$in': ids}})}

    def field_values(self, name, field):
        """{ record id: value of one field } for the whole list."""
        return {d['_id']: d.get(field) for d in self.lists[name].find({}, {field: 1})}

    @staticmethod
    def _write(col, replaces, delete_ids):
        """Saves records in one round trip. replaces: [(id, document)], delete_ids: [id]."""
        if isinstance(col, MongoCollection):
            ops = [ReplaceOne({'_id': i}, d, upsert=True) for i, d in replaces]
            if delete_ids:
                ops.append(DeleteMany({'_id': {'$in': delete_ids}}))
            if ops:
                col.bulk_write(ops, ordered=True)
        else:  # the in-memory database used by the tests
            for i, d in replaces:
                col.replace_one({'_id': i}, d, upsert=True)
            if delete_ids:
                col.delete_many({'_id': {'$in': delete_ids}})

    def apply_list(self, name, upserts, removes):
        """Adds / replaces / removes records by id. New records keep the order they were sent in.
        Returns (added, updated, removed)."""
        col = self.lists[name]

        latest = {}  # a record sent twice: the last one wins
        for item in upserts:
            latest[item['id']] = item
        ids = list(latest)

        existing = {d['_id']: d.get('_pos', 0) for d in col.find({'_id': {'$in': ids}}, {'_pos': 1})} if ids else {}
        new_ids = []
        seen = set()
        for item in upserts:  # new records, in the order they were sent
            if item['id'] not in existing and item['id'] not in seen:
                new_ids.append(item['id'])
                seen.add(item['id'])

        if name in NEWEST_FIRST:
            first = col.find_one({}, sort=[('_pos', 1)])
            start = first['_pos'] - len(new_ids) if first else 0
        else:
            last = col.find_one({}, sort=[('_pos', -1)])
            start = last['_pos'] + 1 if last else 0
        position = {item_id: start + i for i, item_id in enumerate(new_ids)}

        remove_ids = list(removes)
        removed = col.count_documents({'_id': {'$in': remove_ids}}) if remove_ids else 0

        replaces = []
        for item_id, item in latest.items():
            pos = existing.get(item_id, position.get(item_id, 0))
            replaces.append((item_id, {**item, '_id': item_id, '_pos': pos}))
        self._write(col, replaces, remove_ids)

        self.mark_present([name])
        return len(new_ids), len(existing), removed

    def replace_list(self, name, items):
        """Replaces a whole list, keeping the order of `items` (used when importing old data)."""
        col = self.lists[name]
        col.delete_many({})
        self._write(col, [(it['id'], {**it, '_id': it['id'], '_pos': i}) for i, it in enumerate(items)], [])
        self.mark_present([name])

    def set_field(self, name, item_id, field, value):
        self.lists[name].update_one({'_id': item_id}, {'$set': {field: value}})

    def inc_field(self, name, item_id, field, amount):
        self.lists[name].update_one({'_id': item_id}, {'$inc': {field: amount}})

    # ---------- photos ----------

    def save_photo(self, student_id, content_type, data):
        """Stores a student photo. Returns the token that makes the photo address (a new photo = a new address)."""
        token = secrets.token_urlsafe(12)
        self.photos.replace_one(
            {'_id': student_id},
            {'_id': student_id, 'contentType': content_type, 'data': bytes(data), 'token': token},
            upsert=True,
        )
        return token

    def photo_url(self, student_id, token):
        """Address of a student photo. The address says which coaching it belongs to."""
        base = f'/api/photos/{student_id}/{token}'
        return base if self.org == DEFAULT_ORG else f'{base}?o={self.org}'

    def get_photo(self, student_id):
        return self.photos.find_one({'_id': student_id})

    def delete_photos(self, student_ids):
        ids = list(student_ids)
        if ids:
            self.photos.delete_many({'_id': {'$in': ids}})

    # ---------- backups ----------

    def export_data(self, accounts=True, photos=True):
        """Everything as one JSON-ready dict (used by the backup download and the automatic snapshots)."""
        institute = {}
        profile = self.profile()
        if profile is not None:
            institute['profile'] = profile
        present = self.present()
        for name in LISTS:
            if name in present:
                institute[name] = self.find(name)
        out = {
            'format': 'academiaos-backup',
            'version': 1,
            'exportedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
            'institute': institute,
        }
        if accounts:
            out['users'] = self.users_all()  # with the password hashes, so accounts can be restored
        if photos:
            out['photos'] = [
                {
                    'id': d['_id'],
                    'contentType': d.get('contentType', 'image/jpeg'),
                    'token': d.get('token'),
                    'data': base64.b64encode(d['data']).decode('ascii'),
                }
                for d in self.photos.find({})
            ]
        return out

    def restore_data(self, payload, accounts=True):
        """Puts a backup back. The lists in the backup replace the current ones; accounts of the backup that do
        not exist yet are added (nobody is removed, so the principal cannot be locked out).
        Returns a short report."""
        institute = payload.get('institute') if isinstance(payload, dict) else None
        if not isinstance(institute, dict):
            raise ValueError('This is not an AcademiaOS backup file.')

        report = {'lists': {}, 'accounts_added': 0, 'photos': 0}
        if isinstance(institute.get('profile'), dict):
            self.set_profile(institute['profile'])
        for name in LISTS:
            items = institute.get(name)
            if isinstance(items, list):
                items = [i for i in items if isinstance(i, dict) and isinstance(i.get('id'), str) and i['id']]
                self.replace_list(name, items)
                report['lists'][name] = len(items)

        if isinstance(payload.get('photos'), list):
            self.photos.delete_many({})
            for p in payload['photos']:
                try:
                    data = base64.b64decode(p['data'], validate=True)
                except (KeyError, ValueError, TypeError):
                    continue
                self.photos.replace_one(
                    {'_id': p['id']},
                    {'_id': p['id'], 'contentType': p.get('contentType', 'image/jpeg'), 'data': data, 'token': p.get('token') or secrets.token_urlsafe(12)},
                    upsert=True,
                )
                report['photos'] += 1

        if accounts and isinstance(payload.get('users'), list):
            for user in payload['users']:
                if not isinstance(user, dict) or not user.get('id') or not user.get('email'):
                    continue
                user = {k: v for k, v in user.items() if k != '_id'}
                if self.user_by_email(user['email']) or self.user_by_id(user['id']):
                    continue
                user.setdefault('status', 'active')
                self.add_user(user)
                report['accounts_added'] += 1
        self.bump()
        return report

    def snapshot(self, label='automatic'):
        """Saves a compressed copy of the data (without photos, which stay where they are).
        Returns the snapshot's id, or None when it is too big for one document."""
        raw = json.dumps(self.export_data(accounts=True, photos=False), separators=(',', ':')).encode('utf-8')
        packed = zlib.compress(raw, 6)
        if len(packed) > MAX_BACKUP_BYTES:
            return None
        now = datetime.now(timezone.utc)
        snapshot_id = now.strftime('%Y%m%d-%H%M%S') + '-' + secrets.token_hex(2)  # two in one second must not clash
        self.backups.insert_one(
            {
                '_id': snapshot_id,
                'createdAt': now.replace(tzinfo=None),
                'label': label,
                'size': len(raw),
                'payload': packed,
            }
        )
        self.prune_backups()
        return snapshot_id

    def prune_backups(self, keep=14):
        old = [d['_id'] for d in self.backups.find({}, {'_id': 1}).sort('createdAt', -1).skip(keep)]
        if old:
            self.backups.delete_many({'_id': {'$in': old}})

    def list_backups(self):
        docs = self.backups.find({}, {'payload': 0}).sort('createdAt', -1)
        return [
            {'id': d['_id'], 'createdAt': d['createdAt'].isoformat(timespec='seconds') + 'Z', 'label': d.get('label', ''), 'size': d.get('size', 0)}
            for d in docs
        ]

    def get_backup(self, backup_id):
        doc = self.backups.find_one({'_id': backup_id})
        if not doc:
            return None
        return json.loads(zlib.decompress(doc['payload']).decode('utf-8'))

    def latest_backup_time(self, label='automatic'):
        doc = self.backups.find_one({'label': label}, sort=[('createdAt', -1)])
        return doc['createdAt'] if doc else None

    def move_inline_photos(self):
        """Older data keeps photos inside the student records (data URLs). Moves them to the photos collection.
        Returns how many were moved."""
        from .scope import parse_photo_data_url

        col = self.lists['students']
        moved = 0
        for doc in list(col.find({'photoUrl': {'$regex': '^data:'}})):
            try:
                content_type, data = parse_photo_data_url(doc['photoUrl'])
            except Exception:  # a photo that cannot be read stays as it is
                continue
            token = self.save_photo(doc['_id'], content_type, data)
            col.update_one({'_id': doc['_id']}, {'$set': {'photoUrl': self.photo_url(doc['_id'], token)}})
            moved += 1
        if moved:
            self.bump()
        return moved
