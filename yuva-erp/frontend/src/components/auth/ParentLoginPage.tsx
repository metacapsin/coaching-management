import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Award, CalendarCheck, CreditCard, Eye, Heart, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../Context/AuthContext';
import type { Portal } from '../../Context/AuthContext';
import type { LucideIcon } from 'lucide-react';
import { ForgotPassword } from './AuthPage';
import { ParentSignup } from './ParentSignup';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cls = 'w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400';

// the icon of each point on the left side
const POINT_ICONS: LucideIcon[] = [CalendarCheck, CreditCard, Award, Eye];

type Look = {
  portal: Portal;
  name: string; // "Parent"
  icon: LucideIcon;
  brandSub: string;
  headline: string;
  subtitle: string;
  points: string[];
  accent: string; // tailwind background of the round logo
  signup: boolean; // a parent can create an account
  other: string; // text of the link back to the main sign in
};

const LOOKS: Record<'parent', Look> = {
  parent: {
    portal: 'parent',
    name: 'Parent',
    icon: Heart,
    brandSub: 'Parent Portal',
    headline: 'Follow the study of your child.',
    subtitle: 'Sign in to see the attendance, fees, tests and results of your child.',
    points: ['Attendance of your child, day by day', 'Fees paid and pending, with receipts and Pay now', 'Tests that are coming, and the results', 'You can only look: nothing can be changed'],
    accent: 'bg-orange-500',
    signup: false,
    other: 'Teacher, student or coaching login'
  }
};

// The own page of the parents (/parent): a parent only signs in (the principal adds the parents, so there is no Create an account).
export const ParentLoginPage: React.FC = () => <SeparateLoginPage kind="parent" />;

const SeparateLoginPage: React.FC<{ kind: 'parent' }> = ({ kind }) => {
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
      <div className="theme-keep relative overflow-hidden hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#080f1e] via-[#0f172a] to-[#1e293b] text-white p-12">
        <span className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-28 -right-16 w-80 h-80 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${look.accent} flex items-center justify-center shadow-lg shadow-orange-900/40`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight leading-tight">AcademiaOS</div>
            <div className="text-xs text-slate-400">{look.brandSub}</div>
          </div>
        </div>
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-orange-500/15 text-orange-200 border border-orange-400/30">
            <Heart className="w-3.5 h-3.5" />
            For parents
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight max-w-md">{look.headline}</h2>
          <ul className="mt-9 space-y-3 max-w-md">
            {look.points.map((p, i) => {
              const PointIcon = POINT_ICONS[i] ?? ShieldCheck;
              return (
                <li key={p} className="flex items-center gap-3.5 text-sm text-slate-200 rounded-xl border border-white/10 bg-[#080f1e]/50 px-4 py-3">
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-sky-400/10 text-sky-300 flex items-center justify-center">
                    <PointIcon className="w-[18px] h-[18px]" />
                  </span>
                  <span>{p}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="relative text-[11px] text-slate-500">© {new Date().getFullYear()} AcademiaOS</div>
      </div>

      <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />

      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md min-w-0 bg-white rounded-3xl border border-slate-200 shadow-xl p-7 sm:p-9">
          <div className="flex items-center gap-2.5 mb-7">
            <div className={`w-10 h-10 rounded-xl ${look.accent} text-white flex items-center justify-center shadow-md shadow-orange-900/20`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-tight">AcademiaOS</div>
              <div className="text-[11px] text-slate-500">{look.brandSub}</div>
            </div>
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
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-400 w-4 h-4" />
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
                  className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
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

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 text-center mb-3">Not a parent?</p>
            <a
              href="/"
              className="w-full py-2.5 px-4 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {look.other}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
