"""Passwords, sessions and login throttling.

Passwords are stored with scrypt using the same settings as the Node server, so accounts made by
either server can sign in on the other."""

import hashlib
import hmac
import secrets
import threading
import time

SESSION_REMEMBER_SEC = 30 * 24 * 60 * 60
SESSION_SHORT_SEC = 12 * 60 * 60

# ---------- passwords ----------


def new_salt():
    return secrets.token_hex(16)


def sha256_hex(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def hash_password(password, salt):
    return hashlib.scrypt(
        password.encode('utf-8'), salt=salt.encode('utf-8'), n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024
    ).hex()


def _imul(a, b):
    """Math.imul: 32-bit signed multiplication."""
    r = ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF
    return r - 0x100000000 if r >= 0x80000000 else r


def _int32(n):
    n &= 0xFFFFFFFF
    return n - 0x100000000 if n >= 0x80000000 else n


def basic_hash(value):
    """Weak hash an old version of the app used when the browser had no crypto.subtle.
    Kept only so those accounts can still sign in once (they are upgraded right after)."""
    h1 = _int32(0xDEADBEEF)
    h2 = 0x41C6CE57
    raw = value.encode('utf-16-le')
    for i in range(0, len(raw), 2):
        ch = raw[i] | (raw[i + 1] << 8)
        h1 = _imul(h1 ^ ch, 2654435761)
        h2 = _imul(h2 ^ ch, 1597334677)
    h1 = _int32(_imul(h1 ^ ((h1 & 0xFFFFFFFF) >> 16), 2246822507) ^ _imul(h2 ^ ((h2 & 0xFFFFFFFF) >> 13), 3266489909))
    h2 = _int32(_imul(h2 ^ ((h2 & 0xFFFFFFFF) >> 16), 2246822507) ^ _imul(h1 ^ ((h1 & 0xFFFFFFFF) >> 13), 3266489909))
    return format(4294967296 * (2097151 & h2) + (h1 & 0xFFFFFFFF), 'x')


def _safe_equal(a, b):
    return hmac.compare_digest(str(a).encode('utf-8'), str(b).encode('utf-8'))


def verify_password(user, password):
    alg = user.get('alg')
    if alg == 'scrypt':
        return _safe_equal(hash_password(password, user['salt']), user['passwordHash'])
    salted = f"{user['salt']}:{password}"
    if alg == 'sha256':
        return _safe_equal(sha256_hex(salted), user['passwordHash'])
    if alg == 'basic':
        return _safe_equal(basic_hash(salted), user['passwordHash'])
    return False


def needs_upgrade(user):
    """Accounts that were created with an older hash are moved to scrypt at their next sign in."""
    return user.get('alg') != 'scrypt'


def set_password(user, password):
    user['salt'] = new_salt()
    user['alg'] = 'scrypt'
    user['passwordHash'] = hash_password(password, user['salt'])


def build_user(data, status):
    from datetime import datetime, timezone

    user = {
        'id': f'u-{int(time.time() * 1000)}-{secrets.randbelow(100000)}',
        'name': data['name'].strip(),
        'email': data['email'].strip().lower(),
        'role': data['role'],
        'status': status,
        'createdAt': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
    }
    for key in ('phone', 'subject'):
        value = (data.get(key) or '').strip()
        if value:
            user[key] = value
    if data.get('studentId'):
        user['studentId'] = data['studentId']
    if data.get('isParent'):
        user['isParent'] = True  # a parent's login: it sees the child's data, read only
    if data['role'] == 'teacher':
        user['batchIds'] = list(data.get('batchIds') or [])
    set_password(user, data['password'])
    return user


PUBLIC_FIELDS = ('id', 'name', 'email', 'role', 'status', 'createdAt', 'phone', 'subject', 'studentId', 'batchIds', 'resetRequestedAt', 'orgId', 'mustChangePassword', 'isParent')


def public_user(u):
    """What the browser may see about an account (never the hash)."""
    out = {k: u[k] for k in PUBLIC_FIELDS if k in u and u[k] is not None}
    out['status'] = u.get('status') or 'active'
    return out


# ---------- sessions ----------


def create_session(store, user_id, remember):
    token = secrets.token_urlsafe(32)
    store.add_session(sha256_hex(token), user_id, SESSION_REMEMBER_SEC if remember else SESSION_SHORT_SEC)
    return token


def user_for_token(store, token):
    """Returns the signed-in, active account for a token (or None)."""
    if not token:
        return None
    session = store.get_session(sha256_hex(token))
    if not session or store.session_expired(session):
        return None
    user = store.user_by_id_any(session['userId'])
    return user if user and (user.get('status') or 'active') == 'active' else None


def destroy_session(store, token):
    store.delete_session(sha256_hex(token))


def destroy_sessions_of(store, user_id, keep_token=None):
    """Signs an account out everywhere (optionally keeping one session, for example the current one)."""
    store.delete_sessions_of(user_id, sha256_hex(keep_token) if keep_token else None)


# ---------- throttling ----------


class Limiter:
    """Counts failures per key; after `max_failures` inside `window` seconds the key is blocked for `lock` seconds."""

    def __init__(self, max_failures, window_sec, lock_sec):
        self.max = max_failures
        self.window = window_sec
        self.lock_sec = lock_sec
        self.entries = {}
        self._lock = threading.Lock()

    def check(self, key):
        """Returns None when allowed, otherwise the seconds to wait."""
        now = time.time()
        with self._lock:
            e = self.entries.get(key)
            if e and e['locked_until'] > now:
                return int(e['locked_until'] - now) + 1
        return None

    def fail(self, key):
        now = time.time()
        with self._lock:
            if len(self.entries) > 5000:
                for k in [k for k, v in self.entries.items() if v['locked_until'] <= now and now - v['first'] > self.window]:
                    del self.entries[k]
            e = self.entries.get(key)
            if not e or now - e['first'] > self.window:
                e = {'count': 0, 'first': now, 'locked_until': 0}
            e['count'] += 1
            if e['count'] >= self.max:
                e['locked_until'] = now + self.lock_sec
                e['count'] = 0
                e['first'] = now
            self.entries[key] = e

    def reset(self, key):
        with self._lock:
            self.entries.pop(key, None)
