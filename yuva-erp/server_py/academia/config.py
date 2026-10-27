"""Settings. Values come from environment variables, or from server_py/.env (not part of git)."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # server_py/
PROJECT = ROOT.parent  # yuva-erp/


def load_dotenv(path):
    """Reads KEY=VALUE lines. Variables that are already set are not replaced."""
    try:
        lines = Path(path).read_text(encoding='utf-8').splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def settings():
    load_dotenv(ROOT / '.env')
    return {
        'mongodb_uri': os.environ.get('MONGODB_URI', ''),
        'mongodb_db': os.environ.get('MONGODB_DB', 'academiaos'),
        'host': os.environ.get('DB_HOST', '0.0.0.0'),
        # hosting services (Render...) tell the program its port in PORT
        'port': int(os.environ.get('DB_PORT') or os.environ.get('PORT') or '3001'),
        'dist_dir': Path(os.environ.get('DIST_DIR', PROJECT / 'dist')),
        'legacy_file': PROJECT / 'server' / 'data' / 'db.json',
    }
