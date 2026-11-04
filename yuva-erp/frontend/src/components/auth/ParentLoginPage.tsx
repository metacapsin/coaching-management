import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, GraduationCap, Heart, Loader2, Lock, Mail, UserCog } from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../Context/AuthContext';
import type { Portal } from '../../Context/AuthContext';
import type { LucideIcon } from 'lucide-react';
import { ForgotPassword } from './AuthPage';
import { ParentSignup } from './ParentSignup';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cls = 'w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

type Look = {
  portal: Portal;
  name: string; // "Parent", "Front Desk Staff"
  icon: LucideIcon;
  brandSub: string;
  headline: string;
  subtitle: string;
  points: string[];
  accent: string; // tailwind background of the round logo
  signup: boolean; // a parent can create an account; the staff is added by the principal
  other: string; // text of the link back to the main sign in
};

const LOOKS: Record<'parent' | 'staff', Look> = {
  parent: {
    portal: 'parent',
    name: 'Parent',
    icon: Heart,
    brandSub: 'Parent Portal',
    headline: 'Follow the study of your child.',
    subtitle: 'Sign in to see the attendance, fees, tests and results of your child.',
    points: ['Attendance of your child, day by day', 'Fees paid and pending, with receipts and Pay now', 'Tests that are coming, and the results', 'You can only look: nothing can be changed'],
    accent: 'bg-rose-500',
    signup: true,
    other: 'Teacher, student or coaching login'
  },
  staff: {
    portal: 'staff',
    name: 'Front Desk Staff',
    icon: UserCog,
    brandSub: 'Front Desk',
    headline: 'The office of your coaching, in one place.',
    subtitle: 'Sign in with the email and password that the principal made for you.',
    points: ['Admissions, enquiries and the student list', 'Daily attendance and fee collection', 'Fee notices and test notices to the parents', 'Money of the coaching (expenses, salaries) stays with the principal'],
    accent: 'bg-amber-500',
    signup: false,
    other: 'Principal, teacher or student login'
  }
};

// The own page of the parents (/parent) and of the front desk staff (/staff): not tabs of the main sign in. A parent can create an
// account (roll number of the child and the parent mobile number that was given at admission); the staff account is made by the principal.
export const ParentLoginPage: React.FC = () => <SeparateLoginPage kind="parent" />;
export const StaffLoginPage: React.FC = () => <SeparateLoginPage kind="staff" />;

const SeparateLoginPage: React.FC<{ kind: 'parent' | 'staff' }> = ({ kind }) => {
  const look = LOOKS[kind];
  const Icon = look.icon;
  const { signIn } = useAuth();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!EMAIL_REGEX.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    const result = await signIn({ email: email.trim(), password, remember, portal: look.portal });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else window.history.replaceState(null, '', '/'); // signed in: the app opens
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 text-slate-900 font-sans antialiased">
      <div className="theme-keep hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${look.accent} flex items-center justify-center shadow-sm`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight leading-tight">AcademiaOS</div>
            <div className="text-xs text-slate-400">{look.brandSub}</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight max-w-md">{look.headline}</h2>
          <ul className="mt-8 space-y-3 text-sm">
            {look.points.map(p => (
              <li key={p} className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-[11px] text-slate-500">© {new Date().getFullYear()} AcademiaOS</div>
      </div>

      <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md min-w-0">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className={`w-9 h-9 rounded-lg ${look.accent} text-white flex items-center justify-center`}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="text-base font-bold tracking-tight">AcademiaOS</div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{signup ? 'Create a parent account' : `${look.name} login`}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {signup ? 'Choose the coaching of your child first.' : look.subtitle}
          </p>

          {signup ? (
            <ParentSignup onClose={() => setSignup(false)} />
          ) : (
            <>
              <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                    <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={cls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none z-10" />
                    <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" className={cls} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  <span className="text-xs text-slate-700">Keep me signed in on this device</span>
                </label>
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Please wait...
                    </>
                  ) : (
                    `Sign In as ${look.name}`
                  )}
                </button>
              </form>

              {look.signup && (
                <div className="mt-5 text-sm text-slate-600 text-center">
                  New parent?{' '}
                  <button type="button" onClick={() => setSignup(true)} className="font-semibold text-blue-600 hover:underline">
                    Create an account
                  </button>
                </div>
              )}
              <ForgotPassword initialEmail={email} />
            </>
          )}

          <p className="mt-6 text-xs text-center">
            <a href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
              <ArrowLeft className="w-3.5 h-3.5" />
              {look.other}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
