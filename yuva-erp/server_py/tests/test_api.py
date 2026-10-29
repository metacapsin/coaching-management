"""Run with:  python -m unittest discover -s tests -v     (from the server_py folder)

Uses the real Flask app with an in-memory MongoDB (mongomock), and calls it like the app does."""

import hashlib
import json
import os
import secrets
import unittest

import mongomock

from academia import create_app
from academia.auth import basic_hash, hash_password
from academia.legacy import import_legacy
from academia.store import Store

PASSWORD = 'Passw0rd123'


def new_db():
    """An in-memory database. With ACADEMIA_TEST_REAL=1 the tests run on the real MongoDB from server_py/.env
    in a temporary database (named academiaos_test_...), which is deleted afterwards."""
    if os.environ.get('ACADEMIA_TEST_REAL') == '1':
        from pymongo import MongoClient

        from academia.config import settings

        client = MongoClient(settings()['mongodb_uri'], serverSelectionTimeoutMS=15000)
        return client[f'academiaos_test_{secrets.token_hex(4)}']
    return mongomock.MongoClient()[f'academia_test_{secrets.token_hex(4)}']


def drop_db(db):
    db.client.drop_database(db.name)


class Api:
    def __init__(self, app):
        self.client = app.test_client()

    def call(self, method, url, body=None, token=None, headers=None):
        h = dict(headers or {})
        if token:
            h['Authorization'] = f'Bearer {token}'
        res = self.client.open(url, method=method, json=body, headers=h)
        return res.status_code, (res.get_json(silent=True) or {})


# ---------- sample institute data ----------


def batch(bid, code, name, capacity, enrolled):
    return {
        'id': bid, 'code': code, 'name': name, 'courseId': 'c1', 'courseName': 'JEE', 'subjects': [],
        'facultyName': 'secret faculty', 'classroom': 'r1', 'scheduleDays': ['Mon'], 'startTime': '04:00 PM',
        'endTime': '05:00 PM', 'maxCapacity': capacity, 'enrolledCount': enrolled, 'status': 'ongoing',
    }


def student(sid, roll, name, batch_id, phone):
    return {
        'id': sid, 'rollNo': roll, 'name': name, 'email': f'{sid}@x.com', 'phone': phone, 'parentName': 'P',
        'parentPhone': phone, 'grade': 'Class 12', 'courseId': 'c1', 'batchId': batch_id, 'targetExam': 'JEE',
        'dateOfAdmission': '2026-01-01', 'status': 'active', 'photoUrl': '', 'address': '', 'totalFees': 1000,
        'discount': 0, 'feePaid': 500,
    }


BATCHES = [batch('b1', 'A', 'Batch A', 2, 2), batch('b2', 'B', 'Batch B', 30, 1)]
STUDENTS = [
    student('s1', '01', 'Alice', 'b1', '+91 98000 00001'),
    student('s2', '02', 'Bob', 'b1', '+91 98000 00002'),
    student('s3', '03', 'Carol', 'b2', '+91 98000 00003'),
]
EXAM = {
    'id': 'e1', 'code': 'T1', 'title': 'Test 1', 'batchId': 'b1', 'batchName': 'Batch A', 'subject': 'Maths',
    'date': '2026-02-01', 'maxMarks': 100, 'passMarks': 35, 'status': 'published', 'syllabusTopics': [],
    'results': {'s1': {'marksObtained': 90}, 's2': {'marksObtained': 60}},
}
COURSE = {'id': 'c1', 'code': 'J', 'name': 'JEE', 'category': 'Engineering', 'duration': '1y', 'standardFee': 1000, 'description': ''}
SEED = {
    'profile': {'name': 'Test Institute'},
    'courses': {'upsert': [COURSE]},
    'batches': {'upsert': BATCHES},
    'students': {'upsert': STUDENTS},
    'attendance': {'upsert': [{'id': 'att1', 'date': '2026-02-01', 'batchId': 'b1', 'records': {'s1': 'present', 's2': 'absent'}, 'markedBy': 'x', 'updatedAt': ''}]},
    'transactions': {'upsert': [{'id': 'tx1', 'receiptNo': 'REC-2026-0001', 'studentId': 's1', 'studentName': 'Alice', 'studentRollNo': '01', 'batchName': 'Batch A', 'amount': 500, 'paymentMethod': 'Cash', 'date': '2026-01-02', 'installmentNo': 1}]},
    'exams': {'upsert': [EXAM]},
    'timetable': {'upsert': []},
    'templates': {'upsert': []},
    'notificationLogs': {'upsert': [{'id': 'l1', 'timestamp': '', 'type': 'fee_due', 'channel': 'whatsapp', 'recipientName': 'P', 'recipientPhone': '1', 'studentName': 'Alice', 'studentId': 's1', 'content': 'hi', 'status': 'delivered'}]},
}


