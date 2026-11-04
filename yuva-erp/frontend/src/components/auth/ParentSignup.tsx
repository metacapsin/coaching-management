import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth } from '../../Context/AuthContext';
import { CoachingPicker } from './CoachingForms';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// A parent creates an own account. It is checked against the admission record: the roll number of the child and the mobile
// number of the parent that was given at admission. The parent is signed in at once and sees the child only (read only).
export const ParentSignup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { registerParent } = useAuth();
  const [orgId, setOrgId] = useState('');
  const [f, setF] = useState({ rollNo: '', phone: '', email: '', password: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.rollNo.trim()) return setError('Enter the roll number of your child.');
    if (f.phone.replace(/\D/g, '').length < 10) return setError('Enter the 10-digit mobile number of the parent that was given at admission.');
    if (!EMAIL_REGEX.test(f.email.trim())) return setError('Enter a valid email address.');
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) {
      return setError('The password needs at least 8 characters, with letters and numbers.');
    }
    if (f.password !== f.again) return setError('The two passwords do not match.');
    setBusy(true);
    const result = await registerParent({ rollNo: f.rollNo.trim(), phone: f.phone, email: f.email.trim(), password: f.password, orgId });
    setBusy(false);
    if (!result.ok) setError(result.error); // on success the app opens
  };

  return (
    <div className="mt-5">
      <p className="text-xs text-slate-500">Create the account of a parent. It shows the child only and cannot change anything.</p>
      <CoachingPicker onChange={setOrgId} />
      {!orgId ? (
        <p className="mt-4 text-xs text-slate-400">Choose the coaching of your child to go on.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">Use the roll number of your child and the parent mobile number that were given at admission.</p>
          <input value={f.rollNo} onChange={set('rollNo')} placeholder="Roll number of your child (for example 05)" className={cls} />
          <input value={f.phone} onChange={set('phone')} placeholder="Parent mobile number (10 digits)" inputMode="tel" autoComplete="tel" className={cls} />
          <input type="email" value={f.email} onChange={set('email')} placeholder="Your email" autoComplete="email" className={cls} />
          <PasswordInput value={f.password} onChange={set('password')} placeholder="Password (8+ characters, letters and numbers)" autoComplete="new-password" className={cls} />
          <PasswordInput value={f.again} onChange={set('again')} placeholder="Password again" autoComplete="new-password" className={cls} />
          {error && (
            <p className="text-xs text-rose-600 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create parent account
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
