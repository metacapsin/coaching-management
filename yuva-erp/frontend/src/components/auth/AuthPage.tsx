import React, { useEffect, useState } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth } from '../../Context/AuthContext';
import { useLang } from '../../i18n/LangContext';
import type { Portal } from '../../Context/AuthContext';
import { ApiError, requestPasswordReset, resetPasswordWithCode, resetSuperPassword } from '../utils/api';
import { MemberSignup } from './MemberSignup';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  GraduationCap,
  ShieldCheck,
  Crown,
  Heart,
  ArrowRight,
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

// "Forgot your password?": a 6-digit code is emailed (when the server can send email) and the person sets a new password
// right here; the principal also sees the request in Team & Access and can set a password for the person.
export const ForgotPassword: React.FC<{ initialEmail: string }> = ({ initialEmail }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'ask' | 'code' | 'done'>('ask');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setStep('code');
    } catch {
      setError('Could not send the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const setNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await resetPasswordWithCode(email.trim(), code.trim(), password);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set the password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-xs font-medium text-blue-600 hover:underline">
        {t('Forgot your password?')}
      </button>
    );
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const primary = 'px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg';

  return (
    <form onSubmit={step === 'ask' ? send : setNew} className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
      {step === 'done' ? (
        <p className="text-xs text-emerald-700">{t('Your password is changed. Sign in with the new password.')}</p>
      ) : step === 'code' ? (
        <>
          <p className="text-xs text-slate-600">
            {t('If this email has an account, a 6-digit code was sent to it (it works for 15 minutes). The principal also got your request.')}
          </p>
          <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder={t('6-digit code')} className={inputCls} />
          <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('At least 8 characters, letters and numbers')} className={inputCls} />
          {error && <p className="text-xs text-rose-600">{t(error)}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
              {t('Cancel')}
            </button>
            <button type="submit" disabled={busy || code.length !== 6 || !password} className={primary}>
              {busy ? t('Sending...') : t('Set new password')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-600">{t('Enter your email. We send a code to set a new password, and the principal gets a request too.')}</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          {error && <p className="text-xs text-rose-600">{t(error)}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
              {t('Cancel')}
            </button>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? t('Sending...') : t('Send code')}
            </button>
          </div>
        </>
      )}
    </form>
  );
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Forgot your password?" of the Super Admin. Nobody is above the Super Admin, so the new password is set right here,
// and the server accepts it only from the server computer itself (like creating the Super Admin).
const SuperForgotPassword: React.FC<{ initialEmail: string }> = ({ initialEmail }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_REGEX.test(email.trim())) return setError('Enter the email of the Super Admin.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('The new password needs at least 8 characters, with letters and numbers.');
    }
    if (password !== again) return setError('The two passwords do not match.');
    setState('sending');
    try {
      await resetSuperPassword(email.trim(), password);
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Please try again.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full text-xs font-medium text-blue-600 hover:underline">
        {t('Forgot your password?')}
      </button>
    );
  }

  const cls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <form onSubmit={send} className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
      {state === 'done' ? (
        <>
          <p className="text-xs text-emerald-700">Password changed. Sign in above with the new password.</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-blue-600 hover:underline">
            Close
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-600">
            Choose a new password for the Super Admin. This works only on the computer where the server runs.
          </p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Super Admin email" className={cls} />
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className={cls} />
          <PasswordInput value={again} onChange={e => setAgain(e.target.value)} placeholder="New password again" autoComplete="new-password" className={cls} />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={state === 'sending'} className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
              {state === 'sending' ? 'Saving...' : 'Set new password'}
            </button>
          </div>
        </>
      )}
    </form>
  );
};

// Three logins on one page: the Super Admin (manages the coachings), the coaching admin (principal) and the teachers and
// students. The parents have an own page (/parent, see ParentLoginPage), linked below the form.
const PORTALS: { id: Portal; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: 'super', label: 'Super Admin', icon: Crown, blurb: 'Approves coachings and manages all of them.' },
  { id: 'admin', label: 'Coaching Admin', icon: ShieldCheck, blurb: 'Principal of one coaching, with its own data.' },
  { id: 'member', label: 'Teacher / Student', icon: Users, blurb: 'Teacher or student: sign in here, or create your account.' }
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
}> = ({ label, icon: Icon, value, onChange, error, type = 'text', placeholder, autoComplete, inputMode, right }) => {
  const { t } = useLang();
  return (
  <div>
    <label className="block text-xs font-medium text-slate-700 mb-1">{t(label)}</label>
    <div className="relative">
      <Icon className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder ? t(placeholder) : placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full pl-9 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          right ? 'pr-10' : 'pr-3'
        } ${error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'}`}
      />
      {right}
    </div>
    {error && <p className="text-xs text-rose-600 mt-1">{t(error)}</p>}
  </div>
  );
};

