import { cleanName } from '../utils/names';
import React, { useState } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import { AlertCircle, CheckCircle2, GraduationCap, BookOpen, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../Context/AuthContext';
import { CoachingPicker } from './CoachingForms';
import { StudentSignupForm } from './StudentsignupForm';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

type Kind = 'teacher' | 'student-new' | 'student-old';

const KINDS: { id: Kind; label: string; icon: typeof BookOpen }[] = [
  { id: 'teacher', label: 'Teacher', icon: BookOpen },
  { id: 'student-new', label: 'New student', icon: GraduationCap },
  { id: 'student-old', label: 'Already admitted', icon: UserCheck }
];

// A teacher or a student creates an own account on the login page. Everything goes to the coaching they choose:
// a teacher waits for the principal's approval; a student is checked against the admission record, or registers new.
export const MemberSignup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { registerTeacher, registerStudent } = useAuth();
  const [orgId, setOrgId] = useState('');
  const [kind, setKind] = useState<Kind>('teacher');
  const [f, setF] = useState({ name: '', phone: '', subject: '', rollNo: '', email: '', password: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: ['coachingName', 'adminName', 'name'].includes(k as string) ? cleanName(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (kind === 'teacher' && !f.name.trim()) return setError('Enter your full name.');
    if (kind === 'teacher' && !f.subject.trim()) return setError('Enter the subject you teach.');
    if (kind === 'student-old' && !f.rollNo.trim()) return setError('Enter your roll number.');
    if (f.phone.replace(/\D/g, '').length < 10) return setError('Enter a valid 10-digit mobile number.');
    if (!EMAIL_REGEX.test(f.email.trim())) return setError('Enter a valid email address.');
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) {
      return setError('The password needs at least 8 characters, with letters and numbers.');
    }
    if (f.password !== f.again) return setError('The two passwords do not match.');

    setBusy(true);
    const result =
      kind === 'teacher'
        ? await registerTeacher({ name: f.name.trim(), phone: f.phone, subject: f.subject.trim(), email: f.email.trim(), password: f.password })
        : await registerStudent({ rollNo: f.rollNo.trim(), phone: f.phone, email: f.email.trim(), password: f.password });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else if (kind === 'teacher') setSent(true); // a student is signed in at once and the app opens
  };

  if (sent) {
    return (
      <div className="mt-5 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Request sent to the principal
        </p>
        <p>
          Your teacher account is <strong>waiting for the principal's approval</strong>. After it is approved and your batches are assigned,
          sign in here (Teacher / Student tab).
        </p>
        <button onClick={onClose} className="font-semibold text-emerald-800 hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-xs text-slate-500">Create your account. It is for one coaching only.</p>
      <CoachingPicker onChange={setOrgId} />

      <div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 bg-slate-100 p-1 rounded-lg">
        {KINDS.map(k => {
          const Icon = k.icon;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id);
                setError('');
              }}
              className={`py-2 px-1 text-[11px] sm:text-xs leading-tight text-center font-medium rounded-md transition-colors flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                kind === k.id ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {k.label}
            </button>
          );
        })}
      </div>

      {!orgId ? (
        <p className="mt-4 text-xs text-slate-400">Choose your coaching to go on.</p>
      ) : kind === 'student-new' ? (
        <div className="mt-4">
          <StudentSignupForm key={orgId} />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          {kind === 'student-old' && (
            <p className="text-xs text-slate-500">Use the roll number and the mobile number (yours or your parent's) that were given at admission.</p>
          )}
          {kind === 'teacher' && <input value={f.name} onChange={set('name')} placeholder="Full name" autoComplete="name" className={cls} />}
          {kind === 'student-old' && <input value={f.rollNo} onChange={set('rollNo')} placeholder="Roll number (for example 05)" className={cls} />}
          <input value={f.phone} onChange={set('phone')} placeholder="Mobile number (10 digits)" inputMode="tel" autoComplete="tel" className={cls} />
          {kind === 'teacher' && <input value={f.subject} onChange={set('subject')} placeholder="Subject you teach" className={cls} />}
          <input type="email" value={f.email} onChange={set('email')} placeholder="Email" autoComplete="email" className={cls} />
          <PasswordInput value={f.password} onChange={set('password')} placeholder="Password (8+ characters, letters and numbers)" autoComplete="new-password" className={cls} />
          <PasswordInput value={f.again} onChange={set('again')} placeholder="Password again" autoComplete="new-password" className={cls} />
          {error && (
            <p className="text-xs text-rose-600 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {kind === 'teacher' ? 'Send request for approval' : 'Create student account'}
          </button>
        </form>
      )}

      <button type="button" onClick={onClose} className="mt-4 w-full text-xs font-medium text-blue-600 hover:underline">
        Already have an account? Sign in
      </button>
    </div>
  );
};
