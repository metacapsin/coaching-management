"""Everything that is stored in MongoDB.

Collections (in the database named by MONGODB_DB):
  users        one document per account (_id = account id)
  sessions     one document per signed-in session (_id = hash of the token); old ones are removed automatically
  meta         "version" (counts every change), "profile" (institute profile), "present" (which lists exist)
  audit        the activity log
  courses, batches, students, attendance, transactions, exams, timetable, templates, notificationLogs
               one document per record (_id = record id); "_pos" keeps the order of the list
"""

import random
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
]

# The app shows the newest first for these lists
NEWEST_FIRST = {'students', 'attendance', 'transactions', 'exams', 'notificationLogs'}

MAX_AUDIT = 3000


def _now_naive_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def clean(doc):
    """A stored document without MongoDB's own fields."""
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k not in ('_id', '_pos')}


class Store:
    def __init__(self, db):
        self.db = db
        self.users = db['users']
        self.sessions = db['sessions']
        self.meta = db['meta']
        self.audit_col = db['audit']
        self.lists = {name: db[name] for name in LISTS}
        self._ensure_indexes()

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
        return [clean(d) for d in self.users.find({}).sort('createdAt', ASCENDING)]

    def user_count(self):
        return self.users.count_documents({})

    def admin_count(self):
        return self.users.count_documents({'role': 'admin'})

    def user_by_id(self, user_id):
        return clean(self.users.find_one({'_id': user_id}))

    def user_by_email(self, email):
        return clean(self.users.find_one({'email': email}))

    def user_by_student(self, student_id):
        return clean(self.users.find_one({'studentId': student_id}))

    def add_user(self, user):
        self.users.insert_one({**user, '_id': user['id']})

    def save_user(self, user):
        self.users.replace_one({'_id': user['id']}, {**user, '_id': user['id']})

    def remove_user(self, user_id):
        self.users.delete_one({'_id': user_id})

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
