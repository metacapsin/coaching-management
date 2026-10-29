"""Who may see and change which institute data.

  admin    everything
  staff    everything except the institute profile (settings) and the expenses (money the coaching spends)
  teacher  only their own batches: attendance and test marks, study material and notices for those batches
  student  only their own record, attendance, fees, results, timetable, notices and study material (read only)

Reading and writing are checked here on the server, so the browser never receives data
it is not allowed to see.
"""

import base64
import binascii
import math
import re

from .errors import HttpError
from .store import LISTS

MAX_ITEMS_PER_REQUEST = 200000

# Lists only the principal may see and change
PRINCIPAL_ONLY = {'expenses', 'salaries'}


def rank_of(score, scores):
    """Equal marks share a rank (1, 2, 2, 4)."""
    return sum(1 for s in scores if s > score) + 1


def _round(x):
    return math.floor(x + 0.5)  # like Math.round (halves go up)


# ---------- reading ----------


def scope_institute(user, store):
    role = user['role']
    present = store.present()
    profile = store.profile()

    if role in ('admin', 'staff'):
        # Only what exists. A missing list lets the first admin browser add the starting data.
        out = {}
        if profile is not None:
            out['profile'] = profile
        for name in LISTS:
            if name in present and (role == 'admin' or name not in PRINCIPAL_ONLY):
                out[name] = store.find(name)
        return out

    base = {'profile': profile} if profile is not None else {}

    if role == 'teacher':
        ids = user.get('batchIds') or []
        return {
            **base,
            'courses': store.find('courses'),
            'templates': store.find('templates'),
            'batches': store.find('batches', {'_id': {'$in': ids}}),
            'students': store.find('students', {'batchId': {'$in': ids}}),
            'attendance': store.find('attendance', {'batchId': {'$in': ids}}),
            'exams': store.find('exams', {'batchId': {'$in': ids}}),
            'timetable': store.find('timetable', {'batchId': {'$in': ids}}),
            'transactions': [],
            'notificationLogs': [],
            'enquiries': [],
            'expenses': [],
            'salaries': [],
            'books': store.find('books'),
            'announcements': store.find('announcements', {'$or': [{'audience': 'all'}, {'batchId': {'$in': ids}}]}),
            'materials': store.find('materials', {'batchId': {'$in': ids}}),
            'submissions': store.find(
                'submissions',
                {'materialId': {'$in': [m['id'] for m in store.find('materials', {'batchId': {'$in': ids}})]}},
            ),
        }

    # student
    empty = {
        **base,
        'courses': [],
        'templates': [],
        'students': [],
        'batches': [],
        'attendance': [],
        'exams': [],
        'timetable': [],
        'transactions': [],
        'notificationLogs': [],
        'enquiries': [],
        'expenses': [],
        'salaries': [],
        'books': [],
        'announcements': [],
        'materials': [],
        'submissions': [],
    }
    me = store.get_item('students', user.get('studentId')) if user.get('studentId') else None
    if not me:
        return empty

    exams = []
    for e in store.find('exams', {'batchId': me.get('batchId')}):
        results = e.get('results') or {}
        own = results.get(me['id'])
        # Results are visible only after the exam is published
        if e.get('status') != 'published' or not own:
            exams.append({**e, 'results': {}})
            continue
        # Classmates' marks are used for the rank and average only, they are never sent
        scores = [r['marksObtained'] for r in results.values() if not r.get('absent')]
        if own.get('absent'):
            scored = dict(own)
        else:
            scored = {
                **own,
                'rank': rank_of(own['marksObtained'], scores),
                'totalGraded': len(scores),
                'highest': max(scores),
                'average': _round(sum(scores) / len(scores)),
            }
        exams.append({**e, 'results': {me['id']: scored}})

    attendance = [
        {**a, 'records': {me['id']: a['records'][me['id']]}}
        for a in store.find('attendance', {'batchId': me.get('batchId')})
        if (a.get('records') or {}).get(me['id'])
    ]

    logs = [
        log
        for log in store.find('notificationLogs')
        if (log.get('studentId') == me['id'] if log.get('studentId') else log.get('studentName') == me.get('name'))
    ]

    return {
        **empty,
        'courses': store.find('courses', {'_id': me.get('courseId')}),
        'students': [me],
        'batches': store.find('batches', {'_id': me.get('batchId')}),
        'attendance': attendance,
        'exams': exams,
        'timetable': store.find('timetable', {'batchId': me.get('batchId')}),
        'transactions': store.find('transactions', {'studentId': me['id']}),
        'notificationLogs': logs,
        'announcements': store.find('announcements', {'$or': [{'audience': 'all'}, {'batchId': me.get('batchId')}]}),
        'materials': store.find('materials', {'batchId': me.get('batchId')}),
        'books': store.find('books'),
        'submissions': store.find('submissions', {'studentId': me['id']}),
    }