class Flow(unittest.TestCase):
    """The tests run in order (01, 02, ...) and build on each other, like a real day at the institute."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        cls.tokens = {}

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def test_00_security_headers(self):
        res = self.api.client.get('/api/health')
        self.assertEqual(res.headers['X-Frame-Options'], 'DENY')
        self.assertEqual(res.headers['X-Content-Type-Options'], 'nosniff')

    def test_01_setup_creates_the_principal_once(self):
        self.assertEqual(self.call('GET', '/api/auth/status')[1]['hasUsers'], False)
        self.assertEqual(self.call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': 'short'})[0], 400)
        status, data = self.call('POST', '/api/auth/setup', {'name': 'Principal', 'email': 'P@X.com', 'password': PASSWORD})
        self.assertEqual(status, 200)
        self.assertEqual(data['user']['role'], 'admin')
        self.assertEqual(data['user']['email'], 'p@x.com')
        self.tokens['admin'] = data['token']
        self.assertEqual(self.call('POST', '/api/auth/setup', {'name': 'Evil', 'email': 'e@x.com', 'password': PASSWORD})[0], 409)
        self.assertEqual(self.call('GET', '/api/auth/status')[1]['hasUsers'], True)

    def test_02_data_needs_a_session_and_hides_passwords(self):
        self.assertEqual(self.call('GET', '/api/sync')[0], 401)
        self.assertEqual(self.call('GET', '/api/sync', token='nonsense')[0], 401)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {}})[0], 401)
        status, data = self.call('GET', '/api/sync', token=self.tokens['admin'])
        self.assertEqual(status, 200)
        text = json.dumps(data)
        self.assertNotIn('passwordHash', text)
        self.assertNotIn('salt', text)
        self.assertEqual(self.call('GET', f'/api/sync?since={data["version"]}', token=self.tokens['admin'])[1]['changed'], False)

    def test_03_login_rules_and_throttling(self):
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': 'Wrong1234', 'portal': 'admin'})[0], 401)
        status, data = self.call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': PASSWORD, 'portal': 'student'})
        self.assertEqual(status, 403)
        self.assertIn('Coaching Admin', data['error'])
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': PASSWORD, 'portal': 'admin'})[0], 200)

        for _ in range(5):
            self.call('POST', '/api/auth/login', {'email': 'nobody@x.com', 'password': 'Wrong1234', 'portal': 'admin'})
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'nobody@x.com', 'password': 'Wrong1234', 'portal': 'admin'})[0], 429)
        # behind a proxy on this computer every caller has its own address: another address is not locked
        other = self.call('POST', '/api/auth/login', {'email': 'nobody@x.com', 'password': 'Wrong1234', 'portal': 'admin'},
                          headers={'X-Forwarded-For': '203.0.113.9'})
        self.assertEqual(other[0], 401)
        # the real password is also refused for that email while it is locked
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'nobody@x.com', 'password': PASSWORD, 'portal': 'admin'})[0], 429)

    def test_04_principal_saves_and_reads_the_institute(self):
        admin = self.tokens['admin']
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': SEED}, admin)[0], 200)
        data = self.call('GET', '/api/sync', token=admin)[1]['institute']
        self.assertEqual([s['id'] for s in data['students']], ['s1', 's2', 's3'])  # order is kept
        self.assertEqual(data['profile']['name'], 'Test Institute')
        self.assertEqual(len(data['courses']), 1)
        self.assertEqual(data['timetable'], [])  # an empty list that exists is sent as empty
        # update one record and remove another without touching the rest
        self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [{**STUDENTS[0], 'name': 'Alice B'}], 'remove': ['s3']}}}, admin)
        after = self.call('GET', '/api/sync', token=admin)[1]['institute']['students']
        self.assertEqual([s['name'] for s in after], ['Alice B', 'Bob'])
        self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': STUDENTS}}}, admin)
        self.assertEqual(len(self.call('GET', '/api/sync', token=admin)[1]['institute']['students']), 3)
        # bad input
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'hackers': {}}}, admin)[0], 400)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [{'name': 'no id'}]}}}, admin)[0], 400)

    def test_05_new_records_are_put_in_front_in_the_order_sent(self):
        admin = self.tokens['admin']
        new = [student('s-n2', '07', 'N2', 'b2', '+91 98000 00072'), student('s-n1', '06', 'N1', 'b2', '+91 98000 00071')]
        self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': new}}}, admin)
        rolls = [s['id'] for s in self.call('GET', '/api/sync', token=admin)[1]['institute']['students']]
        # (s3 was removed and added again in the test before, so it counts as the newest of the old ones)
        self.assertEqual(rolls, ['s-n2', 's-n1', 's3', 's1', 's2'])
        self.call('PUT', '/api/institute', {'changes': {'students': {'remove': ['s-n1', 's-n2']}}}, admin)
        # lists that are added at the end (batches) keep that order
        self.call('PUT', '/api/institute', {'changes': {'batches': {'upsert': [batch('b3', 'C', 'Batch C', 5, 0)]}}}, admin)
        ids = [b['id'] for b in self.call('GET', '/api/sync', token=admin)[1]['institute']['batches']]
        self.assertEqual(ids, ['b1', 'b2', 'b3'])
        self.call('PUT', '/api/institute', {'changes': {'batches': {'remove': ['b3']}}}, admin)

    def test_06_same_roll_or_receipt_number_is_renumbered(self):
        admin = self.tokens['admin']
        status, data = self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [student('s-clash', '03', 'Clash', 'b2', '+91 98000 00099')]}}}, admin)
        self.assertEqual(status, 200)
        self.assertEqual(data['adjusted'], 1)  # the browser is told, so it fetches the new number
        students = self.call('GET', '/api/sync', token=admin)[1]['institute']['students']
        rolls = [s['rollNo'] for s in students]
        self.assertEqual(len(set(rolls)), len(rolls))
        self.assertEqual(next(s for s in students if s['id'] == 's3')['rollNo'], '03')  # the first one keeps its number
        self.assertEqual(next(s for s in students if s['id'] == 's-clash')['rollNo'], '04')
        self.call('PUT', '/api/institute', {'changes': {'students': {'remove': ['s-clash']}}}, admin)

        tx = {'id': 'tx-clash', 'receiptNo': 'REC-2026-0001', 'studentId': 's2', 'studentName': 'Bob', 'studentRollNo': '02',
              'batchName': 'Batch A', 'amount': 100, 'paymentMethod': 'Cash', 'date': '2026-01-03', 'installmentNo': 1}
        self.call('PUT', '/api/institute', {'changes': {'transactions': {'upsert': [tx]}}}, admin)
        txs = self.call('GET', '/api/sync', token=admin)[1]['institute']['transactions']
        self.assertEqual(next(t for t in txs if t['id'] == 'tx-clash')['receiptNo'], 'REC-2026-0002')
        self.call('PUT', '/api/institute', {'changes': {'transactions': {'remove': ['tx-clash']}}}, admin)

    def test_07_teacher_sees_and_changes_only_own_batches(self):
        admin = self.tokens['admin']
        self.assertEqual(self.call('POST', '/api/auth/register-teacher',
                                   {'name': 'Tina', 'phone': '9800000010', 'subject': 'Maths', 'email': 't@x.com', 'password': PASSWORD})[0], 200)
        status, data = self.call('POST', '/api/auth/login', {'email': 't@x.com', 'password': PASSWORD, 'portal': 'teacher'})
        self.assertEqual(status, 403)
        self.assertIn('approval', data['error'])

        users = self.call('GET', '/api/sync', token=admin)[1]['users']
        teacher_id = next(u for u in users if u['email'] == 't@x.com')['id']
        type(self).teacher_id = teacher_id
        self.assertEqual(self.call('POST', f'/api/users/{teacher_id}/approve', {'batchIds': ['b1']}, admin)[0], 200)

        status, data = self.call('POST', '/api/auth/login', {'email': 't@x.com', 'password': PASSWORD, 'portal': 'teacher'})
        self.assertEqual(status, 200)
        teacher = data['token']
        self.tokens['teacher'] = teacher

        data = self.call('GET', '/api/sync', token=teacher)[1]
        self.assertNotIn('users', data)
        self.assertEqual([b['id'] for b in data['institute']['batches']], ['b1'])
        self.assertEqual(sorted(s['id'] for s in data['institute']['students']), ['s1', 's2'])
        self.assertEqual(data['institute']['transactions'], [])
        self.assertEqual(data['institute']['notificationLogs'], [])

        att = lambda i, b: {'changes': {'attendance': {'upsert': [{'id': i, 'date': '2026-02-02', 'batchId': b, 'records': {'s1': 'present'}, 'markedBy': 't', 'updatedAt': ''}]}}}
        self.assertEqual(self.call('PUT', '/api/institute', att('att2', 'b1'), teacher)[0], 200)
        self.assertEqual(self.call('PUT', '/api/institute', att('att3', 'b2'), teacher)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [{**STUDENTS[0], 'feePaid': 0}]}}}, teacher)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'profile': {'name': 'Mine'}}}, teacher)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'attendance': {'remove': ['att1']}}}, teacher)[0], 403)

        hacked = {**EXAM, 'title': 'Hacked', 'results': {'s1': {'marksObtained': 95}, 's2': {'marksObtained': 60}}}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'exams': {'upsert': [hacked]}}}, teacher)[0], 200)
        exams = self.call('GET', '/api/sync', token=admin)[1]['institute']['exams']
        self.assertEqual(exams[0]['title'], 'Test 1')  # only marks and status changed
        self.assertEqual(exams[0]['results']['s1']['marksObtained'], 95)
        self.assertEqual(len(self.call('GET', '/api/sync', token=admin)[1]['institute']['students']), 3)
        self.assertEqual(self.call('GET', '/api/audit', token=teacher)[0], 403)
        self.assertEqual(self.call('POST', '/api/users', {}, teacher)[0], 403)

    def test_08_student_sees_only_own_data_with_rank(self):
        admin = self.tokens['admin']
        status, _ = self.call('POST', '/api/users', {'name': 'Alice B', 'email': 'alice@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}, admin)
        self.assertEqual(status, 200)
        self.assertEqual(self.call('POST', '/api/users', {'name': 'Dup', 'email': 'dup@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}, admin)[0], 409)

        status, data = self.call('POST', '/api/auth/login', {'email': 'alice@x.com', 'password': PASSWORD, 'portal': 'student'})
        self.assertEqual(status, 200)
        token = data['token']
        self.tokens['student'] = token

        data = self.call('GET', '/api/sync', token=token)[1]
        inst = data['institute']
        self.assertEqual([s['id'] for s in inst['students']], ['s1'])
        self.assertEqual(len(inst['transactions']), 1)
        self.assertEqual([log['id'] for log in inst['notificationLogs']], ['l1'])
        e = inst['exams'][0]
        self.assertEqual(list(e['results']), ['s1'])
        self.assertEqual(e['results']['s1']['rank'], 1)
        self.assertEqual(e['results']['s1']['totalGraded'], 2)
        self.assertEqual(e['results']['s1']['highest'], 95)
        self.assertNotIn('Bob', json.dumps(data))  # a classmate's name is not sent
        self.assertEqual(inst['attendance'][0]['records'], {'s1': 'present'})
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [{**STUDENTS[0], 'feePaid': 1000}]}}}, token)[0], 403)

    def test_09_public_registration(self):
        status, options = self.call('GET', '/api/public/registration-options')
        self.assertEqual(len(options['courses']), 1)
        self.assertIsNone(options['batches'][0].get('facultyName'))  # faculty and room are not public
        self.assertIsNone(options['courses'][0].get('standardFee'))
        b1 = next(b for b in options['batches'] if b['id'] == 'b1')
        self.assertEqual(b1['filled'], 2)
        self.assertEqual(options['nextRollNo'], '04')

        form = {'name': 'New Kid', 'phone': '9811111111', 'parentName': 'Parent', 'parentPhone': '9822222222', 'grade': 'Class 12',
                'courseId': 'c1', 'batchId': 'b2', 'email': 'kid@x.com', 'password': PASSWORD}
        self.assertEqual(self.call('POST', '/api/auth/register-new-student', {**form, 'batchId': 'b1'})[0], 409)  # b1 is full
        status, res = self.call('POST', '/api/auth/register-new-student', form)
        self.assertEqual(status, 200)
        self.assertEqual(res['user']['role'], 'student')
        mine = self.call('GET', '/api/sync', token=res['token'])[1]['institute']['students'][0]
        self.assertEqual(mine['rollNo'], '04')
        self.assertEqual(mine['status'], 'trial')
        self.assertEqual(mine['phone'], '+91 98111 11111')  # stored in one format
        self.assertEqual(self.call('POST', '/api/auth/register-new-student', {**form, 'email': 'kid2@x.com'})[0], 409)  # same name + phone
        batches = self.call('GET', '/api/sync', token=self.tokens['admin'])[1]['institute']['batches']
        self.assertEqual(next(b for b in batches if b['id'] == 'b2')['enrolledCount'], 2)

        bad = self.call('POST', '/api/auth/register-student', {'rollNo': '02', 'phone': '9999999999', 'email': 'bob@x.com', 'password': PASSWORD})
        self.assertEqual(bad[0], 400)
        status, good = self.call('POST', '/api/auth/register-student', {'rollNo': ' 2 ', 'phone': '98000 00002', 'email': 'bob@x.com', 'password': PASSWORD})
        self.assertEqual(status, 200)
        self.assertEqual(good['user']['name'], 'Bob')

    def test_10_passwords_change_reset_and_sign_out_everywhere(self):
        admin, student_token = self.tokens['admin'], self.tokens['student']
        second = self.call('POST', '/api/auth/login', {'email': 'alice@x.com', 'password': PASSWORD, 'portal': 'student'})[1]['token']
        wrong = self.call('POST', '/api/auth/change-password', {'currentPassword': 'Nope12345', 'newPassword': 'Another123'}, student_token)
        self.assertEqual(wrong[0], 400)
        self.assertEqual(self.call('POST', '/api/auth/change-password', {'currentPassword': PASSWORD, 'newPassword': 'Another123'}, student_token)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=student_token)[0], 200)  # this device stays signed in
        self.assertEqual(self.call('GET', '/api/auth/me', token=second)[0], 401)  # the other one does not
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'alice@x.com', 'password': PASSWORD, 'portal': 'student'})[0], 401)
        self.assertEqual(self.call('POST', '/api/auth/login', {'email': 'alice@x.com', 'password': 'Another123', 'portal': 'student'})[0], 200)

        # forgot password: same answer for known and unknown emails, the principal sees the request
        self.assertEqual(self.call('POST', '/api/auth/forgot-password', {'email': 'nobody@x.com'}), (200, {'ok': True}))
        self.assertEqual(self.call('POST', '/api/auth/forgot-password', {'email': 'ALICE@x.com'}), (200, {'ok': True}))
        users = self.call('GET', '/api/sync', token=admin)[1]['users']
        alice = next(u for u in users if u['email'] == 'alice@x.com')
        self.assertTrue(alice.get('resetRequestedAt'))
        self.assertEqual(self.call('POST', f'/api/users/{alice["id"]}/reset-password', {'newPassword': 'weak'}, admin)[0], 400)
        self.assertEqual(self.call('POST', f'/api/users/{alice["id"]}/reset-password', {'newPassword': 'Reset12345'}, admin)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=student_token)[0], 401)  # reset signs the account out
        users = self.call('GET', '/api/sync', token=admin)[1]['users']
        self.assertFalse(next(u for u in users if u['email'] == 'alice@x.com').get('resetRequestedAt'))

    def test_11_principal_rules(self):
        admin, teacher = self.tokens['admin'], self.tokens['teacher']
        me = self.call('GET', '/api/auth/me', token=admin)[1]['user']
        self.assertEqual(self.call('DELETE', f'/api/users/{me["id"]}', token=admin)[0], 400)
        self.assertEqual(self.call('PUT', f'/api/users/{me["id"]}/role', {'role': 'staff'}, admin)[0], 400)
        self.assertEqual(self.call('PUT', f'/api/users/{self.teacher_id}/role', {'role': 'staff'}, admin)[0], 400)

        self.assertEqual(self.call('GET', '/api/auth/me', token=teacher)[0], 200)
        self.assertEqual(self.call('DELETE', f'/api/users/{self.teacher_id}', token=admin)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=teacher)[0], 401)

        log = self.call('GET', '/api/audit', token=admin)[1]['entries']
        actions = [e['action'] for e in log]
        self.assertIn('login', actions)
        self.assertIn('user-remove', actions)
        self.assertTrue(any(e['action'] == 'data' and 'students' in e['detail'] for e in log))

    def test_12_sign_out_ends_the_session(self):
        token = self.call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': PASSWORD, 'portal': 'admin', 'remember': False})[1]['token']
        self.assertEqual(self.call('POST', '/api/auth/logout', token=token)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=token)[0], 401)

    def test_13_everything_survives_a_restart(self):
        api = Api(create_app(db=self.db, dist_dir='no-dist'))  # a new server on the same database
        status, data = api.call('GET', '/api/sync', token=self.tokens['admin'])
        self.assertEqual(status, 200)
        self.assertEqual(len(data['institute']['students']), 4)
        self.assertGreaterEqual(len(data['users']), 3)


class Robustness(unittest.TestCase):
    def setUp(self):
        self.db = new_db()
        self.addCleanup(drop_db, self.db)
        self.app = create_app(db=self.db, dist_dir='no-dist')
        self.api = Api(self.app)
        _, data = self.api.call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})
        self.admin = data['token']

    def test_ids_must_be_text(self):
        """An object where an id is expected (for example {"$ne": null}) is refused, not used in a query."""
        body = {'name': 'S', 'email': 's@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': {'$ne': None}}
        self.assertEqual(self.api.call('POST', '/api/users', body, self.admin)[0], 400)

    def test_database_problem_is_a_clear_503(self):
        from pymongo.errors import ServerSelectionTimeoutError

        store = self.app.extensions['store']
        store.version = lambda: (_ for _ in ()).throw(ServerSelectionTimeoutError('no servers'))
        status, data = self.api.call('GET', '/api/health')
        self.assertEqual(status, 503)
        self.assertIn('database', data['error'])

    def test_broken_requests_get_json_answers(self):
        res = self.api.client.post('/api/auth/login', data='not json', content_type='application/json')
        self.assertEqual(res.status_code, 401)  # treated as an empty form, not a crash
        self.assertEqual(self.api.call('DELETE', '/api/health')[0], 405)
        self.assertEqual(self.api.call('GET', '/api/does-not-exist')[0], 404)


TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='


class Features(unittest.TestCase):
    """Photos, notices, study material, enquiries, backups and own profile."""

    def setUp(self):
        self.db = new_db()
        self.addCleanup(drop_db, self.db)
        self.app = create_app(db=self.db, dist_dir='no-dist')
        self.api = Api(self.app)
        call = self.api.call
        self.admin = call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})[1]['token']
        call('PUT', '/api/institute', {'changes': SEED}, self.admin)

        call('POST', '/api/auth/register-teacher', {'name': 'Tina', 'phone': '9800000010', 'subject': 'Maths', 'email': 't@x.com', 'password': PASSWORD})
        users = call('GET', '/api/sync', token=self.admin)[1]['users']
        self.teacher_id = next(u for u in users if u['email'] == 't@x.com')['id']
        call('POST', f'/api/users/{self.teacher_id}/approve', {'batchIds': ['b1']}, self.admin)
        self.teacher = call('POST', '/api/auth/login', {'email': 't@x.com', 'password': PASSWORD, 'portal': 'teacher'})[1]['token']

        call('POST', '/api/users', {'name': 'Alice', 'email': 'alice@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}, self.admin)
        call('POST', '/api/users', {'name': 'Carol', 'email': 'carol@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's3'}, self.admin)
        self.alice = call('POST', '/api/auth/login', {'email': 'alice@x.com', 'password': PASSWORD, 'portal': 'student'})[1]['token']
        self.carol = call('POST', '/api/auth/login', {'email': 'carol@x.com', 'password': PASSWORD, 'portal': 'student'})[1]['token']

    def institute(self, token):
        return self.api.call('GET', '/api/sync', token=token)[1]['institute']

    def push(self, token, changes):
        return self.api.call('PUT', '/api/institute', {'changes': changes}, token)

    # ----- photos -----

    def test_photos_are_kept_apart_from_the_records(self):
        status, data = self.push(self.admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': TINY_PNG}]}})
        self.assertEqual(status, 200)
        self.assertEqual(data['adjusted'], 1)  # the browser must fetch the new address
        alice = next(x for x in self.institute(self.admin)['students'] if x['id'] == 's1')
        self.assertTrue(alice['photoUrl'].startswith('/api/photos/s1/'))
        self.assertNotIn('data:image', json.dumps(self.institute(self.admin)))  # the lists stay small

        res = self.api.client.get(alice['photoUrl'])  # no sign-in needed: an <img> cannot send one
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, 'image/png')
        self.assertIn('immutable', res.headers['Cache-Control'])
        self.assertEqual(self.api.client.get('/api/photos/s1/wrong-token').status_code, 404)
        self.assertEqual(self.api.client.get('/api/photos/s2/anything').status_code, 404)

        # a new photo gets a new address
        self.push(self.admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': TINY_PNG}]}})
        again = next(x for x in self.institute(self.admin)['students'] if x['id'] == 's1')
        self.assertNotEqual(again['photoUrl'], alice['photoUrl'])

        # removing the student removes the photo
        self.push(self.admin, {'students': {'remove': ['s1']}})
        self.assertEqual(self.api.client.get(again['photoUrl']).status_code, 404)

    def test_bad_photos_are_refused(self):
        bad = self.push(self.admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': 'data:text/html;base64,PGI+aGk8L2I+'}]}})
        self.assertEqual(bad[0], 400)
        broken = self.push(self.admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': 'data:image/png;base64,@@@'}]}})
        self.assertEqual(broken[0], 400)
        import base64

        big = 'data:image/jpeg;base64,' + base64.b64encode(b'x' * 1_600_000).decode()
        self.assertEqual(self.push(self.admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': big}]}})[0], 413)

    def test_photos_inside_old_records_are_moved_at_start(self):
        self.db.students.update_one({'_id': 's2'}, {'$set': {'photoUrl': TINY_PNG}})
        create_app(db=self.db, dist_dir='no-dist')  # a restart
        bob = next(x for x in self.institute(self.admin)['students'] if x['id'] == 's2')
        self.assertTrue(bob['photoUrl'].startswith('/api/photos/s2/'))

    # ----- notices -----

    def test_notices_reach_the_right_people(self):
        def notice(nid, audience, batch_id=None, **extra):
            return {'id': nid, 'title': nid, 'body': 'text', 'audience': audience, 'batchId': batch_id, 'createdAt': '2026-10-24T10:00:00Z', **extra}

        self.assertEqual(self.push(self.admin, {'announcements': {'upsert': [notice('n-all', 'all'), notice('n-b1', 'batch', 'b1'), notice('n-b2', 'batch', 'b2')]}})[0], 200)
        ids = lambda token: sorted(a['id'] for a in self.institute(token)['announcements'])
        self.assertEqual(ids(self.admin), ['n-all', 'n-b1', 'n-b2'])
        self.assertEqual(ids(self.teacher), ['n-all', 'n-b1'])  # teacher of b1
        self.assertEqual(ids(self.alice), ['n-all', 'n-b1'])  # student of b1
        self.assertEqual(ids(self.carol), ['n-all', 'n-b2'])  # student of b2

        # a teacher can post to an own batch only, and the notice carries the teacher as author
        self.assertEqual(self.push(self.teacher, {'announcements': {'upsert': [notice('t1', 'batch', 'b1', authorId='someone-else')]}})[0], 200)
        mine = next(a for a in self.institute(self.admin)['announcements'] if a['id'] == 't1')
        self.assertEqual(mine['authorName'], 'Tina')
        self.assertNotEqual(mine['authorId'], 'someone-else')
        self.assertEqual(self.push(self.teacher, {'announcements': {'upsert': [notice('t2', 'batch', 'b2')]}})[0], 403)  # not her batch
        self.assertEqual(self.push(self.teacher, {'announcements': {'upsert': [notice('t3', 'all')]}})[0], 403)  # not for everybody
        # only her own notices can be changed or removed
        self.assertEqual(self.push(self.teacher, {'announcements': {'remove': ['n-b1']}})[0], 403)
        self.assertEqual(self.push(self.teacher, {'announcements': {'upsert': [notice('n-b1', 'batch', 'b1')]}})[0], 403)
        self.assertEqual(self.push(self.teacher, {'announcements': {'remove': ['t1']}})[0], 200)
        self.assertEqual(self.push(self.alice, {'announcements': {'upsert': [notice('s1', 'all')]}})[0], 403)

    # ----- study material -----

    def test_study_material(self):
        def material(mid, batch_id):
            return {'id': mid, 'title': mid, 'description': '', 'type': 'link', 'url': 'https://example.com', 'batchId': batch_id, 'batchName': batch_id,
                    'subject': 'Maths', 'createdAt': '2026-10-24T10:00:00Z', 'authorId': 'x', 'authorName': 'x'}

        self.assertEqual(self.push(self.teacher, {'materials': {'upsert': [material('m1', 'b1')]}})[0], 200)
        self.assertEqual(self.push(self.teacher, {'materials': {'upsert': [material('m2', 'b2')]}})[0], 403)  # not her batch
        self.assertEqual(self.push(self.admin, {'materials': {'upsert': [material('m3', 'b2')]}})[0], 200)
        ids = lambda token: sorted(m['id'] for m in self.institute(token)['materials'])
        self.assertEqual(ids(self.admin), ['m1', 'm3'])
        self.assertEqual(ids(self.teacher), ['m1'])
        self.assertEqual(ids(self.alice), ['m1'])
        self.assertEqual(ids(self.carol), ['m3'])
        self.assertEqual(self.push(self.teacher, {'materials': {'remove': ['m3']}})[0], 403)  # not her batch
        self.assertEqual(self.push(self.teacher, {'materials': {'remove': ['m1']}})[0], 200)
        self.assertEqual(self.push(self.alice, {'materials': {'upsert': [material('m9', 'b1')]}})[0], 403)

    # ----- enquiries -----

    def test_enquiries_are_for_the_office_only(self):
        enquiry = {'id': 'q1', 'name': 'Rahul', 'phone': '9811111111', 'source': 'walk-in', 'status': 'new', 'notes': '', 'createdAt': '2026-10-24T10:00:00Z'}
        self.assertEqual(self.push(self.admin, {'enquiries': {'upsert': [enquiry]}})[0], 200)
        self.assertEqual(self.push(self.teacher, {'enquiries': {'upsert': [{**enquiry, 'id': 'q2'}]}})[0], 403)
        self.assertEqual(self.push(self.alice, {'enquiries': {'upsert': [{**enquiry, 'id': 'q3'}]}})[0], 403)
        self.assertEqual([q['id'] for q in self.institute(self.admin)['enquiries']], ['q1'])
        self.assertEqual(self.institute(self.teacher)['enquiries'], [])
        self.assertEqual(self.institute(self.alice)['enquiries'], [])

    # ----- backups -----

    def test_backup_and_restore(self):
        admin = self.admin
        self.push(admin, {'students': {'upsert': [{**STUDENTS[0], 'photoUrl': TINY_PNG}]}})
        res = self.api.client.get('/api/backup', headers={'Authorization': f'Bearer {admin}'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('attachment', res.headers['Content-Disposition'])
        backup = res.get_json()
        self.assertEqual(backup['format'], 'academiaos-backup')
        self.assertEqual(len(backup['institute']['students']), 3)
        self.assertEqual(len(backup['photos']), 1)
        self.assertTrue(any(u['email'] == 'p@x.com' and 'passwordHash' in u for u in backup['users']))
        self.assertEqual(self.api.call('GET', '/api/backup', token=self.teacher)[0], 403)

        # change things, then restore
        self.push(admin, {'students': {'remove': ['s2', 's3']}})
        self.assertEqual(len(self.institute(admin)['students']), 1)
        self.assertEqual(self.api.call('POST', '/api/backup/restore', {'backup': backup}, admin)[0], 400)  # needs the confirmation
        status, report = self.api.call('POST', '/api/backup/restore', {'backup': backup, 'confirm': 'RESTORE'}, admin)
        self.assertEqual(status, 200)
        self.assertEqual(report['lists']['students'], 3)
        self.assertEqual(len(self.institute(admin)['students']), 3)
        self.assertEqual(self.api.call('GET', '/api/auth/me', token=admin)[0], 200)  # still signed in
        self.assertEqual(self.api.call('POST', '/api/backup/restore', {'backup': {'nothing': 1}, 'confirm': 'RESTORE'}, admin)[0], 400)

        # the restore took a safety snapshot first
        backups = self.api.call('GET', '/api/backups', token=admin)[1]['backups']
        self.assertTrue(any(b['label'] == 'before restore' for b in backups))

    def test_stored_snapshots(self):
        admin = self.admin
        self.assertEqual(self.api.call('GET', '/api/backups', token=admin)[1]['backups'], [])
        status, created = self.api.call('POST', '/api/backups', {'label': 'manual'}, admin)
        self.assertEqual(status, 200)
        listed = self.api.call('GET', '/api/backups', token=admin)[1]['backups']
        self.assertEqual([b['id'] for b in listed], [created['id']])
        self.assertEqual(self.api.call('POST', '/api/backups', {}, self.teacher)[0], 403)

        self.push(admin, {'students': {'remove': ['s1', 's2', 's3']}})
        self.assertEqual(self.institute(admin)['students'], [])
        self.assertEqual(self.api.call('POST', f'/api/backups/{created["id"]}/restore', {}, admin)[0], 400)
        self.assertEqual(self.api.call('POST', f'/api/backups/{created["id"]}/restore', {'confirm': 'RESTORE'}, admin)[0], 200)
        self.assertEqual(len(self.institute(admin)['students']), 3)
        self.assertEqual(self.api.call('POST', '/api/backups/nope/restore', {'confirm': 'RESTORE'}, admin)[0], 404)
        download = self.api.client.get(f'/api/backups/{created["id"]}', headers={'Authorization': f'Bearer {admin}'})
        self.assertEqual(download.get_json()['format'], 'academiaos-backup')

    def test_only_the_newest_snapshots_are_kept(self):
        from datetime import datetime

        store = self.app.extensions['store']
        for i in range(17):
            self.db.backups.insert_one({'_id': f'old-{i:02d}', 'createdAt': datetime(2026, 1, 1, 0, 0, i), 'label': 'automatic', 'size': 1, 'payload': b''})
        store.prune_backups(keep=14)
        self.assertEqual(self.db.backups.count_documents({}), 14)

    def test_daily_snapshot_is_made_when_due(self):
        from datetime import datetime, timedelta

        from academia.scheduler import snapshot_if_due

        store = self.app.extensions['store']
        first = snapshot_if_due(store)
        self.assertIsNotNone(first)  # none yet: made at once
        self.assertIsNone(snapshot_if_due(store))  # less than a day later: nothing
        later = datetime.utcnow() + timedelta(hours=25)
        self.assertIsNotNone(snapshot_if_due(store, now=later))  # a day later: a new one
        self.assertEqual(len(self.api.call('GET', '/api/backups', token=self.admin)[1]['backups']), 2)

    # ----- own details -----

    def test_own_details(self):
        status, data = self.api.call('PUT', '/api/auth/profile', {'name': 'Tina T', 'phone': '9800000099', 'subject': 'Physics'}, self.teacher)
        self.assertEqual(status, 200)
        self.assertEqual((data['user']['name'], data['user']['phone'], data['user']['subject']), ('Tina T', '9800000099', 'Physics'))
        users = self.api.call('GET', '/api/sync', token=self.admin)[1]['users']
        self.assertEqual(next(u for u in users if u['email'] == 't@x.com')['name'], 'Tina T')
        self.assertEqual(self.api.call('PUT', '/api/auth/profile', {'phone': '123'}, self.teacher)[0], 400)
        self.assertEqual(self.api.call('PUT', '/api/auth/profile', {'name': ''}, self.teacher)[0], 400)
        # a student can change the phone number, not the name
        status, data = self.api.call('PUT', '/api/auth/profile', {'name': 'Hacker', 'phone': '9800000088'}, self.alice)
        self.assertEqual((data['user']['name'], data['user']['phone']), ('Alice', '9800000088'))
        self.assertEqual(self.api.call('PUT', '/api/auth/profile', {'phone': '9800000088'})[0], 401)


class PasswordHashes(unittest.TestCase):
    """The hashes are the same as the ones the Node server makes, so accounts work on both servers."""

    def test_scrypt_matches_node(self):
        self.assertEqual(
            hash_password('Passw0rd123', '0123456789abcdef0123456789abcdef'),
            '9d7ea5f5b8f4c371d86189d7968ba9da64af00c4229c4ff0a36dce6fa8dd03a40c4d49ea097eae8b92bd5ce4748efd1ecff217f6b5fe1d51c15b5a72536a7040',
        )

    def test_old_weak_hash_matches_node(self):
        self.assertEqual(basic_hash('abc123:Passw0rd123'), '4480d2790cf9c')
        self.assertEqual(basic_hash('sañlt:päss\U0001F600wd1'), '3357dc0d9ce8c')
        self.assertEqual(basic_hash(''), 'bdcb81aee8d83')


class OldDataImport(unittest.TestCase):
    def test_old_file_is_moved_and_old_accounts_sign_in(self):
        salt = 'abc123'
        legacy_user = {
            'id': 'u-1', 'name': 'Old Principal', 'email': 'old@x.com', 'role': 'admin', 'status': 'active',
            'createdAt': '2026-01-01T00:00:00.000Z', 'salt': salt, 'alg': 'sha256',
            'passwordHash': hashlib.sha256(f'{salt}:{PASSWORD}'.encode()).hexdigest(),
        }
        old_students = [{**s, 'rollNo': f'APEX-25-010{i + 1}'} for i, s in enumerate(STUDENTS)]  # the old roll numbers
        old_receipt = {'id': 'tx-old', 'receiptNo': 'REC-2025-0001', 'studentId': 's2', 'studentName': 'Bob', 'studentRollNo': 'APEX-25-0102',
                       'batchName': 'Batch A', 'amount': 100, 'paymentMethod': 'Cash', 'date': '2025-01-01', 'installmentNo': 1}
        institute = {'profile': {'name': 'Old Institute'}, 'students': old_students, 'batches': BATCHES, 'courses': [],
                     'attendance': [], 'transactions': [old_receipt], 'exams': [], 'timetable': [], 'templates': [], 'notificationLogs': []}
        raw = {'version': 3, 'data': {'academia_os_users_v1': json.dumps([legacy_user]), 'academia_os_institute_data_v1': json.dumps(institute)}}

        db = new_db()
        self.addCleanup(drop_db, db)
        report = import_legacy(Store(db), raw)
        self.assertEqual(report['users'], 1)
        self.assertEqual(report['renumbered'], 3)

        api = Api(create_app(db=db, dist_dir='no-dist'))
        self.assertEqual(api.call('POST', '/api/auth/login', {'email': 'old@x.com', 'password': 'Wrong12345', 'portal': 'admin'})[0], 401)
        status, login = api.call('POST', '/api/auth/login', {'email': 'old@x.com', 'password': PASSWORD, 'portal': 'admin'})
        self.assertEqual(status, 200)
        data = api.call('GET', '/api/sync', token=login['token'])[1]['institute']
        self.assertEqual(data['profile']['name'], 'Old Institute')
        self.assertEqual([s['rollNo'] for s in data['students']], ['01', '02', '03'])  # plain running numbers
        self.assertEqual(data['transactions'][0]['studentRollNo'], '02')
        self.assertEqual(db.users.find_one({'email': 'old@x.com'})['alg'], 'scrypt')  # the hash was upgraded at sign in


class Coachings(unittest.TestCase):
    """Several coachings in one database: a super admin manages them, and none can see another's data."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def login(self, email, password=PASSWORD, portal='admin'):
        return self.call('POST', '/api/auth/login', {'email': email, 'password': password, 'portal': portal})

    def login_to(self, email, org_id, password=PASSWORD):
        return self.call('POST', '/api/auth/login', {'email': email, 'password': password, 'portal': 'admin', 'orgId': org_id})

    def coaching(self, name, email):
        return {'coachingName': name, 'city': 'Bijainagar', 'adminName': f'{name} Admin', 'email': email, 'phone': '+91 98000 11111', 'password': PASSWORD}

    def test_01_super_admin_setup_and_limits(self):
        self.assertEqual(self.call('GET', '/api/super/status')[1]['hasSuper'], False)
        status, data = self.call('POST', '/api/super/setup', {'name': 'Super', 'email': 'super@x.com', 'password': PASSWORD})
        self.assertEqual(status, 200)
        self.assertEqual(data['user']['role'], 'super')
        self.__class__.sup = data['token']
        self.assertEqual(self.call('POST', '/api/super/setup', {'name': 'Evil', 'email': 'e@x.com', 'password': PASSWORD})[0], 409)
        # nobody can create a coaching principal through the first-run page, bypassing the approval
        self.assertEqual(self.call('GET', '/api/auth/status')[1]['hasUsers'], True)
        self.assertEqual(self.call('POST', '/api/auth/setup', {'name': 'Evil', 'email': 'e2@x.com', 'password': PASSWORD})[0], 409)
        # one login page with two tabs: the super admin has its own, the principals use the other
        self.assertEqual(self.login('super@x.com', portal='super')[0], 200)
        status, data = self.login('super@x.com', portal='admin')
        self.assertEqual(status, 403)
        self.assertIn('Super Admin', data['error'])
        self.assertEqual(self.call('GET', '/api/auth/status')[1]['hasSuper'], True)
        # the super admin cannot open the data of a coaching
        self.assertEqual(self.call('GET', '/api/sync', token=self.sup)[0], 403)
        for method, url in (('GET', '/api/backups'), ('GET', '/api/backup'), ('GET', '/api/audit'), ('POST', '/api/users'), ('PUT', '/api/institute')):
            self.assertEqual(self.call(method, url, {}, self.sup)[0], 403, url)
        self.assertEqual(self.call('GET', '/api/auth/me', token=self.sup)[0], 200)

    def test_02_a_new_coaching_waits_for_approval(self):
        self.assertEqual(self.call('POST', '/api/public/register-coaching', self.coaching('Alpha', 'a@x.com'))[0], 200)
        self.assertEqual(self.call('POST', '/api/public/register-coaching', self.coaching('Dup', 'a@x.com'))[0], 409)
        status, data = self.login('a@x.com')
        self.assertEqual(status, 403)
        self.assertIn('super admin', data['error'])
        orgs = self.call('GET', '/api/super/orgs', token=self.sup)[1]['orgs']
        alpha = next(o for o in orgs if o['name'] == 'Alpha')
        self.assertEqual(alpha['status'], 'pending')
        self.assertEqual(alpha['admin']['email'], 'a@x.com')
        self.assertEqual(self.call('POST', f'/api/super/orgs/{alpha["id"]}/approve', token=self.sup)[0], 200)
        status, data = self.login('a@x.com')
        self.assertEqual(status, 200)
        self.__class__.admin_a, self.__class__.org_a = data['token'], alpha['id']
        self.assertEqual(self.call('GET', '/api/super/orgs', token=self.admin_a)[0], 403)  # a principal is not a super admin
        self.assertEqual(self.call('GET', '/api/super/audit', token=self.admin_a)[0], 403)
        actions = [e['action'] for e in self.call('GET', '/api/super/audit', token=self.sup)[1]['entries']]
        self.assertIn('coaching-approve', actions)
        self.assertIn('coaching-requested', actions)

    def test_03_an_added_coaching_waits_for_the_approval(self):
        # "Add coaching" only sends a request: nobody can sign in before the Approve
        status, data = self.call('POST', '/api/super/orgs', self.coaching('Beta', 'b@x.com'), self.sup)
        self.assertEqual((status, data['org']['status']), (200, 'pending'))
        self.__class__.org_b = data['org']['id']
        status, err = self.login('b@x.com')
        self.assertEqual(status, 403)
        self.assertIn('approval', err['error'])
        self.assertEqual(self.call('POST', '/api/super/orgs', self.coaching('Beta2', 'b@x.com'), self.sup)[0], 409)
        # a principal cannot approve anything, only the Super Admin can
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/approve', {}, self.admin_a)[0], 403)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/approve', {}, self.sup)[0], 200)
        status, data = self.login('b@x.com')
        self.assertEqual(status, 200)
        self.__class__.admin_b = data['token']
        # a request that is turned down is gone
        status, data = self.call('POST', '/api/super/orgs', self.coaching('Waiting Co', 'w@x.com'), self.sup)
        self.assertEqual(self.call('POST', f"/api/super/orgs/{data['org']['id']}/reject", {}, self.sup)[0], 200)
        self.assertEqual(self.login('w@x.com')[0], 401)

    def test_03b_subscription_of_a_coaching(self):
        # monthly fee, payments and the paid-until date (money between the platform and a coaching)
        org = self.org_b
        status, data = self.call('PUT', f'/api/super/orgs/{org}', {'name': 'Beta', 'city': 'Bijainagar', 'monthlyFee': 1500}, self.sup)
        self.assertEqual((status, data['org']['monthlyFee'], data['org']['subscription']), (200, 1500, 'due'))
        self.assertEqual(self.call('PUT', f'/api/super/orgs/{org}', {'name': 'Beta', 'monthlyFee': -5}, self.sup)[0], 400)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{org}/payments', {'amount': 0}, self.sup)[0], 400)
        status, data = self.call('POST', f'/api/super/orgs/{org}/payments', {'amount': 3000, 'months': 2}, self.sup)
        self.assertEqual((status, data['org']['subscription']), (200, 'paid'))
        first = data['org']['paidUntil']
        # paying again before the date adds on top of what is paid
        data = self.call('POST', f'/api/super/orgs/{org}/payments', {'amount': 1500, 'months': 1}, self.sup)[1]
        self.assertGreater(data['org']['paidUntil'], first)
        self.assertEqual(len(data['org']['payments']), 2)
        listing = self.call('GET', '/api/super/orgs', token=self.sup)[1]
        self.assertEqual(listing['income']['total'], 4500)
        self.assertEqual(listing['income']['thisMonth'], 4500)
        # only the Super Admin deals with this money
        self.assertEqual(self.call('POST', f'/api/super/orgs/{org}/payments', {'amount': 10}, self.admin_b)[0], 403)

    def test_04_no_coaching_sees_the_data_of_another(self):
        seed = {k: v for k, v in SEED.items() if k != 'profile'}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': seed}, self.admin_a)[0], 200)
        mine = self.call('GET', '/api/sync', token=self.admin_a)[1]
        self.assertEqual(len(mine['institute']['students']), 3)
        other = self.call('GET', '/api/sync', token=self.admin_b)[1]
        self.assertEqual(other['institute'].get('students', []), [])
        self.assertEqual({u['email'] for u in other['users']}, {'b@x.com'})  # only its own accounts
        # the same record ids in two coachings do not clash
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'students': {'upsert': [{**STUDENTS[0], 'name': 'Zed'}]}}}, self.admin_b)[0], 200)
        names = {x['id']: x['name'] for x in self.call('GET', '/api/sync', token=self.admin_a)[1]['institute']['students']}
        self.assertEqual(names['s1'], 'Alice')
        # an account of another coaching cannot be reached by its id
        users_a = self.call('GET', '/api/sync', token=self.admin_a)[1]['users']
        uid_a = next(u['id'] for u in users_a if u['email'] == 'a@x.com')
        self.assertEqual(self.call('POST', f'/api/users/{uid_a}/reset-password', {'newPassword': 'Hacked12345'}, self.admin_b)[0], 404)
        self.assertEqual(self.call('DELETE', f'/api/users/{uid_a}', token=self.admin_b)[0], 404)
        self.assertEqual(self.login('a@x.com')[0], 200)
        # backups and activity logs are separate too
        self.assertEqual(self.call('POST', '/api/backups', {'label': 'x'}, self.admin_a)[0], 200)
        self.assertEqual(self.call('GET', '/api/backups', token=self.admin_b)[1]['backups'], [])
        self.assertFalse(any('Alice' in e['detail'] for e in self.call('GET', '/api/audit', token=self.admin_b)[1]['entries']))

    def test_05_students_sign_up_to_the_chosen_coaching(self):
        reg = {'rollNo': '01', 'phone': '+91 98000 00001', 'email': 'alice@x.com', 'password': PASSWORD}
        self.assertEqual(self.call('POST', '/api/auth/register-student', reg)[0], 400)  # two coachings: choose one
        coachings = self.call('GET', '/api/public/coachings')[1]['coachings']
        self.assertEqual({c['name'] for c in coachings}, {'Alpha', 'Beta'})
        # roll 01 with that phone is Alice of Alpha; Beta has another student with roll 01 and a different phone
        self.assertEqual(self.call('POST', '/api/auth/register-student', {**reg, 'orgId': self.org_b, 'phone': '+91 90000 99999'})[0], 400)
        status, data = self.call('POST', '/api/auth/register-student', {**reg, 'orgId': self.org_a})
        self.assertEqual(status, 200)
        self.assertEqual(data['user']['orgId'], self.org_a)
        me = self.call('GET', '/api/sync', token=data['token'])[1]
        self.assertEqual(me['institute']['students'][0]['name'], 'Alice')

    def test_05b_a_coaching_card_lets_in_only_its_own_principal(self):
        # signing in from the card of Alpha: Alpha's principal enters, Beta's principal does not
        self.assertEqual(self.login_to('a@x.com', self.org_a)[0], 200)
        status, data = self.login_to('b@x.com', self.org_a)
        self.assertEqual((status, data['error']), (401, 'Incorrect email or password.'))
        self.assertEqual(self.login_to('a@x.com', self.org_b)[0], 401)
        self.assertEqual(self.login_to('super@x.com', self.org_a)[0], 401)  # the super admin needs the principal's login too
        self.assertEqual(self.login_to('a@x.com', 'no-such-coaching')[0], 401)

    def test_06_switching_a_coaching_off_and_on(self):
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/suspend', token=self.sup)[0], 200)
        self.assertEqual(self.call('GET', '/api/sync', token=self.admin_b)[0], 401)  # signed out
        status, data = self.login('b@x.com')
        self.assertEqual(status, 403)
        self.assertIn('switched off', data['error'])
        self.assertEqual(len(self.call('GET', '/api/public/coachings')[1]['coachings']), 1)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/activate', token=self.sup)[0], 200)
        self.assertEqual(self.login('b@x.com')[0], 200)
        self.assertIn(self.call('POST', '/api/super/orgs/default/suspend', token=self.sup)[0], (400, 404))

    def test_07_reset_reject_and_delete(self):
        # a principal can never delete, switch off, approve or edit any coaching, not even its own
        for org in (self.org_a, self.org_b):
            self.assertEqual(self.call('DELETE', f'/api/super/orgs/{org}', {'confirmName': 'Alpha'}, self.admin_a)[0], 403)
            self.assertEqual(self.call('POST', f'/api/super/orgs/{org}/suspend', {}, self.admin_a)[0], 403)
            self.assertEqual(self.call('POST', f'/api/super/orgs/{org}/approve', {}, self.admin_a)[0], 403)
            self.assertEqual(self.call('PUT', f'/api/super/orgs/{org}', {'name': 'Hacked'}, self.admin_a)[0], 403)
        names = {o['name'] for o in self.call('GET', '/api/super/orgs', token=self.sup)[1]['orgs']}
        self.assertTrue({'Alpha', 'Beta'} <= names)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/reset-admin-password', {'newPassword': 'weak'}, self.sup)[0], 400)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/reset-admin-password', {'newPassword': 'Fresh12345'}, self.sup)[0], 200)
        self.assertEqual(self.login('b@x.com')[0], 401)
        status, data = self.login('b@x.com', 'Fresh12345')
        self.assertEqual(status, 200)
        # the Super Admin knows this password, so the principal has to choose an own one
        self.assertTrue(data['user']['mustChangePassword'])
        token = data['token']
        self.assertEqual(self.call('POST', '/api/auth/change-password', {'currentPassword': 'Fresh12345', 'newPassword': 'Own12345pw'}, token)[0], 200)
        self.assertFalse(self.call('GET', '/api/auth/me', token=token)[1]['user'].get('mustChangePassword'))
        self.assertEqual(self.login('b@x.com', 'Own12345pw')[0], 200)
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/reset-admin-password', {'newPassword': 'Fresh12345'}, self.sup)[0], 200)

        self.call('POST', '/api/public/register-coaching', self.coaching('Gamma', 'g@x.com'))
        gamma = next(o for o in self.call('GET', '/api/super/orgs', token=self.sup)[1]['orgs'] if o['name'] == 'Gamma')
        self.assertEqual(self.call('POST', f'/api/super/orgs/{self.org_b}/reject', token=self.sup)[0], 400)  # active, not pending
        self.assertEqual(self.call('POST', f'/api/super/orgs/{gamma["id"]}/reject', token=self.sup)[0], 200)
        self.assertEqual(self.login('g@x.com')[0], 401)  # the request and its account are gone

        self.assertEqual(self.call('DELETE', f'/api/super/orgs/{self.org_b}', {'confirmName': 'wrong'}, self.sup)[0], 400)
        self.assertEqual(self.call('DELETE', f'/api/super/orgs/{self.org_b}', {'confirmName': 'Beta'}, self.sup)[0], 200)
        self.assertEqual(self.login('b@x.com', 'Fresh12345')[0], 401)
        self.assertIn(self.call('DELETE', '/api/super/orgs/default', {'confirmName': 'x'}, self.sup)[0], (400, 404))

    def test_08_the_first_coaching_keeps_the_old_data(self):
        # accounts without a coaching (made before this feature) belong to the first one
        db = new_db()
        db.users.insert_one({'_id': 'u1', 'id': 'u1', 'name': 'Old', 'email': 'old@x.com', 'role': 'admin', 'status': 'active', 'createdAt': ''})
        store = Store(db)
        store.migrate_to_coachings()
        self.assertEqual(store.user_by_id('u1')['orgId'], 'default')
        self.assertEqual(store.org_get('default')['status'], 'active')
        drop_db(db)