const portalOfLink = (): Portal | null => {
  try {
    const wanted = new URLSearchParams(window.location.search).get('portal');
    return wanted === 'super' || wanted === 'admin' || wanted === 'member' ? wanted : null;
  } catch {
    return null;
  }
};

// `embedded`: the form is part of the website (no side panel, no full page of its own)
export const AuthPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { signIn, signUp, hasSuper } = useAuth();
  const { t } = useLang();

  // Without a Super Admin the page starts on the Super Admin tab, to create it first
  // a link in an email can say which form to open: /?portal=super (or admin, member)
  const [portal, setPortal] = useState<Portal>(() => (hasSuper ? portalOfLink() ?? 'admin' : 'super'));
  // a teacher or student creating an own account (Teacher / Student tab)
  const [memberSignup, setMemberSignup] = useState(false);

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
    setMemberSignup(false);
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
    <div className={embedded ? 'text-slate-900 font-sans' : 'min-h-screen grid lg:grid-cols-2 bg-slate-50 text-slate-900 font-sans antialiased'}>
      {/* Left: brand panel */}
      {!embedded && (
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
      )}

      {!embedded && <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />}

      {/* Right: form */}
      <div className={embedded ? '' : 'flex items-center justify-center p-6 sm:p-10'}>
        <div className="w-full max-w-md min-w-0">
          {!embedded && (
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-tight">AcademiaOS</div>
              <div className="text-[11px] text-slate-500">Coaching Institute Management</div>
            </div>
          </div>
          )}

          {/* on the website the heading of the page is its own message, so this one is a smaller heading */}
          {React.createElement(
            embedded ? 'h2' : 'h1',
            { className: 'text-2xl font-bold tracking-tight text-slate-900' },
            t(createSuper ? 'Create the Super Admin' : memberSignup ? 'Create your account' : 'Welcome back')
          )}
          <p className="text-sm text-slate-500 mt-1">
            {createSuper
              ? 'The Super Admin approves coachings. Create this account first (only once).'
              : memberSignup
              ? t('For teachers and students. Choose your coaching first.')
              : t('Sign in as {x} to continue.').replace('{x}', t(activePortal.label))}
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
                  {t(p.label)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 text-center">{t(activePortal.blurb)}</p>

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

          {memberSignup ? (
            <MemberSignup onClose={() => setMemberSignup(false)} />
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
                  <span className="text-xs text-slate-700">{t('Keep me signed in on this device')}</span>
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
                    {t('Please wait...')}
                  </>
                ) : createSuper ? (
                  'Create Super Admin Account'
                ) : (
                  t('Sign In as {x}').replace('{x}', t(activePortal.label))
                )}
              </button>
            </form>
          )}

          {portal === 'admin' && (
            <p className="mt-5 text-xs text-slate-500 text-center leading-relaxed">
              {t('A new coaching is added by the Super Admin. You get your email and password from the Super Admin.')}
            </p>
          )}

          {portal === 'member' && !memberSignup && (
            <div className="mt-5 text-sm text-slate-600 text-center">
              {t('New teacher or student?')}{' '}
              <button type="button" onClick={() => setMemberSignup(true)} className="font-semibold text-blue-600 hover:underline">
                {t('Create an account')}
              </button>
            </div>
          )}

          {!memberSignup && !createSuper && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                Parent?
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <a
                href="/parent"
                className="group mt-3 flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg shadow-xs transition-colors"
              >
                <Heart className="w-4 h-4" />
                Parent login
                <ArrowRight className="w-3.5 h-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          )}

          {portal === 'super' && !createSuper && <SuperForgotPassword initialEmail={email} />}
          {portal !== 'super' && !memberSignup && <ForgotPassword initialEmail={email} />}

          <p className="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">
            {t("Your account and data are stored on the institute's server.")}
          </p>
        </div>
      </div>
    </div>
  );
};
