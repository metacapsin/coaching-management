import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Eye, EyeOff, Loader2, Lock, Mail, MapPin, Phone, User, X } from 'lucide-react';
import { cleanName } from '../utils/names';
import { ApiError, registerCoaching } from '../utils/api';
import { useEscape } from '../ui/useEscape';
import { useLang } from '../../i18n/LangContext';

// "Add your coaching": a full pop-up of the website in three short steps (the coaching, the principal, the password). A Super Admin approves the request; then
// the principal signs in. The look is the one of the website (dark blue, sky blue lines).

const STEPS = [
  { title: 'Your coaching', text: 'Its name and the city' },
  { title: 'The principal', text: 'Who runs the coaching' },
  { title: 'Your password', text: 'To sign in after the approval' }
];

const BENEFITS = ['The data of every coaching stays its own', 'Nothing to install: it opens in the browser', 'Attendance, fees, tests and notices in one place'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strengthOf = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};
const STRENGTH_TEXT = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['bg-white/15', 'bg-rose-500', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-400'];

const inputBase =
  'w-full rounded-xl bg-[#080f1e] border text-sm text-white placeholder-slate-500 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition-colors';

// one input with an icon on the left, a label above and a line of help or error under it
const Box: React.FC<{
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  prefix?: string;
  required?: boolean;
  autoFocus?: boolean;
}> = ({ label, icon: Icon, value, onChange, error, hint, type = 'text', placeholder, autoComplete, inputMode, prefix, required, autoFocus }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
        {label} {required && <span className="text-sky-400">*</span>}
      </label>
      <div className="relative">
        <Icon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {prefix && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">{prefix}</span>}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          type={isPassword && show ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoFocus={autoFocus}
          className={`${inputBase} ${prefix ? 'pl-[4.25rem]' : 'pl-10'} ${isPassword ? 'pr-11' : 'pr-3.5'} ${error ? 'border-rose-400/70' : 'border-white/10 focus:border-sky-400/60'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-md"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error ? <p className="text-[11px] text-rose-400 mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-slate-500 mt-1.5">{hint}</p> : null}
    </div>
  );
};

export const AddCoachingModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useLang();
  useEscape(onClose);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gmailOpen, setGmailOpen] = useState(false);
  const [f, setF] = useState({ coachingName: '', city: '', adminName: '', phone: '', email: '', password: '', confirm: '', appPassword: '' });
  const set = (k: keyof typeof f) => (v: string) => {
    setF(prev => ({ ...prev, [k]: k === 'coachingName' || k === 'adminName' || k === 'city' ? cleanName(v) : k === 'phone' ? v.replace(/\D/g, '').slice(0, 10) : v }));
    setErrors(prev => ({ ...prev, [k]: '' }));
    setError('');
  };

  // the page behind does not scroll while the pop-up is open
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  const strength = strengthOf(f.password);

  const check = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (f.coachingName.trim().length < 2) e.coachingName = 'Write the name of your coaching';
    } else if (s === 1) {
      if (f.adminName.trim().length < 2) e.adminName = 'Write your name';
      if (f.phone.length !== 10) e.phone = 'Write a mobile number of 10 digits';
      if (!EMAIL_RE.test(f.email.trim())) e.email = 'Write an email that works: you sign in with it';
    } else {
      if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'At least 8 characters, with letters and numbers';
      if (f.confirm !== f.password) e.confirm = 'The two passwords are not the same';
    }
    return e;
  };

  const next = () => {
    const e = check(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(s => s + 1);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step < 2) return next();
    const e = check(2);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setError('');
    try {
      await registerCoaching({
        coachingName: f.coachingName.trim(),
        city: f.city.trim(),
        adminName: f.adminName.trim(),
        phone: f.phone,
        email: f.email.trim(),
        password: f.password,
        ...(f.appPassword.trim() ? { appPassword: f.appPassword.trim() } : {})
      });
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not send the request. Please try again.';
      setError(message);
      // the server named the box that is wrong: go back to its step
      if (/email|password|phone|mobile|name/i.test(message)) setStep(/password/i.test(message) ? 2 : /name/i.test(message) && !/email/i.test(message) ? (/coaching/i.test(message) ? 0 : 1) : 1);
    } finally {
      setBusy(false);
    }
  };

  // (it is put in <body>: inside the website an animated parent would shrink and fade it)
  return createPortal(
    <div className="theme-keep fixed inset-0 z-[70] overflow-y-auto bg-[#060b11]/85 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-coaching-title">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 grid md:grid-cols-[300px_1fr] bg-[#0f172a] text-white">
          {/* the left side: what this is, the three steps */}
          <aside className="relative hidden md:flex flex-col p-7 bg-gradient-to-b from-[#080f1e] to-[#0f172a] border-r border-white/10 overflow-hidden">
            <span className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
            <span className="absolute -bottom-24 -right-16 w-56 h-56 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#f97316] flex items-center justify-center font-extrabold">A</span>
              <span className="font-bold text-lg tracking-tight">AcademiaOS</span>
            </div>
            <h2 className="relative mt-8 text-2xl font-bold leading-tight tracking-tight">{t('Add your coaching')}</h2>
            <p className="relative mt-2 text-sm text-sky-100/70 leading-relaxed">{t('Three short steps. A Super Admin checks your request, then you sign in as the principal.')}</p>

            <ol className="relative mt-8 space-y-5">
              {STEPS.map((s, i) => {
                const state = done || i < step ? 'done' : i === step ? 'now' : 'next';
                return (
                  <li key={s.title} className="flex items-start gap-3">
                    <span
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border transition-colors ${
                        state === 'done' ? 'bg-emerald-500 border-emerald-400 text-white' : state === 'now' ? 'bg-sky-400 border-sky-300 text-[#080f1e]' : 'border-white/20 text-slate-400'
                      }`}
                    >
                      {state === 'done' ? <Check className="w-4 h-4" /> : i + 1}
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${state === 'next' ? 'text-slate-400' : 'text-white'}`}>{t(s.title)}</span>
                      <span className="block text-xs text-slate-400">{t(s.text)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <ul className="relative mt-auto pt-8 space-y-2.5">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-start gap-2 text-xs text-sky-100/75">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-px" />
                  {t(b)}
                </li>
              ))}
            </ul>
          </aside>

          {/* the right side: the form */}
          <div className="relative flex flex-col min-h-[520px]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {done ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 sm:px-10 py-12">
                <span className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 flex items-center justify-center lp-pop">
                  <CheckCircle2 className="w-9 h-9" />
                </span>
                <h2 id="add-coaching-title" className="mt-5 text-2xl font-bold tracking-tight">
                  {t('Request sent')}
                </h2>
                <p className="mt-2 text-sm text-sky-100/75 max-w-sm leading-relaxed">
                  {t('Thank you')}, {f.adminName.split(' ')[0]}. <strong className="text-white">{f.coachingName}</strong> {t('is waiting for the approval of the Super Admin.')}
                </p>
                <ol className="mt-7 w-full max-w-sm text-left space-y-3">
                  {['The Super Admin checks your request', 'You get an email when it is approved', 'You sign in as Coaching Admin with your email and password'].map((x, i) => (
                    <li key={x} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      {t(x)}
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={onClose} className="mt-9 px-6 py-3 text-sm font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] rounded-xl shadow-lg shadow-blue-900/30 transition-colors">
                  {t('Back to the website')}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex-1 flex flex-col" noValidate>
                {/* on a phone there is no left side: the title and the steps are here */}
                <div className="md:hidden px-6 pt-6">
                  <h2 className="text-xl font-bold tracking-tight">{t('Add your coaching')}</h2>
                </div>
                <div className="px-6 sm:px-10 pt-6 md:pt-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
                    {t('Step')} {step + 1} {t('of')} 3
                  </p>
                  <h3 id={step === 0 ? 'add-coaching-title' : undefined} className="mt-1.5 text-2xl font-bold tracking-tight">
                    {t(STEPS[step].title)}
                  </h3>
                  <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300" style={{ width: `${((step + 1) / 3) * 100}%` }} />
                  </div>
                </div>

                <div className="flex-1 px-6 sm:px-10 py-6 space-y-5">
                  {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/30 text-xs text-rose-200">{t(error)}</div>}

                  {step === 0 && (
                    <>
                      <Box label={t('Name of your coaching')} icon={Building2} value={f.coachingName} onChange={set('coachingName')} error={errors.coachingName && t(errors.coachingName)} placeholder="e.g. Sunrise Classes" required autoFocus />
                      <Box label={t('City / area')} icon={MapPin} value={f.city} onChange={set('city')} hint={t('Optional. It helps teachers and parents to find you.')} placeholder="e.g. Kota" />
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Box label={t('Your name (principal)')} icon={User} value={f.adminName} onChange={set('adminName')} error={errors.adminName && t(errors.adminName)} placeholder="e.g. Rakesh Sharma" required autoFocus />
                      <Box
                        label={t('Mobile number')}
                        icon={Phone}
                        value={f.phone}
                        onChange={set('phone')}
                        error={errors.phone && t(errors.phone)}
                        hint={t('10 digits. Teachers who want to join call you on this number.')}
                        inputMode="tel"
                        prefix="+91"
                        placeholder="98765 43210"
                        required
                      />
                      <Box label={t('Email')} icon={Mail} value={f.email} onChange={set('email')} error={errors.email && t(errors.email)} hint={t('You sign in with this email.')} type="email" autoComplete="username" placeholder="you@example.com" required />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div>
                        <Box label={t('Password')} icon={Lock} value={f.password} onChange={set('password')} error={errors.password && t(errors.password)} type="password" autoComplete="new-password" placeholder="At least 8 characters" required autoFocus />
                        {f.password && (
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div className="flex-1 grid grid-cols-4 gap-1.5">
                              {[1, 2, 3, 4].map(n => (
                                <span key={n} className={`h-1.5 rounded-full ${strength >= n ? STRENGTH_COLOR[strength] : 'bg-white/10'}`} />
                              ))}
                            </div>
                            <span className="text-[11px] text-slate-400 w-16 text-right">{t(STRENGTH_TEXT[strength])}</span>
                          </div>
                        )}
                      </div>
                      <Box label={t('Confirm password')} icon={Lock} value={f.confirm} onChange={set('confirm')} error={errors.confirm && t(errors.confirm)} type="password" autoComplete="new-password" placeholder="Write it again" required />

                      {/* the own Gmail of the coaching (optional) */}
                      <div className="rounded-xl border border-white/10 bg-[#080f1e]/60">
                        <button type="button" onClick={() => setGmailOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={gmailOpen}>
                          <span>
                            <span className="block text-sm font-semibold text-slate-100">{t('Send the emails from my own Gmail')}</span>
                            <span className="block text-[11px] text-slate-400">{t('Optional. You can do this later.')}</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${gmailOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {gmailOpen && (
                          <div className="px-4 pb-4 space-y-2">
                            <Box label={t('Gmail app password')} icon={Lock} value={f.appPassword} onChange={set('appPassword')} type="password" autoComplete="off" placeholder="16 letters, only if your email is a Gmail" />
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {t('If you give it, every email of your coaching goes out from your own email address. Google account → 2-Step Verification → App passwords.')}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="px-6 sm:px-10 py-5 border-t border-white/10 bg-[#0b1220] flex items-center justify-between gap-3">
                  {step > 0 ? (
                    <button type="button" onClick={() => setStep(s => s - 1)} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl flex items-center gap-2 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                      {t('Back')}
                    </button>
                  ) : (
                    <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                      {t('Cancel')}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-60 rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-colors"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {step < 2 ? t('Continue') : busy ? t('Sending...') : t('Send request')}
                    {step < 2 && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