class Expenses(unittest.TestCase):
    """The expenses (and so the profit) are for the principal only."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.admin = call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})[1]['token']
        for role, email in (('staff', 's@x.com'), ('teacher', 't@x.com')):
            call('POST', '/api/users', {'name': role, 'email': email, 'password': PASSWORD, 'role': role, 'batchIds': ['b1']}, cls.admin)
        cls.staff = call('POST', '/api/auth/login', {'email': 's@x.com', 'password': PASSWORD, 'portal': 'admin'})[1]['token']
        cls.teacher = call('POST', '/api/auth/login', {'email': 't@x.com', 'password': PASSWORD, 'portal': 'teacher'})[1]['token']

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def test_1_the_principal_keeps_the_expenses(self):
        rent = {'id': 'x1', 'date': '2026-10-01', 'title': 'Rent', 'category': 'rent', 'amount': 40000, 'createdAt': ''}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'expenses': {'upsert': [rent]}}}, self.admin)[0], 200)
        seen = self.call('GET', '/api/sync', token=self.admin)[1]['institute']
        self.assertEqual([e['title'] for e in seen['expenses']], ['Rent'])
        pay = {'id': 'sal1', 'name': 'Teacher One', 'role': 'teacher', 'monthlySalary': 30000, 'active': True}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'salaries': {'upsert': [pay]}}}, self.admin)[0], 200)
        self.assertEqual(len(self.call('GET', '/api/sync', token=self.admin)[1]['institute']['salaries']), 1)

    def test_2_staff_and_teachers_neither_see_nor_change_them(self):
        staff_view = self.call('GET', '/api/sync', token=self.staff)[1]['institute']
        self.assertNotIn('expenses', staff_view)
        self.assertNotIn('salaries', staff_view)
        self.assertEqual(self.call('GET', '/api/sync', token=self.teacher)[1]['institute']['salaries'], [])
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'salaries': {'remove': ['sal1']}}}, self.staff)[0], 403)
        self.assertEqual(self.call('GET', '/api/sync', token=self.teacher)[1]['institute']['expenses'], [])
        change = {'changes': {'expenses': {'remove': ['x1']}}}
        self.assertEqual(self.call('PUT', '/api/institute', change, self.staff)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', change, self.teacher)[0], 403)
        still = self.call('GET', '/api/sync', token=self.admin)[1]['institute']['expenses']
        self.assertEqual(len(still), 1)


    def test_2b_staff_attendance_is_for_the_principal_only(self):
        row = {'id': 'sat1', 'date': '2026-10-29', 'records': {'sal1': 'leave'}, 'updatedAt': ''}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'staffAttendance': {'upsert': [row]}}}, self.admin)[0], 200)
        self.assertEqual(self.call('GET', '/api/sync', token=self.admin)[1]['institute']['staffAttendance'][0]['records'], {'sal1': 'leave'})
        self.assertNotIn('staffAttendance', self.call('GET', '/api/sync', token=self.staff)[1]['institute'])
        self.assertEqual(self.call('GET', '/api/sync', token=self.teacher)[1]['institute']['staffAttendance'], [])
        change = {'changes': {'staffAttendance': {'remove': ['sat1']}}}
        self.assertEqual(self.call('PUT', '/api/institute', change, self.staff)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', change, self.teacher)[0], 403)

    def test_3_the_teacher_student_tab_is_for_teachers_and_students_only(self):
        login = lambda email, portal: self.call('POST', '/api/auth/login', {'email': email, 'password': PASSWORD, 'portal': portal})
        self.assertEqual(login('t@x.com', 'member')[0], 200)  # a teacher on the Teacher / Student tab
        status, data = login('p@x.com', 'member')  # the principal is not a member
        self.assertEqual(status, 403)
        self.assertIn('Coaching Admin', data['error'])
        self.assertEqual(login('t@x.com', 'admin')[0], 403)  # and a teacher is not an admin

    def test_3b_everybody_can_change_the_own_login_email(self):
        login = lambda email, portal='member', pw=PASSWORD: self.call('POST', '/api/auth/login', {'email': email, 'password': pw, 'portal': portal})
        token = login('t@x.com')[1]['token']
        change = lambda body, tok=token: self.call('POST', '/api/auth/change-email', body, tok)
        self.assertEqual(change({'currentPassword': 'wrong', 'newEmail': 'new@x.com'})[0], 400)  # the password is asked
        self.assertEqual(change({'currentPassword': PASSWORD, 'newEmail': 'not-an-email'})[0], 400)
        self.assertEqual(change({'currentPassword': PASSWORD, 'newEmail': 's@x.com'})[0], 409)  # taken by the staff account
        self.assertEqual(change({'currentPassword': PASSWORD, 'newEmail': 'T@x.com'})[0], 400)  # the same
        status, data = change({'currentPassword': PASSWORD, 'newEmail': 'Teacher.New@X.com'})
        self.assertEqual((status, data['user']['email']), (200, 'teacher.new@x.com'))
        self.assertEqual(login('t@x.com')[0], 401)  # the old email does not work anymore
        self.assertEqual(login('teacher.new@x.com')[0], 200)
        # and back, for the next tests
        back = login('teacher.new@x.com')[1]['token']
        self.assertEqual(change({'currentPassword': PASSWORD, 'newEmail': 't@x.com'}, back)[0], 200)

    def test_4_an_account_the_principal_made_has_to_change_its_password(self):
        status, data = self.call('POST', '/api/auth/login', {'email': 't@x.com', 'password': PASSWORD, 'portal': 'member'})
        self.assertEqual(status, 200)
        self.assertTrue(data['user']['mustChangePassword'])  # the principal chose it, so the teacher chooses an own one
        token = data['token']
        self.assertEqual(self.call('POST', '/api/auth/change-password', {'currentPassword': PASSWORD, 'newPassword': 'Mine12345pw'}, token)[0], 200)
        self.assertFalse(self.call('GET', '/api/auth/me', token=token)[1]['user'].get('mustChangePassword'))


class Homework(unittest.TestCase):
    """A student marks homework as done; the teacher sees it; nobody can fake it."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.admin = call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})[1]['token']
        cls.hw = {'id': 'hw1', 'title': 'Chapter 3', 'description': '', 'type': 'homework', 'batchId': 'b1', 'batchName': 'Batch A', 'subject': 'Maths', 'createdAt': '', 'authorId': 'x', 'authorName': 'P'}
        other = {**cls.hw, 'id': 'hw2', 'batchId': 'b2'}
        call('PUT', '/api/institute', {'changes': {'batches': {'upsert': BATCHES}, 'students': {'upsert': STUDENTS}, 'materials': {'upsert': [cls.hw, other]}}}, cls.admin)
        call('POST', '/api/users', {'name': 'Alice', 'email': 'alice@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}, cls.admin)
        call('POST', '/api/users', {'name': 'T', 'email': 't@x.com', 'password': PASSWORD, 'role': 'teacher', 'batchIds': ['b1']}, cls.admin)
        login = lambda e, portal: call('POST', '/api/auth/login', {'email': e, 'password': PASSWORD, 'portal': portal})[1]['token']
        cls.student = login('alice@x.com', 'member')
        cls.teacher = login('t@x.com', 'member')

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def test_1_the_student_marks_and_unmarks(self):
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': True}, self.student)[0], 200)
        mine = self.call('GET', '/api/sync', token=self.student)[1]['institute']['submissions']
        self.assertEqual([(x['materialId'], x['studentId']) for x in mine], [('hw1', 's1')])
        # the teacher of the batch sees who did it
        seen = self.call('GET', '/api/sync', token=self.teacher)[1]['institute']['submissions']
        self.assertEqual(len(seen), 1)
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': False}, self.student)[0], 200)
        self.assertEqual(self.call('GET', '/api/sync', token=self.student)[1]['institute']['submissions'], [])

    def test_2_nobody_can_fake_it(self):
        self.assertEqual(self.call('PUT', '/api/homework/hw2', {'done': True}, self.student)[0], 404)  # another batch
        self.assertEqual(self.call('PUT', '/api/homework/nope', {'done': True}, self.student)[0], 404)
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': True}, self.teacher)[0], 403)  # only a student
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': True}, self.admin)[0], 403)
        fake = {'id': 'x', 'materialId': 'hw1', 'studentId': 's2', 'doneAt': ''}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'submissions': {'upsert': [fake]}}}, self.admin)[0], 403)
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'submissions': {'upsert': [fake]}}}, self.student)[0], 403)


