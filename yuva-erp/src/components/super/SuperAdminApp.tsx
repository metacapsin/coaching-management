import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  KeyRound,
  LogOut,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  Lock,
  Search,
  History,
  Users,
  X,
  AlertTriangle
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ModalShell } from '../ui/ModalShell';
import { formatDate, formatDateTime } from '../utils/helpers';
import { ApiError } from '../utils/api';
import type { AuthUser } from '../utils/api';
import { useAuth } from '../../Context/AuthContext';
import { superApi, useOrgs } from './superApi';
import type { ActivityEntry, NewCoaching, OrgStatus, OrgSummary } from './superApi';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

const STATUS_STYLE: Record<OrgStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-slate-200 text-slate-600'
};
const STATUS_LABEL: Record<OrgStatus, string> = { pending: 'Waiting for approval', active: 'Active', suspended: 'Switched off' };

const Shell: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-bold leading-tight">AcademiaOS Super Admin</div>
            <div className="text-[11px] text-slate-500">All coachings of your area</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {right}
        </div>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
  </div>
);

// ---------- pop-ups ----------

const AddCoachingModal: React.FC<{ onClose: () => void; onDone: (name: string) => void }> = ({ onClose, onDone }) => {
  // the Super Admin has to tick this to add a coaching: it is the approval
  const [approved, setApproved] = useState(false);
  const [blink, setBlink] = useState(0);
  const [f, setF] = useState<NewCoaching>({ coachingName: '', city: '', adminName: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  type TextField = Exclude<keyof NewCoaching, 'asRequest' | 'approved'>;
  const set = (k: TextField) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!approved) {
      // no tick, no coaching: the box blinks and nothing is sent
      setBlink(n => n + 1);
      setError('Tick the box below to approve this coaching. Without your approval it is not added.');
      return;
    }
    setBusy(true);
    try {
      await superApi.add({ ...f, coachingName: f.coachingName.trim(), adminName: f.adminName.trim(), email: f.email.trim(), approved: true });
      onDone(f.coachingName.trim());
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: TextField, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input value={f[key]} onChange={set(key)} className={inputCls} {...props} />
    </div>
  );

  return (
    <ModalShell title="Add a coaching" subtitle="It is active at once, its principal can sign in" icon={Building2} iconClass="bg-indigo-600" width="lg" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Name of the coaching *', 'coachingName')}
          {field('City / area', 'city')}
          {field('Principal (administrator) name *', 'adminName')}
          {field('Principal mobile *', 'phone', { placeholder: '10-digit mobile number' })}
          {field('Principal email *', 'email', { type: 'email', autoComplete: 'off' })}
          {field('Password for the principal *', 'password', { type: 'text', autoComplete: 'off', placeholder: 'At least 8 characters, letters and numbers' })}
        </div>
        <label
          key={blink}
          className={`flex items-start gap-2 text-xs text-slate-700 cursor-pointer p-3 rounded-lg border-2 ${
            blink > 0 && !approved ? 'blink-attn border-rose-500 bg-rose-50' : approved ? 'border-emerald-400 bg-emerald-50' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <input
            type="checkbox"
            checked={approved}
            onChange={e => {
              setApproved(e.target.checked);
              if (e.target.checked) setError('');
            }}
            className="mt-0.5 w-4 h-4"
          />
          <span>
            <strong>I approve this coaching.</strong> I have checked the details and I am sure I want to add it. Its principal can sign in as soon
            as it is added. Without this tick the coaching is not added.
          </span>
        </label>
        <p className="text-[11px] text-slate-500">Give this email and password to the principal. They choose an own password at the first sign in.</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {busy ? 'Adding...' : 'Add coaching'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const EditModal: React.FC<{ org: OrgSummary; onClose: () => void; onDone: () => void }> = ({ org, onClose, onDone }) => {
  const [name, setName] = useState(org.name);
  const [city, setCity] = useState(org.city);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await superApi.edit(org.id, { name: name.trim(), city: city.trim() });
      onDone();
      onClose();
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <ModalShell title="Edit coaching" icon={Pencil} iconClass="bg-blue-600" width="sm" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">City / area</label>
          <input value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const PasswordModal: React.FC<{ org: OrgSummary; onClose: () => void; onDone: (msg: string) => void }> = ({ org, onClose, onDone }) => {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await superApi.resetAdminPassword(org.id, pw);
      onDone(`New password set for ${org.admin?.name}. Give it to them; they can change it after signing in.`);
      onClose();
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <ModalShell title="Set a new password" subtitle={`${org.name} · ${org.admin?.email}`} icon={KeyRound} iconClass="bg-amber-600" width="sm" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">New password for the principal</label>
          <input value={pw} onChange={e => setPw(e.target.value)} autoComplete="off" className={inputCls} placeholder="At least 8 characters, letters and numbers" />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
            Set password
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const DeleteModal: React.FC<{ org: OrgSummary; onClose: () => void; onDone: (msg: string) => void }> = ({ org, onClose, onDone }) => {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      await superApi.remove(org.id, typed);
      onDone(`${org.name} and all its data were deleted.`);
      onClose();
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <ModalShell title="Delete this coaching?" icon={Trash2} iconClass="bg-rose-600" width="sm" onClose={onClose}>
      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-600">
          <strong>{org.name}</strong> will be deleted with its {org.students} students, fees, exams and all {org.accounts} accounts. This cannot be undone.
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Type the name of the coaching to confirm</label>
          <input value={typed} onChange={e => setTyped(e.target.value)} className={inputCls} />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            disabled={typed !== org.name}
            onClick={submit}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-lg"
          >
            Delete everything
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const MyPasswordModal: React.FC<{ onClose: () => void; onDone: (msg: string) => void }> = ({ onClose, onDone }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await superApi.changePassword(current, next);
      onDone('Your password was changed.');
      onClose();
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <ModalShell title="Change my password" icon={KeyRound} iconClass="bg-slate-700" width="sm" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <input type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} autoComplete="current-password" />
        <input type="password" placeholder="New password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} autoComplete="new-password" />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Change
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const EnterModal: React.FC<{ org: OrgSummary; onClose: () => void }> = ({ org, onClose }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    // Only the principal (or staff) of THIS coaching is let in; the server checks it, not this screen
    const result = await signIn({ email: email.trim(), password, remember: false, portal: 'admin', orgId: org.id });
    setBusy(false);
    if (!result.ok) setError(result.error || 'Could not sign in.');
  };

  return (
    <ModalShell title={`Enter ${org.name}`} subtitle="Sign in with this coaching's principal email and password" icon={Lock} iconClass="bg-indigo-600" width="sm" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          Only the principal of this coaching can enter. Not even the Super Admin can open it without that login.
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Principal email</label>
          <input type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" className={inputCls} />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg">
            {busy ? 'Signing in...' : 'Enter coaching'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const ACTION_TEXT: Record<string, string> = {
  'super-setup': 'Super Admin created',
  'coaching-requested': 'Coaching asked to join',
  'coaching-add': 'Coaching added',
  'coaching-approve': 'Coaching approved',
  'coaching-reject': 'Request rejected',
  'coaching-suspend': 'Coaching switched off',
  'coaching-activate': 'Coaching switched on',
  'coaching-edit': 'Coaching edited',
  'coaching-delete': 'Coaching deleted',
  'coaching-admin-password': 'Principal password set',
  login: 'Signed in',
  'login-failed': 'Failed sign in',
  'change-password': 'Password changed'
};

// What happened on the platform (newest first)
const ActivityPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setEntries(await superApi.audit());
      setError('');
    } catch (err) {
      setError(errText(err));
    }
  };

  return (
    <section className="mt-8 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          Recent activity
        </span>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {error && <p className="p-4 text-xs text-rose-600">{error}</p>}
          {!entries && !error && <p className="p-4 text-xs text-slate-400">Loading...</p>}
          {entries && entries.length === 0 && <p className="p-4 text-xs text-slate-400">Nothing yet.</p>}
          {entries && entries.length > 0 && (
            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {entries.map((e, i) => (
                <li key={i} className="px-5 py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{ACTION_TEXT[e.action] || e.action}</span>
                    {e.detail && <span className="text-slate-500"> · {e.detail}</span>}
                    {e.name && <div className="text-[11px] text-slate-400">by {e.name}</div>}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

// ---------- the dashboard ----------

const Dashboard: React.FC<{ user: AuthUser; onSignOut: () => void }> = ({ user, onSignOut }) => {
  const { orgs, error, loaded, reload } = useOrgs(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [modal, setModal] = useState<
    | { kind: 'add' }
    | { kind: 'edit' | 'password' | 'delete' | 'enter'; org: OrgSummary }
    | { kind: 'mine' }
    | null
  >(null);
  const [filter, setFilter] = useState<'all' | OrgStatus>('all');
  const [query, setQuery] = useState('');

  const flash = (type: 'ok' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const act = async (job: () => Promise<unknown>, okText: string) => {
    try {
      await job();
      flash('ok', okText);
      reload();
    } catch (err) {
      flash('error', errText(err));
    }
  };

  const pending = orgs.filter(o => o.status === 'pending');
  const q = query.trim().toLowerCase();
  const shown = orgs.filter(
    o =>
      (filter === 'all' || o.status === filter) &&
      (!q || [o.name, o.city, o.admin?.name, o.admin?.email].some(v => (v || '').toLowerCase().includes(q)))
  );
  const totalStudents = orgs.reduce((n, o) => n + o.students, 0);

  const pendingRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenPending = useRef<number | null>(null);

  // A request arrived while this page is open: say so, and show the number in the browser tab
  useEffect(() => {
    if (!loaded) return;
    if (seenPending.current !== null && pending.length > seenPending.current) {
      const newest = pending[pending.length - 1];
      flash('ok', `New request: ${newest.name} is waiting for your approval.`);
    }
    seenPending.current = pending.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pending.length]);

  useEffect(() => {
    const base = 'AcademiaOS - Coaching Institute Management SaaS';
    document.title = pending.length ? `(${pending.length}) Approval waiting · ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [pending.length]);

  const stat = (label: string, value: number | string, cls = 'text-slate-900', onClick?: () => void, hot = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-white border rounded-xl p-4 shadow-xs transition-shadow ${
        onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
      } ${hot ? 'border-amber-400 ring-2 ring-amber-200 animate-pulse' : 'border-slate-200'}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      {onClick && <div className="text-[10px] text-slate-400 mt-1">Click to see</div>}
    </button>
  );

  return (
    <Shell
      right={
        <>
          <button onClick={() => setModal({ kind: 'mine' })} className="hidden sm:block px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            {user.name}
          </button>
          <button onClick={onSignOut} title="Sign out" className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        </>
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold">Coachings</h1>
          <p className="text-xs text-slate-500">
            Each coaching has its own principal and its own data. You see who runs it and how big it is, never the data inside.
          </p>
        </div>
        <button
          onClick={() => setModal({ kind: 'add' })}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 self-start"
        >
          <Plus className="w-5 h-5" />
          Add coaching
        </button>
      </div>

      {notice && (
        <div
          className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
            notice.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {notice.text}
        </div>
      )}
      {error && !loaded && <p className="mb-4 text-xs text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stat('Coachings', orgs.filter(o => o.status !== 'pending').length, 'text-slate-900', () => {
          setFilter('all');
          listRef.current?.scrollIntoView({ behavior: 'smooth' });
        })}
        {stat(
          'Waiting for approval',
          pending.length,
          pending.length ? 'text-amber-700' : 'text-slate-900',
          () => {
            setFilter('pending');
            pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
          pending.length > 0
        )}
        {stat('Active', orgs.filter(o => o.status === 'active').length, 'text-emerald-700', () => {
          setFilter('active');
          listRef.current?.scrollIntoView({ behavior: 'smooth' });
        })}
        {stat('Students in all', totalStudents)}
      </div>

      <div ref={pendingRef}>
      {pending.length === 0 && (
        <section className="bg-white border border-slate-200 rounded-xl mb-6 shadow-xs p-5 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
            No coaching is waiting for approval
          </div>
          A coaching owner sends a request from the login page (Coaching Admin tab, "Register your coaching"). It appears here with Approve and
          Reject. When you press <strong>+ Add coaching</strong> yourself, you approve it with the tick in the form.
        </section>
      )}
      {pending.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-xl overflow-hidden mb-6 shadow-xs">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-sm font-semibold text-amber-900 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Requests waiting for your approval ({pending.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {pending.map(o => (
              <li key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {o.name} <span className="font-normal text-slate-500">· {o.city || 'city not given'}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Principal: {o.admin?.name} · {o.admin?.email} · {o.admin?.phone} · asked on {formatDate(o.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => act(() => superApi.approve(o.id), `${o.name} was approved. Its principal can sign in now.`)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => window.confirm(`Reject the request of ${o.name}?`) && act(() => superApi.reject(o.id), `The request of ${o.name} was rejected.`)}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>

      <div ref={listRef} className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold">All coachings ({shown.length})</h2>
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by coaching, city or principal..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as 'all' | OrgStatus)}
          className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="pending">Waiting for approval</option>
          <option value="suspended">Switched off</option>
        </select>
      </div>

      {!loaded ? (
        <p className="p-8 text-center text-xs text-slate-400">Loading...</p>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 text-center shadow-xs">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No coaching yet</p>
          <p className="text-xs text-slate-400 mt-1">Press + Add coaching, or wait for requests from the login page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map(o => {
            const canEnter = o.status === 'active';
            return (
              <div
                key={o.id}
                role={canEnter ? 'button' : undefined}
                tabIndex={canEnter ? 0 : undefined}
                onClick={() => canEnter && setModal({ kind: 'enter', org: o })}
                onKeyDown={e => canEnter && e.key === 'Enter' && setModal({ kind: 'enter', org: o })}
                className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col transition-shadow ${
                  canEnter ? 'cursor-pointer hover:shadow-md hover:border-indigo-300' : 'opacity-80'
                }`}
              >
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold min-w-0">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{o.name}</span>
                  </h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <div className="px-5 py-4 flex-1 space-y-3">
                  <div>
                    <div className="text-[11px] text-slate-500">Principal</div>
                    <div className="text-sm font-medium text-slate-900">{o.admin?.name || '-'}</div>
                    <div className="text-[11px] text-slate-500 truncate">{o.admin?.email}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{o.admin?.phone}</div>
                    {o.admin?.resetRequestedAt && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        <KeyRound className="w-3 h-3" />
                        Asked for a new password
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Students
                      </div>
                      <div className="text-lg font-bold">{o.students}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="text-[11px] text-slate-500">Accounts</div>
                      <div className="text-lg font-bold">{o.accounts}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {o.city || 'City not given'} · since {formatDate(o.createdAt)}
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  {canEnter ? (
                    <button onClick={() => setModal({ kind: 'enter', org: o })} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Enter coaching →
                    </button>
                  ) : (
                    o.status === 'pending' ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => act(() => superApi.approve(o.id), `${o.name} was approved. Its principal can sign in now.`)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => window.confirm(`Reject the request of ${o.name}?`) && act(() => superApi.reject(o.id), `The request of ${o.name} was rejected.`)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Switch it on again to enter</span>
                    )
                  )}
                  <div className="flex gap-1">
                    {o.status === 'active' && o.id !== 'default' && (
                      <button
                        title="Switch off (nobody of this coaching can sign in)"
                        onClick={() => window.confirm(`Switch off ${o.name}? Everybody of this coaching is signed out.`) && act(() => superApi.suspend(o.id), `${o.name} was switched off.`)}
                        className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg"
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>
                    )}
                    {o.status === 'suspended' && (
                      <button title="Switch on again" onClick={() => act(() => superApi.activate(o.id), `${o.name} is active again.`)} className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg">
                        <PlayCircle className="w-4 h-4" />
                      </button>
                    )}
                    {o.admin && (
                      <button title="Set a new password for the principal" onClick={() => setModal({ kind: 'password', org: o })} className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    <button title="Edit" onClick={() => setModal({ kind: 'edit', org: o })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {o.id !== 'default' && (
                      <button title="Delete" onClick={() => setModal({ kind: 'delete', org: o })} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActivityPanel />

      {modal?.kind === 'add' && <AddCoachingModal onClose={() => setModal(null)} onDone={name => { flash('ok', `${name} was added.`); reload(); }} />}
      {modal?.kind === 'edit' && <EditModal org={modal.org} onClose={() => setModal(null)} onDone={() => { flash('ok', 'Saved.'); reload(); }} />}
      {modal?.kind === 'password' && <PasswordModal org={modal.org} onClose={() => setModal(null)} onDone={msg => flash('ok', msg)} />}
      {modal?.kind === 'delete' && <DeleteModal org={modal.org} onClose={() => setModal(null)} onDone={msg => { flash('ok', msg); reload(); }} />}
      {modal?.kind === 'enter' && <EnterModal org={modal.org} onClose={() => setModal(null)} />}
      {modal?.kind === 'mine' && <MyPasswordModal onClose={() => setModal(null)} onDone={msg => flash('ok', msg)} />}
    </Shell>
  );
};

// ---------- the page ----------

// What the Super Admin sees after signing in on the normal login page
export const SuperAdminApp: React.FC = () => {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return <Dashboard user={user} onSignOut={signOut} />;
};
