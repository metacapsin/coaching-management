"""All API routes. Each route says who may call it:
  public   anybody (sign in, sign up)
  user     any signed-in account
  admin    principal only (of one coaching)
  super    the super admin only (manages the coachings, never sees their data)
  any      any signed-in account, also the super admin
"""

import functools
import hmac
import json
import re
from datetime import datetime, timezone

from flask import Blueprint, Response, current_app, g, request
from pymongo.errors import DuplicateKeyError

from . import auth
from .errors import HttpError
from .rollno import next_roll_number
from .scope import apply_changes, scope_institute
from .store import DEFAULT_ORG, PLATFORM_ORG
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

DEFAULT_PHOTO = '/avatar.svg'  # a local picture (the app has it in public/)
MINUTE = 60

SMALL_BODY = 256 * 1024
INSTITUTE_BODY = 100 * 1024 * 1024  # student photos are stored inside the data

def make_limiters():
    return {
        'login': auth.Limiter(max_failures=5, window_sec=15 * MINUTE, lock_sec=15 * MINUTE),
        'ip': auth.Limiter(max_failures=40, window_sec=15 * MINUTE, lock_sec=15 * MINUTE),
        'register': auth.Limiter(max_failures=20, window_sec=60 * MINUTE, lock_sec=60 * MINUTE),
    }


def root():
    """The store that knows all coachings (and the accounts, which are shared)."""
    return current_app.extensions['store']


def store():
    """The data of the coaching this request is about (set by the route, or the first coaching)."""
    chosen = g.get('store')
    return chosen if chosen is not None else root()


def limiters():
    return current_app.extensions['limiters']


def route(rule, methods, access='public'):
    def decorator(fn):
        @bp.route(rule, methods=methods, endpoint=fn.__name__)
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            g.token = _bearer_token()
            g.user = None
            g.store = None
            if access != 'public':
                r = root()
                g.user = auth.user_for_token(r, g.token)
                if not g.user:
                    raise HttpError(401, 'Please sign in.')
                is_super = g.user['role'] == 'super'
                if access == 'super' and not is_super:
                    raise HttpError(403, 'Only the super admin can do this.')
                if access not in ('super', 'any') and is_super:
                    raise HttpError(403, 'The super admin manages the coachings and cannot open their data.')
                org_id = PLATFORM_ORG if is_super else (g.user.get('orgId') or DEFAULT_ORG)
                if not is_super:
                    org = r.org_get(org_id)
                    if not org or org.get('status') != 'active':
                        raise HttpError(403, 'This coaching is not active. Please contact the super admin.')
                g.store = r.for_org(org_id)
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


def choose_org():
    """The coaching a public sign-up form is for (the browser sends orgId). When only one coaching
    exists it is used without asking."""
    r = root()
    data = request.get_json(silent=True) if request.method == 'POST' else None
    org_id = (data.get('orgId') if isinstance(data, dict) else None) or request.args.get('orgId')
    if not org_id:
        active = r.org_active_list()
        if len(active) != 1:
            raise HttpError(400, 'Please choose your coaching.')
        org_id = active[0]['id']
    org = r.org_get(org_id) if isinstance(org_id, str) else None
    if not org or org.get('status') != 'active':
        raise HttpError(404, 'This coaching was not found or is not active.')
    g.store = r.for_org(org_id)
    return g.store


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
    return root().user_by_email(email) is not None  # one email, one account, over all coachings


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


