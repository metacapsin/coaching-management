"""Roll numbers are plain running numbers like in a school register: 01, 02, 03 ... 99, 100.
A new student gets the highest number in the list + 1."""

import re


def is_plain(value):
    return re.fullmatch(r'\d+', str(value if value is not None else '').strip()) is not None


def format_roll(n):
    return str(n).zfill(2)


def highest_plain(students):
    best = 0
    for s in students:
        if is_plain(s.get('rollNo')):
            best = max(best, int(str(s['rollNo']).strip()))
    return best


def next_roll_number(students):
    return format_roll(highest_plain(students) + 1)


def _tail_number(value):
    m = re.search(r'(\d+)\D*$', str(value or ''))
    return int(m.group(1)) if m else 0


def renumber_legacy_rolls(students):
    """Older data used numbers like APEX-25-0101. Those students get plain numbers in the same order
    (APEX-25-0101 -> 01, APEX-25-0102 -> 02 ...). Returns { student id: new roll number }."""
    legacy = sorted(
        (s for s in students if not is_plain(s.get('rollNo'))),
        key=lambda s: (_tail_number(s.get('rollNo')), str(s.get('dateOfAdmission') or '')),
    )
    nxt = highest_plain(students) + 1
    mapping = {}
    for s in legacy:
        mapping[s['id']] = format_roll(nxt)
        nxt += 1
    return mapping
