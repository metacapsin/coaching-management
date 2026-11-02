# AcademiaOS

A coaching-institute management platform for a whole area. A **Super Admin** (for example one for a town)
approves coachings; every **coaching** has its own principal and its own data: admissions, enquiries,
attendance, fees, expenses and profit, exams, batches, timetable, notices, study material, reports and
parent messages. One coaching can never see the data of another.

- Front end: React + Vite + Tailwind (`src/`)
- Back end: Flask + MongoDB (`server_py/`). Everything is stored in your MongoDB database.
- No paid API key is needed. WhatsApp messages open through `wa.me` links (see "Messages").

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
For daily use, `npm start` builds the app and the server shows it at <http://localhost:3001>.
Other computers in the same network open `http://<this computer's IP>:3000`.

With MongoDB Atlas, the computer's IP address must be allowed under **Network Access** (a phone hotspot
changes the IP often; "Allow access from anywhere" is the easy way for a demo, remove it afterwards).

### Tests

```bash
npm test         # the server (Python)
npm run test:ui  # the screens and helpers (Vitest)
npm run test:all # both
```

Runs the Python tests (in-memory MongoDB, nothing real is touched). Set `ACADEMIA_TEST_REAL=1` to run
them on a temporary database in your real cluster (it is dropped afterwards).

## How people sign in (one page, three tabs)

| Tab | Who | What |
| --- | --- | --- |
| **Super Admin** | The person who manages all coachings | First time: create the account (only on the server computer, only once). Then sign in. |
| **Coaching Admin** | The principal (and office staff) of one coaching | Sign in. A new coaching clicks "Register your coaching" and waits for the Super Admin's approval. |
| **Teacher / Student** | People of a coaching | Sign in, or "Create an account" (choose the coaching first): a **teacher** sends a request the principal approves; a **student** registers new (roll number is automatic) or proves an admission with the roll number and mobile. The principal can also make accounts (Team & Access, or the "Add Teacher" button). |

### The Super Admin

- Sees each coaching as a card: principal, number of students and accounts, status.
- **Approves or rejects** coachings that registered themselves. A coaching can add itself only through this approval.
- "+ Add coaching" only sends a request too: the coaching waits in "Requests waiting for your approval" and works only after
  the Super Admin presses **Approve**. Nothing becomes active without that Approve.
- Everybody can change the **email they sign in with** (the current password is asked): Super Admin in "My account", the others in Team & Access.
- Can add **another Super Admin** (so two people can help each other when one forgets the password: "Set new password" for the other, who then chooses an own one) and remove one. Nobody of a coaching can. A Super Admin who is alone can reset the password on the server computer ("Forgot your password?").
- Keeps the **subscription** of every coaching: the monthly fee, payments ("Record a payment" moves the paid-until date on)
  and a Paid / Payment due badge; the top shows the income of this month.
- Switch a coaching off or on, edit it, delete it (the name must be typed), set a new password for its principal
  (the principal then has to choose an own password at the next sign in), and read the platform activity log.
- Never sees a coaching's data (students, fees, exams...). To enter a coaching the Super Admin needs the
  principal's own email and password, like anybody else. "Back to Super Admin" in the sidebar (or signing out)
  returns to the list.

### Isolation and security

- Every request is tied to a sign-in token. The server decides the coaching from the token, never from the browser.
- Every coaching has its own collections (data, backups, activity log, photos). Accounts are checked against the coaching.
- A principal cannot delete, switch off, approve or rename a coaching; only the Super Admin can (the server answers 403).
- Passwords are hashed (scrypt), sign in is throttled, sign-ups are limited, sessions end when a coaching is switched off.
- Teachers see only their batches, students only their own record, staff do not see the expenses or the institute profile.
- Security headers are sent (no framing, no sniffing). For HTTPS see "Going online".

## What a coaching can do

