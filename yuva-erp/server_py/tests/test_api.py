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
        self.assertIn('Administration', data['error'])
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
        self.assertEqual(data['renumbered'], 1)  # the browser is told, so it fetches the new number
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

        users = self.call('GET', '/api/sync', token=admin)[1]['users']
        alice = next(u for u in users if u['email'] == 'alice@x.com')
        self.assertEqual(self.call('POST', f'/api/users/{alice["id"]}/reset-password', {'newPassword': 'weak'}, admin)[0], 400)
        self.assertEqual(self.call('POST', f'/api/users/{alice["id"]}/reset-password', {'newPassword': 'Reset12345'}, admin)[0], 200)
        self.assertEqual(self.call('GET', '/api/auth/me', token=student_token)[0], 401)  # reset signs the account out

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


if __name__ == '__main__':
    unittest.main()
