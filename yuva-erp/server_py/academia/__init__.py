"""AcademiaOS server (Flask + MongoDB)."""

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from .config import settings
from .errors import HttpError
from .store import Store

MAX_BODY = 100 * 1024 * 1024


def connect(cfg):
    """Opens the MongoDB database named in the settings."""
    from pymongo import MongoClient

    if not cfg['mongodb_uri']:
        raise RuntimeError('MONGODB_URI is not set. Put it in server_py/.env (see .env.example).')
    client = MongoClient(cfg['mongodb_uri'], serverSelectionTimeoutMS=15000)
    client.admin.command('ping')  # fails early with a clear error when the database cannot be reached
    return client[cfg['mongodb_db']]


def create_app(db=None, dist_dir=None):
    """`db` is a pymongo Database (tests pass an in-memory one)."""
    cfg = settings()
    if db is None:
        db = connect(cfg)
    dist = Path(dist_dir) if dist_dir is not None else cfg['dist_dir']

    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = MAX_BODY
    app.json.sort_keys = False
    app.extensions['store'] = Store(db)
    app.extensions['store'].migrate_to_coachings()  # data from before the coachings belongs to the first one
    app.extensions['store'].move_inline_photos()  # older data keeps photos inside the records

    from .routes import bp, make_limiters

    app.extensions['limiters'] = make_limiters()

    app.register_blueprint(bp)

    @app.errorhandler(HttpError)
    def on_http_error(err):
        return jsonify({'error': err.message}), err.status

    @app.errorhandler(404)
    def on_not_found(_err):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(405)
    def on_not_allowed(_err):
        return jsonify({'error': 'Method not allowed'}), 405

    @app.errorhandler(413)
    def on_too_large(_err):
        return jsonify({'error': 'Request is too large.'}), 413

    @app.errorhandler(PyMongoError)
    def on_database_error(err):
        app.logger.error('MongoDB problem: %s', err)
        return jsonify({'error': 'The database is not reachable right now. Please try again in a moment.'}), 503

    @app.errorhandler(Exception)
    def on_error(err):
        if isinstance(err, HTTPException):  # for example 400 for a broken request
            return jsonify({'error': err.description}), err.code
        app.logger.exception(err)
        return jsonify({'error': 'Server error.'}), 500

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'  # nobody can show the app inside another website
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        if request.path.startswith('/api'):
            response.headers.setdefault('Cache-Control', 'no-store')
        return response

    # The built app (after npm run build): the server shows it too
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def static_app(path):
        if path.startswith('api'):
            return jsonify({'error': 'Not found'}), 404
        if not (dist / 'index.html').exists():
            return jsonify({'error': 'Not found. Run "npm run build" to let this server show the app.'}), 404
        target = dist / path
        if path and target.is_file():
            immutable = path.startswith('assets/')
            response = send_from_directory(dist, path)
            response.headers['Cache-Control'] = 'public, max-age=31536000, immutable' if immutable else 'no-cache'
            return response
        response = send_from_directory(dist, 'index.html')
        response.headers['Cache-Control'] = 'no-cache'
        return response

    return app
