# AcademiaOS: project status

Which modules are complete, which screens (UI) exist, what is still missing, and where the API is.

## 1. Complete modules (backend + screen, checked in the browser)

| # | Module | Screen (UI) | Backend / API | Checked |
| --- | --- | --- | --- | --- |
| 1 | **Super Admin** (platform) | `frontend/src/components/super/SuperAdminApp.tsx` | `/api/super/*` | tests + browser |
| 1a | Coaching cards, search, filter | cards, stat boxes, search | `GET /api/super/orgs` | yes |
| 1b | Approval of coachings (requests, Approve, Reject, switch off/on, delete) | "Requests waiting for your approval" | `/api/super/orgs/<id>/approve ...` | yes |
| 1c | Subscription and income (monthly fee, payments, Paid / Due) | card + "Record a payment" | `/api/super/orgs/<id>/payments` | yes |
| 1d | **Only one Super Admin** (created once; nobody can add another) | `AuthPage.tsx` | `POST /api/super/setup` (409 when one exists) | yes |
| 1e | Platform activity log | "Recent activity" panel | `GET /api/super/audit` | yes |
| 2 | **Login and accounts** | `frontend/src/components/auth/` (3 tabs) | `/api/auth/*`, `/api/users/*` | tests + browser |
| 2a | Super Admin create + sign in + forgot password (server computer only) | tab "Super Admin" | `/api/super/setup`, `/api/super/forgot-password` | yes |
| 2b | Coaching Admin sign in, "Register your coaching", forgot password | tab "Coaching Admin" | `/api/public/register-coaching`, `/api/auth/forgot-password` | yes |
| 2c | Teacher / Student sign in and "Create an account" (teacher request, new student, admitted student) | tab "Teacher / Student" | `/api/auth/register-teacher`, `register-student`, `register-new-student` | yes |
| 2d | Forced own password after a reset or a principal-made account | `ForcePasswordChange.tsx` | `change-password` | yes |
| 3 | **Separate coachings** (nobody sees another's data) | (rule in every screen) | `backend/src/store.ts`, `routes.ts` | tests (8) |
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
| 27 | **Automatic screen tests** (login page, theme, pager, pop-up, access rules, helpers, library) | `frontend/src/test/` | `npm run test:ui` | 33 tests |
| 28 | **Library** (books shared with a link; everybody reads, the office adds) | `LibraryView.tsx` | `PUT /api/institute`, list `books` | tests + browser |
| 29 | **Parent login** on an own page `/parent` (the child's data only, read only; the principal makes it in the student's Dossier) | `StudentLoginCard.tsx` (parent), `Studentportalview.tsx` | `POST /api/users` with `isParent` | tests + browser |
| 30 | **Birthdays** on the dashboard (today and the next 7 days) | `DashboardView.tsx` | `dateOfBirth` of the student | tests + browser |
| 31 | **Staff attendance** (teachers and staff: present, half day, leave, absent; month count; CSV) | `StaffAttendancePanel.tsx` (tab in Expenses) | list `staffAttendance` (principal only) | tests + browser |
| 32 | **More reports**: Batch comparison, Fees by student, Attendance by student; attendance CSV of a day | `ReportsView.tsx`, `AttendanceView.tsx` | `GET /api/sync` | browser |
| 33 | **Search** in the tests, the message history and the accounts | `ExamsView`, `NotificationsView`, `Teamview` | none | browser |
| 34 | **Coaching list download** for the Super Admin (CSV, no student data) | `SuperAdminApp.tsx` | `GET /api/super/orgs` | browser |
| 35 | **Public website** (the first page before sign in: the sign in form in the top part, then why, how it works, features, roles, security, FAQ, footer; the page and the form are dark; it moves: the top message changes by itself, cards rise into place, numbers count up) | `frontend/src/components/landing/LandingPage.tsx` | none | tests + browser |
| 36 | ~~Book a demo~~ removed from the website and from the Super Admin page (the server routes are still there but no screen uses them) | | | |
| 37 | **Bell for every role** (principal, teacher, student, parent): the notices of others, a new student / teacher, what a teacher did; click opens the Notice Board on that message; delete / clear all (only from the own bell) | `NoticeBell.tsx`, `bellMemory.ts`, `focusItem.ts` | `GET /api/sync` | tests + browser |
| 38 | **Sidebar number** on the Notice Board (what is new; gone when the page is opened), "New" tags, "What happened" (principal), "Messages from the coaching" (parent, student) | `App.tsx`, `NoticesView.tsx` | none | tests + browser |
| 39 | **Notices to the parents AND the students**: homework, tests (the subject and the teacher are named), a reminder the day before a test, the result; the principal's own messages are not in his bell | `parentNotices.ts`, `InstituteContext.tsx` (`notifyHomework`, `notifyTest`, `notifyResults`) | list `notificationLogs` (channel `whatsapp` for the parent, `student` for the student) | tests + browser |
| 40 | **Who may tell the parents**: homework / test / result: the teacher of that subject (or the principal); absent and late students: the class teacher of the batch (chosen on the batch) or the principal; a teacher's own notices are for the students, not the parents; a parent only reads | `scope.ts`, `AttendanceView.tsx`, `EditbatchModal.tsx` | `PUT /api/institute` (403 otherwise) | tests + browser |
| 41 | **The teacher confirms** a test / homework that the principal made for him, then the principal tells the parents | `TeacherSelect.tsx`, `ExamsView.tsx`, `MaterialView.tsx` | `exams`, `materials` (`confirmed`) | tests + browser |
| 42 | **One principal per coaching, no front desk role**; the parent has an own login page `/parent` | `Teamview.tsx`, `ParentLoginPage.tsx` | `POST /api/users` (only teacher / student) | tests + browser |
| 43 | **Leave of a student**: the student asks the principal (dates + the full reason, at least 15 letters); the principal gets it in the bell and on the Notice Board ("Leave request", "New", the number on the sidebar), calls the parent (the phone is on the card), ticks that he did, and approves or does not give (the student reads the note); the PARENT gets the same news as a text (asked, approved, not given). Not visible to a teacher. A parent and a teacher cannot ask | `LeaveSection.tsx`, `NoticesView.tsx`, `NoticeBell.tsx` | `POST /api/leaves`, `PUT /api/leaves/<id>` | tests + browser |
| 44 | **Leave by email too**: a student asks: the principal, the parent and the teachers of the student's batch get an email with the reason (so a teacher knows why the student is absent); the answer goes to the student, the parent and (when approved) the teachers; a teacher's own leave goes to the principal only and the answer to that teacher only. Sent only when SMTP is set (otherwise the email log) | `routes.ts` (`emailAboutLeave`) | `POST /api/leaves`, `PUT /api/leaves/<id>` | tests |
| 45 | **Medical certificate on a sick leave**: only for the type Sick; the person ticks that a certificate exists and can upload a photo of it (made smaller in the browser, JPG / PNG / WebP, stored like a student photo); the principal sees the picture on the request card, the student sees a link; teachers and parents never get it | `LeavePage.tsx`, `LeaveSection.tsx` | `POST /api/leaves` (`proof`), `GET /api/photos/<id>/<token>` | tests + browser |
| 46 | **Emails show who they come from**: an email that comes from a person (a student's leave, a teacher asking to join, the principal's welcome / approval / fee notice, the Super Admin's approve / reject) has that person's NAME as sender ("Danish Imam (Student, Sunrise Classes)"), the person's email as Reply-To, and the email written in the text. The address in "From" is always the account of SMTP_USER (Gmail does not allow another one). Emails without a person (a reset code, "we received your request") show the name AcademiaOS. **Forgot password**: when a student, a parent or a teacher asks for a reset code, the principal is told by email (from that person, not again within 10 minutes), and again when the new password was set with the code (never the password or the code) | `mailer.ts`, `emailTemplate.ts`, `http.ts` (`fromPerson`) | all email routes | tests |
| 47 | **The own Gmail of a coaching**: the principal connects the own Gmail (an app password) in Institute Profile ("Emails: send from my own Gmail"); every email of that coaching then goes out FROM that address (the receiver sees the email of the principal). The login is checked when it is saved, the password is stored sealed (AES-GCM, key from APP_SECRET or MONGODB_URI) and never shown again; a test email button; Remove goes back to the platform account; if the Gmail stops working the platform account sends it. Super Admin emails and coachings without an own Gmail use SMTP_USER | `MailSettings.tsx`, `mailer.ts`, `secretBox.ts` | `GET/PUT/DELETE /api/mail-settings`, `POST /api/mail-settings/test` | tests + browser (wrong password) |
| 48 | **Super Admin page = record only**: no Add coaching, no Enter coaching, no edit / key / pause buttons (only Delete); a new card design with the **logo** of the coaching (only the logo of the profile reaches the Super Admin), principal box, student / account tiles, "Demo" tag; the public "Add coaching" / "Register your coaching" on the website stays (needs the Super Admin's Approve) | `SuperAdminApp.tsx`, `superApi.ts` | `GET /api/super/orgs` (`logo`) | tests + browser |

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

All API code: `backend/src/routes.ts` and `routesSuper.ts` (50 routes). Who may call: public, any signed-in user, principal (admin), Super Admin.
How the data modules (students, fees, attendance, exams, enquiries, expenses...) talk to the server: **two routes**, not one route per module:

* `GET /api/sync?since=<version>`: the browser asks for the data it may see (the server sends each role only its own part; `backend/src/scope.ts`).
* `PUT /api/institute`: the browser sends only what changed, record by record (`{ students: { upsert: [...], remove: [...] } }`). The server checks the role again before it writes.

Every other route is about accounts, coachings, backups and photos:

| Area | Routes |
| --- | --- |
| Public | `GET /api/health`, `GET /api/auth/status`, `POST /api/auth/setup`(old first-run), `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/register-teacher`, `register-student`, `register-new-student`, `GET /api/public/registration-options`, `GET /api/public/coachings`, `POST /api/public/register-coaching`, `GET /api/photos/<student>/<token>` |
| Signed in | `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/change-email`, `PUT /api/homework/<id>` (student), `PUT /api/auth/profile`, `GET /api/sync`, `PUT /api/institute` |
| Principal | `POST /api/users`, `.../<id>/approve`, `/reject`, `/batches`, `/role`, `/reset-password`, `DELETE /api/users/<id>`, `GET /api/audit`, `GET/POST /api/backups`, `GET /api/backup`, `POST /api/backup/restore`, `GET /api/backups/<id>`, `POST /api/backups/<id>/restore` |
| Super Admin | `GET /api/super/status`, `POST /api/super/setup`, `POST /api/super/forgot-password`, `GET /api/super/audit`, `GET/POST /api/super/orgs`, `PUT/DELETE /api/super/orgs/<id>`, `.../approve`, `/reject`, `/suspend`, `/activate`, `/payments`, `/reset-admin-password` |

## 4. Where the code is

| What | Folder / file |
| --- | --- |
| Screens (React) | `frontend/src/components/views/`, `modals/`, `auth/`, `super/`, `layout/`, `ui/` |
| Data and actions of the screens | `frontend/src/Context/InstituteContext.tsx`, `AuthContext.tsx`, `Access.ts` (who sees which page) |
| Talking to the server | `frontend/src/components/utils/api.ts`, `frontend/src/components/super/superApi.ts` |
| Backend start | `backend/src/index.ts` (Node + Express + MongoDB) |
| Backend code | `backend/src/` (`routes.ts`, `routesSuper.ts`, `store.ts`, `scope.ts`, `auth.ts`, `mailer.ts`) |
| Tests | `backend/tests/` (71 tests, run `npm test`) |

## Website extras

| What | Where |
| --- | --- |
| Contact (email, phone, address) in the footer, real customer quotes, list of app screenshots | `frontend/src/data/siteInfo.ts` (empty fields are not shown; no quotes = no testimonial section) |
| Screenshots of the real app (sample data) | `public/screens/*.png`, shown as a gallery on the website |
| Slider ("A day in your coaching", gallery, testimonials) | `frontend/src/components/landing/Carousel.tsx` |

