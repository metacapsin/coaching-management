"""Moves the data of the older Node server (server/data/db.json) into MongoDB."""

import json

from .rollno import renumber_legacy_rolls
from .store import LISTS

LEGACY_USERS_KEY = 'academia_os_users_v1'
LEGACY_INSTITUTE_KEY = 'academia_os_institute_data_v1'


def _parse(value, fallback):
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
    except ValueError:
        return fallback
    return fallback if parsed is None else parsed


def extract(raw):
    """Returns (accounts, institute data) from either layout of the old data file."""
    if isinstance(raw, dict) and raw.get('format') == 2:
        users = raw.get('users') or []
        institute = raw.get('institute') or {}
    else:
        data = (raw or {}).get('data') or {}
        users = _parse(data.get(LEGACY_USERS_KEY), [])
        institute = _parse(data.get(LEGACY_INSTITUTE_KEY), {})
    return (users if isinstance(users, list) else []), (institute if isinstance(institute, dict) else {})


def import_legacy(store, raw):
    """Adds the accounts and institute data of the old file. Returns a short report."""
    users, institute = extract(raw)
    report = {'users': 0, 'skipped_users': 0, 'lists': {}, 'renumbered': 0}

    for user in users:
        user = {k: v for k, v in user.items() if k != '_id'}
        if not user.get('id') or not user.get('email') or store.user_by_email(user['email']) or store.user_by_id(user['id']):
            report['skipped_users'] += 1
            continue
        user.setdefault('status', 'active')
        store.add_user(user)
        report['users'] += 1

    if isinstance(institute.get('profile'), dict):
        store.set_profile(institute['profile'])

    # Older data used roll numbers like APEX-25-0101: they become plain running numbers (01, 02, ...)
    students = institute.get('students') if isinstance(institute.get('students'), list) else None
    new_roll = renumber_legacy_rolls(students) if students else {}
    if new_roll:
        institute['students'] = [{**s, 'rollNo': new_roll[s['id']]} if s['id'] in new_roll else s for s in students]
        if isinstance(institute.get('transactions'), list):
            institute['transactions'] = [
                {**t, 'studentRollNo': new_roll[t['studentId']]} if t.get('studentId') in new_roll else t
                for t in institute['transactions']
            ]
        report['renumbered'] = len(new_roll)

    for name in LISTS:
        items = institute.get(name)
        if isinstance(items, list):
            items = [i for i in items if isinstance(i, dict) and isinstance(i.get('id'), str)]
            store.replace_list(name, items)
            report['lists'][name] = len(items)

    store.bump()
    return report
