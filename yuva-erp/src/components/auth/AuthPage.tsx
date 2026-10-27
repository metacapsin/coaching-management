import React, { useState } from 'react';
import { useAuth } from '../../Context/AuthContext';
import type { Portal } from '../../Context/AuthContext';
import { requestPasswordReset } from '../utils/api';
import { RegisterCoachingForm } from './CoachingForms';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  GraduationCap,
  ShieldCheck,
  Crown,
  Users,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// "Forgot your password?": tells the principal, who then sets a new password in Team & Access
const ForgotPassword: React.FC<{ initialEmail: string }> = ({ initialEmail }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    try {
      await requestPasswordReset(email.trim());
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-xs font-medium text-blue-600 hover:underline">
        Forgot your password?
      </button>
    );
  }

  return (
    <form onSubmit={send} className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
      {state === 'sent' ? (
        <p className="text-xs text-emerald-700">
          Request sent. If this email has an account, the principal will see it and give you a new password.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-600">Enter your email. The principal gets a request and sets a new password for you.</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {state === 'error' && <p className="text-xs text-rose-600">Could not send the request. Please try again.</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={state === 'sending'} className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
              {state === 'sending' ? 'Sending...' : 'Send request'}
            </button>
          </div>
        </>
      )}
    </form>
  );
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Three logins on one page: the Super Admin (manages the coachings), the coaching admin (principal) and the teachers and
// students (their accounts are made by the principal of their coaching, inside the app: no sign-up here).
const PORTALS: { id: Portal; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: 'super', label: 'Super Admin', icon: Crown, blurb: 'Approves coachings and manages all of them.' },
  { id: 'admin', label: 'Coaching Admin', icon: ShieldCheck, blurb: 'Principal of one coaching, with its own data.' },
  { id: 'member', label: 'Teacher / Student', icon: Users, blurb: 'Your login is made by the principal of your coaching.' }
];

const FEATURES = [
  'Super Admin: approves coachings and sees who runs each one',
  'Coaching Admin: complete control of one coaching only',
  'Teachers and students: their own classes, marks and fees',
  'Every coaching has its own students, fees and exams',
  'No coaching can see the data of another coaching'
];

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-slate-200', 'bg-rose-500', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'];

const getPasswordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

