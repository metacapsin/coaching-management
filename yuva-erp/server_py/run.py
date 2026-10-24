"""python run.py   starts the Flask server on http://localhost:3001 (same address as the Node server)."""

import socket
import sys

from academia import create_app
from academia.config import settings
from academia.scheduler import start_daily_snapshots


def port_is_free(host, port):
    """Windows says 'access permissions' (not 'in use') when another program already has the port, so check first."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind((host if host != '0.0.0.0' else '', port))
            return True
        except OSError:
            return False


def main():
    cfg = settings()
    if not port_is_free(cfg['host'], cfg['port']):
        print(f'Cannot start: port {cfg["port"]} is already in use by another program.')
        print('  Probably the Node server (npm run server / dev:all) or an older copy of this server is still running.')
        print('  Close it (Ctrl+C in its terminal), or start this one on another port (DB_PORT=3002).')
        sys.exit(1)
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

    start_daily_snapshots(store)  # one backup a day, kept inside MongoDB (Settings shows them)

    try:
        from waitress import serve
    except ImportError:  # without waitress Flask's own (development) server is used
        serve = None

    try:
        if serve:
            serve(app, host=cfg['host'], port=cfg['port'], threads=8, max_request_body_size=100 * 1024 * 1024)
        else:
            app.run(host=cfg['host'], port=cfg['port'], threaded=True, use_reloader=False)
    except OSError:
        print(f'Port {cfg["port"]} is already in use. Another server is probably running. '
              'Close it, or start this one on another port (DB_PORT=3002).')
        sys.exit(1)


if __name__ == '__main__':
    main()
