import React, { useState } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../Context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';

const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// Shown instead of the app when somebody else (the Super Admin or the principal) set this account's password.
// The person has to choose an own password before anything else.
export const ForcePasswordChange: React.FC = () => {
  const { user, changeOwnPassword, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError('The new password needs at least 8 characters, with letters and numbers.');
      return;
    }
    if (next !== again) {
      setError('The two new passwords do not match.');
      return;
    }
    setBusy(true);
    const result = await changeOwnPassword(current, next);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-6">
      <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-7 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Choose your own password</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your current password was set by somebody else, so they know it. Choose a new one that only you know. You can use the
          app right after.
        </p>
        <PasswordInput placeholder="Current password (the one you just signed in with)" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className={inputCls} />
        <PasswordInput placeholder="New password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" className={inputCls} />
        <PasswordInput placeholder="New password again" value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" className={inputCls} />
        {error && (
          <p className="text-xs text-rose-600 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save my password
        </button>
        <button type="button" onClick={() => void signOut()} className="w-full text-xs text-slate-500 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
};