// One input with an icon and an error line
const Field: React.FC<{
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email';
  right?: React.ReactNode;
}> = ({ label, icon: Icon, value, onChange, error, type = 'text', placeholder, autoComplete, inputMode, right }) => (
  <div>
    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
    <div className="relative">
      <Icon className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full pl-9 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          right ? 'pr-10' : 'pr-3'
        } ${error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'}`}
      />
      {right}
    </div>
    {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
  </div>
);

export const AuthPage: React.FC = () => {
  const { signIn, signUp, hasSuper } = useAuth();

  // Without a Super Admin the page starts on the Super Admin tab, to create it first
  const [portal, setPortal] = useState<Portal>(hasSuper ? 'admin' : 'super');
  // the principal of a new coaching registers here (and waits for the Super Admin's approval)
  const [registering, setRegistering] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The Super Admin tab: create the account first (only once), then sign in
  const createSuper = portal === 'super' && !hasSuper;
  const strength = getPasswordStrength(password);
  const activePortal = PORTALS.find(p => p.id === portal)!;

  const resetForm = () => {
    setErrors({});
    setFormError('');
    setPassword('');
    setConfirm('');
    setShowPassword(false);
  };

  const choosePortal = (next: Portal) => {
    setPortal(next);
    setRegistering(false);
    resetForm();
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (createSuper && !name.trim()) errs.name = 'Full name is required';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Enter a valid email address';

    if (!password) {
      errs.password = 'Password is required';
    } else if (createSuper) {
      if (password.length < 8) errs.password = 'Use at least 8 characters';
      else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        errs.password = 'Include at least one letter and one number';
      }
    }

    if (createSuper && confirm !== password) errs.confirm = 'Passwords do not match';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = createSuper
        ? await signUp({ name: name.trim(), email: email.trim(), password })
        : await signIn({ email: email.trim(), password, remember, portal });
      if (!result.ok) setFormError(result.error);
    } finally {
      setSubmitting(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(prev => !prev)}
      className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded"
      title={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Left: brand panel */}
      <div className="theme-keep hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight leading-tight">AcademiaOS</div>
            <div className="text-xs text-slate-400">Coaching Institute Management</div>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight max-w-md">
            One platform for every coaching of your area.
          </h2>
          <p className="mt-3 text-sm text-slate-400 max-w-md">
            Each coaching signs in with its own principal and sees only its own data.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {FEATURES.map(feature => (
              <li key={feature} className="flex items-start gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[11px] text-slate-500">© {new Date().getFullYear()} AcademiaOS · v2.4</div>
      </div>

      <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md min-w-0">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-tight">AcademiaOS</div>
              <div className="text-[11px] text-slate-500">Coaching Institute Management</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {createSuper ? 'Create the Super Admin' : registering ? 'Register your coaching' : 'Welcome back'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {createSuper
              ? 'The Super Admin approves coachings. Create this account first (only once).'
              : registering
              ? 'The Super Admin checks your request. After approval you sign in here as Coaching Admin.'
              : `Sign in as ${activePortal.label} to continue.`}
          </p>

          {/* The two logins */}
          <div className="mt-6 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 bg-slate-100 p-1 rounded-lg">
            {PORTALS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePortal(p.id)}
                  className={`py-2 px-1 text-[11px] sm:text-xs leading-tight text-center font-medium rounded-md transition-colors flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                    portal === p.id ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 text-center">{activePortal.blurb}</p>

          {createSuper && (
            <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span>
                This account becomes the <strong>Super Admin</strong>. Coachings register on this same page, you approve
                them, and each coaching gets its own principal. Nobody can see the data of another coaching.
              </span>
            </div>
          )}

          {formError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {registering ? (
            <RegisterCoachingForm onClose={() => setRegistering(false)} />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              {createSuper && (
                <Field
                  label="Full Name"
                  icon={User}
                  value={name}
                  onChange={setName}
                  error={errors.name}
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                />
              )}

              <Field
                label="Email Address"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={setEmail}
                error={errors.email}
              />

              <div>
                <Field
                  label="Password"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={createSuper ? 'new-password' : 'current-password'}
                  placeholder={createSuper ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={setPassword}
                  error={errors.password}
                  right={passwordToggle}
                />

                {createSuper && password && (
                  <div className="mt-2">
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map(level => (
                        <div
                          key={level}
                          className={`h-1.5 rounded-full transition-colors ${strength >= level ? STRENGTH_COLORS[strength] : 'bg-slate-200'}`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Strength: <span className="font-medium text-slate-700">{STRENGTH_LABELS[strength]}</span>
                    </p>
                  </div>
                )}
              </div>

              {createSuper && (
                <Field
                  label="Confirm Password"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={setConfirm}
                  error={errors.confirm}
                />
              )}

              {!createSuper && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-xs text-slate-700">Keep me signed in on this device</span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Please wait...
                  </>
                ) : createSuper ? (
                  'Create Super Admin Account'
                ) : (
                  `Sign In as ${activePortal.label}`
                )}
              </button>
            </form>
          )}

          {portal === 'admin' && !registering && (
            <div className="mt-5 text-sm text-slate-600 text-center">
              New coaching?{' '}
              <button type="button" onClick={() => setRegistering(true)} className="font-semibold text-blue-600 hover:underline">
                Register your coaching
              </button>
            </div>
          )}

          {portal !== 'super' && !registering && <ForgotPassword initialEmail={email} />}

          <p className="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">
            Your account and data are stored on the institute's server.
          </p>
        </div>
      </div>
    </div>
  );
};