class Library(unittest.TestCase):
    """The library: the principal and the front desk add the books, everybody reads them."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.admin = call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})[1]['token']
        call('PUT', '/api/institute', {'changes': {'batches': {'upsert': BATCHES}, 'students': {'upsert': STUDENTS}}}, cls.admin)
        for role, email in (('staff', 's@x.com'), ('teacher', 't@x.com')):
            call('POST', '/api/users', {'name': role, 'email': email, 'password': PASSWORD, 'role': role, 'batchIds': ['b1']}, cls.admin)
        call('POST', '/api/users', {'name': 'Alice', 'email': 'alice@x.com', 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}, cls.admin)
        login = lambda e, portal: call('POST', '/api/auth/login', {'email': e, 'password': PASSWORD, 'portal': portal})[1]['token']
        cls.staff = login('s@x.com', 'admin')
        cls.teacher = login('t@x.com', 'member')
        cls.student = login('alice@x.com', 'member')

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def test_1_the_office_adds_books_and_everybody_reads_them(self):
        book = {'id': 'bk1', 'title': 'Physics', 'author': 'A', 'category': 'Physics', 'description': '', 'url': 'https://example.com/physics.pdf'}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'books': {'upsert': [book]}}}, self.admin)[0], 200)
        second = {**book, 'id': 'bk2', 'title': 'Chemistry'}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'books': {'upsert': [second]}}}, self.staff)[0], 200)  # the front desk too
        for token in (self.admin, self.staff, self.teacher, self.student):
            view = self.call('GET', '/api/sync', token=token)[1]['institute']
            self.assertEqual(sorted(b['title'] for b in view['books']), ['Chemistry', 'Physics'])

    def test_2_teachers_and_students_cannot_change_books(self):
        for token in (self.teacher, self.student):
            for change in ({'remove': ['bk1']}, {'upsert': [{'id': 'bk9', 'title': 'Fake', 'url': 'https://x.com'}]}):
                self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'books': change}}, token)[0], 403)
        self.assertEqual(len(self.call('GET', '/api/sync', token=self.admin)[1]['institute']['books']), 2)

    def test_3_a_book_can_be_deleted(self):
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': {'books': {'remove': ['bk2']}}}, self.admin)[0], 200)
        self.assertEqual([b['id'] for b in self.call('GET', '/api/sync', token=self.student)[1]['institute']['books']], ['bk1'])

    def test_4_the_removed_lists_are_gone(self):
        change = {'transportRoutes': {'upsert': [{'id': 'r1'}]}}
        self.assertEqual(self.call('PUT', '/api/institute', {'changes': change}, self.admin)[0], 400)


class Parents(unittest.TestCase):
    """A parent's login: the child's data only, read only, next to the student's own login."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.admin = call('POST', '/api/auth/setup', {'name': 'P', 'email': 'p@x.com', 'password': PASSWORD})[1]['token']
        hw = {'id': 'hw1', 'title': 'Chapter 3', 'description': '', 'type': 'homework', 'batchId': 'b1', 'batchName': 'Batch A', 'subject': 'Maths', 'createdAt': '', 'authorId': 'x', 'authorName': 'P'}
        call('PUT', '/api/institute', {'changes': {'batches': {'upsert': BATCHES}, 'students': {'upsert': STUDENTS}, 'materials': {'upsert': [hw]}}}, cls.admin)

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def make(self, email, parent):
        body = {'name': 'Parent of Alice' if parent else 'Alice', 'email': email, 'password': PASSWORD, 'role': 'student', 'studentId': 's1'}
        if parent:
            body['isParent'] = True
        return self.call('POST', '/api/users', body, self.admin)

    def login(self, email):
        return self.call('POST', '/api/auth/login', {'email': email, 'password': PASSWORD, 'portal': 'member'})[1]['token']

    def test_1_a_parent_and_a_student_login_live_side_by_side(self):
        self.assertEqual(self.make('alice@x.com', False)[0], 200)
        status, data = self.make('mum@x.com', True)
        self.assertEqual(status, 200)
        self.assertTrue(data['user']['isParent'])
        self.assertEqual(self.make('dad@x.com', True)[0], 409)  # one parent login per student
        self.assertEqual(self.make('alice2@x.com', False)[0], 409)  # and one student login
        users = self.call('GET', '/api/sync', token=self.admin)[1]['users']
        self.assertEqual(sorted((u['email'], bool(u.get('isParent'))) for u in users if u['role'] == 'student'), [('alice@x.com', False), ('mum@x.com', True)])

    def test_2_the_parent_sees_the_child_only(self):
        token = self.login('mum@x.com')
        view = self.call('GET', '/api/sync', token=token)[1]
        self.assertTrue(view['user']['isParent'])
        self.assertEqual([x['id'] for x in view['institute']['students']], ['s1'])
        self.assertEqual(view['institute']['expenses'], [])
        self.assertEqual(view['institute']['enquiries'], [])

    def test_3_the_parent_cannot_change_anything_or_mark_homework(self):
        token = self.login('mum@x.com')
        change = {'changes': {'students': {'remove': ['s1']}}}
        self.assertEqual(self.call('PUT', '/api/institute', change, token)[0], 403)
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': True}, token)[0], 403)
        self.assertEqual(self.call('GET', '/api/users', token=token)[0] in (401, 403, 404, 405), True)
        # the student can still mark it
        self.assertEqual(self.call('PUT', '/api/homework/hw1', {'done': True}, self.login('alice@x.com'))[0], 200)
        # and the parent sees that the child did it
        seen = self.call('GET', '/api/sync', token=token)[1]['institute']['submissions']
        self.assertEqual([x['studentId'] for x in seen], ['s1'])


