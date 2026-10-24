# AcademiaOS

Coaching institute management: admissions, attendance, fees, exams, batches, timetable, parent
messages, and separate logins for the principal, staff, teachers and students.

Everything runs on your own computer. No API key and no external service is needed, only
[Node.js](https://nodejs.org) 18 or newer.

## Run it

```bash
npm install
npm run dev:all
```

Open <http://localhost:3000>. `dev:all` starts the server (port 3001) and the app (port 3000) together.
The first time, the app asks you to create the principal account.

Other computers in the same network open `http://<this computer's IP>:3000`.

### One process (for daily use)

```bash
npm start
```

This builds the app and the server shows it, so everything is at <http://localhost:3001>.

### Tests

```bash
npm test
```

Starts the real server with a temporary data folder and checks sign in, roles, throttling, sync and
the upgrade from the older data file.

## Flask + MongoDB server (Python)

`server_py/` is the same server written in Python (Flask) that keeps everything in MongoDB. It has the
same API, so the app works with either one. Use **one of them** at a time (both use port 3001).

One-time setup (needs Python 3.10+ and a MongoDB database, for example a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster):

```bash
cd server_py
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows (on Mac/Linux: .venv/bin/pip)
copy .env.example .env                              # Mac/Linux: cp .env.example .env
```

Open `server_py/.env` and put your own MongoDB address in `MONGODB_URI`. This file is not part of git,
so never share it. For Atlas also allow your computer under **Network Access** (IP allow list).

Then, from the project folder:

```bash
npm run dev:all:py        # Flask + MongoDB server and the app together (app on http://localhost:3000)
npm run server:py         # only the server
npm run test:py           # the server tests (in memory, no MongoDB needed)
```

To move the accounts and data of the older Node server (`server/data/db.json`) into MongoDB (once):

```bash
cd server_py
.venv\Scripts\python migrate_from_json.py
```

The old file is only read. Passwords stay the same, and old roll numbers like `APEX-25-0101` become
plain numbers (01, 02, ...) on the way. Both servers store passwords the same way, so an account works on either.

MongoDB layout: the database named in `MONGODB_DB` (default `academiaos`) has one collection per list
(`students`, `batches`, ... one document per record), plus `users`, `sessions` (expire by themselves),
`audit` and `meta`.

## Where the data is (Node server)

`server/data/db.json` holds the accounts, the institute data, the sessions and the activity log.
A backup (`db.backup.json`) is kept every 10 minutes. Copy the `server/data` folder to back everything up.
It is not part of git.

If the data file comes from an older version, the server converts it on start and keeps the original as
`db.before-upgrade-<time>.json`.

## How it works

- **Sign in**: passwords are stored with scrypt on the server. A session token is sent with every request.
  Five wrong passwords lock that account and address for 15 minutes.
- **Roles**: the server sends each account only the data its role may see and accepts only the changes
  it may make.
  - Principal: everything. Front desk staff: everything except the institute profile and accounts.
  - Teacher: own batches (attendance, test marks). Student: own record only, read only.
- **Sync**: the app asks the server for changes every 4 seconds, so a change on one computer shows up on the others.
  Changes are sent per record, so two people editing different records never overwrite each other.
- **Activity log**: Team & Access shows the last actions (sign ins, data changes, account changes).

## Good to know

- The server speaks plain HTTP. Use it inside the institute's private network. To use it over the internet,
  put it behind an HTTPS proxy (for example Caddy or nginx), because passwords are sent to the server.
- WhatsApp / SMS messages are not sent by the server (that needs a paid gateway account). The app records
  them in the log and opens a WhatsApp link where you press send.
- Settings (environment variables): `DB_PORT` (3001), `DB_HOST` (0.0.0.0), `DB_DIR` (server/data).
