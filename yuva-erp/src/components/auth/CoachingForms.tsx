import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { ApiError, listCoachings, registerCoaching, setPublicOrg } from '../utils/api';
import type { PublicCoaching } from '../utils/api';
import { useLang } from '../../i18n/LangContext';

const fieldCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// Students and teachers sign up to ONE coaching. With only one coaching it is chosen without asking.
export const CoachingPicker: React.FC<{ onChange: (orgId: string) => void }> = ({ onChange }) => {
  const [list, setList] = useState<PublicCoaching[] | null>(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    let alive = true;
    listCoachings()
      .then(items => {
        if (!alive) return;
        setList(items);
        if (items.length === 1) {
          setChosen(items[0].id);
          setPublicOrg(items[0].id);
          onChange(items[0].id);
        }
      })
      .catch(err => alive && setError(err instanceof ApiError ? err.message : 'Could not load the coachings.'));
    return () => {
      alive = false;
      setPublicOrg(null);
      onChange('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    setChosen(id);
    setPublicOrg(id || null);
    onChange(id);
  };

  if (error) return <p className="text-xs text-rose-600 mt-4">{error}</p>;
  if (!list) return <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading coachings...</p>;
  if (list.length === 0)
    return (
      <p className="mt-4 p-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
        No coaching is open for sign-up yet. Please ask your coaching to register first.
      </p>
    );
  if (list.length === 1)
    return (
      <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5" />
        Coaching: <strong className="text-slate-700">{list[0].name}</strong>
      </p>
    );

  return (
    <div className="mt-4">
      <label className="block text-xs font-medium text-slate-700 mb-1">Your coaching</label>
      <select value={chosen} onChange={e => pick(e.target.value)} className={`${fieldCls} bg-white`}>
        <option value="">Choose your coaching...</option>
        {list.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.city ? ` · ${c.city}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

// A coaching asks to join. Its principal can sign in only after the super admin approves it.
export const RegisterCoachingForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useLang();
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
      <label className="block text-xs font-medium text-slate-700 mb-1">{t(label)}</label>
      <input value={f[key]} onChange={set(key)} className={fieldCls} {...props} placeholder={props.placeholder ? t(props.placeholder) : undefined} />
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <p className="text-xs text-slate-500">
        {t('Register your coaching. You become its principal (administrator) once the super admin approves.')}
      </p>
      {field('Name of your coaching *', 'coachingName')}
      {field('City / area', 'city')}
      {field('Your name (principal) *', 'adminName')}
      {field('Your mobile number *', 'phone', { inputMode: 'tel', placeholder: '10-digit mobile number' })}
      {field('Your email *', 'email', { type: 'email', autoComplete: 'username' })}
      {field('Password *', 'password', { type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters, letters and numbers' })}
      {field('Confirm password *', 'confirm', { type: 'password', autoComplete: 'new-password' })}
      {error && <p className="text-xs text-rose-600">{t(error)}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
          {t('Cancel')}
        </button>
        <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
          {busy ? t('Sending...') : t('Send request')}
        </button>
      </div>
    </form>
  );
};