| Screen | Who | What |
| --- | --- | --- |
| Dashboard | Principal, staff | A "Today" strip (collected, absent, follow-ups, overdue), numbers, fee chart, notices, quick buttons (Add Teacher, New Admission) |
| Enquiries | Principal, staff | Leads, follow-up dates, WhatsApp, one-click "Admit" (open enquiries are shown first) |
| Admissions & Students | Principal, staff | Admission, search, edit, ID card, receipts, archive, and a **Timeline** of everything about a student |
| Fees & Invoicing | Principal, staff | Receipts, cancel receipt, overdue accounts ("Queue reminders for all" in one click), programs and standard fees |
| **Expenses & Profit** | Principal only | Write down salary, rent and bills; profit = fees collected minus expenses, per month. A **Salaries** tab lists teachers and staff with the monthly salary: "Pay" writes the expense for the month |
| Attendance | Principal, staff, teacher | Roll call per batch, absent alerts |
| Exams | Principal, staff, teacher | Tests, marks (press Enter to go to the next student), ranks, report cards, admit cards |
| Notice Board, Study Material | Everybody | Notices and homework per batch. A student marks homework as done; the teacher sees "7 of 30 done" |
| Reports | Principal, staff | Fees, attendance, exam results, admissions (profit and loss for the principal); CSV and print |
| Parent Broadcasts | Principal, staff | Templates and a message queue |
| Team & Access | Principal | Teacher, staff and student accounts, batches, password reset |
| **Public website** | Everybody | The first page before sign in: what AcademiaOS is, how it works, features, who uses it, security, FAQ and a "Book a demo" form. The sign in form (3 tabs) sits in the top part of the same page, so there is no separate login page. The Super Admin reads the demo requests on the platform page |
| **Parent login** | Parent | A parent signs in on the Teacher / Student tab and sees the child's attendance, fees, results and notices (read only). The principal makes it in the student's Dossier |
| **Staff attendance** | Principal only | Tab in Expenses & Profit: teachers and staff present / half day / leave / absent, with a month count |
| **Library** | Everybody reads; principal and front desk add | Books shared with a link (PDF, Drive, website): students and teachers press Read and it opens online |
| Institute Profile | Principal | Letterhead with a **logo** (side menu, receipts, report cards), "queue fee reminders by itself once a day", backup and restore, clean start |

A new coaching opens with sample data so every screen can be seen at once (`AUTO_DEMO_FOR_NEW_COACHING` in
`src/Context/InstituteContext.tsx`; "Delete all data" in the Institute Profile clears it for real use).

## Backups

Institute Profile → Data Backup: download everything (data, accounts, photos) as one file, restore it
(you must type RESTORE; a safety copy is taken first), or use the backups the server keeps for every coaching
itself (one automatic copy a day, the last 14 are kept, plus "Backup now").

## Messages

The app has no WhatsApp/SMS gateway (that needs a paid account). Messages to parents are opened as a ready-made
WhatsApp chat on the computer. Bulk messages go to a queue ("Waiting to be sent"); press "Send now" on each one.
To send automatically later, a gateway can be connected at `sendNotification` in `src/Context/InstituteContext.tsx`.

**Approval emails.** When the Super Admin approves or rejects a coaching, the principal gets an email (a reason can be written for a rejection).
This needs an SMTP account in `server_py/.env` (a free Gmail with an app password works, see `.env.example`). Without it nothing is emailed and the
Super Admin sees a "Send on WhatsApp" button with the same message.

**Other emails (same SMTP account).** A coaching that registers gets "we received your request" and the Super Admin gets "new request".
"Forgot your password?" emails a 6-digit code (15 minutes, 5 tries) so the person sets a new password without waiting for the principal.

## Going online (HTTPS)

Put a reverse proxy such as [Caddy](https://caddyserver.com) in front of the server:

```
your-domain.com {
    reverse_proxy localhost:3001
}
```

Caddy gets the HTTPS certificate by itself. In MongoDB Atlas, allow the server's IP address under Network Access.

## Notes for a demo

- The database is in MongoDB Atlas, so the computer needs internet (a mobile hotspot is fine). With a local
  MongoDB (`mongodb://localhost:27017`) it works fully offline.
- Show it in this order: create the Super Admin, register a coaching (second tab), approve it as Super Admin,
  open the coaching card (principal's email and password), look around, "Back to Super Admin".
- Change the Atlas password if it was ever shared, and never put the connection string in code or git.
