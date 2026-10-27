import React, { useState } from 'react';
import { useAuth } from '../../Context/AuthContext';

const cls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// "Change the email I sign in with": the current password has to be typed
export const ChangeEmailForm: React.FC<{ onDone?: (message: string) => void }> = ({ onDone }) => {
  const { user, changeOwnEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Type your current password.');
    setBusy(true);
    const result = await changeOwnEmail(password, email.trim());
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setEmail('');
    setPassword('');
    onDone?.('Your login email was changed. Sign in with the new email from now on.');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-500">
        Now you sign in with <strong className="text-slate-700">{user?.email}</strong>.
      </p>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="New email" autoComplete="off" className={cls} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" className={cls} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
        {busy ? 'Saving...' : 'Change email'}
      </button>
    </form>
  );
};
