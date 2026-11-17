import React, { useState } from 'react';
import { ScrollText, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../Context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { RulesText } from '../views/RulesView';

// Shown instead of the app to a new teacher, student or parent, before anything else: the rules and regulations of the coaching (the server sends the
// rules that fit the person). The person reads them, ticks the box and presses "I agree" (for a teacher the principal is told by email). They were
// sent by email too when the principal added the person.
export const RulesGate: React.FC = () => {
  const { user, acceptRules, signOut } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree || busy) return;
    setBusy(true);
    setError('');
    const r = await acceptRules();
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased p-4 sm:p-8">
      <ThemeToggle className="fixed top-3 right-3 z-30 bg-white/80 border border-slate-200" />
      <form onSubmit={submit} className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <ScrollText className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Please read the rules and regulations</h1>
            <p className="text-xs text-slate-500">
              {user?.name} · {user?.email}. You must agree before you open the app.
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <RulesText />
        </div>
        <div className="px-6 py-5 border-t border-slate-200 bg-slate-50 space-y-3">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0" />
            <span className="text-sm text-slate-800">I have read all the rules and regulations above and I agree to follow them.</span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => void signOut()} className="text-xs text-slate-500 hover:underline">
              Sign out
            </button>
            <button
              type="submit"
              disabled={!agree || busy}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}I agree
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
