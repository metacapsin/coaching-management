import { Select } from '../ui/Pickers';
import React, { useEffect, useRef, useState } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  KeyRound,
  LogOut,
  PlayCircle,
  MapPin,
  Mail,
  Phone,
  Trash2,
  Search,
  UserPlus,
  History,
  Users,
  X,
  AlertTriangle,
  Download
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ChangeEmailForm } from '../auth/ChangeEmailForm';
import { ModalShell } from '../ui/ModalShell';
import { downloadCsv, formatDate, formatDateTime, toLocalISODate, toWhatsAppNumber } from '../utils/helpers';
import { ApiError } from '../utils/api';
import type { AuthUser } from '../utils/api';
import { useAuth } from '../../Context/AuthContext';
import { superApi, useOrgs } from './superApi';
import type { ActivityEntry, OrgStatus, OrgSummary } from './superApi';

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

const DeleteModal: React.FC<{ org: OrgSummary; onClose: () => void; onDone: (msg: string) => void }> = ({ org, onClose, onDone }) => {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      await superApi.remove(org.id, typed, password);
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
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Your own password (the one you sign in with)</label>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
        </div>
        <p className="text-[11px] text-slate-500">Every Super Admin gets an email when a coaching is deleted.</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            disabled={typed !== org.name || !password}
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
    <ModalShell title="My account" icon={KeyRound} iconClass="bg-slate-700" width="sm" onClose={onClose}>
      <div className="px-6 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Login email</h3>
        <ChangeEmailForm onDone={msg => { onDone(msg); onClose(); }} />
      </div>
      <form onSubmit={submit} className="p-6 space-y-4 border-t border-slate-100 mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</h3>
        <PasswordInput placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} autoComplete="current-password" />
        <PasswordInput placeholder="New password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} autoComplete="new-password" />
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

const ACTION_TEXT: Record<string, string> = {
  'demo-requested': 'Demo requested on the website',
  'super-admin-add': 'Super Admin added',
  'super-admin-password': 'Super Admin password set',
  'super-admin-remove': 'Super Admin removed',
  'super-password-reset': 'Super Admin password reset',
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
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string; wa?: string } | null>(null);
  const [modal, setModal] = useState<
    | { kind: 'delete'; org: OrgSummary }
    | { kind: 'mine' }
    | null
  >(null);
  const [filter, setFilter] = useState<'all' | OrgStatus>('all');
  const [query, setQuery] = useState('');

  const flash = (type: 'ok' | 'error', text: string, wa?: string) => {
    setNotice({ type, text, wa });
    setTimeout(() => setNotice(null), wa ? 30000 : 6000);
  };

  // Approve or reject a request: the principal is told by email (when the server can send it); if not, the same words
  // are offered here to send on WhatsApp
  const waUrl = (phone: string, message: string) => `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;

  const decide = async (kind: 'approve' | 'reject', o: OrgSummary) => {
    let reason = '';
    if (kind === 'reject') {
      const answer = window.prompt(`Reject the request of ${o.name}?
