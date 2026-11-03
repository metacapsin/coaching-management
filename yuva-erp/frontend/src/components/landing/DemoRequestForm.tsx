import React, { useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { ApiError, request } from '../utils/api';

const inputCls =
  'w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#35414d] border border-sky-300/60 text-white placeholder:text-[#6fa8dc] focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-300';

// "Book a demo": a visitor leaves the name and the contact; the Super Admin sees the request on the platform page
export const DemoRequestForm: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', coaching: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Please write your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Please write a valid email.');
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Please write a 10-digit mobile number.');
    setBusy(true);
    try {
      await request('POST', '/public/demo-request', form, { auth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white mt-4">Thank you, {form.name.trim().split(' ')[0]}</h3>
        <p className="text-sm text-sky-100/80 mt-2">Your request is saved. We will contact you on {form.email.trim()} or the number you gave.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-dark rounded-2xl border border-sky-300/25 bg-[#2a3742] p-6 sm:p-8 space-y-4" noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="demo-name" className="block text-xs font-medium text-white mb-1.5">
            Your name
          </label>
          <input id="demo-name" value={form.name} onChange={set('name')} autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="demo-coaching" className="block text-xs font-medium text-white mb-1.5">
            Name of your coaching
          </label>
          <input id="demo-coaching" value={form.coaching} onChange={set('coaching')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="demo-email" className="block text-xs font-medium text-white mb-1.5">
            Email
          </label>
          <input id="demo-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" className={inputCls} />
        </div>
        <div>
          <label htmlFor="demo-phone" className="block text-xs font-medium text-white mb-1.5">
            Mobile number
          </label>
          <input id="demo-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="demo-message" className="block text-xs font-medium text-white mb-1.5">
          What would you like to see? (optional)
        </label>
        <textarea id="demo-message" rows={3} value={form.message} onChange={set('message')} className={inputCls} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-[#1565c0] hover:bg-[#0d47a1] disabled:opacity-60 rounded-lg flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send my request
      </button>
      <p className="text-[11px] text-slate-400">We use your details only to answer this request.</p>
    </form>
  );
};