# ---------- writing ----------


def _check_items(name, items):
    for item in items:
        if not isinstance(item, dict):
            raise HttpError(400, f'{name}: every item must be an object.')
        item_id = item.get('id')
        if not isinstance(item_id, str) or not item_id or len(item_id) > 200:
            raise HttpError(400, f'{name}: every item needs an id.')


def _parse_change(name, change):
    if not isinstance(change, dict):
        raise HttpError(400, f'{name}: invalid change.')
    upsert = change.get('upsert') if change.get('upsert') is not None else []
    remove = change.get('remove') if change.get('remove') is not None else []
    if not isinstance(upsert, list) or not isinstance(remove, list):
        raise HttpError(400, f'{name}: invalid change.')
    if len(upsert) + len(remove) > MAX_ITEMS_PER_REQUEST:
        raise HttpError(413, f'{name}: too many changes.')
    _check_items(name, upsert)
    if any(not isinstance(i, str) for i in remove):
        raise HttpError(400, f'{name}: remove needs ids.')
    return {'upsert': upsert, 'remove': remove}


def _teacher_plan(name, change, user, store):
    ids = user.get('batchIds') or []

    if name == 'materials':
        # Study material of their own batches: add, change and remove
        existing = store.get_many('materials', [m['id'] for m in change['upsert']] + change['remove'])
        for m in change['upsert']:
            if m.get('batchId') not in ids or (m['id'] in existing and existing[m['id']].get('batchId') not in ids):
                raise HttpError(403, 'You can only post study material for your own batches.')
        for rid in change['remove']:
            if rid in existing and existing[rid].get('batchId') not in ids:
                raise HttpError(403, 'You can only remove study material of your own batches.')
        return change

    if name == 'announcements':
        # Notices to their own batches; they can only change or remove their own notices
        existing = store.get_many('announcements', [a['id'] for a in change['upsert']] + change['remove'])
        upsert = []
        for a in change['upsert']:
            if a.get('audience') != 'batch' or a.get('batchId') not in ids:
                raise HttpError(403, 'You can only post notices to your own batches.')
            if a['id'] in existing and existing[a['id']].get('authorId') != user['id']:
                raise HttpError(403, 'You can only change your own notices.')
            upsert.append({**a, 'authorId': user['id'], 'authorName': user['name']})
        for rid in change['remove']:
            if rid in existing and existing[rid].get('authorId') != user['id']:
                raise HttpError(403, 'You can only remove your own notices.')
        return {'upsert': upsert, 'remove': change['remove']}

    if change['remove']:
        raise HttpError(403, 'Teachers cannot delete records.')

    if name == 'attendance':
        for a in change['upsert']:
            if a.get('batchId') not in ids:
                raise HttpError(403, 'You can only mark attendance for your own batches.')
        return change

    if name == 'exams':
        by_id = store.get_many('exams', [e['id'] for e in change['upsert']])
        upsert = []
        for e in change['upsert']:
            existing = by_id.get(e['id'])
            if existing:
                if existing.get('batchId') not in ids:
                    raise HttpError(403, 'You can only change tests of your own batches.')
                # For an existing test only the marks and the status can change
                upsert.append(
                    {
                        **existing,
                        'results': e['results'] if e.get('results') is not None else existing.get('results'),
                        'status': e['status'] if e.get('status') is not None else existing.get('status'),
                    }
                )
            else:
                if e.get('batchId') not in ids:
                    raise HttpError(403, 'You can only add tests for your own batches.')
                upsert.append(e)
        return {'upsert': upsert, 'remove': []}

    if name == 'notificationLogs':
        # Messages can be added, never changed
        known = store.get_many('notificationLogs', [log['id'] for log in change['upsert']])
        return {'upsert': [log for log in change['upsert'] if log['id'] not in known], 'remove': []}

    raise HttpError(403, f'Teachers cannot change {name}.')


# Two computers can pick the same roll / receipt number at the same moment.
# The record that arrived second gets the next free number, so no data is lost.
UNIQUE_FIELD = {'students': 'rollNo', 'transactions': 'receiptNo'}
_SPLIT = re.compile(r'^(.*?)(\d+)$', re.S)


