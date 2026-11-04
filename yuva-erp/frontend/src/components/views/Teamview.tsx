import React, { useCallback, useEffect, useState } from 'react';
import { request, updateOwnDetails, refreshNow, ApiError } from '../utils/api';
import { ChangeEmailForm } from '../auth/ChangeEmailForm';
import { useAuth, roleLabel } from '../../Context/AuthContext';
import type { AuthUser, UserRole } from '../../Context/AuthContext';
import { useInstitute } from '../../Context/InstituteContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Trash2,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Copy,
  RefreshCw,
  Clock,
  Layers,
  History
} from 'lucide-react';

// ---------- Helpers ----------

type Cell = boolean | string;

const PERMISSIONS: { label: string; admin: Cell; teacher: Cell; student: Cell }[] = [
  { label: 'Institute dashboard & analytics', admin: true, teacher: false, student: false },
  { label: 'Admissions & all student records', admin: true, teacher: false, student: false },
  { label: 'Daily attendance', admin: true, teacher: 'Own batches', student: false },
  { label: 'Exams & marks entry', admin: true, teacher: 'Own batches', student: false },
  { label: 'Fee collection & receipts', admin: true, teacher: false, student: 'View own' },
  { label: 'Batches & timetable management', admin: true, teacher: false, student: false },
  { label: 'Parent broadcasts', admin: true, teacher: false, student: false },
  { label: 'Teacher dashboard', admin: false, teacher: true, student: false },
  { label: 'Student portal (own data)', admin: false, teacher: false, student: true },
  { label: 'Institute settings, backup & restore', admin: true, teacher: false, student: false },
  { label: 'Team & Access (accounts, approvals)', admin: true, teacher: false, student: false }
];

// Random password that always has letters and a digit
const generatePassword = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const all = `${letters}23456789`;
  const pick = (chars: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return chars[arr[0] % chars.length];
  };
  let pw = pick(letters);
  for (let i = 0; i < 8; i++) pw += pick(all);
  pw += pick('23456789');
  return pw;
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const ROLE_BADGE: Record<UserRole, string> = {
  super: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  teacher: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  student: 'bg-amber-50 text-amber-700 border-amber-200'
};

