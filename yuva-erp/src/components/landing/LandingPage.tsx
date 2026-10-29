import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Menu,
  X,
  ArrowRight,
  Users,
  Wallet,
  CalendarCheck,
  Award,
  Megaphone,
  Library,
  BarChart3,
  UserCog,
  Smartphone,
  ShieldCheck,
  DatabaseBackup,
  Layers,
  Building2,
  ChevronDown,
  Check,
  LogIn,
  Lock,
  Eye
} from 'lucide-react';
import { DemoRequestForm } from './DemoRequestForm';

// The public website of AcademiaOS: what it is, how it works, who uses it. It is shown before sign in.
// Everything written here is true for the product (no invented clients, numbers or reviews).

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#roles', label: 'Who uses it' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' }
];

const WHY_TABS: { id: string; label: string; title: string; text: string; points: string[] }[] = [
  {
    id: 'one',
    label: 'One platform',
    title: 'Every coaching of your area on one platform',
    text: 'A Super Admin approves coachings and sees who runs each one. Each coaching gets its own principal, its own teachers, students and fees.',
    points: ['New coachings wait for the Super Admin’s approval', 'Each coaching signs in with its own principal login', 'Switch a coaching off or on at any time']
  },
  {
    id: 'private',
    label: 'Separate data',
    title: 'One coaching can never see another',
    text: 'Students, fees, exams and accounts of a coaching live apart from every other coaching. Not even the Super Admin opens the data inside a coaching without that principal’s login.',
    points: ['Data of every coaching is stored separately', 'The server checks the role on every request', 'Teachers see only their own batches']
  },
  {
    id: 'roles',
    label: 'Everybody has a login',
    title: 'Principal, teacher, student and parent',
    text: 'Each person signs in on the same page and sees only what belongs to them: the principal runs the coaching, the teacher takes attendance, the student and the parent follow the progress.',
    points: ['Principal and front desk run the office', 'Teachers mark attendance and marks of their batches', 'Students and parents see attendance, fees, results']
  },
  {
    id: 'daily',
    label: 'Daily work',
    title: 'The daily work takes minutes, not hours',
    text: 'Admit a student, take the roll call, collect a fee and print the receipt, schedule a test and publish the ranks. Reports and CSV downloads are one click away.',
    points: ['Receipts and report cards ready to print', 'Reminders for pending fees', 'Reports by batch, student and month']
  },
  {
    id: 'phone',
    label: 'Works on phone',
    title: 'Open it on any phone or computer',
    text: 'There is nothing to install. The pages fit a phone screen, so a teacher can take the roll call and a parent can check the attendance from anywhere.',
    points: ['Light and dark look', 'Pages fit small screens', 'No app to install']
  }
];

const STEPS = [
  { n: '01', title: 'Register your coaching', text: 'Send a request from the sign in page with the name of your coaching and the principal. The Super Admin approves it.' },
  { n: '02', title: 'Add programs and batches', text: 'Write down your programs with their fees. Every program starts with a first batch, so you can admit students at once.' },
  { n: '03', title: 'Admit students and add teachers', text: 'Admission gives the student a login. Add teachers, front desk staff and the parents of your students.' },
  { n: '04', title: 'Run the day', text: 'Attendance, fees, tests, notices and study material, with reports and reminders for every month.' }
];

const FEATURES: { icon: React.ElementType; title: string; text: string }[] = [
  { icon: Users, title: 'Admissions and students', text: 'Admission form, student dossier, ID card, search, filters and a timeline of everything about a student.' },
  { icon: Wallet, title: 'Fees and receipts', text: 'Collect fees by cash, UPI, cheque or card, print numbered receipts, track pending and overdue fees.' },
  { icon: CalendarCheck, title: 'Attendance', text: 'Daily roll call for all students or one batch, late and excused marks, and an alert for the parent of an absent student.' },
  { icon: Award, title: 'Exams and report cards', text: 'Schedule tests, enter marks, publish ranks, print admit cards and report cards.' },
  { icon: Megaphone, title: 'Notices and study material', text: 'Send a notice or homework to one batch or to everybody. Students tick the homework they finished.' },
  { icon: Library, title: 'Online library', text: 'Share books with a link (PDF, Drive, website). Students and teachers open them with one tap.' },
  { icon: BarChart3, title: 'Reports and downloads', text: 'Fees, attendance, results, admissions and batch comparison. Download as CSV or print.' },
  { icon: UserCog, title: 'Staff and salaries', text: 'Salary list, pay for the month (it becomes an expense), and the daily attendance of teachers and staff.' },
  { icon: Layers, title: 'Batches and timetable', text: 'Groups of students, class timings, seats and a weekly timetable without clashes.' },
  { icon: Smartphone, title: 'Student and parent portal', text: 'Attendance, fee balance, results, notices and study material, read only, with a print of the results.' },
  { icon: DatabaseBackup, title: 'Backups', text: 'A daily automatic backup, and a download or restore of the whole coaching when you want.' },
  { icon: Building2, title: 'Many coachings', text: 'The Super Admin approves coachings, records their subscription and sees the activity of the platform.' }
];