def _make_unique(name, plan, store):
    field = UNIQUE_FIELD.get(name)
    if not field or not plan['upsert']:
        return 0

    values = store.field_values(name, field)  # record id -> number
    existing_ids = set(values)
    for rid in plan['remove']:
        values.pop(rid, None)

    new_ids = []
    latest = {}
    for item in plan['upsert']:
        item_id = item['id']
        if item_id not in existing_ids and item_id not in latest:
            new_ids.append(item_id)
        latest[item_id] = item
        values[item_id] = item.get(field)
    for rid in plan['remove']:
        values.pop(rid, None)

    fixed = {}
    for item_id in new_ids:
        item = latest[item_id]
        value = item.get(field)
        if not isinstance(value, str) or item_id not in values:
            continue
        if not any(other != item_id and ov == value for other, ov in values.items()):
            continue
        parts = _SPLIT.match(value)
        if not parts:
            continue
        prefix, digits = parts.group(1), parts.group(2)
        highest = 0
        for ov in values.values():
            other = _SPLIT.match(ov) if isinstance(ov, str) else None
            if other and other.group(1) == prefix:
                highest = max(highest, int(other.group(2)))
        new_value = f'{prefix}{str(highest + 1).zfill(len(digits))}'
        fixed[item_id] = {**item, field: new_value}
        values[item_id] = new_value

    if fixed:
        # only the first (new) copy of a record is renumbered
        done = set()
        out = []
        for item in plan['upsert']:
            if item['id'] in fixed and item['id'] not in done:
                out.append(fixed[item['id']])
                done.add(item['id'])
            else:
                out.append(item)
        plan['upsert'] = out
    return len(fixed)


_PHOTO_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
MAX_PHOTO_BYTES = 1_500_000
_DATA_URL = re.compile(r'^data:(image/[a-z+.-]+);base64,(.*)$', re.S)


def parse_photo_data_url(url):
    """'data:image/jpeg;base64,...' -> (content type, bytes). Raises HttpError for anything else."""
    match = _DATA_URL.match(url)
    if not match or match.group(1) not in _PHOTO_TYPES:
        raise HttpError(400, 'The photo must be a JPG, PNG, WebP or GIF image.')
    try:
        data = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HttpError(400, 'The photo could not be read.')
    if len(data) > MAX_PHOTO_BYTES:
        raise HttpError(413, 'The photo is too big (the limit is 1.5 MB).')
    return match.group(1), data


def _store_photos(plan, store):
    """A photo sent as a data URL is saved apart and replaced by a short address, so the lists stay small.
    Returns how many photos were moved."""
    moved = 0
    upsert = []
    for item in plan['upsert']:
        url = item.get('photoUrl')
        if isinstance(url, str) and url.startswith('data:'):
            content_type, data = parse_photo_data_url(url)
            token = store.save_photo(item['id'], content_type, data)
            item = {**item, 'photoUrl': store.photo_url(item['id'], token)}
            moved += 1
        upsert.append(item)
    plan['upsert'] = upsert
    return moved


def apply_changes(user, store, changes):
    """Applies a set of changes. Nothing is written unless every part is allowed.
    changes: { profile?: dict, <list name>: { upsert?: [...], remove?: [ids] } }
    Returns (summary for the activity log, how many things the server adjusted)."""
    if not isinstance(changes, dict):
        raise HttpError(400, 'Invalid changes.')
    if user['role'] == 'student':
        raise HttpError(403, 'Students cannot change institute data.')

    for name in changes:
        if name != 'profile' and name not in LISTS:
            raise HttpError(400, f'Unknown data: {name}')

    has_profile = False
    profile = None
    plans = []

    for name, change in changes.items():
        if name == 'profile':
            if user['role'] != 'admin':
                raise HttpError(403, 'Only the principal can change the institute profile.')
            if not isinstance(change, dict):
                raise HttpError(400, 'profile: invalid.')
            has_profile = True
            profile = change
            continue
        parsed = _parse_change(name, change)
        if name == 'submissions':
            raise HttpError(403, 'Homework is marked as done by the students themselves.')
        if name in PRINCIPAL_ONLY and user['role'] != 'admin':
            raise HttpError(403, 'Only the principal can change the expenses.')
        if user['role'] == 'teacher':
            parsed = _teacher_plan(name, parsed, user, store)
        plans.append((name, parsed))

    adjusted_total = 0  # things the server changed for the browser (renumbered, photos moved): it must fetch them
    for name, plan in plans:
        adjusted_total += _make_unique(name, plan, store)
        if name == 'students':
            adjusted_total += _store_photos(plan, store)

    summary = []
    if has_profile:
        store.set_profile(profile)
        summary.append('profile')

    for name, plan in plans:
        added, updated, removed = store.apply_list(name, plan['upsert'], plan['remove'])
        if name == 'students':
            store.delete_photos(plan['remove'])
        if added or updated or removed:
            summary.append(f'{name} +{added} ~{updated} -{removed}')
    if adjusted_total and summary:
        summary[-1] += f' ({adjusted_total} adjusted)'
    return summary, adjusted_total