@route('/api/auth/forgot-password', ['POST'])
def forgot_password():
    """Marks that somebody forgot the password, so the principal sees it in Team & Access and sets a new one.
    The answer is always the same, so nobody can find out which emails have an account."""
    limit_registrations()
    email = text(body().get('email')).lower()
    target = root().user_by_email(email) if email else None
    if target and (target.get('status') or 'active') == 'active':
        s = root().for_org(target.get('orgId') or DEFAULT_ORG)
        target['resetRequestedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        s.save_user(target)
        s.bump()
        s.audit(None, 'password-reset-requested', email)
    return ok()


@route('/api/auth/status', ['GET'])
def auth_status():
    # any account in the database (also a super admin or another coaching) means the first-run set-up is over
    return {
        'hasUsers': root().users.count_documents({}) > 0,
        'hasSuper': root().for_org(PLATFORM_ORG).user_count() > 0,
    }


@route('/api/auth/setup', ['POST'])
def setup():
    """First start: creates the principal. Only works while there is no account at all."""
    s = store()
    if root().users.count_documents({}) > 0:
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
    root().ensure_default_org()
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
    if found:
        s = s.for_org(PLATFORM_ORG if found['role'] == 'super' else (found.get('orgId') or DEFAULT_ORG))
    if not found or len(password) > 200:
        auth.hash_password(password[:200], '0' * 32)  # same time whether or not the email exists
        fail()
        s.audit(None, 'login-failed', email)
        raise invalid
    if not auth.verify_password(found, password):
        fail()
        s.audit(found, 'login-failed', 'wrong password')
        raise invalid

    if found['role'] != 'super':
        org = root().org_get(found.get('orgId') or DEFAULT_ORG)
        if not org or org.get('status') == 'pending':
            raise HttpError(403, 'Your coaching is waiting for the super admin’s approval. Please try again after it is approved.')
        if org.get('status') == 'suspended':
            raise HttpError(403, 'This coaching has been switched off by the super admin. Please contact the super admin.')

    if (found.get('status') or 'active') == 'pending':
        raise HttpError(
            403, 'Your account is waiting for the principal’s approval. Please try again after it is approved.'
        )

    # Signing in to one chosen coaching (from its card): only an account of THAT coaching is let in.
    # The answer is the same as for a wrong password, so nothing is revealed about other coachings.
    wanted = b.get('orgId')
    if isinstance(wanted, str) and wanted and (found.get('orgId') != wanted or found['role'] not in ('admin', 'staff')):
        fail()
        s.audit(found, 'login-failed', 'wrong coaching')
        raise invalid

    # two logins: 'super' for the super admin, 'admin' for the principal and the office staff of a coaching
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
    s = choose_org()
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
    s = choose_org()
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
    s = choose_org()
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
    s = choose_org()
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


@route('/api/auth/logout', ['POST'], 'any')
def logout():
    auth.destroy_session(store(), g.token)
    return ok()


@route('/api/auth/me', ['GET'], 'any')
def me():
    return {'user': auth.public_user(g.user)}


@route('/api/auth/change-password', ['POST'], 'any')
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
    g.user.pop('mustChangePassword', None)  # a password reset by somebody else has to be replaced by an own one
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
    org = root().org_get(s.org)
    if org:
        out['org'] = {'id': org['id'], 'name': org['name'], 'city': org.get('city', '')}
    if g.user['role'] in ('admin', 'staff'):
        out['users'] = [auth.public_user(u) for u in s.users_all()]
    return out


@route('/api/institute', ['PUT'], 'user')
def put_institute():
    """The browser sends what changed: { students: { upsert: [...], remove: [ids] }, profile: {...} }"""
    s = store()
    b = body(INSTITUTE_BODY)
    summary, adjusted = apply_changes(g.user, s, b.get('changes'))
    if summary:
        s.bump()
        s.audit(g.user, 'data', ', '.join(summary))
    # adjusted: how many things the server changed itself (renumbered, photo moved): the browser must fetch them
    return {'version': s.version(), 'adjusted': adjusted}


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
        if not student_id or not isinstance(student_id, str):
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
    target.pop('resetRequestedAt', None)
    if target['id'] != g.user['id']:
        target['mustChangePassword'] = True  # the person has to choose an own password at the next sign in
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


@route('/api/auth/profile', ['PUT'], 'user')
def update_profile():
    """Everybody can change their own phone number; everybody except students also their name
    (a student's name belongs to the admission record)."""
    s = store()
    b = body()
    user = g.user
    if g.user['role'] != 'student' and 'name' in b:
        name = text(b.get('name'))
        if not name:
            raise HttpError(400, 'Please enter your name.')
        user['name'] = name
    if 'phone' in b:
        phone = text(b.get('phone'), 30)
        if phone and len(last10(phone)) < 10:
            raise HttpError(400, 'Please enter a valid 10-digit mobile number.')
        if phone:
            user['phone'] = phone
        else:
            user.pop('phone', None)
    if 'subject' in b and user['role'] == 'teacher':
        subject = text(b.get('subject'))
        if subject:
            user['subject'] = subject
        else:
            user.pop('subject', None)
    s.save_user(user)
    s.bump()
    s.audit(g.user, 'profile', 'Own details changed')
    return {'user': auth.public_user(user)}


# ---------- coachings: public ----------


@route('/api/public/coachings', ['GET'])
def public_coachings():
    """The coachings a student or teacher can sign up to."""
    return {'coachings': [{'id': o['id'], 'name': o['name'], 'city': o.get('city', '')} for o in root().org_active_list()]}


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def _new_coaching(b, status):
    """Creates a coaching and its principal account. status: 'pending' (waits for the super admin) or 'active'."""
    r = root()
    name = text(b.get('coachingName'), 120)
    admin_name = text(b.get('adminName'))
    email = text(b.get('email')).lower()
    if not name:
        raise HttpError(400, 'Please enter the name of the coaching.')
    if not admin_name:
        raise HttpError(400, 'Please enter the name of the administrator.')
    if len(last10(b.get('phone'))) < 10:
        raise HttpError(400, 'Please enter a valid 10-digit mobile number.')
    check_email(email)
    check_password(b.get('password'))
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')

    org = {
        'id': new_id('org'),
        'name': name,
        'city': text(b.get('city'), 80),
        'status': status,
        'createdAt': _now_iso(),
    }
    user = auth.build_user(
        {
            'name': admin_name,
            'email': email,
            'password': b['password'],
            'role': 'admin',
            'phone': text(b.get('phone'), 30),
        },
        'active' if status == 'active' else 'pending',
    )
    r.org_save(org)
    tenant = r.for_org(org['id'])
    try:
        tenant.add_user(user)
    except DuplicateKeyError:
        r.org_remove(org['id'])
        raise HttpError(409, 'An account with this email already exists.')
    tenant.bump()
    return org, user


@route('/api/public/register-coaching', ['POST'])
def register_coaching():
    """A coaching asks to join. The super admin has to approve it before its principal can sign in."""
    limit_registrations()
    org, user = _new_coaching(body(), 'pending')
    root().for_org(PLATFORM_ORG).audit(None, 'coaching-requested', f'{org["name"]} ({user["email"]})')
    return ok()


# ---------- the super admin ----------


def _loopback():
    return client_ip() in ('127.0.0.1', '::1', 'localhost')


@route('/api/super/status', ['GET'])
def super_status():
    return {'hasSuper': root().for_org(PLATFORM_ORG).user_count() > 0}


@route('/api/super/setup', ['POST'])
def super_setup():
    """The first super admin. Only from the server computer itself, and only while there is none."""
    platform = root().for_org(PLATFORM_ORG)
    if platform.user_count() > 0:
        raise HttpError(409, 'The super admin already exists. Please sign in.')
    if not _loopback():
        raise HttpError(403, 'The first super admin can only be created on the server computer itself.')
    b = body()
    name = text(b.get('name'))
    email = text(b.get('email')).lower()
    if not name:
        raise HttpError(400, 'Please enter your full name.')
    check_email(email)
    check_password(b.get('password'))
    if email_taken(email):
        raise HttpError(409, 'An account with this email already exists.')
    user = auth.build_user({'name': name, 'email': email, 'password': b['password'], 'role': 'super'}, 'active')
    try:
        platform.add_user(user)
    except DuplicateKeyError:
        raise HttpError(409, 'An account with this email already exists.')
    platform.audit(user, 'super-setup', 'Super admin created')
    g.store = platform
    return start_session(user)


def _org_summary(org):
    """What the super admin may see of a coaching: who runs it and how big it is. Never its data."""
    tenant = root().for_org(org['id'])
    admins = [u for u in tenant.users_all() if u['role'] == 'admin']
    admin = admins[0] if admins else None
    return {
        **org,
        'admin': {
            'id': admin['id'],
            'name': admin['name'],
            'email': admin['email'],
            'phone': admin.get('phone', ''),
            'resetRequestedAt': admin.get('resetRequestedAt'),
        }
        if admin
        else None,
        'students': tenant.lists['students'].count_documents({}),
        'accounts': tenant.user_count(),
    }


def _get_org(org_id):
    org = root().org_get(org_id)
    if not org:
        raise HttpError(404, 'Coaching not found.')
    return org


@route('/api/super/audit', ['GET'], 'super')
def super_audit():
    """What happened on the platform: coachings requested, approved, switched off, passwords reset..."""
    limit = min(500, max(1, request.args.get('limit', default=100, type=int) or 100))
    return {'entries': g.store.audit_recent(limit)}


@route('/api/super/orgs', ['GET'], 'super')
def super_orgs():
    return {'orgs': [_org_summary(o) for o in root().org_list()]}


@route('/api/super/orgs', ['POST'], 'super')
def super_add_org():
    """The Super Admin adds a coaching. It never becomes active by itself: it goes to the requests that wait for
    approval, and only the Approve of the Super Admin makes it work (like a coaching that asked to join)."""
    org, user = _new_coaching(body(), 'pending')
    g.store.audit(g.user, 'coaching-requested', f'{org["name"]} ({user["email"]}) added by the Super Admin')
    return {'org': _org_summary(org)}


@route('/api/super/orgs/<org_id>', ['PUT'], 'super')
def super_edit_org(org_id):
    org = _get_org(org_id)
    b = body()
    name = text(b.get('name'), 120)
    if not name:
        raise HttpError(400, 'Please enter the name of the coaching.')
    org['name'] = name
    org['city'] = text(b.get('city'), 80)
    root().org_save(org)
    g.store.audit(g.user, 'coaching-edit', org['name'])
    return {'org': _org_summary(org)}


def _set_org_status(org_id, status, only_from=None):
    org = _get_org(org_id)
    if only_from and org.get('status') not in only_from:
        raise HttpError(400, 'This coaching is not in the right state for this action.')
    if org['id'] == DEFAULT_ORG and status == 'suspended':
        raise HttpError(400, 'The first coaching cannot be switched off.')
    org['status'] = status
    root().org_save(org)
    tenant = root().for_org(org['id'])
    if status == 'active':  # its principal can sign in now
        for u in tenant.users_all():
            if u['role'] == 'admin' and (u.get('status') or 'active') == 'pending':
                u['status'] = 'active'
                tenant.save_user(u)
    if status == 'suspended':  # everybody is signed out
        for u in tenant.users_all():
            auth.destroy_sessions_of(root(), u['id'])
    tenant.bump()
    return org


@route('/api/super/orgs/<org_id>/approve', ['POST'], 'super')
def super_approve_org(org_id):
    org = _set_org_status(org_id, 'active', only_from=('pending',))
    g.store.audit(g.user, 'coaching-approve', org['name'])
    return {'org': _org_summary(org)}


@route('/api/super/orgs/<org_id>/activate', ['POST'], 'super')
def super_activate_org(org_id):
    org = _set_org_status(org_id, 'active', only_from=('suspended',))
    g.store.audit(g.user, 'coaching-activate', org['name'])
    return {'org': _org_summary(org)}


@route('/api/super/orgs/<org_id>/suspend', ['POST'], 'super')
def super_suspend_org(org_id):
    org = _set_org_status(org_id, 'suspended', only_from=('active',))
    g.store.audit(g.user, 'coaching-suspend', org['name'])
    return {'org': _org_summary(org)}


@route('/api/super/orgs/<org_id>/reject', ['POST'], 'super')
def super_reject_org(org_id):
    """A request that is turned down is removed (nothing was ever stored for it)."""
    org = _get_org(org_id)
    if org.get('status') != 'pending':
        raise HttpError(400, 'Only a request that is waiting can be rejected.')
    root().for_org(org['id']).drop_org_data()
    root().org_remove(org['id'])
    g.store.audit(g.user, 'coaching-reject', org['name'])
    return ok()


@route('/api/super/orgs/<org_id>', ['DELETE'], 'super')
def super_delete_org(org_id):
    """Deletes a coaching with ALL its data. The super admin has to type the name of the coaching."""
    org = _get_org(org_id)
    if org['id'] == DEFAULT_ORG:
        raise HttpError(400, 'The first coaching cannot be deleted.')
    if text(body().get('confirmName')) != org['name']:
        raise HttpError(400, 'Type the exact name of the coaching to delete it.')
    tenant = root().for_org(org['id'])
    for u in tenant.users_all():
        auth.destroy_sessions_of(root(), u['id'])
    tenant.drop_org_data()
    root().org_remove(org['id'])
    g.store.audit(g.user, 'coaching-delete', org['name'])
    return ok()


@route('/api/super/orgs/<org_id>/reset-admin-password', ['POST'], 'super')
def super_reset_admin_password(org_id):
    org = _get_org(org_id)
    new = body().get('newPassword')
    check_password(new)
    tenant = root().for_org(org['id'])
    admin = next((u for u in tenant.users_all() if u['role'] == 'admin'), None)
    if not admin:
        raise HttpError(404, 'This coaching has no administrator.')
    auth.set_password(admin, new)
    admin.pop('resetRequestedAt', None)
    admin['mustChangePassword'] = True  # the Super Admin knows this password, so the principal must replace it
    tenant.save_user(admin)
    auth.destroy_sessions_of(root(), admin['id'])
    g.store.audit(g.user, 'coaching-admin-password', f'{org["name"]} ({admin["email"]})')
    return ok()


# ---------- student photos ----------


@route('/api/photos/<student_id>/<token>', ['GET'])
def student_photo(student_id, token):
    """The address contains a random token, so only people who were sent the record can open a photo
    (a browser <img> cannot send the sign-in token)."""
    org_id = request.args.get('o') or DEFAULT_ORG
    r = root()
    if r.org_get(org_id) is None:
        raise HttpError(404, 'Not found')
    doc = r.for_org(org_id).get_photo(student_id)
    if not doc or not hmac.compare_digest(str(doc.get('token', '')).encode(), token.encode()):
        raise HttpError(404, 'Not found')
    response = Response(doc['data'], mimetype=doc.get('contentType', 'image/jpeg'))
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'  # a new photo gets a new address
    return response


# ---------- backups (principal only) ----------


def _download(data, filename):
    response = Response(json.dumps(data, separators=(',', ':')), mimetype='application/json')
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _require_confirm(b):
    if b.get('confirm') != 'RESTORE':
        raise HttpError(400, 'Restoring replaces the current data. Confirm it by sending confirm: "RESTORE".')


def _restore(payload, accounts):
    """Puts a backup back. A snapshot of the current data is taken first, so a restore can be undone."""
    s = store()
    before = s.snapshot('before restore')
    try:
        report = s.restore_data(payload, accounts=accounts)
    except ValueError as err:
        raise HttpError(400, str(err))
    s.audit(g.user, 'restore', f'{sum(report["lists"].values())} records, {report["accounts_added"]} accounts added')
    report['safety_snapshot'] = before
    return report


@route('/api/backup', ['GET'], 'admin')
def download_backup():
    """Everything in one file: data, accounts (with password hashes), photos. Keep it safe."""
    s = store()
    data = s.export_data(accounts=True, photos=True)
    s.audit(g.user, 'backup-download')
    return _download(data, f'academiaos-backup-{data["exportedAt"][:10]}.json')


@route('/api/backup/restore', ['POST'], 'admin')
def restore_backup():
    b = body(INSTITUTE_BODY)
    _require_confirm(b)
    return _restore(b.get('backup'), accounts=b.get('accounts') is not False)


@route('/api/backups', ['GET'], 'admin')
def list_backups():
    return {'backups': store().list_backups()}


@route('/api/backups', ['POST'], 'admin')
def create_backup():
    s = store()
    snapshot_id = s.snapshot(text(body().get('label')) or 'manual')
    if not snapshot_id:
        raise HttpError(413, 'The data is too big for a stored backup. Use "Download backup" instead.')
    s.audit(g.user, 'backup-create', snapshot_id)
    return {'id': snapshot_id}


@route('/api/backups/<backup_id>', ['GET'], 'admin')
def download_stored_backup(backup_id):
    data = store().get_backup(backup_id)
    if data is None:
        raise HttpError(404, 'Backup not found.')
    return _download(data, f'academiaos-backup-{backup_id}.json')


@route('/api/backups/<backup_id>/restore', ['POST'], 'admin')
def restore_stored_backup(backup_id):
    b = body()
    _require_confirm(b)
    data = store().get_backup(backup_id)
    if data is None:
        raise HttpError(404, 'Backup not found.')
    return _restore(data, accounts=b.get('accounts') is not False)
