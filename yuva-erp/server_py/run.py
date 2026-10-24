"""python run.py   starts the Flask server on http://localhost:3001 (same address as the Node server)."""

import sys

from academia import create_app
from academia.config import settings


def main():
    cfg = settings()
    try:
        app = create_app()
    except Exception as err:  # connection problems get a short, clear message
        print('Could not start: cannot connect to MongoDB.')
        print(f'  {type(err).__name__}: {str(err)[:300]}')
        print('Check MONGODB_URI in server_py/.env and, for MongoDB Atlas, Network Access (allow your IP address).')
        sys.exit(1)

    print(f'AcademiaOS (Flask + MongoDB) running on http://{cfg["host"]}:{cfg["port"]}')
    print(f'Database: {cfg["mongodb_db"]}')
    if (cfg['dist_dir'] / 'index.html').exists():
        print(f'App: open http://localhost:{cfg["port"]}')

    store = app.extensions['store']
    if store.user_count() == 0 and cfg['legacy_file'].exists():
        print('Found an older data file (server/data/db.json). To move its accounts and data into MongoDB run:')
        print('  python migrate_from_json.py')

    try:
        app.run(host=cfg['host'], port=cfg['port'], threaded=True, use_reloader=False)
    except OSError:
        print(f'Port {cfg["port"]} is already in use. Another server is probably running. '
              'Close it, or start this one on another port (DB_PORT=3002).')
        sys.exit(1)


if __name__ == '__main__':
    main()
