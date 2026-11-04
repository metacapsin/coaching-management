import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Menu,
  X,
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
  Lock,
  Eye,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Star
} from 'lucide-react';
import { AuthPage } from '../auth/AuthPage';
import { Carousel } from './Carousel';
import { useLang } from '../../i18n/LangContext';
import { SITE_INFO, SOCIAL, SCREENSHOTS, TESTIMONIALS } from '../../data/siteInfo';
import { CountUp, FloatingButtons, Reveal, prefersReducedMotion, useTicker } from './LandingMotion';

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
  { n: '02', title: 'Add programs and batches', text: 'Write down your programs with their fees. Add a batch to a program while you admit the first student, or in Batches.' },
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

// The top of the page changes its message by itself (the first one is the main one)
const HERO_SLIDES: { a: string; b: string; text: string }[] = [
  {
    a: 'Run your whole coaching ',
    b: 'from one place',
    text: 'Admissions, fees, attendance, tests, notices and reports for the principal, the teachers, the students and their parents. One platform for every coaching of your area.'
  },
  { a: 'Take the roll call ', b: 'in a minute', text: 'Mark a batch or all students at once, note who is late, and prepare the message for the parent of an absent student.' },
  { a: 'Fees and receipts ', b: 'without a register', text: 'Collect the fee, print a numbered receipt, and see at a glance who still has to pay.' },
  { a: 'Every coaching’s data ', b: 'stays its own', text: 'Separate data for each coaching, roles checked by the server on every request, and a backup every day.' }
];

const DAY: { title: string; text: string }[] = [
  { title: 'Morning: the roll call', text: 'The teacher opens the batch on a phone and marks who is present. The parent of an absent student gets a message ready to send.' },
  { title: 'Noon: new admissions', text: 'The front desk admits a student, takes the first fee and prints the receipt. The student’s login is made in the same step.' },
  { title: 'Afternoon: tests and marks', text: 'Schedule a test, enter the marks, and the ranks and report cards are ready to print.' },
  { title: 'Evening: fees and notices', text: 'See who still has to pay, remind them, and send a notice or homework to a batch.' },
  { title: 'Month end: reports', text: 'Fees collected, expenses, salaries and profit. Download the reports as CSV.' }
];

const WHY_CARDS = [
  { icon: Building2, title: 'Built for coachings', text: 'Programs, batches, test series, ranks and fee receipts are the way a coaching works.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Each coaching, its own data. Roles are checked by the server.' },
  { icon: Smartphone, title: 'Nothing to install', text: 'Open it in a browser on a phone or a computer.' },
  { icon: BarChart3, title: 'Numbers at a glance', text: 'Today’s absentees, pending fees, new admissions and profit on one dashboard.' }
];

const SOCIAL_ICON: Record<string, React.ReactNode> = {
  facebook: <Facebook className="w-5 h-5" />,
  x: <Twitter className="w-5 h-5" />,
  linkedin: <Linkedin className="w-5 h-5" />,
  instagram: <Instagram className="w-5 h-5" />,
  medium: <span className="font-serif font-bold text-lg leading-none">M</span>,
  reviews: <Star className="w-5 h-5" />
};

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <a href="#top" className={`flex items-center gap-2.5 ${className}`}>
    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
      <GraduationCap className="w-5 h-5" />
    </span>
    <span className="hidden min-[360px]:inline text-lg sm:text-xl font-bold tracking-tight text-white">AcademiaOS</span>
  </a>
);

const SectionHead: React.FC<{ kicker: string; title: React.ReactNode; text?: string }> = ({ kicker, title, text }) => {
  const { t } = useLang();
  return (
  <Reveal className="text-center max-w-3xl mx-auto mb-10">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{'— '}{t(kicker)}{' —'}</p>
    <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 tracking-tight">{title}</h2>
    {text && <p className="text-sky-100/80 mt-4 leading-relaxed">{t(text)}</p>}
  </Reveal>
  );
};

