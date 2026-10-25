import React, { useState } from 'react';
import { useAuth } from '../../Context/AuthContext';
import type { Portal } from '../../Context/AuthContext';
import { requestPasswordReset } from '../utils/api';
import { CoachingPicker, RegisterCoachingForm } from './CoachingForms';
import { ThemeToggle } from '../ui/ThemeToggle';
import { StudentSignupForm } from '../auth/StudentsignupForm';
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Phone,
  Hash,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Mode = 'signin' | 'signup';

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

const PORTALS: { id: Portal; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: 'student', label: 'Student', icon: GraduationCap, blurb: 'See your attendance, fees, results and timetable.' },
  { id: 'teacher', label: 'Teacher', icon: BookOpen, blurb: 'Mark attendance and enter marks for your batches.' },
  { id: 'admin', label: 'Administration', icon: ShieldCheck, blurb: 'Principal and office staff. Full institute access.' }
];

const FEATURES = [
  'Students: own attendance, fees, results and timetable',
  'Teachers: attendance and marks for their own batches',
  'Principal: complete control of every module and account',
  'Admissions, fee receipts and instant parent alerts'
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
  const { signIn, signUp, registerStudent, registerTeacher, hasUsers } = useAuth();

  // No account yet -> first-time principal setup. Otherwise normal role-based login / registration.
  const setupMode = !hasUsers;

  const [portal, setPortal] = useState<Portal>('student');
  const [mode, setMode] = useState<Mode>('signin');

  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [teacherRequested, setTeacherRequested] = useState(false);
  // Students can register as new (roll number is automatic) or verify an existing admission
  const [studentMode, setStudentMode] = useState<'new' | 'existing'>('new');
  // the coaching a student or teacher signs up to, and the 'register your coaching' form
  const [orgId, setOrgId] = useState('');
  const [registeringCoaching, setRegisteringCoaching] = useState(false);

  // Administration accounts are created by the principal, so there is no public sign-up for them
  const isSignup = !setupMode && mode === 'signup' && portal !== 'admin';
  const isSignin = !setupMode && !isSignup;
  const needsConfirm = setupMode || isSignup;
  const strength = getPasswordStrength(password);
  const activePortal = PORTALS.find(p => p.id === portal)!;
  const newStudentMode = isSignup && portal === 'student' && studentMode === 'new';

  const resetForm = () => {
    setErrors({});
    setFormError('');
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setTeacherRequested(false);
  };

  const choosePortal = (next: Portal) => {
    setPortal(next);
    if (next === 'admin') setMode('signin');
    resetForm();
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    resetForm();
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if ((setupMode || (isSignup && portal === 'teacher')) && !name.trim()) errs.name = 'Full name is required';
    if (isSignup && portal === 'student' && !rollNo.trim()) errs.rollNo = 'Roll number is required';
    if (isSignup && phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid 10-digit mobile number';
    if (isSignup && portal === 'teacher' && !subject.trim()) errs.subject = 'Subject is required';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Enter a valid email address';

    if (!password) {
      errs.password = 'Password is required';
    } else if (needsConfirm) {
      if (password.length < 8) errs.password = 'Use at least 8 characters';
      else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        errs.password = 'Include at least one letter and one number';
      }
    }

    if (needsConfirm && confirm !== password) errs.confirm = 'Passwords do not match';

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
      let result;
      if (setupMode) result = await signUp({ name, email, password });
      else if (isSignin) result = await signIn({ email, password, remember, portal });
      else if (portal === 'student') result = await registerStudent({ rollNo, phone, email, password });
      else result = await registerTeacher({ name, phone, subject, email, password });

      if (!result.ok) {
        setFormError(result.error);
      } else if (isSignup && portal === 'teacher') {
        setTeacherRequested(true);
      }
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
            One platform for your principal, teachers and students.
          </h2>
          <p className="mt-3 text-sm text-slate-400 max-w-md">
            Everyone signs in with their own role and sees only what they need.
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
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-tight">AcademiaOS</div>
              <div className="text-[11px] text-slate-500">Coaching Institute Management</div>
            </div>
          </div>

          {/* Teacher request submitted */}
          {teacherRequested ? (
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs text-center">
              <span className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-4">Request sent to the principal</h1>
              <p className="text-sm text-slate-500 mt-2">
                Your teacher account is <strong>pending approval</strong>. Once the principal approves it and
                assigns your batches, you can sign in from the Teacher tab.
              </p>
              <button
                onClick={() => {
                  setTeacherRequested(false);
                  chooseMode('signin');
                }}
                className="mt-5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {setupMode
                  ? 'Set up your institute'
                  : isSignin
                  ? 'Welcome back'
                  : portal === 'student'
                  ? 'Create student account'
                  : 'Create teacher account'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {setupMode
                  ? 'Create the principal (administrator) account to get started.'
                  : isSignin
                  ? `Sign in as ${activePortal.label.toLowerCase()} to continue.`
                  : portal === 'student'
                  ? studentMode === 'new'
                    ? 'Register as a new student. Your roll number is assigned automatically.'
                    : 'Verify with your roll number and registered mobile number.'
                  : 'Send a request to the principal for approval.'}
              </p>

              {/* Role tabs */}
              {!setupMode && (
                <div className="mt-6 grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                  {PORTALS.map(p => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => choosePortal(p.id)}
                        className={`py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                          portal === p.id
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {!setupMode && (
                <p className="mt-2 text-[11px] text-slate-400 text-center">{activePortal.blurb}</p>
              )}

              {setupMode && (
                <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>
                    This first account becomes the <strong>Principal (Administrator)</strong> with full access.
                    Teachers and students can then register, and you can add office staff from{' '}
                    <strong>Team &amp; Access</strong>.
                  </span>
                </div>
              )}

              {isSignup && portal === 'teacher' && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <span>
                    Teacher accounts need the principal&apos;s approval before you can sign in.
                  </span>
                </div>
              )}

              {isSignup && <CoachingPicker onChange={setOrgId} />}

              {isSignup && portal === 'student' && (
                <div className="mt-4 grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                  {(
                    [
                      { id: 'new', label: 'New Registration' },
                      { id: 'existing', label: 'Already Admitted' }
                    ] as const
                  ).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setStudentMode(m.id);
                        resetForm();
                      }}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                        studentMode === m.id
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {isSignup && portal === 'student' && studentMode === 'existing' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>
                    Use the mobile number (yours or your parent&apos;s) that was given at admission. Your account
                    is linked to your admission record.
                  </span>
                </div>
              )}

              {formError && !newStudentMode && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {newStudentMode && orgId && <StudentSignupForm key={orgId} />}

              <form
                onSubmit={handleSubmit}
                noValidate
                className={`mt-5 space-y-4 ${newStudentMode || (isSignup && !orgId) ? 'hidden' : ''}`}
              >
                {(setupMode || (isSignup && portal === 'teacher')) && (
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

                {isSignup && portal === 'student' && (
                  <Field
                    label="Roll Number"
                    icon={Hash}
                    value={rollNo}
                    onChange={setRollNo}
                    error={errors.rollNo}
                    placeholder="e.g. 05"
                  />
                )}

                {isSignup && (
                  <Field
                    label={portal === 'student' ? 'Registered Mobile Number' : 'Mobile Number'}
                    icon={Phone}
                    value={phone}
                    onChange={setPhone}
                    error={errors.phone}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                )}

                {isSignup && portal === 'teacher' && (
                  <Field
                    label="Subject You Teach"
                    icon={BookOpen}
                    value={subject}
                    onChange={setSubject}
                    error={errors.subject}
                    placeholder="e.g. Physics"
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
                    autoComplete={isSignin ? 'current-password' : 'new-password'}
                    placeholder={isSignin ? 'Enter your password' : 'At least 8 characters'}
                    value={password}
                    onChange={setPassword}
                    error={errors.password}
                    right={passwordToggle}
                  />

                  {needsConfirm && password && (
                    <div className="mt-2">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map(level => (
                          <div
                            key={level}
                            className={`h-1.5 rounded-full transition-colors ${
                              strength >= level ? STRENGTH_COLORS[strength] : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Strength: <span className="font-medium text-slate-700">{STRENGTH_LABELS[strength]}</span>
                      </p>
                    </div>
                  )}
                </div>

                {needsConfirm && (
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

                {isSignin && (
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
                  ) : setupMode ? (
                    'Create Principal Account'
                  ) : isSignin ? (
                    `Sign In as ${activePortal.label}`
                  ) : portal === 'student' ? (
                    'Create Student Account'
                  ) : (
                    'Send Request for Approval'
                  )}
                </button>
              </form>

              {/* Switch between sign in and create account */}
              {!setupMode && portal !== 'admin' && (
                <p className="mt-5 text-sm text-slate-600 text-center">
                  {isSignin ? (
                    <>
                      New {portal}?{' '}
                      <button
                        type="button"
                        onClick={() => chooseMode('signup')}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => chooseMode('signin')}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              )}

              {!setupMode && portal === 'admin' && (
                <div className="mt-5 text-xs text-slate-500 text-center leading-relaxed">
                  <p>
                    Office-staff accounts are created by the principal inside the app under{' '}
                    <strong className="text-slate-700">Team &amp; Access</strong>.
                  </p>
                  {!registeringCoaching && (
                    <button type="button" onClick={() => setRegisteringCoaching(true)} className="mt-3 font-semibold text-blue-600 hover:underline">
                      Own a coaching? Register your coaching
                    </button>
                  )}
                  {registeringCoaching && <RegisterCoachingForm onClose={() => setRegisteringCoaching(false)} />}
                </div>
              )}

              {isSignin && <ForgotPassword initialEmail={email} />}

              <p className="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">
                Your account and data are stored on the institute's server.{' '}
                <a href="/superadmin" className="text-slate-500 hover:text-blue-600 hover:underline">
                  Super Admin
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};