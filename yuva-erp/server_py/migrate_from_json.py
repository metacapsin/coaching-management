"""python migrate_from_json.py [path]

Moves the accounts and the institute data of the older Node server (server/data/db.json) into MongoDB.
The old file is only read, never changed. It refuses to run when MongoDB already has accounts,
so nothing is overwritten by mistake (use --force to add the old data anyway)."""

import json
import sys

from academia import connect
from academia.config import settings
from academia.legacy import import_legacy
from academia.store import Store


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    cfg = settings()
    path = args[0] if args else cfg['legacy_file']

    try:
        with open(path, encoding='utf-8') as f:
            raw = json.load(f)
    except (OSError, ValueError) as err:
        print(f'Could not read {path}: {err}')
        sys.exit(1)

    store = Store(connect(cfg))
    if store.user_count() > 0 and not force:
        print('MongoDB already has accounts. Nothing was changed. (Use --force to add the old data anyway.)')
        sys.exit(1)

    report = import_legacy(store, raw)
    print(f'Accounts moved: {report["users"]} (skipped: {report["skipped_users"]})')
    for name, count in report['lists'].items():
        print(f'  {name}: {count}')
    if report['renumbered']:
        print(f'Roll numbers changed to plain numbers (01, 02, ...): {report["renumbered"]}')
    print('Done. Start the server with: python run.py')


if __name__ == '__main__':
    main()