const ROLES: { who: string; sees: string[] }[] = [
  { who: 'Super Admin', sees: ['Approves or rejects coachings', 'Subscription and payments of each coaching', 'Switch a coaching on or off', 'Never sees the students and fees inside'] },
  { who: 'Principal', sees: ['Everything of the own coaching', 'Fees, expenses, salaries and profit', 'Adds teachers, staff, students and parents', 'Backups and the institute profile'] },
  { who: 'Front desk', sees: ['Admissions, enquiries and fees', 'Attendance, exams and notices', 'No expenses and no settings'] },
  { who: 'Teacher', sees: ['Only the own batches', 'Attendance and marks of those batches', 'Notices and study material'] },
  { who: 'Student', sees: ['Own attendance, fees and results', 'Notices, study material, library', 'Marks homework as done'] },
  { who: 'Parent', sees: ['The child’s attendance, fees and results', 'Notices and study material', 'Read only'] }
];

const SECURITY: { icon: React.ElementType; title: string; text: string }[] = [
  { icon: Lock, title: 'Roles on every request', text: 'The server checks who you are and what you may see, every time. Hiding a button is not the only protection.' },
  { icon: Eye, title: 'Separate data', text: 'Each coaching’s records are stored apart. A principal can never open another coaching.' },
  { icon: ShieldCheck, title: 'Safe sign in', text: 'Passwords are stored as hashes, failed sign ins are limited, and an account made by somebody else must choose an own password first.' },
  { icon: DatabaseBackup, title: 'Activity log and backups', text: 'The important actions are written in an activity log, and a backup is kept every day.' }
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Who can use AcademiaOS?', a: 'Any coaching institute: the principal, the front desk, the teachers, the students and their parents. The Super Admin runs the platform for many coachings.' },
  { q: 'Does one coaching see the data of another?', a: 'No. Every coaching has its own data and its own principal login. Not even the Super Admin opens the data inside a coaching without the principal’s login.' },
  { q: 'How do I start?', a: 'Choose "Register your coaching" on the sign in page. After the Super Admin approves it you sign in, add a program, and admit the first student. The dashboard shows these steps.' },
  { q: 'Can the students and parents sign in?', a: 'Yes. The principal makes the logins (a student’s login is made together with the admission). They see only their own data, read only.' },
  { q: 'Do fees get paid online?', a: 'Not yet. The principal writes down every payment and the app prints the receipt. Online payment needs a paid gateway and can be added later.' },
  { q: 'How are parents told about fees or absence?', a: 'The app prepares the message and opens it in WhatsApp for you to send. Automatic sending needs a paid service and is not included yet.' },
  { q: 'Does it work on a phone?', a: 'Yes, every page fits a phone screen and nothing has to be installed.' },
  { q: 'What if I forget my password?', a: 'The principal or the Super Admin sets a new one. The person chooses an own password at the next sign in.' },
  { q: 'Can I take my data out?', a: 'Yes. Reports download as CSV, and the whole coaching can be downloaded as a backup file and restored later.' }
];

const WHY_CARDS = [
  { icon: Building2, title: 'Built for coachings', text: 'Programs, batches, test series, ranks and fee receipts are the way a coaching works.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Each coaching, its own data. Roles are checked by the server.' },
  { icon: Smartphone, title: 'Nothing to install', text: 'Open it in a browser on a phone or a computer.' },
  { icon: BarChart3, title: 'Numbers at a glance', text: 'Today’s absentees, pending fees, new admissions and profit on one dashboard.' }
];

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <a href="#top" className={`flex items-center gap-2.5 ${className}`}>
    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
      <GraduationCap className="w-5 h-5" />
    </span>
    <span className="text-xl font-bold tracking-tight text-white">AcademiaOS</span>
  </a>
);

const SectionHead: React.FC<{ kicker: string; title: React.ReactNode; text?: string }> = ({ kicker, title, text }) => (
  <div className="text-center max-w-3xl mx-auto mb-10">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{'— '}{kicker}{' —'}</p>
    <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 tracking-tight">{title}</h2>
    {text && <p className="text-sky-100/80 mt-4 leading-relaxed">{text}</p>}
  </div>
);

