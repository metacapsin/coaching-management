"""Input rules shared by the routes. They are the same rules the sign-up screens show."""

import random
import re
import time
from datetime import datetime

EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
MAX_PASSWORD_LENGTH = 200  # very long passwords would only slow the server down


def password_problem(pw):
    if not isinstance(pw, str) or len(pw) < 8:
        return 'Password must be at least 8 characters.'
    if len(pw) > MAX_PASSWORD_LENGTH:
        return 'Password is too long.'
    if not re.search(r'[A-Za-z]', pw) or not re.search(r'\d', pw):
        return 'Password must include at least one letter and one number.'
    return None


def text(value, max_len=200):
    return value.strip()[:max_len] if isinstance(value, str) else ''


def last10(value):
    return re.sub(r'\D', '', str(value or ''))[-10:]


def norm_roll(value):
    """'05', '5' and '005' all become the same key (older numbers like 'APEX-25-0105' too)."""
    s = str(value or '').upper().strip()
    s = re.sub(r'(\d+)(?=\D*$)', lambda m: str(int(m.group(1))), s, count=1)
    return re.sub(r'[^A-Z0-9]', '', s)


def normalize_phone(value):
    """One format for stored phones: '+91 98765 43210' for 10-digit Indian numbers."""
    raw = str(value or '')
    digits = re.sub(r'\D', '', raw)
    ten = digits[-10:] if len(digits) >= 10 else ''
    if ten and (len(digits) == 10 or digits.startswith('91') or digits.startswith('0')):
        return f'+91 {ten[:5]} {ten[5:]}'
    return raw.strip()


def today_local():
    return datetime.now().strftime('%Y-%m-%d')


def new_id(prefix):
    return f'{prefix}-{int(time.time() * 1000)}-{random.randrange(10**6)}'


def role_label(role):
    return {
        'admin': 'Principal (Administrator)',
        'staff': 'Front Desk Staff',
        'teacher': 'Teacher',
        'student': 'Student',
        'super': 'Super Admin',
    }.get(role, 'User')


def portal_label(role):
    """Which login tab a role belongs to."""
    if role == 'super':
        return 'Super Admin'
    return 'Teacher / Student' if role in ('student', 'teacher') else 'Coaching Admin'
