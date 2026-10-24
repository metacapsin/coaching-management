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

## Where the data is

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