// A small picture of the dashboard, drawn with plain boxes (no image file needed)
const HeroMock: React.FC = () => (
  <div className="relative w-full max-w-md mx-auto" aria-hidden="true">
    <div className="absolute -inset-6 bg-gradient-to-tr from-blue-600/30 via-sky-400/10 to-pink-500/20 blur-3xl rounded-full" />
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur shadow-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-[10px] text-slate-400">Command Dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Students', '248', 'text-sky-300'],
          ['Present today', '92%', 'text-emerald-300'],
          ['Fees pending', '₹1.2L', 'text-amber-300']
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg bg-white/5 border border-white/10 p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`text-lg font-bold mt-0.5 ${tone}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-3">
        <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-2">Fees collected, month by month</div>
        <div className="flex items-end gap-1.5 h-16">
          {[35, 55, 40, 70, 60, 85, 75].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-sky-400" />
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {['Roll call saved for Batch A', 'Receipt REC-2026-0042 printed', 'Test ranks published'].map(t => (
          <li key={t} className="flex items-center gap-2 text-[11px] text-slate-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-slate-500 text-right">Sample screen</p>
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState(WHY_TABS[0].id);
  const [open, setOpen] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const active = WHY_TABS.find(t => t.id === tab) || WHY_TABS[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const btnPrimary = 'px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors';
  const btnLight = 'px-5 py-2.5 text-sm font-semibold text-sky-100 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors';

  return (
    <div id="top" className="theme-keep min-h-screen bg-[#0f1b26] text-slate-200 antialiased font-sans scroll-smooth">
      {/* Top bar */}
      <header className={`sticky top-0 z-40 border-b ${scrolled ? 'bg-[#0f1b26]/95 backdrop-blur border-white/10' : 'bg-[#0f1b26] border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="text-sm text-slate-300 hover:text-white transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <a href="#/login" className={btnLight + ' flex items-center gap-1.5'}>
              <LogIn className="w-4 h-4" />
              Sign in
            </a>
            <a href="#demo" className={btnPrimary}>
              Book a demo
            </a>
          </div>
          <button onClick={() => setMenu(m => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/10">
            {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {menu && (
          <div className="lg:hidden border-t border-white/10 px-4 py-3 space-y-1 bg-[#0f1b26]">
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/10">
                {n.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <a href="#/login" className={btnLight + ' flex-1 text-center'}>
                Sign in
              </a>
              <a href="#demo" onClick={() => setMenu(false)} className={btnPrimary + ' flex-1 text-center'}>
                Book a demo
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1b2c3c] via-[#16293a] to-[#0f1b26]">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-3 py-1">
              Coaching institute management
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mt-5 leading-[1.1]">
              Run your whole coaching <span className="text-sky-400">from one place</span>
            </h1>
            <p className="text-lg text-sky-100/80 mt-5 leading-relaxed max-w-xl">
              Admissions, fees, attendance, tests, notices and reports for the principal, the teachers, the students and their parents. One platform for every coaching of your area.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#demo" className={btnPrimary + ' flex items-center gap-2 !px-6 !py-3'}>
                Book a demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#/login" className={btnLight + ' !px-6 !py-3'}>
                Sign in
              </a>
              <a href="#how" className="px-3 py-3 text-sm font-semibold text-sky-300 hover:text-sky-200">
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {['No app to install', 'Works on a phone', 'Each coaching’s data stays separate'].map(t => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Why: tabs */}
      <section id="why" className="bg-[#16222d]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div role="tablist" aria-label="Why AcademiaOS" className="flex overflow-x-auto -mx-4 sm:mx-0 border-b border-white/10">
            {WHY_TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-5 py-4 text-sm font-medium transition-colors ${tab === t.id ? 'text-sky-400 bg-white/5 border-b-2 border-sky-400' : 'text-slate-300 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="py-14 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{'— '}Why AcademiaOS{' —'}</p>
              <h2 className="text-3xl font-bold text-white mt-3 tracking-tight">{active.title}</h2>
              <p className="text-sky-100/80 mt-4 leading-relaxed">{active.text}</p>
            </div>
            <ul className="space-y-3">
              {active.points.map(p => (
                <li key={p} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
                  <Check className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="pb-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY_CARDS.map(c => (
              <div key={c.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-sky-400/40 transition-colors">
                <span className="w-11 h-11 rounded-full bg-sky-400/10 text-sky-400 flex items-center justify-center">
                  <c.icon className="w-5 h-5" />
                </span>
                <h3 className="text-base font-semibold text-white mt-4">{c.title}</h3>
                <p className="text-sm text-sky-100/70 mt-2 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="How it works" title={<>From registration to the first roll call <span className="text-sky-400">in four steps</span></>} text="No long set up. This is how a coaching starts." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map(s => (
              <div key={s.n} className="relative rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <span className="absolute top-3 right-4 text-4xl font-extrabold text-sky-400/70">{s.n}</span>
                <h3 className="text-lg font-semibold text-white pr-12">{s.title}</h3>
                <p className="text-sm text-sky-100/75 mt-3 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <a href="#demo" className={btnPrimary}>
              Book a demo
            </a>
            <a href="#/login" className="px-5 py-2.5 text-sm font-semibold text-white border border-white/30 hover:bg-white/10 rounded-lg transition-colors">
              Register your coaching
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#16222d] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Features" title={<>Everything a coaching needs, <span className="text-sky-400">in one app</span></>} text="Twelve areas of work, ready to use from the first day." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="group rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 hover:border-sky-400/40 transition-colors">
                <span className="w-11 h-11 rounded-lg bg-blue-600/20 text-sky-300 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <f.icon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-semibold text-white mt-4">{f.title}</h3>
                <p className="text-sm text-sky-100/75 mt-2 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Who uses it" title={<>One sign in, <span className="text-sky-400">six kinds of people</span></>} text="Everybody sees only what belongs to them." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLES.map(r => (
              <div key={r.who} className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-lg font-semibold text-white">{r.who}</h3>
                <ul className="mt-3 space-y-2">
                  {r.sees.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-sky-100/80">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="bg-[#16222d] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="At a glance" title={<>What is inside, <span className="text-sky-400">in short</span></>} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['6', 'kinds of sign in', 'Super Admin, principal, front desk, teacher, student, parent'],
              ['12', 'areas of work', 'From admission to reports'],
              ['1', 'daily backup', 'Kept automatically'],
              ['100%', 'separate data', 'For every coaching']
            ].map(([n, l, d]) => (
              <div key={l} className="rounded-xl border border-sky-400/30 bg-white/[0.04] p-6 text-center">
                <div className="text-3xl font-extrabold text-white">{n}</div>
                <div className="text-sky-300 text-sm font-medium mt-1">{l}</div>
                <div className="text-xs text-slate-400 mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Security and privacy" title={<>Your data is <span className="text-sky-400">yours alone</span></>} text={"Students’ records and fee details are private. This is how they are protected."} />
          <div className="grid sm:grid-cols-2 gap-4">
            {SECURITY.map(s => (
              <div key={s.title} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <span className="w-11 h-11 rounded-full bg-sky-400/10 text-sky-400 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <p className="text-sm text-sky-100/75 mt-1.5 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[#16222d] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="FAQ" title={<>Questions <span className="text-sky-400">people ask</span></>} />
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left text-sm sm:text-base font-semibold text-white hover:bg-white/5"
                >
                  {f.q}
                  <ChevronDown className={`w-5 h-5 text-sky-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="px-5 pb-5 text-sm text-sky-100/80 leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo request */}
      <section id="demo" className="bg-gradient-to-br from-[#1b2c3c] to-[#0f1b26] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{'— '}Book a demo{' —'}</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 tracking-tight">See how it works for <span className="text-sky-400">your coaching</span></h2>
            <p className="text-sky-100/80 mt-4 leading-relaxed">
              Tell us who you are and we will get back to you to show AcademiaOS and answer your questions. Already have a coaching here? Sign in directly.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              {['A walk through of the app with your own questions', 'Help to register your coaching', 'No payment is asked on this page'].map(t => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
            <a href="#/login" className="inline-flex items-center gap-2 mt-8 text-sm font-semibold text-sky-300 hover:text-sky-200">
              Already registered? Sign in <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <DemoRequestForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#16222d] border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo />
            <p className="text-sm text-sky-100/70 mt-4 leading-relaxed">
              Coaching institute management: admissions, fees, attendance, exams and reports for principals, teachers, students and parents.
            </p>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['#features', 'Features'], ['#how', 'How it works'], ['#roles', 'Who uses it'], ['#security', 'Security']].map(([h, l]) => (
                <li key={h}>
                  <a href={h} className="text-sky-100/70 hover:text-white">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">Get started</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['#/login', 'Sign in'], ['#/login', 'Register your coaching'], ['#demo', 'Book a demo'], ['#faq', 'FAQ']].map(([h, l]) => (
                <li key={l}>
                  <a href={h} className="text-sky-100/70 hover:text-white">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">Who signs in</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-sky-100/70">
              <li>Super Admin</li>
              <li>Coaching Admin (principal and front desk)</li>
              <li>Teacher, student and parent</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} AcademiaOS. All rights reserved.</span>
            <a href="#top" className="hover:text-white">
              Back to top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
