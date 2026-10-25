import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ApiError, registerCoaching } from '../utils/api';

const fieldCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// A coaching asks to join. Its principal can sign in only after the super admin approves it.
export const RegisterCoachingForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [f, setF] = useState({ coachingName: '', city: '', adminName: '', phone: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await registerCoaching({
        coachingName: f.coachingName.trim(),
        city: f.city.trim(),
        adminName: f.adminName.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        password: f.password
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Request sent
        </p>
        <p>
          The super admin will check your request. After it is approved, sign in here with the email and password you just
          chose (Administration tab).
        </p>
        <button onClick={onClose} className="font-semibold text-emerald-800 hover:underline">
          Back to sign in
        </button>
      </div>
    );

  const field = (label: string, key: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input value={f[key]} onChange={set(key)} className={fieldCls} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <p className="text-xs text-slate-500">
        Register your coaching. You become its principal (administrator) once the super admin approves.
      </p>
      {field('Name of your coaching *', 'coachingName')}
      {field('City / area', 'city')}
      {field('Your name (principal) *', 'adminName')}
      {field('Your mobile number *', 'phone', { inputMode: 'tel', placeholder: '10-digit mobile number' })}
      {field('Your email *', 'email', { type: 'email', autoComplete: 'username' })}
      {field('Password *', 'password', { type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters, letters and numbers' })}
      {field('Confirm password *', 'confirm', { type: 'password', autoComplete: 'new-password' })}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
          {busy ? 'Sending...' : 'Send request'}
        </button>
      </div>
    </form>
  );
};
