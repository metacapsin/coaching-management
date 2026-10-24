"""Automatic daily backup: a snapshot of the data is kept inside MongoDB (the last 14 are kept)."""

import threading
import time
from datetime import datetime, timedelta, timezone

CHECK_EVERY_SEC = 30 * 60
DAILY = timedelta(hours=24)


def snapshot_if_due(store, every=DAILY, now=None):
    """Makes an automatic snapshot when the last one is older than `every`. Returns its id, or None."""
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    last = store.latest_backup_time('automatic')
    if last is not None and now - last < every:
        return None
    return store.snapshot('automatic')


def start_daily_snapshots(store):
    """Checks every half hour in the background (a day without a snapshot is caught up at start)."""

    def loop():
        while True:
            try:
                snapshot_if_due(store)
            except Exception as err:  # a failed backup must never stop the server
                print('Automatic backup failed:', err)
            time.sleep(CHECK_EVERY_SEC)

    thread = threading.Thread(target=loop, name='daily-backup', daemon=True)
    thread.start()
    return thread
