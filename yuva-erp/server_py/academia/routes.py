"""All API routes. Each route says who may call it:
  public   anybody (sign in, sign up)
  user     any signed-in account
  admin    principal only
"""

import functools
import re

from flask import Blueprint, current_app, g, request
from pymongo.errors import DuplicateKeyError

from . import auth
from .errors import HttpError
from .rollno import next_roll_number
from .scope import apply_changes, scope_institute
from .validate import (
    EMAIL_REGEX,
    last10,
    new_id,
    norm_roll,
    normalize_phone,
    password_problem,
    portal_label,
    role_label,
    text,
    today_local,
)

bp = Blueprint('api', __name__)

DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
MINUTE = 60

SMALL_BODY = 256 * 1024
INSTITUTE_BODY = 100 * 1024 * 1024  # student photos are stored inside the data

def make_limiters():
    return {
        'login': auth.Limiter(max_failures=5, window_sec=15 * MINUTE, lock_sec=15 * MINUTE),
        'ip': auth.Limiter(max_failures=40, window_sec=15 * MINUTE, lock_sec=15 * MINUTE),
        'register': auth.Limiter(max_failures=20, window_sec=60 * MINUTE, lock_sec=60 * MINUTE),
    }


def store():
    return current_app.extensions['store']


def limiters():
    return current_app.extensions['limiters']


def route(rule, methods, access='public'):
    def decorator(fn):
        @bp.route(rule, methods=methods, endpoint=fn.__name__)
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            g.token = _bearer_token()
            g.user = None
            if access != 'public':
                g.user = auth.user_for_token(store(), g.token)
                if not g.user:
                    raise HttpError(401, 'Please sign in.')
                if access == 'admin' and g.user['role'] != 'admin':
                    raise HttpError(403, 'Only the principal (administrator) can do this.')
            return fn(*args, **kwargs)

        return wrapper

    return decorator


# ---------- helpers ----------


def _bearer_token():
    header = request.headers.get('Authorization', '')
    if header[:7].lower() == 'bearer ':
        return header[7:].strip()
    return ''


def client_ip():
    """Address of the caller. Behind a proxy on this same computer the proxy's own address would be the
    same for everybody, so the address it forwards is used (only trusted when the proxy is local)."""
    peer = (request.remote_addr or 'unknown').replace('::ffff:', '')
    if peer in ('127.0.0.1', '::1'):
        forwarded = request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
        if forwarded:
            return forwarded.replace('::ffff:', '')[:64]
    return peer


def body(limit=SMALL_BODY):
    if request.content_length and request.content_length > limit:
        raise HttpError(413, 'Request is too large.')
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def require_setup():
    if store().user_count() == 0:
        raise HttpError(
            409, 'The institute is not set up yet. Please ask the principal to create the administrator account first.'
        )


def limit_registrations():
    """Public sign-up forms are limited per address so nobody can flood the server."""
    ip = client_ip()
    if limiters()['register'].check(ip) is not None:
        raise HttpError(429, 'Too many sign-up attempts. Please try again later.')
    limiters()['register'].fail(ip)


def start_session(user, remember=True):
    token = auth.create_session(store(), user['id'], remember)
    return {'token': token, 'user': auth.public_user(user)}


def check_email(email):
    if not EMAIL_REGEX.match(email):
        raise HttpError(400, 'Please enter a valid email address.')


def check_password(pw):
    problem = password_problem(pw)
    if problem:
        raise HttpError(400, problem)


def email_taken(email):
    return store().user_by_email(email) is not None


def add_user_or_conflict(user):
    try:
        store().add_user(user)
    except DuplicateKeyError:
        raise HttpError(409, 'An account with this email already exists.')


def ok():
    return {'ok': True}


# ---------- public ----------


@route('/api/health', ['GET'])
def health():
    return {'ok': True, 'version': store().version()}


@route('/api/auth/status', ['GET'])
def auth_status():
    return {'hasUsers': store().user_count() > 0}