You may write the reason (the principal gets it). Press Cancel to keep the request.`, '');
      if (answer === null) return;
      reason = answer.trim();
    }
    try {
      const res = kind === 'approve' ? await superApi.approve(o.id) : await superApi.reject(o.id, reason);
      const what = kind === 'approve' ? `${o.name} was approved. Its principal can sign in now.` : `The request of ${o.name} was rejected.`;
      const tell =
        res.notified === 'sent'
          ? ` An email was sent to the principal.`
          : res.notified === 'no-email'
          ? ` Email is not set up on the server, so send the message on WhatsApp.`
          : '';
      flash('ok', what + tell, res.notified === 'no-email' && res.phone && res.message ? waUrl(res.phone, res.message) : undefined);
      reload();
    } catch (err) {
      flash('error', errText(err));
    }
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
        <div className="flex flex-wrap gap-2 self-start">
          <button
            onClick={() =>
              downloadCsv(
                `coachings-${toLocalISODate()}.csv`,
                ['Coaching', 'City', 'Status', 'Principal', 'Principal email', 'Principal phone', 'Students', 'Accounts', 'Since'],
                orgs.map(o => [
                  o.name,
                  o.city,
                  o.status,
                  o.admin?.name ?? '',
                  o.admin?.email ?? '',
                  o.admin?.phone ?? '',
                  o.students,
                  o.accounts,
                  o.createdAt.slice(0, 10)
                ])
              )
            }
            disabled={orgs.length === 0}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download list (CSV)
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
            notice.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {notice.text}
          {notice.wa && (
            <a href={notice.wa} target="_blank" rel="noopener noreferrer" className="ml-2 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md whitespace-nowrap">
              Send on WhatsApp
            </a>
          )}
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
          Reject. This page is your record of all the coachings: you can look at them here, you cannot enter one.
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
                    onClick={() => decide('approve', o)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => decide('reject', o)}
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
        <Select
          value={filter}
          onChange={e => setFilter(e.target.value as 'all' | OrgStatus)}
          className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="pending">Waiting for approval</option>
          <option value="suspended">Switched off</option>
        </Select>
      </div>

      {!loaded ? (
        <p className="p-8 text-center text-xs text-slate-400">Loading...</p>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 text-center shadow-xs">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No coaching yet</p>
          <p className="text-xs text-slate-400 mt-1">A coaching appears here when its owner registers on the login page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map(o => {
            const principal = o.admin?.name || '-';
            const initials = principal.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
            const needsAction = o.status === 'pending' || o.status === 'suspended';
            return (
              <div key={o.id} className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden self-start ${o.status === 'active' ? '' : 'opacity-80'}`}>
                <div className="p-5">
                  {/* the coaching: a letter, the name, where and since when; on the right the state and the delete */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* the logo of the coaching (what the principal put in the Institute Profile); the first letter when there is none */}
                      {o.logo ? (
                        <img src={o.logo} alt={`Logo of ${o.name}`} className="w-11 h-11 rounded-xl object-contain bg-white border border-slate-200 shrink-0" />
                      ) : (
                        <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                          {o.name.trim().charAt(0).toUpperCase() || <Building2 className="w-5 h-5" />}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{o.name}</h3>
                        <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1 min-w-0">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{o.city || 'City not given'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="whitespace-nowrap">since {formatDate(o.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {o.id === 'default' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">Demo</span>}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      {o.id !== 'default' && (
                        <button title="Delete this coaching" onClick={() => setModal({ kind: 'delete', org: o })} className="ml-0.5 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* the principal */}
                  <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{initials}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Principal</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">{principal}</div>
                      {o.admin?.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{o.admin.email}</span>
                        </div>
                      )}
                      {o.admin?.phone && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          {o.admin.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  {o.admin?.resetRequestedAt && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      <KeyRound className="w-3 h-3" />
                      Asked for a new password
                    </div>
                  )}

                  {/* how big it is */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                      <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <Users className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-lg font-bold leading-none text-slate-900">{o.students}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Students</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                      <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <KeyRound className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-lg font-bold leading-none text-slate-900">{o.accounts}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Accounts</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* only when there is something to do: a request to answer, a coaching that is switched off */}
                {needsAction && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                    {o.status === 'pending' ? (
                      <>
                        <span className="text-[11px] text-slate-500">Waiting for your answer</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => decide('approve', o)} className="px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                            Approve
                          </button>
                          <button onClick={() => decide('reject', o)} className="px-3 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg">
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-slate-500">Switched off</span>
                        <button title="Switch on again" onClick={() => act(() => superApi.activate(o.id), `${o.name} is active again.`)} className="px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1">
                          <PlayCircle className="w-3.5 h-3.5" />
                          Switch on
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActivityPanel />

      {modal?.kind === 'delete' && <DeleteModal org={modal.org} onClose={() => setModal(null)} onDone={msg => { flash('ok', msg); reload(); }} />}
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