const RoleBadge: React.FC<{ role: UserRole; parent?: boolean }> = ({ role, parent }) => (
  <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${ROLE_BADGE[role]}`}>
    {parent ? 'Parent' : roleLabel(role)}
  </span>
);

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  children
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
    <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
      <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// Checkbox list of batches (used for teacher assignment)
const BatchPicker: React.FC<{
  batches: { id: string; name: string; classroom: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}> = ({ batches, selected, onChange }) => (
  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
    {batches.length === 0 && <div className="p-3 text-xs text-slate-400">No batches created yet.</div>}
    {batches.map(b => (
      <label key={b.id} className="flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-slate-50 text-xs">
        <input
          type="checkbox"
          checked={selected.includes(b.id)}
          onChange={e => onChange(e.target.checked ? [...selected, b.id] : selected.filter(id => id !== b.id))}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
        />
        <span className="font-medium text-slate-800">{b.name}</span>
        <span className="text-slate-400">· {b.classroom}</span>
      </label>
    ))}
  </div>
);

type Credentials = { name: string; email: string; password: string; heading: string };

// ---------- Component ----------

// Everybody can change their own phone number; everybody except students also their name
const MyDetails: React.FC<{ onDone: (type: 'success' | 'error', text: string) => void }> = ({ onDone }) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [subject, setSubject] = useState(user?.subject || '');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateOwnDetails({
        ...(user.role !== 'student' ? { name: name.trim() } : {}),
        phone: phone.trim(),
        ...(user.role === 'teacher' ? { subject: subject.trim() } : {})
      });
      await refreshNow(true);
      onDone('success', 'Your details were saved.');
    } catch (err) {
      onDone('error', err instanceof ApiError ? err.message : 'Could not save your details.');
    } finally {
      setBusy(false);
    }
  };

  const cls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">My details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
          <input value={name} disabled={user.role === 'student'} onChange={e => setName(e.target.value)} className={cls} />
          {user.role === 'student' && <p className="text-[11px] text-slate-400 mt-1">Your name comes from the admission record.</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Mobile number</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className={cls} />
        </div>
        {user.role === 'teacher' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className={cls} />
          </div>
        )}
      </div>
      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
        >
          {busy ? 'Saving...' : 'Save my details'}
        </button>
      </div>
      <details className="mt-4 border-t border-slate-100 pt-3">
        <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Change the email I sign in with</summary>
        <div className="mt-3 max-w-sm">
          <ChangeEmailForm onDone={msg => onDone('success', msg)} />
        </div>
      </details>
    </form>
  );
};

// addTeacherSignal: each time it grows, the Add Account window opens for a new teacher (from the Dashboard / top bar)
export const TeamView: React.FC<{ addTeacherSignal?: number }> = ({ addTeacherSignal = 0 }) => {
  const {
    user,
    users,
    isAdmin,
    addUser,
    approveUser,
    rejectUser,
    setUserBatches,
    removeUser,
    resetUserPassword,
    changeOwnPassword
  } = useAuth();
  const { students, batches } = useInstitute();

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add account
  const [showAdd, setShowAdd] = useState(false);
  const [aRole, setARole] = useState<UserRole | 'parent'>('teacher');
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aSubject, setASubject] = useState('');
  const [aStudentId, setAStudentId] = useState('');
  const [aBatchIds, setABatchIds] = useState<string[]>([]);
  const [aPassword, setAPassword] = useState('');
  const [aShowPw, setAShowPw] = useState(true);
  const [aError, setAError] = useState('');
  const [aBusy, setABusy] = useState(false);

  // Approve teacher / edit batches
  const [approveTarget, setApproveTarget] = useState<AuthUser | null>(null);
  const [batchTarget, setBatchTarget] = useState<AuthUser | null>(null);
  const [batchSel, setBatchSel] = useState<string[]>([]);

  // Reset password / remove
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AuthUser | null>(null);

  // Credentials shown once after add / reset
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  // Change own password
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showOwnPw, setShowOwnPw] = useState(false);
  const [ownMsg, setOwnMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ownBusy, setOwnBusy] = useState(false);

  // Activity log kept by the server (principal only)
  type Activity = { at: string; name: string | null; action: string; detail: string };
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState('');

  const loadActivity = useCallback(async () => {
    try {
      const res = await request<{ entries: Activity[] }>('GET', '/audit?limit=100');
      setActivity(res.entries);
      setActivityError('');
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Could not load the activity log.');
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadActivity();
  }, [isAdmin, loadActivity]);

  const pending = users.filter(u => u.status === 'pending');
  const [memberQuery, setMemberQuery] = useState('');
  const mq = memberQuery.trim().toLowerCase();
  const allMembers = users.filter(u => u.status !== 'pending');
  const members = allMembers.filter(u => !mq || `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(mq));
  const studentsWithoutAccount = students.filter(s => !users.some(u => u.studentId === s.id && !u.isParent));
  const studentsWithoutParent = students.filter(s => !users.some(u => u.studentId === s.id && u.isParent));
  const batchName = (id: string) => batches.find(b => b.id === id)?.name || 'Batch';

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // ----- Add account -----
  const openAdd = () => {
    setARole('teacher');
    setAName('');
    setAEmail('');
    setAPhone('');
    setASubject('');
    setAStudentId('');
    setABatchIds([]);
    setAPassword(generatePassword());
    setAShowPw(true);
    setAError('');
    setShowAdd(true);
  };

  useEffect(() => {
    if (addTeacherSignal > 0 && isAdmin) {
      openAdd();
      setARole('teacher');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTeacherSignal]);

  const handlePickStudent = (id: string) => {
    setAStudentId(id);
    const s = students.find(item => item.id === id);
    if (!s) return;
    if (aRole === 'parent') {
      // a parent login: the name and number of the parent, the child's data is what it shows
      setAName(s.parentName || `Parent of ${s.name}`);
      setAEmail(s.parentEmail || '');
      setAPhone(s.parentPhone || '');
    } else {
      setAName(s.name);
      setAEmail(s.email || '');
      setAPhone(s.phone || '');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aBusy) return;
    setAError('');
    setABusy(true);
    try {
      const result = await addUser({
        name: aName,
        email: aEmail,
        password: aPassword,
        role: aRole === 'parent' ? 'student' : aRole,
        phone: aPhone,
        subject: aSubject,
        batchIds: aBatchIds,
        studentId: aRole === 'student' || aRole === 'parent' ? aStudentId : undefined,
        isParent: aRole === 'parent' ? true : undefined
      });
      if (!result.ok) {
        setAError(result.error);
        return;
      }
      setShowAdd(false);
      setCopied(false);
      setCredentials({
        name: aName.trim(),
        email: aEmail.trim().toLowerCase(),
        password: aPassword,
        heading: 'Account created'
      });
    } finally {
      setABusy(false);
    }
  };

  // ----- Pending teacher requests -----
  const openApprove = (target: AuthUser) => {
    setApproveTarget(target);
    setBatchSel(target.batchIds || []);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    const result = await approveUser(approveTarget.id, batchSel);
    if (result.ok) showNotice('success', `${approveTarget.name} approved. They can sign in now.`);
    else showNotice('error', result.error);
    setApproveTarget(null);
  };

  const handleReject = async (target: AuthUser) => {
    const result = await rejectUser(target.id);
    if (result.ok) showNotice('success', `Request from ${target.name} was rejected.`);
    else showNotice('error', result.error);
  };

  // ----- Edit teacher batches -----
  const openBatches = (target: AuthUser) => {
    setBatchTarget(target);
    setBatchSel(target.batchIds || []);
  };

  const handleSaveBatches = async () => {
    if (!batchTarget) return;
    const result = await setUserBatches(batchTarget.id, batchSel);
    if (result.ok) showNotice('success', `Batches updated for ${batchTarget.name}.`);
    else showNotice('error', result.error);
    setBatchTarget(null);
  };

  // ----- Reset password / remove / role -----
  const openReset = (target: AuthUser) => {
    setResetTarget(target);
    setResetPassword(generatePassword());
    setResetError('');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || resetBusy) return;
    setResetError('');
    setResetBusy(true);
    try {
      const result = await resetUserPassword(resetTarget.id, resetPassword);
      if (!result.ok) {
        setResetError(result.error);
        return;
      }
      setCopied(false);
      setCredentials({
        name: resetTarget.name,
        email: resetTarget.email,
        password: resetPassword,
        heading: 'Password reset'
      });
      setResetTarget(null);
    } finally {
      setResetBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const result = await removeUser(removeTarget.id);
    if (result.ok) showNotice('success', `${removeTarget.name} has been removed.`);
    else showNotice('error', result.error);
    setRemoveTarget(null);
  };

  const handleCopyCredentials = async () => {
    if (!credentials) return;
    const text = `AcademiaOS login\nEmail: ${credentials.email}\nPassword: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // ----- Own password -----
  const handleChangeOwn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownBusy) return;
    setOwnMsg(null);

    if (!curPw || !newPw) {
      setOwnMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPw !== confPw) {
      setOwnMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setOwnBusy(true);
    try {
      const result = await changeOwnPassword(curPw, newPw);
      if (result.ok) {
        setOwnMsg({ type: 'success', text: 'Your password has been updated.' });
        setCurPw('');
        setNewPw('');
        setConfPw('');
      } else {
        setOwnMsg({ type: 'error', text: result.error });
      }
    } finally {
      setOwnBusy(false);
    }
  };

  const renderCell = (value: Cell) =>
    typeof value === 'string' ? (
      <span className="text-[10px] font-medium text-blue-700">{value}</span>
    ) : value ? (
      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
    ) : (
      <X className="w-4 h-4 text-slate-300 mx-auto" />
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isAdmin ? 'Team & Access' : 'My Account'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'Create accounts, approve teacher requests, assign batches and control who can sign in.'
              : 'View your role and permissions, and change your password.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Add Account
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <MyDetails onDone={(type, text) => setNotice({ type, text })} />

      {/* Password requests (admin only) */}
      {isAdmin && members.some(u => u.resetRequestedAt) && (
        <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-blue-200 bg-blue-50 text-sm font-semibold text-blue-900">
            Forgot-password requests ({members.filter(u => u.resetRequestedAt).length})
          </div>
          <ul className="divide-y divide-slate-100">
            {members
              .filter(u => u.resetRequestedAt)
              .map(u => (
                <li key={u.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{u.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {u.email} · {roleLabel(u.role)} · asked on {new Date(u.resetRequestedAt!).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <button
                    onClick={() => openReset(u)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0"
                  >
                    Set new password
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Pending requests (admin only) */}
      {isAdmin && pending.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-amber-200 flex items-center gap-2 bg-amber-50">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Pending Requests ({pending.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map(req => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">
                    {req.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span className="truncate">{req.name}</span>
                      <RoleBadge role={req.role} />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {req.email} · {req.phone || 'no phone'}
                      {req.subject ? ` · ${req.subject}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-400">Requested on {formatDate(req.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openApprove(req)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">All Accounts ({allMembers.length})</h3>
            </div>
            <input
              value={memberQuery}
              onChange={e => setMemberQuery(e.target.value)}
              placeholder="Search name or email..."
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white w-44 sm:w-56"
            />
            <span className="text-xs text-slate-500">
              {members.filter(u => u.role === 'admin').length} Principal ·{' '}
              {members.filter(u => u.role === 'teacher').length} Teachers ·{' '}
              {members.filter(u => u.role === 'student' && !u.isParent).length} Students ·{' '}
              {members.filter(u => u.isParent).length} Parents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Member</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Added On</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(member => {
                  const isMe = member.id === user?.id;
                  const linkedStudent = students.find(s => s.id === member.studentId);
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span className="truncate">{member.name}</span>
                              {isMe && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{member.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <RoleBadge role={member.role} parent={member.isParent} />
                      </td>

                      <td className="p-3.5 text-slate-600">
                        {member.role === 'teacher' && (
                          <div>
                            <div className="text-slate-700">{member.subject || 'Teacher'}</div>
                            <div className="text-[11px] text-slate-400">
                              {(member.batchIds || []).length === 0
                                ? 'No batches assigned'
                                : (member.batchIds || []).map(batchName).join(', ')}
                            </div>
                          </div>
                        )}
                        {member.role === 'student' && (
                          <div>
                            <div className="font-mono text-slate-700">{linkedStudent?.rollNo || 'Record missing'}</div>
                            <div className="text-[11px] text-slate-400">{linkedStudent?.grade || ''}</div>
                          </div>
                        )}
                        {member.role === 'admin' && <span className="text-slate-300">—</span>}
                      </td>

                      <td className="p-3.5 text-slate-500">{formatDate(member.createdAt)}</td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {member.role === 'teacher' && (
                            <button
                              onClick={() => openBatches(member)}
                              className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Layers className="w-3 h-3" />
                              Batches
                            </button>
                          )}
                          <button
                            onClick={() => openReset(member)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" />
                            Reset Password
                          </button>
                          {!isMe && (
                            <button
                              onClick={() => setRemoveTarget(member)}
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                              title="Remove account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity log (principal only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            </div>
            <button
              onClick={() => void loadActivity()}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
          {activityError ? (
            <div className="p-4 text-xs text-rose-700">{activityError}</div>
          ) : activity.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No activity yet.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {activity.map((entry, i) => (
                <div key={`${entry.at}-${i}`} className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {new Date(entry.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-semibold text-slate-800">{entry.name || 'Unknown'}</span>
                  <span className="text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {entry.action.replace(/-/g, ' ')}
                  </span>
                  {entry.detail && <span className="text-slate-500 truncate">{entry.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change own password */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            Change My Password
          </h3>

          <div className="mt-3 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
              {(user?.name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-500 truncate">
                {user?.email} · {roleLabel(user?.role)}
              </div>
            </div>
          </div>

          <form onSubmit={handleChangeOwn} className="space-y-3">
            {ownMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                  ownMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {ownMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{ownMsg.text}</span>
              </div>
            )}

            {[
              { label: 'Current Password', value: curPw, set: setCurPw, auto: 'current-password' },
              { label: 'New Password', value: newPw, set: setNewPw, auto: 'new-password' },
              { label: 'Confirm New Password', value: confPw, set: setConfPw, auto: 'new-password' }
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{f.label}</label>
                <input
                  type={showOwnPw ? 'text' : 'password'}
                  autoComplete={f.auto}
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowOwnPw(prev => !prev)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {showOwnPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showOwnPw ? 'Hide' : 'Show'} passwords
              </button>
              <button
                type="submit"
                disabled={ownBusy}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {ownBusy ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Role permissions: only the principal sees it (a teacher or a student was added by the principal) */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900">What each role can do</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Feature</th>
                    <th className="p-3 text-center">Principal</th>
                    <th className="p-3 text-center">Teacher</th>
                    <th className="p-3 text-center">Student</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PERMISSIONS.map(p => (
                    <tr key={p.label}>
                      <td className="p-3 text-slate-700">{p.label}</td>
                      <td className="p-3 text-center">{renderCell(p.admin)}</td>
                      <td className="p-3 text-center">{renderCell(p.teacher)}</td>
                      <td className="p-3 text-center">{renderCell(p.student)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add account modal */}
      {showAdd && (
        <Modal
          title="Add Account"
          subtitle="Create a login for a teacher, a student or a parent."
          onClose={() => setShowAdd(false)}
        >
          <form onSubmit={handleAdd} className="space-y-4">
            {aError && (
              <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
              <select
                value={aRole}
                onChange={e => {
                  setARole(e.target.value as UserRole | 'parent');
                  setAStudentId('');
                }}
                className={`${inputClass} bg-white`}
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="parent">Parent</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {aRole === 'parent'
                  ? 'Parents sign in at "Parent login" (button below the main sign in form).'
                  : 'Teachers, students and the principal sign in on the main sign in form.'}
              </p>
            </div>

            {aRole === 'parent' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Child (student record)</label>
                <select value={aStudentId} onChange={e => handlePickStudent(e.target.value)} className={`${inputClass} bg-white`}>
                  <option value="">Select the student whose parent this is...</option>
                  {studentsWithoutParent.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">The parent signs in and sees the attendance, fees and results of this child (read only).</p>
              </div>
            )}

            {aRole === 'student' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student Record</label>
                <select
                  value={aStudentId}
                  onChange={e => handlePickStudent(e.target.value)}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">Select a student without an account...</option>
                  {studentsWithoutAccount.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={aName}
                onChange={e => setAName(e.target.value)}
                disabled={aRole === 'student' && !!aStudentId}
                className={`${inputClass} disabled:bg-slate-50`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input type="email" value={aEmail} onChange={e => setAEmail(e.target.value)} className={inputClass} />
            </div>

            {aRole === 'teacher' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mobile</label>
                    <input type="text" value={aPhone} onChange={e => setAPhone(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={aSubject}
                      onChange={e => setASubject(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assign Batches</label>
                  <BatchPicker batches={batches} selected={aBatchIds} onChange={setABatchIds} />
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">Temporary Password</label>
                <button
                  type="button"
                  onClick={() => setAPassword(generatePassword())}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type={aShowPw ? 'text' : 'password'}
                  value={aPassword}
                  onChange={e => setAPassword(e.target.value)}
                  className={`${inputClass} pr-10 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setAShowPw(prev => !prev)}
                  className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded"
                >
                  {aShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={aBusy}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                {aBusy ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Approve teacher request */}
      {approveTarget && (
        <Modal
          title="Approve Teacher"
          subtitle={`Choose the batches ${approveTarget.name} will handle.`}
          onClose={() => setApproveTarget(null)}
        >
          <BatchPicker batches={batches} selected={batchSel} onChange={setBatchSel} />
          <p className="text-[11px] text-slate-400 mt-2">You can change the batches later from the accounts table.</p>
          <div className="pt-5 flex justify-end gap-2">
            <button
              onClick={() => setApproveTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
          </div>
        </Modal>
      )}

      {/* Edit teacher batches */}
      {batchTarget && (
        <Modal
          title="Assign Batches"
          subtitle={`Batches for ${batchTarget.name}`}
          onClose={() => setBatchTarget(null)}
        >
          <BatchPicker batches={batches} selected={batchSel} onChange={setBatchSel} />
          <div className="pt-5 flex justify-end gap-2">
            <button
              onClick={() => setBatchTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBatches}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {/* Reset password */}
      {resetTarget && (
        <Modal
          title="Reset Password"
          subtitle={`Set a new password for ${resetTarget.name}`}
          onClose={() => setResetTarget(null)}
        >
          <form onSubmit={handleReset} className="space-y-4">
            {resetError && (
              <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">New Password</label>
                <button
                  type="button"
                  onClick={() => setResetPassword(generatePassword())}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate
                </button>
              </div>
              <input
                type="text"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetBusy}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                {resetBusy ? 'Saving...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <Modal
          title="Remove Account"
          subtitle="This account will no longer be able to sign in."
          onClose={() => setRemoveTarget(null)}
        >
          <p className="text-sm text-slate-700">
            Remove <strong>{removeTarget.name}</strong> ({removeTarget.email})?
          </p>
          <div className="pt-5 flex justify-end gap-2">
            <button
              onClick={() => setRemoveTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </Modal>
      )}

      {/* Credentials shown once */}
      {credentials && (
        <Modal
          title={credentials.heading}
          subtitle="Share these login details securely. The password is shown only now."
          onClose={() => setCredentials(null)}
        >
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 text-xs">Name</span>
                <span className="font-medium text-slate-900">{credentials.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 text-xs">Email</span>
                <span className="font-mono text-xs text-slate-900">{credentials.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 text-xs">Password</span>
                <span className="font-mono text-xs font-semibold text-slate-900">{credentials.password}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCopyCredentials}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy details'}
              </button>
              <button
                onClick={() => setCredentials(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};