@route('/api/auth/setup', ['POST'])
def setup():
    """First start: creates the principal. Only works while there is no account at all."""
    s = store()
    if s.user_count() > 0:
        raise HttpError(409, 'Setup is already complete. Please sign in, or register as a student or teacher.')
    b = body()
    name = text(b.get('name'))
    email = text(b.get('email')).lower()
    password = b.get('password')
    if not name:
        raise HttpError(400, 'Please enter your full name.')
    check_email(email)
    check_password(password)

    user = auth.build_user({'name': name, 'email': email, 'password': password, 'role': 'admin'}, 'active')
    add_user_or_conflict(user)
    s.bump()
    s.audit(user, 'setup', 'Principal account created')
    return start_session(user)


@route('/api/auth/login', ['POST'])
def login():
    s = store()
    b = body()
    email = text(b.get('email')).lower()
    password = b.get('password') if isinstance(b.get('password'), str) else ''
    portal = b.get('portal')
    remember = b.get('remember') is not False
    ip = client_ip()
    invalid = HttpError(401, 'Incorrect email or password.')

    login_limiter, ip_limiter = limiters()['login'], limiters()['ip']
    key_email = f'{ip}|{email}'
    for wait in (login_limiter.check(key_email), ip_limiter.check(ip)):
        if wait is not None:
            minutes = max(1, -(-wait // 60))
            raise HttpError(
                429, f'Too many failed attempts. Please try again in {minutes} minute{"" if minutes == 1 else "s"}.'
            )

    def fail():
        login_limiter.fail(key_email)
        ip_limiter.fail(ip)

    found = s.user_by_email(email)
    if not found or len(password) > 200:
        auth.hash_password(password[:200], '0' * 32)  # same time whether or not the email exists
        fail()
        s.audit(None, 'login-failed', email)
        raise invalid
    if not auth.verify_password(found, password):
        fail()
        s.audit(found, 'login-failed', 'wrong password')
        raise invalid

    if (found.get('status') or 'active') == 'pending':
        raise HttpError(
            403, 'Your account is waiting for the principal’s approval. Please try again after it is approved.'
        )

    portal_ok = found['role'] in ('admin', 'staff') if portal == 'admin' else found['role'] == portal
    if not portal_ok:
        raise HttpError(
            403,
            f'This is a {role_label(found["role"])} account. Please use the “{portal_label(found["role"])}” tab to sign in.',
        )

    if auth.needs_upgrade(found):
        auth.set_password(found, password)
        s.save_user(found)
    login_limiter.reset(key_email)
    s.audit(found, 'login')
    return start_session(found, remember)


@route('/api/auth/register-teacher', ['POST'])
def register_teacher():
    s = store()
    require_setup()
    limit_registrations()
    b = body()
    name = text(b.get('name'))
    email = text(b.get('email')).lower()
    subject = text(b.get('subject'))
    if not name:
        raise HttpError(400, 'Please enter your full name.')
    if len(last10(b.get('phone'))) < 10:
        raise HttpError(400, 'Please enter a valid 10-digit mobile number.')
    check_email(email)
    check_password(b.get('password'))
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')

    user = auth.build_user(
        {
            'name': name,
            'email': email,
            'password': b['password'],
            'role': 'teacher',
            'phone': text(b.get('phone'), 30),
            'subject': subject,
            'batchIds': [],
        },
        'pending',
    )
    add_user_or_conflict(user)
    s.bump()
    s.audit(user, 'register-teacher', 'Waiting for approval')
    return ok()


@route('/api/auth/register-student', ['POST'])
def register_student():
    """A student that was admitted by the office creates a login (checked against the admission record)."""
    s = store()
    require_setup()
    limit_registrations()
    b = body()
    roll_input = text(b.get('rollNo'), 50)
    email = text(b.get('email')).lower()
    phone10 = last10(b.get('phone'))

    if not roll_input:
        raise HttpError(400, 'Please enter your roll number.')
    if len(phone10) < 10:
        raise HttpError(400, 'Enter the 10-digit mobile number registered at admission.')
    check_email(email)
    check_password(b.get('password'))

    records = s.find('students')
    roll_key = norm_roll(roll_input)
    student = next((x for x in records if norm_roll(x.get('rollNo') or '') == roll_key), None)
    # Only the number was typed (for example "101"): accept it when it points to exactly one student
    if not student and roll_input.isdigit() and len(roll_input) <= 6:
        typed = int(roll_input)
        matches = []
        for x in records:
            tail = re.search(r'(\d+)\D*$', str(x.get('rollNo') or ''))
            if tail and int(tail.group(1)) == typed:
                matches.append(x)
        if len(matches) == 1:
            student = matches[0]
    verified = bool(student) and (last10(student.get('phone')) == phone10 or last10(student.get('parentPhone')) == phone10)
    if not student or not verified:
        sample = records[0].get('rollNo') if records else '05'
        raise HttpError(
            400,
            f'We could not verify these details. Check your roll number (it looks like {sample}) '
            'and the mobile number registered at admission.',
        )
    if s.user_by_student(student['id']):
        raise HttpError(
            409, 'An account already exists for this student. Please sign in, or ask the principal to reset your password.'
        )
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')

    user = auth.build_user(
        {
            'name': student['name'],
            'email': email,
            'password': b['password'],
            'role': 'student',
            'phone': text(b.get('phone'), 30),
            'studentId': student['id'],
        },
        'active',
    )
    add_user_or_conflict(user)
    s.bump()
    s.audit(user, 'register-student', student.get('rollNo'))
    return start_session(user)


@route('/api/public/registration-options', ['GET'])
def registration_options():
    s = store()
    students = s.find('students')
    batches = [
        {
            'id': b['id'],
            'code': b.get('code'),
            'name': b.get('name'),
            'courseId': b.get('courseId'),
            'courseName': b.get('courseName'),
            'startTime': b.get('startTime'),
            'endTime': b.get('endTime'),
            'maxCapacity': b.get('maxCapacity'),
            'status': b.get('status'),
            'filled': sum(1 for x in students if x.get('batchId') == b['id']),
        }
        for b in s.find('batches')
        if b.get('status') != 'completed'
    ]
    courses = [{'id': c['id'], 'code': c.get('code'), 'name': c.get('name')} for c in s.find('courses')]
    return {'courses': courses, 'batches': batches, 'nextRollNo': next_roll_number(students)}


@route('/api/auth/register-new-student', ['POST'])
def register_new_student():
    """A new student registers on the portal: the student record gets an automatic roll number."""
    s = store()
    require_setup()
    limit_registrations()
    b = body()
    name = text(b.get('name'))
    email = text(b.get('email')).lower()
    phone10 = last10(b.get('phone'))

    if not name:
        raise HttpError(400, 'Please enter your full name.')
    if len(phone10) < 10:
        raise HttpError(400, 'Please enter a valid 10-digit student mobile number.')
    if not text(b.get('parentName')):
        raise HttpError(400, 'Please enter the parent or guardian name.')
    if len(last10(b.get('parentPhone'))) < 10:
        raise HttpError(400, 'Please enter a valid 10-digit parent mobile number.')
    check_email(email)
    check_password(b.get('password'))

    course = s.get_item('courses', b.get('courseId')) if isinstance(b.get('courseId'), str) else None
    batch = s.get_item('batches', b.get('batchId')) if isinstance(b.get('batchId'), str) else None
    if not course or not batch or batch.get('courseId') != b.get('courseId') or batch.get('status') == 'completed':
        raise HttpError(400, 'Please choose a program and one of its batches.')

    records = s.find('students')
    if sum(1 for x in records if x.get('batchId') == batch['id']) >= (batch.get('maxCapacity') or 0):
        raise HttpError(409, 'This batch is full. Please choose another batch.')
    already = any(
        str(x.get('name', '')).strip().lower() == name.lower()
        and (last10(x.get('phone')) == phone10 or last10(x.get('parentPhone')) == phone10)
        for x in records
    )
    if already:
        raise HttpError(
            409,
            'A student with this name and mobile number is already registered. '
            'Use the “Already Admitted” option to create your login.',
        )
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')

    student = {
        'id': new_id('s'),
        'rollNo': next_roll_number(records),  # automatic, the student cannot choose it
        'name': name,
        'email': email,
        'phone': normalize_phone(b.get('phone')),
        'parentName': text(b.get('parentName')),
        'parentPhone': normalize_phone(b.get('parentPhone')),
        'grade': text(b.get('grade'), 40) or 'Class 12',
        'courseId': course['id'],
        'batchId': batch['id'],
        'targetExam': course.get('name'),
        'dateOfAdmission': today_local(),
        'status': 'trial',  # waits for the principal to confirm the admission and set the fee
        'photoUrl': DEFAULT_PHOTO,
        'address': '',
        'totalFees': 0,
        'discount': 0,
        'feePaid': 0,
        'notes': 'Self-registered through the student portal. Fee structure pending confirmation.',
    }
    user = auth.build_user(
        {
            'name': name,
            'email': email,
            'password': b['password'],
            'role': 'student',
            'phone': text(b.get('phone'), 30),
            'studentId': student['id'],
        },
        'active',
    )

    add_user_or_conflict(user)
    s.apply_list('students', [student], [])
    s.inc_field('batches', batch['id'], 'enrolledCount', 1)
    s.bump()
    s.audit(user, 'register-student', f'New registration {student["rollNo"]}')
    return start_session(user)


# ---------- any signed-in account ----------


@route('/api/auth/logout', ['POST'], 'user')
def logout():
    auth.destroy_session(store(), g.token)
    return ok()


@route('/api/auth/me', ['GET'], 'user')
def me():
    return {'user': auth.public_user(g.user)}


@route('/api/auth/change-password', ['POST'], 'user')
def change_password():
    s = store()
    b = body()
    current = b.get('currentPassword') if isinstance(b.get('currentPassword'), str) else ''
    new = b.get('newPassword')
    if not auth.verify_password(g.user, current):
        raise HttpError(400, 'Current password is incorrect.')
    check_password(new)
    if new == current:
        raise HttpError(400, 'New password must be different from the current one.')

    auth.set_password(g.user, new)
    s.save_user(g.user)
    auth.destroy_sessions_of(s, g.user['id'], g.token)  # other devices must sign in again
    s.audit(g.user, 'change-password')
    return ok()


@route('/api/sync', ['GET'], 'user')
def sync():
    """The browser asks for changes since the version it already has."""
    s = store()
    version = s.version()
    since = request.args.get('since', type=int)
    if since is not None and since == version:
        return {'changed': False, 'version': version}

    out = {
        'changed': True,
        'version': version,
        'user': auth.public_user(g.user),
        'institute': scope_institute(g.user, s),
    }
    if g.user['role'] in ('admin', 'staff'):
        out['users'] = [auth.public_user(u) for u in s.users_all()]
    return out


@route('/api/institute', ['PUT'], 'user')
def put_institute():
    """The browser sends what changed: { students: { upsert: [...], remove: [ids] }, profile: {...} }"""
    s = store()
    b = body(INSTITUTE_BODY)
    summary, renumbered = apply_changes(g.user, s, b.get('changes'))
    if summary:
        s.bump()
        s.audit(g.user, 'data', ', '.join(summary))
    return {'version': s.version(), 'renumbered': renumbered}


# ---------- accounts (principal only) ----------


def _batch_ids(value):
    return [i for i in value if isinstance(i, str)] if isinstance(value, list) else []


@route('/api/users', ['POST'], 'admin')
def add_user():
    s = store()
    b = body()
    email = text(b.get('email')).lower()
    role = b.get('role')
    if role not in ('admin', 'staff', 'teacher', 'student'):
        raise HttpError(400, 'Choose a valid role.')
    if not text(b.get('name')):
        raise HttpError(400, 'Please enter the full name.')
    check_email(email)
    check_password(b.get('password'))
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')

    if role == 'student':
        student_id = b.get('studentId')
        if not student_id:
            raise HttpError(400, 'Please choose the student record for this account.')
        if s.user_by_student(student_id):
            raise HttpError(409, 'This student already has an account.')
        if not s.get_item('students', student_id):
            raise HttpError(400, 'That student record does not exist.')

    user = auth.build_user(
        {
            'name': text(b.get('name')),
            'email': email,
            'password': b['password'],
            'role': role,
            'phone': text(b.get('phone'), 30),
            'subject': text(b.get('subject')),
            'batchIds': _batch_ids(b.get('batchIds')),
            'studentId': b.get('studentId') if role == 'student' else None,
        },
        'active',
    )
    add_user_or_conflict(user)
    s.bump()
    s.audit(g.user, 'user-add', f'{user["email"]} ({role_label(role)})')
    return {'user': auth.public_user(user)}


@route('/api/users/<user_id>/approve', ['POST'], 'admin')
def approve_user(user_id):
    s = store()
    target = s.user_by_id(user_id)
    if not target:
        raise HttpError(404, 'Request not found.')
    b = body()
    target['status'] = 'active'
    if target['role'] == 'teacher':
        target['batchIds'] = _batch_ids(b.get('batchIds')) if isinstance(b.get('batchIds'), list) else target.get('batchIds') or []
    s.save_user(target)
    s.bump()
    s.audit(g.user, 'user-approve', target['email'])
    return ok()


@route('/api/users/<user_id>/reject', ['POST'], 'admin')
def reject_user(user_id):
    s = store()
    target = s.user_by_id(user_id)
    if not target:
        raise HttpError(404, 'Request not found.')
    if (target.get('status') or 'active') != 'pending':
        raise HttpError(400, 'Only pending requests can be rejected.')
    s.remove_user(user_id)
    s.bump()
    s.audit(g.user, 'user-reject', target['email'])
    return ok()


@route('/api/users/<user_id>/batches', ['PUT'], 'admin')
def set_user_batches(user_id):
    s = store()
    target = s.user_by_id(user_id)
    if not target or target['role'] != 'teacher':
        raise HttpError(404, 'Teacher account not found.')
    b = body()
    if not isinstance(b.get('batchIds'), list):
        raise HttpError(400, 'batchIds must be a list.')
    target['batchIds'] = _batch_ids(b['batchIds'])
    s.save_user(target)
    s.bump()
    s.audit(g.user, 'user-batches', target['email'])
    return ok()


@route('/api/users/<user_id>/role', ['PUT'], 'admin')
def set_user_role(user_id):
    s = store()
    role = body().get('role')
    if role not in ('admin', 'staff'):
        raise HttpError(400, 'Only Administrator or Front Desk Staff can be assigned here.')
    target = s.user_by_id(user_id)
    if not target:
        raise HttpError(404, 'User not found.')
    if target['role'] in ('teacher', 'student'):
        raise HttpError(400, 'Teacher and student roles cannot be changed.')
    if target['id'] == g.user['id']:
        raise HttpError(400, 'You cannot change your own role.')
    if target['role'] == 'admin' and role != 'admin' and s.admin_count() <= 1:
        raise HttpError(400, 'At least one administrator is required.')
    target['role'] = role
    s.save_user(target)
    s.bump()
    s.audit(g.user, 'user-role', f'{target["email"]} -> {role_label(role)}')
    return ok()


@route('/api/users/<user_id>/reset-password', ['POST'], 'admin')
def reset_user_password(user_id):
    s = store()
    new = body().get('newPassword')
    check_password(new)
    target = s.user_by_id(user_id)
    if not target:
        raise HttpError(404, 'User not found.')
    auth.set_password(target, new)
    s.save_user(target)
    if target['id'] == g.user['id']:
        auth.destroy_sessions_of(s, target['id'], g.token)
    else:
        auth.destroy_sessions_of(s, target['id'])
    s.audit(g.user, 'user-reset-password', target['email'])
    return ok()


@route('/api/users/<user_id>', ['DELETE'], 'admin')
def remove_user(user_id):
    s = store()
    target = s.user_by_id(user_id)
    if not target:
        raise HttpError(404, 'User not found.')
    if target['id'] == g.user['id']:
        raise HttpError(400, 'You cannot remove your own account.')
    if target['role'] == 'admin' and s.admin_count() <= 1:
        raise HttpError(400, 'At least one administrator is required.')
    s.remove_user(user_id)
    auth.destroy_sessions_of(s, user_id)
    s.bump()
    s.audit(g.user, 'user-remove', target['email'])
    return ok()


@route('/api/audit', ['GET'], 'admin')
def audit_log():
    limit = min(1000, max(1, request.args.get('limit', default=200, type=int) or 200))
    return {'entries': store().audit_recent(limit)}
