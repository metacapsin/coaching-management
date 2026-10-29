"""Sends an email through any SMTP service (a free Gmail account works: SMTP_HOST=smtp.gmail.com and an "app password").

Settings (environment or server_py/.env): SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM (default SMTP_USER).
Without them nothing is sent and `configured()` is False, so the app tells the person that no email was sent.
"""

import os
import smtplib
import threading
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


def _deliver(to, subject, text):
    s = _settings()
    msg = EmailMessage()
    msg['From'] = s['sender']
    msg['To'] = to
    msg['Subject'] = subject
    msg.set_content(text)
    try:
        with smtplib.SMTP(s['host'], s['port'], timeout=15) as smtp:
            smtp.starttls()
            smtp.login(s['user'], s['password'])
            smtp.send_message(msg)
    except Exception as err:  # a failed email must never break the approval itself
        print(f'[mail] could not send to {to}: {err}')


def send(to, subject, text):
    """Sends in the background. Returns True when an email was handed over, False when email is not set up."""
    if not to or not configured():
        return False
    threading.Thread(target=_deliver, args=(to, subject, text), daemon=True).start()
    return True
