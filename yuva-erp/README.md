# AcademiaOS

Coaching institute management: admissions, enquiries, attendance, fees, exams, batches, timetable,
notices, study material, reports, parent messages, and separate logins for the principal, staff,
teachers and students.

- Front end: React + Vite + Tailwind (this folder, `src/`)
- Back end: Flask + MongoDB (`server_py/`). All data lives in your MongoDB database.
- No paid API key is needed. WhatsApp messages open through `wa.me` links (see "Messages" below).

## Run it

You need [Node.js](https://nodejs.org) 18+, Python 3.10+ and a MongoDB connection string
(MongoDB Atlas free cluster, or a local MongoDB).

1. Create `server_py/.env` (it is not part of git; see `.env.example`):

   ```
   MONGODB_URI=<your connection string>
   MONGODB_DB=academiaos
   ```

2. Install once:

   ```bash
   npm install
   python -m venv server_py/.venv
   server_py/.venv/Scripts/pip install -r server_py/requirements.txt
   ```

3. Start everything:

   ```bash
   npm run dev:all
   ```

Open <http://localhost:3000>. `dev:all` starts the server (port 3001) and the app (port 3000).
The first time, the app asks you to create the principal account and how to start
(empty, or with sample data for a demo).

Other computers in the same network open `http://<this computer's IP>:3000`.

For daily use, `npm start` builds the app and the server shows it at <http://localhost:3001>.

### Tests

```bash
npm test
```

Runs the Python tests (in-memory MongoDB, nothing real is touched). Set `ACADEMIA_TEST_REAL=1` to run
them on a temporary database in your real cluster (it is dropped afterwards).

## What the app does

| Screen | Who | What |
| --- | --- | --- |
| Dashboard | Principal, staff | Numbers, fee chart, follow-ups due, notices, getting-started checklist |
| Enquiries | Principal, staff | Leads, follow-up dates, WhatsApp, one-click "Admit" that fills the admission form |
| Admissions & Students | Principal, staff | Admission, search, edit, ID card, receipts, archive |
| Fees & Invoicing | Principal, staff | Receipts, cancel receipt (stays in ledger), overdue accounts, programs and standard fees |
| Attendance | Principal, staff, teacher | Roll call per batch, absent alerts |
| Exams | Principal, staff, teacher | Tests, marks, ranks, report cards, admit cards, edit / delete test |
| Notice Board | Everybody | Principal/staff write for all or a batch; teachers for their batches; students read |
| Study Material | Everybody | Links, notes, homework with date, per batch |
| Reports | Principal, staff | Fees by month and mode, attendance by batch, exam results, admissions (CSV and print) |
| Parent Broadcasts | Principal, staff | Templates and a message queue |
| Team & Access | Principal | Accounts, roles, batches. Everybody edits their own phone / name here |
| Institute Profile | Principal | Letterhead, backup and restore, clean start |

Each role gets only its own data from the server (a student cannot see classmates, a teacher only their batches).

## Backups

Institute Profile → Data Backup: download everything (data, accounts, photos) as one file, restore it
(you must type RESTORE; a safety copy is taken first), or use the backups the server keeps itself
(one automatic copy a day, the last 14 are kept, plus "Backup now").

## Messages

The app has no WhatsApp/SMS gateway (that needs a paid account). Messages to parents are opened
as a ready-made WhatsApp chat on the computer. Bulk messages go to a queue ("Waiting to be sent");
press "Send now" on each one. To send automatically later, a gateway can be connected at
`sendNotification` in `src/Context/InstituteContext.tsx`.

## Going online (HTTPS)

Put a reverse proxy such as [Caddy](https://caddyserver.com) in front of the server:

```
your-domain.com {
    reverse_proxy localhost:3001
}
```

Caddy gets the HTTPS certificate by itself. In MongoDB Atlas, allow the server's IP address under
Network Access.

## Notes for a demo

- The database is in MongoDB Atlas, so the computer needs internet (a mobile hotspot is fine). With a
  local MongoDB (`mongodb://localhost:27017`) it works fully offline.
- Choose "Start with sample data" on a new database to see every screen filled.
- Change the Atlas password if it was ever shared, and never put the connection string in code or git.