// `signedIn`: somebody is already signed in on this browser and came here by a link of an email
export const LandingPage: React.FC<{ signedIn?: { text: string; onContinue: () => void; onSignOut: () => void } }> = ({ signedIn }) => {
  const { t: tr } = useLang();
  const [menu, setMenu] = useState(false);
  // the "Add coaching" buttons open the registration of a coaching in the form at the top
  const [registerSignal, setRegisterSignal] = useState(0);
  const openRegister = () => {
    setRegisterSignal(n => n + 1);
    setMenu(false);
    document.getElementById('signin')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };
  const [tab, setTab] = useState(WHY_TABS[0].id);
  const [open, setOpen] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const active = WHY_TABS.find(t => t.id === tab) || WHY_TABS[0];

  // the message at the top changes every few seconds (it waits while the mouse is over it)
  const [slide, setSlide] = useState(0);
  const [slideHold, setSlideHold] = useState(false);
  useTicker(() => setSlide(i => (i + 1) % HERO_SLIDES.length), 6000, slideHold);
  const hero = HERO_SLIDES[slide];

  // the tabs of "Why" go on by themselves until somebody chooses one
  const [autoTabs, setAutoTabs] = useState(true);
  const [tabHold, setTabHold] = useState(false);
  useTicker(() => setTab(cur => WHY_TABS[(WHY_TABS.findIndex(t => t.id === cur) + 1) % WHY_TABS.length].id), 7000, !autoTabs || tabHold);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const before = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = before;
    };
  }, []);

  // a link from an email (/?portal=super#signin) lands on the sign in form
  useEffect(() => {
    if (window.location.hash !== '#signin' && !new URLSearchParams(window.location.search).get('portal')) return;
    const id = setTimeout(() => document.getElementById('signin')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  return (
    <div id="top" className="theme-keep min-h-screen bg-[#0f1b26] text-slate-200 antialiased font-sans scroll-smooth">
      {/* Top bar */}
      <header className={`sticky top-0 z-40 border-b ${scrolled ? 'bg-[#0f1b26]/95 backdrop-blur border-white/10' : 'bg-[#0f1b26] border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <Logo className="shrink-0" />
          <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="text-sm text-slate-300 hover:text-white transition-colors">
                {tr(n.label)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openRegister} className="px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded-lg transition-colors">
              {tr('Add coaching')}
            </button>
            <button onClick={() => setMenu(m => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/10">
              {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="lg:hidden border-t border-white/10 px-4 py-3 space-y-1 bg-[#0f1b26]">
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/10">
                {tr(n.label)}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1b2c3c] via-[#16293a] to-[#0f1b26]">
        <div className="lp-blob absolute -top-24 -right-24 w-96 h-96 rounded-full bg-pink-500/10 blur-3xl" aria-hidden="true" />
        <div className="lp-blob lp-blob-2 absolute top-1/3 -left-32 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" aria-hidden="true" />
        <div className="lp-blob absolute -bottom-32 left-1/3 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-3 py-1">
              {tr('Coaching institute management')}
            </span>
            <div
              className="min-h-[15.5rem] sm:min-h-[17rem]"
              onMouseEnter={() => setSlideHold(true)}
              onMouseLeave={() => setSlideHold(false)}
              onFocus={() => setSlideHold(true)}
              onBlur={() => setSlideHold(false)}
              aria-live="polite"
            >
              <div key={slide} className="lp-slide">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mt-5 leading-[1.1]">{tr(hero.a)}<span className="text-sky-400">{tr(hero.b)}</span></h1>
                <p className="text-lg text-sky-100/80 mt-5 leading-relaxed max-w-xl">{tr(hero.text)}</p>
              </div>
            </div>
            <div className="-mt-2 flex items-center gap-1.5" role="group" aria-label="Messages">
              {HERO_SLIDES.map((_, i) => (
                <button key={i} type="button" onClick={() => setSlide(i)} aria-label={`Show message ${i + 1}`} aria-current={i === slide} className="py-4 px-0.5">
                  <span className={`block h-1.5 rounded-full overflow-hidden bg-white/20 transition-all duration-300 ${i === slide ? 'w-10' : 'w-4 hover:bg-white/40'}`}>
                    {i === slide && <span key={slide} className="lp-bar block h-full bg-sky-400" style={{ animationDuration: '6s', animationPlayState: slideHold ? 'paused' : 'running' }} />}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={openRegister} className="mt-6 px-6 py-3 text-sm font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded-lg shadow-lg shadow-blue-900/30 transition-colors">
              {tr('Add coaching')}
            </button>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {['No app to install', 'Works on a phone', 'Each coaching’s data stays separate'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {tr(item)}
                </li>
              ))}
            </ul>
          </div>
          <div id="signin" className="lp-slide w-full max-w-md mx-auto lg:ml-auto">
            <div className="auth-dark rounded-2xl bg-[#2a3742] border border-sky-300/25 text-slate-900 shadow-2xl shadow-black/30 p-6 sm:p-8">
              {signedIn && (
                <div className="mb-5 p-3 rounded-lg border border-sky-300/30 bg-sky-400/10 text-xs text-sky-100">
                  <p>
                    {tr('You are already signed in as')} <strong className="text-white">{signedIn.text}</strong>. {tr('Use the form below to sign in as somebody else.')}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={signedIn.onContinue} className="px-3 py-1.5 font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded-md">
                      {tr('Open my dashboard')}
                    </button>
                    <button type="button" onClick={signedIn.onSignOut} className="px-3 py-1.5 font-semibold text-sky-100 border border-sky-300/40 hover:bg-white/10 rounded-md">
                      {tr('Sign Out')}
                    </button>
                  </div>
                </div>
              )}
              <AuthPage embedded registerSignal={registerSignal} />
            </div>
          </div>
        </div>
      </section>

      {/* Why: tabs */}
      <section id="why" className="scroll-mt-16 bg-[#16222d]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div role="tablist" aria-label="Why AcademiaOS" className="flex overflow-x-auto -mx-4 sm:mx-0 border-b border-white/10" onMouseEnter={() => setTabHold(true)} onMouseLeave={() => setTabHold(false)}>
            {WHY_TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setAutoTabs(false);
                }}
                className={`relative shrink-0 px-5 py-4 text-sm font-medium transition-colors ${tab === t.id ? 'text-sky-400 bg-white/5' : 'text-slate-300 hover:text-white'}`}
              >
                {tr(t.label)}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400/25">
                    {autoTabs ? (
                      <span key={tab} className="lp-bar block h-full bg-sky-400" style={{ animationDuration: '7s', animationPlayState: tabHold ? 'paused' : 'running' }} />
                    ) : (
                      <span className="block h-full bg-sky-400" />
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div key={tab} role="tabpanel" className="lp-slide py-14 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">{'— '}{tr('Why AcademiaOS')}{' —'}</p>
              <h2 className="text-3xl font-bold text-white mt-3 tracking-tight">{tr(active.title)}</h2>
              <p className="text-sky-100/80 mt-4 leading-relaxed">{tr(active.text)}</p>
            </div>
            <ul className="space-y-3">
              {active.points.map(p => (
                <li key={p} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
                  <Check className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  {tr(p)}
                </li>
              ))}
            </ul>
          </div>
          <Reveal stagger className="pb-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY_CARDS.map(c => (
              <div key={c.title} className="lp-lift rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-sky-400/40">
                <span className="w-11 h-11 rounded-full bg-sky-400/10 text-sky-400 flex items-center justify-center">
                  <c.icon className="w-5 h-5" />
                </span>
                <h3 className="text-base font-semibold text-white mt-4">{tr(c.title)}</h3>
                <p className="text-sm text-sky-100/70 mt-2 leading-relaxed">{tr(c.text)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="How it works" title={<>{tr('From registration to the first roll call ')}<span className="text-sky-400">{tr('in four steps')}</span></>} text="No long set up. This is how a coaching starts." />
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map(s => (
              <div key={s.n} className="lp-lift relative rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:border-sky-400/40">
                <span className="absolute top-3 right-4 text-4xl font-extrabold text-sky-400/70">{s.n}</span>
                <h3 className="text-lg font-semibold text-white pr-12">{tr(s.title)}</h3>
                <p className="text-sm text-sky-100/75 mt-3 leading-relaxed">{tr(s.text)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-[#16222d] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Features" title={<>{tr('Everything a coaching needs, ')}<span className="text-sky-400">{tr('in one app')}</span></>} text="Twelve areas of work, ready to use from the first day." />
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-lift group rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 hover:border-sky-400/40">
                <span className="w-11 h-11 rounded-lg bg-blue-600/20 text-sky-300 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <f.icon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-semibold text-white mt-4">{tr(f.title)}</h3>
                <p className="text-sm text-sky-100/75 mt-2 leading-relaxed">{tr(f.text)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Who uses it" title={<>{tr('One sign in, ')}<span className="text-sky-400">{tr('six kinds of people')}</span></>} text="Everybody sees only what belongs to them." />
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLES.map(r => (
              <div key={r.who} className="lp-lift rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:border-sky-400/40">
                <h3 className="text-lg font-semibold text-white">{tr(r.who)}</h3>
                <ul className="mt-3 space-y-2">
                  {r.sees.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-sky-100/80">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {tr(s)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* A day in a coaching: slider */}
      <section className="bg-[#16222d] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Where it is used" title={tr('A day in your coaching')} />
          <Carousel
            label={tr('A day in your coaching')}
            slides={DAY.map(d => (
              <div key={d.title} className="rounded-2xl border border-sky-400/30 bg-white/[0.05] p-8 text-center min-h-[11rem] flex flex-col justify-center">
                <h3 className="text-xl font-semibold text-white">{tr(d.title)}</h3>
                <p className="text-sky-100/80 mt-3 leading-relaxed">{tr(d.text)}</p>
              </div>
            ))}
          />
        </div>
      </section>

      {/* Screens of the real app */}
      {SCREENSHOTS.length > 0 && (
        <section id="screens" className="scroll-mt-16 bg-[#1b2833] py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <SectionHead kicker="The app" title={tr('See the real app')} text="Screens of AcademiaOS, with sample data." />
            <Carousel
              label={tr('See the real app')}
              ms={7000}
              slides={SCREENSHOTS.map(x => (
                <figure key={x.file} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
                  <a href={x.file} target="_blank" rel="noopener noreferrer" aria-label={`${tr(x.title)}: ${tr('Open the full screen')}`}>
                    <img src={x.file} alt={x.title} loading="lazy" className="w-full rounded-lg border border-white/10" />
                  </a>
                  <figcaption className="mt-3 text-center">
                    <span className="font-semibold text-white">{tr(x.title)}</span>
                    <span className="block text-sm text-sky-100/75 mt-1">{tr(x.text)}</span>
                  </figcaption>
                </figure>
              ))}
            />
          </div>
        </section>
      )}

      {/* Real words of customers (only when there are real ones) */}
      {TESTIMONIALS.length > 0 && (
        <section className="bg-[#1b2833] py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <SectionHead kicker="What coachings say" title={tr('What coachings say')} />
            <Carousel
              label={tr('What coachings say')}
              slides={TESTIMONIALS.map(q => (
                <blockquote key={q.name} className="rounded-2xl border border-sky-400/30 bg-white/[0.05] p-8 text-center">
                  <p className="text-lg text-white leading-relaxed">“{q.quote}”</p>
                  <footer className="mt-4 text-sm text-sky-300">{q.name}, {q.role}</footer>
                </blockquote>
              ))}
            />
          </div>
        </section>
      )}

      {/* Facts */}
      <section className="bg-[#16222d] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="At a glance" title={<>{tr('What is inside, ')}<span className="text-sky-400">{tr('in short')}</span></>} />
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              [6, '', 'kinds of sign in', 'Super Admin, principal, front desk, teacher, student, parent'],
              [12, '', 'areas of work', 'From admission to reports'],
              [1, '', 'daily backup', 'Kept automatically'],
              [100, '%', 'separate data', 'For every coaching']
            ] as [number, string, string, string][]).map(([n, suffix, l, d]) => (
              <div key={l} className="lp-lift rounded-xl border border-sky-400/30 bg-white/[0.04] p-6 text-center">
                <div className="text-3xl font-extrabold text-white">
                  <CountUp to={n} suffix={suffix} />
                </div>
                <div className="text-sky-300 text-sm font-medium mt-1">{tr(l)}</div>
                <div className="text-xs text-slate-400 mt-1">{tr(d)}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-16 bg-[#1b2833] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="Security and privacy" title={<>{tr('Your data is ')}<span className="text-sky-400">{tr('yours alone')}</span></>} text={"Students’ records and fee details are private. This is how they are protected."} />
          <Reveal stagger className="grid sm:grid-cols-2 gap-4">
            {SECURITY.map(s => (
              <div key={tr(s.title)} className="lp-lift flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-6 hover:border-sky-400/40">
                <span className="w-11 h-11 rounded-full bg-sky-400/10 text-sky-400 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{tr(s.title)}</h3>
                  <p className="text-sm text-sky-100/75 mt-1.5 leading-relaxed">{tr(s.text)}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 bg-[#16222d] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionHead kicker="FAQ" title={<>{tr('Questions ')}<span className="text-sky-400">{tr('people ask')}</span></>} />
          <Reveal stagger className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left text-sm sm:text-base font-semibold text-white hover:bg-white/5"
                >
                  {tr(f.q)}
                  <ChevronDown className={`w-5 h-5 text-sky-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="lp-slide px-5 pb-5 text-sm text-sky-100/80 leading-relaxed">{tr(f.a)}</p>}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <FloatingButtons onAddCoaching={openRegister} />

      {/* Footer */}
      <footer className="bg-[#16222d] border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo />
            <p className="text-sm text-sky-100/70 mt-4 leading-relaxed">
              {tr('Coaching institute management: admissions, fees, attendance, exams and reports for principals, teachers, students and parents.')}
            </p>
            {SOCIAL.some(x => x.url) && (
              <div className="mt-5 flex flex-wrap gap-3" aria-label="Social pages">
                {SOCIAL.filter(x => x.url).map(x => (
                  <a
                    key={x.key}
                    href={x.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={x.label}
                    title={x.label}
                    className="w-11 h-11 rounded-full bg-white/10 hover:bg-sky-400/25 text-sky-300 hover:text-white flex items-center justify-center shadow-md shadow-black/20 transition-colors"
                  >
                    {SOCIAL_ICON[x.key]}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">{tr('Product')}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['#features', 'Features'], ['#how', 'How it works'], ['#roles', 'Who uses it'], ['#security', 'Security']].map(([h, l]) => (
                <li key={h}>
                  <a href={h} className="text-sky-100/70 hover:text-white">
                    {tr(l)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">{tr('Get started')}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['#top', 'Sign in'], ['#top', 'Register your coaching'], ['#faq', 'FAQ']].map(([h, l]) => (
                <li key={l}>
                  <a href={h} className="text-sky-100/70 hover:text-white">
                    {tr(l)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">{tr('Who signs in')}</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-sky-100/70">
              <li>{tr('Super Admin')}</li>
              <li>{tr('Coaching Admin (principal and front desk)')}</li>
              <li>{tr('Teacher, student and parent')}</li>
            </ul>
            {(SITE_INFO.email || SITE_INFO.phone || SITE_INFO.address) && (
              <>
                <h4 className="text-base font-semibold text-white mt-6">{tr('Contact')}</h4>
                <ul className="mt-3 space-y-2 text-sm text-sky-100/70">
                  {SITE_INFO.email && <li><a href={`mailto:${SITE_INFO.email}`} className="hover:text-white">{SITE_INFO.email}</a></li>}
                  {SITE_INFO.phone && <li><a href={`tel:${SITE_INFO.phone.replace(/\s/g, '')}`} className="hover:text-white">{SITE_INFO.phone}</a></li>}
                  {SITE_INFO.address && <li>{SITE_INFO.address}</li>}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} AcademiaOS. {tr('All rights reserved.')}</span>
            <a href="#top" className="hover:text-white">
              {tr('Back to top')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
