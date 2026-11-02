# AcademiaOS: project status

Which modules are complete, which screens (UI) exist, what is still missing, and where the API is.

## 1. Complete modules (backend + screen, checked in the browser)

| # | Module | Screen (UI) | Backend / API | Checked |
| --- | --- | --- | --- | --- |
| 1 | **Super Admin** (platform) | `src/components/super/SuperAdminApp.tsx` | `/api/super/*` | tests + browser |
| 1a | Coaching cards, search, filter | cards, stat boxes, search | `GET /api/super/orgs` | yes |
| 1b | Approval of coachings (requests, Approve, Reject, switch off/on, delete) | "Requests waiting for your approval" | `/api/super/orgs/<id>/approve ...` | yes |
| 1c | Subscription and income (monthly fee, payments, Paid / Due) | card + "Record a payment" | `/api/super/orgs/<id>/payments` | yes |
| 1d | More Super Admins (add, new password, remove) | "Super Admins" panel | `/api/super/admins*` | yes |
| 1e | Platform activity log | "Recent activity" panel | `GET /api/super/audit` | yes |
| 2 | **Login and accounts** | `src/components/auth/` (3 tabs) | `/api/auth/*`, `/api/users/*` | tests + browser |
| 2a | Super Admin create + sign in + forgot password (server computer only) | tab "Super Admin" | `/api/super/setup`, `/api/super/forgot-password` | yes |
| 2b | Coaching Admin sign in, "Register your coaching", forgot password | tab "Coaching Admin" | `/api/public/register-coaching`, `/api/auth/forgot-password` | yes |
| 2c | Teacher / Student sign in and "Create an account" (teacher request, new student, admitted student) | tab "Teacher / Student" | `/api/auth/register-teacher`, `register-student`, `register-new-student` | yes |
| 2d | Forced own password after a reset or a principal-made account | `ForcePasswordChange.tsx` | `change-password` | yes |
| 3 | **Separate coachings** (nobody sees another's data) | (rule in every screen) | `server_py/academia/store.py`, `routes.py` | tests (8) |
| 4 | **Dashboard** ("Today" strip, KPIs, fee chart, follow-ups, notices) | `DashboardView.tsx` | `GET /api/sync` | yes |
| 5 | **Admissions and Students** (admission, search, edit, ID card, dossier, Timeline, student login) | `AdmissionsView.tsx`, `AdmissionModal.tsx`, `StudentDetailModal.tsx`, `StudentLoginCard.tsx` | `PUT /api/institute` + `POST /api/users` | yes |
| 6 | **Enquiries** (leads, follow-ups, WhatsApp, one-click Admit) | `EnquiriesView.tsx` | `PUT /api/institute` | yes |
| 7 | **Daily Attendance** (roll call, absent alerts) | `AttendanceView.tsx` | `PUT /api/institute` | yes |
| 8 | **Fees and Invoicing** (receipts, cancel, overdue, programs, "Queue reminders for all", CSV) | `FeesView.tsx` | `PUT /api/institute` | yes |
| 9 | **Exams** (tests, marks with Enter, ranks, report cards, admit cards) | `ExamsView.tsx` | `PUT /api/institute` | yes |
| 10 | **Batches and Timetable** | `BatchesTimetableView.tsx` | `PUT /api/institute` | yes |
| 11 | **Parent Broadcasts** (templates, queue, "Send now" via WhatsApp link) | `NotificationsView.tsx` | `PUT /api/institute` | yes |
| 12 | **Notice Board** and **Study Material / Homework** (with search) | `NoticesView.tsx`, `MaterialView.tsx` | `PUT /api/institute` | yes |
| 13 | **Reports** (fees, attendance, exams, admissions, profit and loss; CSV, print) | `ReportsView.tsx` | `GET /api/sync` | yes |
| 14 | **Expenses and Profit** (principal only) | `ExpensesView.tsx` | `PUT /api/institute` (principal only) | tests + browser |
| 15 | **Team and Access** (accounts, approve teachers, batches, password reset, my details) | `Teamview.tsx` | `/api/users/*`, `/api/auth/profile` | yes |
| 16 | **Teacher home** (own batches only) and **Student portal** (own data only) | `Teacherhomeview.tsx`, `Studentportalview.tsx` | `GET /api/sync` (scoped) | yes |
| 17 | **Institute Profile and Backups** (letterhead, download, restore, daily automatic backup) | `SettingsView.tsx` | `/api/backup*`, `/api/backups*` | tests + browser |
| 18 | **Photos** of students | admission form | `GET /api/photos/<id>/<token>` | tests |
| 19 | **Security** (roles, login lock, throttling, headers, activity log) | (everywhere) | `auth.py`, `scope.py`, `GET /api/audit` | tests |
| 20 | Dark / light mode, mobile layout | `ThemeToggle.tsx`, `index.css` | none | browser |
| 21 | **Salaries / payroll** (teachers and staff, "Pay" writes an expense) | `SalariesPanel.tsx` (tab in Expenses) | `PUT /api/institute` (principal only) | tests + browser |
| 22 | **Homework done** (student ticks, teacher sees the count) | `MaterialView.tsx` | `PUT /api/homework/<id>` | tests + browser |
| 23 | **Student prints own results** | `PrintableMyResultsModal.tsx` | `GET /api/sync` (scoped) | browser |
| 24 | **Logo** of the coaching (side menu, receipts, report cards) | `SettingsView.tsx`, `OrgLogo.tsx` | profile in `PUT /api/institute` | browser |
| 25 | **Automatic daily fee reminders** (queue, once a day) | Institute Profile checkbox, `InstituteContext.tsx` | message queue | browser |
| 26 | **Change own login email** (all roles) | `ChangeEmailForm.tsx` | `POST /api/auth/change-email` | tests + browser |
| 27 | **Automatic screen tests** (login page, theme, pager, pop-up, access rules, helpers, library) | `src/test/` | `npm run test:ui` | 33 tests |
| 28 | **Library** (books shared with a link; everybody reads, the office adds) | `LibraryView.tsx` | `PUT /api/institute`, list `books` | tests + browser |
| 29 | **Parent login** (the child's data only, read only; the principal makes it in the student's Dossier) | `StudentLoginCard.tsx` (parent), `Studentportalview.tsx` | `POST /api/users` with `isParent` | tests + browser |
| 30 | **Birthdays** on the dashboard (today and the next 7 days) | `DashboardView.tsx` | `dateOfBirth` of the student | tests + browser |
| 31 | **Staff attendance** (teachers and staff: present, half day, leave, absent; month count; CSV) | `StaffAttendancePanel.tsx` (tab in Expenses) | list `staffAttendance` (principal only) | tests + browser |
| 32 | **More reports**: Batch comparison, Fees by student, Attendance by student; attendance CSV of a day | `ReportsView.tsx`, `AttendanceView.tsx` | `GET /api/sync` | browser |
| 33 | **Search** in the tests, the message history and the accounts | `ExamsView`, `NotificationsView`, `Teamview` | none | browser |
| 34 | **Coaching list download** for the Super Admin (CSV, no student data) | `SuperAdminApp.tsx` | `GET /api/super/orgs` | browser |
| 35 | **Public website** (the first page before sign in: the sign in form in the top part, then why, how it works, features, roles, security, FAQ, footer; the page and the form are dark; it moves: the top message changes by itself, cards rise into place, numbers count up) | `src/components/landing/LandingPage.tsx` | none | tests + browser |
| 36 | **Book a demo** (form on the website; the Super Admin reads and deletes the requests) | `DemoRequestForm.tsx`, `LeadsPanel` in `SuperAdminApp.tsx` | `POST /api/public/demo-request`, `GET/DELETE /api/super/leads` | tests + browser |

## 2. Not built / still missing

| Item | Why |
| --- | --- |
| Automatic WhatsApp / SMS sending | needs a paid account and a key. Now: ready message opens in WhatsApp + queue "Send now" |
| Online payment (UPI / card gateway) | needs a paid account and a key. Receipts are written by hand |
| Sending e-mails (password reset, notices) | needs an e-mail service. Now: the principal / Super Admin sets a new password |
| Live on the internet (HTTPS, a real server) | written in README (Caddy) but never tried on a real server |
| Automatic reminders while nobody has the app open | the daily queue runs when the principal opens the app (no background job) |
| Merge into `main` | all work is on branch `feature/super-admin` |

## 3. Where the API is

All API code: `server_py/academia/routes.py` (50 routes). Who may call: public, any signed-in user, principal (admin), Super Admin.
How the data modules (students, fees, attendance, exams, enquiries, expenses...) talk to the server: **two routes**, not one route per module:

* `GET /api/sync?since=<version>`: the browser asks for the data it may see (the server sends each role only its own part; `server_py/academia/scope.py`).
* `PUT /api/institute`: the browser sends only what changed, record by record (`{ students: { upsert: [...], remove: [...] } }`). The server checks the role again before it writes.

Every other route is about accounts, coachings, backups and photos:

| Area | Routes |
| --- | --- |
| Public | `GET /api/health`, `GET /api/auth/status`, `POST /api/auth/setup`(old first-run), `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/register-teacher`, `register-student`, `register-new-student`, `GET /api/public/registration-options`, `GET /api/public/coachings`, `POST /api/public/register-coaching`, `GET /api/photos/<student>/<token>` |
| Signed in | `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/change-email`, `PUT /api/homework/<id>` (student), `PUT /api/auth/profile`, `GET /api/sync`, `PUT /api/institute` |
| Principal | `POST /api/users`, `.../<id>/approve`, `/reject`, `/batches`, `/role`, `/reset-password`, `DELETE /api/users/<id>`, `GET /api/audit`, `GET/POST /api/backups`, `GET /api/backup`, `POST /api/backup/restore`, `GET /api/backups/<id>`, `POST /api/backups/<id>/restore` |
| Super Admin | `GET /api/super/status`, `POST /api/super/setup`, `POST /api/super/forgot-password`, `GET/POST /api/super/admins`, `.../admins/<id>/reset-password`, `DELETE .../admins/<id>`, `GET /api/super/audit`, `GET/POST /api/super/orgs`, `PUT/DELETE /api/super/orgs/<id>`, `.../approve`, `/reject`, `/suspend`, `/activate`, `/payments`, `/reset-admin-password` |

## 4. Where the code is

| What | Folder / file |
| --- | --- |
| Screens (React) | `src/components/views/`, `modals/`, `auth/`, `super/`, `layout/`, `ui/` |
| Data and actions of the screens | `src/Context/InstituteContext.tsx`, `AuthContext.tsx`, `Access.ts` (who sees which page) |
| Talking to the server | `src/components/utils/api.ts`, `src/components/super/superApi.ts` |
| Backend start | `server_py/run.py` |
| Backend code | `server_py/academia/` (`routes.py`, `store.py`, `scope.py`, `auth.py`) |
| Tests | `server_py/tests/test_api.py` (run `npm test`) |

## Website extras

| What | Where |
| --- | --- |
| Contact (email, phone, address) in the footer, real customer quotes, list of app screenshots | `src/data/siteInfo.ts` (empty fields are not shown; no quotes = no testimonial section) |
| Screenshots of the real app (sample data) | `public/screens/*.png`, shown as a gallery on the website |
| Slider ("A day in your coaching", gallery, testimonials) | `src/components/landing/Carousel.tsx` |