class Website(unittest.TestCase):
    """"Book a demo" on the public website: anybody can send it, only the Super Admin reads it."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.super = call('POST', '/api/super/setup', {'name': 'S', 'email': 's@x.com', 'password': PASSWORD})[1]['token']
        org = call('POST', '/api/super/orgs', {'coachingName': 'Star', 'adminName': 'P', 'email': 'p@x.com', 'password': PASSWORD, 'phone': '9876543210'}, cls.super)[1]['org']
        call('POST', f"/api/super/orgs/{org['id']}/approve", {}, cls.super)
        cls.admin = call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': PASSWORD, 'portal': 'admin'})[1]['token']

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def test_1_a_visitor_sends_a_request_and_wrong_ones_are_refused(self):
        good = {'name': 'Ravi Kumar', 'email': 'Ravi@Example.com', 'phone': '9876543210', 'coaching': 'Star Classes', 'message': 'Show me the fees part'}
        self.assertEqual(self.call('POST', '/api/public/demo-request', good)[0], 200)
        for bad in ({**good, 'name': ''}, {**good, 'email': 'nope'}, {**good, 'phone': '123'}):
            self.assertEqual(self.call('POST', '/api/public/demo-request', bad)[0], 400)

    def test_2_only_the_super_admin_reads_and_deletes_them(self):
        status, data = self.call('GET', '/api/super/leads', token=self.super)
        self.assertEqual(status, 200)
        self.assertEqual([(l['name'], l['email'], l['coaching']) for l in data['leads']], [('Ravi Kumar', 'ravi@example.com', 'Star Classes')])
        self.assertIn(self.call('GET', '/api/super/leads', token=self.admin)[0], (401, 403))  # a principal cannot
        self.assertEqual(self.call('GET', '/api/super/leads')[0], 401)  # nor a visitor
        lead_id = data['leads'][0]['id']
        self.assertIn(self.call('DELETE', f'/api/super/leads/{lead_id}', token=self.admin)[0], (401, 403))
        self.assertEqual(self.call('DELETE', f'/api/super/leads/{lead_id}', token=self.super)[0], 200)
        self.assertEqual(self.call('GET', '/api/super/leads', token=self.super)[1]['leads'], [])
        self.assertEqual(self.call('DELETE', f'/api/super/leads/{lead_id}', token=self.super)[0], 404)

    def test_3_the_request_shows_in_the_activity_log(self):
        self.call('POST', '/api/public/demo-request', {'name': 'Mina', 'email': 'm@example.com', 'phone': '9876543211'})
        entries = self.call('GET', '/api/super/audit', token=self.super)[1]['entries']
        self.assertTrue(any(e['action'] == 'demo-requested' for e in entries))


class SuperRecovery(unittest.TestCase):
    """The Super Admin forgot the password: it can be reset on the server computer only."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        cls.token = cls.api.call('POST', '/api/super/setup', {'name': 'S', 'email': 's@x.com', 'password': PASSWORD})[1]['token']

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def reset(self, email, password='NewPass12345', headers=None):
        return self.api.call('POST', '/api/super/forgot-password', {'email': email, 'newPassword': password}, headers=headers)

    def test_1_not_from_another_computer(self):
        # a request that comes through a proxy from somewhere else is refused
        status, data = self.reset('s@x.com', headers={'X-Forwarded-For': '8.8.8.8'})
        self.assertEqual(status, 403)
        self.assertIn('server computer', data['error'])
        self.assertEqual(self.api.call('GET', '/api/auth/me', token=self.token)[0], 200)  # nothing changed

    def test_2_a_wrong_email_or_a_weak_password_changes_nothing(self):
        self.assertEqual(self.reset('nobody@x.com')[0], 404)
        self.assertEqual(self.reset('s@x.com', 'weak')[0], 400)

    def test_3_on_the_server_computer_it_works(self):
        self.assertEqual(self.reset('S@X.com')[0], 200)
        self.assertEqual(self.api.call('GET', '/api/auth/me', token=self.token)[0], 401)  # signed out everywhere
        login = lambda pw: self.api.call('POST', '/api/auth/login', {'email': 's@x.com', 'password': pw, 'portal': 'super'})
        self.assertEqual(login(PASSWORD)[0], 401)
        self.assertEqual(login('NewPass12345')[0], 200)


