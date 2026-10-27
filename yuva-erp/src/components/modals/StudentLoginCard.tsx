import React, { useState } from 'react';
import { KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../Context/AuthContext';
import { flushPending } from '../utils/api';
import type { Student } from '../../types';

// A temporary password that is easy to read out: letters and digits, no look-alike characters
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
  return pw + pick('23456789');
};

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// The login of one student: the principal makes it (email + a temporary password). The student signs in on the
// "Teacher / Student" tab and chooses an own password at the first sign in.
export const StudentLoginCard: React.FC<{ student: Student }> = ({ student }) => {
  const { users, addUser, isAdmin } = useAuth();
  const existing = users.find(u => u.studentId === student.id);

  const [email, setEmail] = useState(student.email || '');
  const [password, setPassword] = useState(generatePassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isAdmin) return null; // only the principal makes accounts

  const create = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter the email the student will sign in with.');
      return;
    }
    setBusy(true);
    await flushPending(); // the student record has to be on the server before the account can point to it
    const result = await addUser({
      name: student.name,
      email: email.trim(),
      password,
      role: 'student',
      phone: student.phone,
      studentId: student.id
    });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else setCreated({ email: email.trim(), password });
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the person can still read it on the screen */
    }
  };

  if (created) {
    return (
      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          Login created for {student.name}
        </p>
        <div className="font-mono bg-white border border-emerald-200 rounded-md p-2.5 leading-relaxed">
          Email: {created.email}
          <br />
          Password: {created.password}
        </div>
        <p>
          Give these to the student. They sign in on the <strong>Teacher / Student</strong> tab and choose an own password at the first
          sign in. <strong>Note the password now, it is not shown again.</strong>
        </p>
        <button onClick={copy} className="px-3 py-1.5 font-semibold bg-white border border-emerald-300 rounded-md hover:bg-emerald-100 flex items-center gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'Copied' : 'Copy email and password'}
        </button>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
        <KeyRound className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <span>
          This student has a login: <strong className="text-slate-800">{existing.email}</strong>. They sign in on the Teacher / Student tab. A new
          password can be set in Team & Access.
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
      <div className="flex items-start gap-2">
        <KeyRound className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-slate-800">Create a login for this student</p>
          <p className="text-[11px] text-slate-500">So the student can sign in and see own attendance, fees, results and notices.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Student email (the login)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@example.com" className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Temporary password</label>
          <div className="flex gap-2">
            <input value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} font-mono`} />
            <button type="button" onClick={() => setPassword(generatePassword())} className="px-2.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
              New
            </button>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg flex items-center gap-1.5"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Create login
      </button>
    </div>
  );
};
