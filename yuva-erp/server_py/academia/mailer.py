"""Sends an email through any SMTP service (a free Gmail account works: SMTP_HOST=smtp.gmail.com and an "app password").

Settings (environment or server_py/.env): SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM (default SMTP_USER).
Without them nothing is sent and `configured()` is False, so the app tells the person that no email was sent.

Emails are sent one after the other by one background worker (a service like Gmail can refuse two logins at the same moment),
and an email that fails is tried once more.
"""

import os
import queue
import smtplib
import threading
import time
from email.message import EmailMessage

from .config import load_dotenv, ROOT


def _settings():
    load_dotenv(ROOT / '.env')
    host = os.environ.get('SMTP_HOST', '').strip()
    user = os.environ.get('SMTP_USER', '').strip()
    password = os.environ.get('SMTP_PASSWORD', '').strip()
    return {
        'host': host,
        'port': int(os.environ.get('SMTP_PORT') or '587'),
        'user': user,
        'password': password,
        'sender': os.environ.get('SMTP_FROM', '').strip() or user,
    }


def configured():
    s = _settings()
    return bool(s['host'] and s['user'] and s['password'])


def _deliver(to, subject, text, html=None):
    """Sends one email now. Returns True when the service took it; a failure is written to the log, never raised."""
    s = _settings()
    msg = EmailMessage()
    msg['From'] = s['sender']
    msg['To'] = to
    msg['Subject'] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype='html')  # programs that show HTML use this, the others show the plain text
    try:
        with smtplib.SMTP(s['host'], s['port'], timeout=20) as smtp:
            smtp.starttls()
            smtp.login(s['user'], s['password'])
            smtp.send_message(msg)
        print(f'[mail] sent to {to}: {subject}')
        return True
    except Exception as err:  # a failed email must never break the approval itself
        print(f'[mail] could not send to {to}: {err}')
        return False


_jobs = queue.Queue()
_worker = None
_worker_lock = threading.Lock()


def _work():
    while True:
        job = _jobs.get()
        try:
            if not _deliver(*job):
                time.sleep(3)
                _deliver(*job)  # one more try
        finally:
            _jobs.task_done()


def send(to, subject, text, html=None):
    """Puts the email in the line of the background worker. Returns True when it was taken, False when email is not set up."""
    global _worker
    if not to or not configured():
        return False
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_work, daemon=True)
            _worker.start()
    _jobs.put((to, subject, text, html))
    return True