class SuperAdmins(unittest.TestCase):
    """Two Super Admins can help each other; nobody else can touch them."""

    @classmethod
    def setUpClass(cls):
        cls.db = new_db()
        cls.api = Api(create_app(db=cls.db, dist_dir='no-dist'))
        call = cls.api.call
        cls.one = call('POST', '/api/super/setup', {'name': 'One', 'email': 'one@x.com', 'password': PASSWORD})[1]['token']
        org = call('POST', '/api/super/orgs', {'coachingName': 'Alpha', 'city': 'T', 'adminName': 'Principal', 'phone': '+91 98000 11111', 'email': 'p@x.com', 'password': PASSWORD}, cls.one)[1]['org']
        call('POST', f"/api/super/orgs/{org['id']}/approve", {}, cls.one)
        cls.principal = call('POST', '/api/auth/login', {'email': 'p@x.com', 'password': PASSWORD, 'portal': 'admin'})[1]['token']

    @classmethod
    def tearDownClass(cls):
        drop_db(cls.db)

    def call(self, *a, **kw):
        return self.api.call(*a, **kw)

    def login(self, email, password):
        return self.call('POST', '/api/auth/login', {'email': email, 'password': password, 'portal': 'super'})

    def test_1_only_a_super_admin_adds_one(self):
        new = {'name': 'Two', 'email': 'two@x.com', 'password': 'Temp12345pw'}
        self.assertEqual(self.call('POST', '/api/super/admins', new, self.principal)[0], 403)  # a principal cannot
        self.assertEqual(self.call('POST', '/api/super/admins', new)[0], 401)  # nobody signed in cannot
        self.assertEqual(self.call('POST', '/api/super/admins', {**new, 'password': 'weak'}, self.one)[0], 400)
        self.assertEqual(self.call('POST', '/api/super/admins', {**new, 'email': 'p@x.com'}, self.one)[0], 409)
        self.assertEqual(self.call('POST', '/api/super/admins', new, self.one)[0], 200)
        status, data = self.login('two@x.com', 'Temp12345pw')
        self.assertEqual(status, 200)
        self.assertTrue(data['user']['mustChangePassword'])  # chooses an own password first
        self.__class__.two = data['token']
        names = [a['name'] for a in self.call('GET', '/api/super/admins', token=self.one)[1]['admins']]
        self.assertEqual(sorted(names), ['One', 'Two'])
        self.assertEqual(self.call('GET', '/api/super/admins', token=self.principal)[0], 403)

    def test_2_they_help_each_other_with_a_forgotten_password(self):
        admins = self.call('GET', '/api/super/admins', token=self.one)[1]['admins']
        one = next(a for a in admins if a['name'] == 'One')['id']
        two = next(a for a in admins if a['name'] == 'Two')['id']
        # Two forgot the password: One sets a new one
        self.assertEqual(self.call('POST', f'/api/super/admins/{two}/reset-password', {'newPassword': 'Fresh12345pw'}, self.principal)[0], 403)
        self.assertEqual(self.call('POST', f'/api/super/admins/{two}/reset-password', {'newPassword': 'weak'}, self.one)[0], 400)
        self.assertEqual(self.call('POST', f'/api/super/admins/{two}/reset-password', {'newPassword': 'Fresh12345pw'}, self.one)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=self.two)[0], 401)  # signed out
        self.assertEqual(self.login('two@x.com', 'Temp12345pw')[0], 401)
        self.assertTrue(self.login('two@x.com', 'Fresh12345pw')[1]['user']['mustChangePassword'])
        # the own password has its own button
        self.assertEqual(self.call('POST', f'/api/super/admins/{one}/reset-password', {'newPassword': 'Other12345pw'}, self.one)[0], 400)

    def test_3_removing(self):
        admins = self.call('GET', '/api/super/admins', token=self.one)[1]['admins']
        one = next(a for a in admins if a['name'] == 'One')['id']
        two = next(a for a in admins if a['name'] == 'Two')['id']
        self.assertEqual(self.call('DELETE', f'/api/super/admins/{one}', token=self.one)[0], 400)  # not yourself
        self.assertEqual(self.call('DELETE', f'/api/super/admins/{two}', token=self.principal)[0], 403)
        self.assertEqual(self.call('DELETE', f'/api/super/admins/{two}', token=self.one)[0], 200)
        self.assertEqual(self.login('two@x.com', 'Fresh12345pw')[0], 401)



if __name__ == '__main__':
    unittest.main()
