import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, Mail, Send, Trash2 } from 'lucide-react';
import { ApiError, request } from '../utils/api';
import { useAuth } from '../../Context/AuthContext';

// The principal connects the own Gmail of the coaching. Then EVERY email of this coaching (welcome, leave, notices, reset codes...) goes out
// from that address, so the receiver sees the email of the principal / the coaching as the sender (not the account of the platform).
// Gmail needs an "app password" for this (not the normal password of the Gmail).

type Status = { email: string; connected: boolean; fromName: string };

export const MailSettings: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState(user?.email ?? ''); // the email of the principal is already known (it was written when the coaching was added)
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setStatus(await request<Status>('GET', '/mail-settings'));
    } catch {
      setStatus(null);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const fail = (err: unknown, fallback: string) => setMessage({ type: 'error', text: err instanceof ApiError ? err.message : fallback });

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const saved = await request<Status>('PUT', '/mail-settings', { email: email.trim(), appPassword: password });
      setStatus(saved);
      setPassword('');
      setMessage({ type: 'ok', text: `Connected. The emails of your coaching now go out from ${saved.email}.` });
    } catch (err) {
      fail(err, 'Could not connect this Gmail.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const r = await request<{ sent: boolean; to: string }>('POST', '/mail-settings/test', {});
      setMessage(r.sent ? { type: 'ok', text: `A test email was sent to ${r.to}. Check that inbox.` } : { type: 'error', text: 'No email could be sent: the server has no email set up.' });
    } catch (err) {
      fail(err, 'Could not send the test email.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove this Gmail? The emails of your coaching will go out from the AcademiaOS account again.')) return;
    setMessage(null);
    setBusy(true);
    try {
      await request('DELETE', '/mail-settings');
      await load();
      setMessage({ type: 'ok', text: 'Removed.' });
    } catch (err) {
      fail(err, 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
        <Mail className="w-4 h-4 text-indigo-600" />
        Emails: send from my own Gmail
      </h3>

      {status?.connected ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Connected: <b>{status.email}</b>. Every email of your coaching (accounts, leave, notices, password codes) goes out from this address.
          </span>
        </div>
      ) : (
        <p className="text-xs text-slate-600 leading-relaxed">
          Now the emails of your coaching go out from the AcademiaOS account. Connect your own Gmail, and the receivers see <b>your</b> email as the sender.
        </p>
      )}

      <form onSubmit={connect} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Gmail address (your registered email is filled in)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="principal@gmail.com" autoComplete="off" required className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">App password (16 letters)</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="abcd efgh ijkl mnop"
              autoComplete="new-password"
              required
              className={`${inputCls} pr-10`}
            />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide' : 'Show'} className="absolute right-2 top-2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <ol className="text-[11px] text-slate-500 leading-relaxed list-decimal pl-4 space-y-0.5">
          <li>Your email is already known. Gmail only lets a program send from it with an "app password", so this one step is needed (only once).</li>
          <li>Turn on "2-Step Verification" in your Google account.</li>
          <li>
            Open{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
              myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3" />
            </a>
            , make an app password and copy the 16 letters.
          </li>
          <li>Paste it here. It is kept safe on the server and never shown again.</li>
        </ol>
        {message && (
          <p role="alert" className={`text-xs font-medium rounded-lg px-3 py-2 border ${message.type === 'ok' ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
            {busy ? 'Please wait...' : status?.connected ? 'Change Gmail' : 'Connect Gmail'}
          </button>
          <button type="button" onClick={() => void test()} disabled={busy} className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            Send test email to me
          </button>
          {status?.connected && (
            <button type="button" onClick={() => void remove()} disabled={busy} className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 rounded-lg flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
