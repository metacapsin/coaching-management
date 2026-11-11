import React, { useState } from 'react';
import { CalendarOff, GraduationCap, Send, ShieldCheck, UserRound } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { formatDateTime, toLocalISODate } from '../utils/helpers';
import { Dropdown, DatePicker } from '../ui/Pickers';
import { MIN_REASON, STATUS, errorText, leaveDates } from './LeaveSection';

// The page "Apply for Leave": a leave application form for a STUDENT and for a TEACHER (nobody else asks for leave).
//   student  the name, roll no, batch, parent and the phone of the parent are filled in from the admission record (read only);
//            the principal calls the parent, and the parent gets the same news as a text
//   teacher  only the name, the subject and the designation: a teacher has no batch and no parent here
// The notice goes to the PRINCIPAL only. A parent login does not get this page.

const KINDS = {
  student: ['Sick', 'Family function', 'Travel', 'Exam / other class', 'Other'],
  teacher: ['Sick', 'Casual', 'Family function', 'Travel', 'Other']
};

const inputClass = 'mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const readOnlyClass = 'mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-700 cursor-not-allowed';

const Field: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
  <label className={`block text-xs font-medium text-slate-700 ${className ?? ''}`}>
    {label}
    <input type="text" value={value} readOnly tabIndex={-1} className={readOnlyClass} />
  </label>
);

export const LeavePage: React.FC = () => {
  const { user } = useAuth();
  const { profile, students, batches, leaveRequests, askLeave, cancelLeave } = useInstitute();
  const today = toLocalISODate();

  const [kind, setKind] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [hasProof, setHasProof] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // a parent only reads: it has no leave to ask
  if (user?.role === 'student' && user.isParent) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Leave is asked by the student</h2>
        <p className="text-xs text-slate-500 mt-1">You get a message in the bell and on the Notice Board when your child asks for leave and when the principal answers.</p>
      </div>
    );
  }

  const isTeacher = user?.role === 'teacher';
  const role: 'student' | 'teacher' = isTeacher ? 'teacher' : 'student';
  const student = students[0];
  const batch = batches.find(b => b.id === student?.batchId) ?? batches[0];

  const lastDay = toDate || fromDate;
  const days = fromDate && lastDay >= fromDate ? Math.round((Date.parse(lastDay) - Date.parse(fromDate)) / 86400000) + 1 : 0;

  const reset = () => {
    setKind('');
    setFromDate(today);
    setToDate('');
    setReason('');
    setHasProof(false);
    setDeclaration(false);
    setSignature('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (!kind) return setError('Choose the type of leave.');
    if (reason.trim().length < MIN_REASON) return setError(`Write the full reason (at least ${MIN_REASON} letters): why do you need the leave?`);
    if (!declaration) return setError('Tick that the details are correct.');
    if (signature.trim().length < 3) return setError('Type your full name as the signature.');
    setBusy(true);
    try {
      await askLeave({ fromDate, toDate: toDate || fromDate, reason: reason.trim(), kind, hasProof, declaration, signature: signature.trim() });
      reset();
      setDone(
        isTeacher
          ? 'Sent to the principal. The leave is yours only after he approves it.'
          : 'Sent to the principal and to your parent. He may call your parent to check the reason. The leave is yours only after he approves it.'
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
            <CalendarOff className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Leave Application Form - {profile.name}</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">The notice goes to the principal only. It is a leave only after he approves it.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* who asks: filled in, nothing to type */}
        <div className="p-5 space-y-3 bg-slate-50/60 border-b border-slate-100">
          <div className="flex items-center gap-4 flex-wrap text-xs font-medium text-slate-700">
            <span>Apply for:</span>
            {(['student', 'teacher'] as const).map(r => (
              <label key={r} className={`inline-flex items-center gap-1.5 ${r === role ? 'text-slate-900' : 'text-slate-400'}`} title={r === role ? '' : `You apply as a ${role}`}>
                <input type="radio" name="applyFor" checked={r === role} disabled={r !== role} readOnly />
                {r === 'student' ? 'Student' : 'Teacher'}
              </label>
            ))}
          </div>
          {isTeacher ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Teacher Name" value={user?.name ?? ''} />
              <Field label="Subject" value={user?.subject || '-'} />
              <Field label="Designation" value="Teacher" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Student Name" value={student?.name ?? user?.name ?? ''} />
              <Field label="Student ID" value={student?.rollNo ?? ''} />
              <Field label="Course / Batch Name" value={batch?.name ?? ''} />
              <Field label="Parent / Guardian Name" value={student?.parentName ?? ''} className="sm:col-span-2" />
              <Field label="Contact Number" value={student?.parentPhone ?? ''} />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="text-xs font-medium text-slate-700 sm:col-span-1">
              <span id="leave-kind">Type of Leave</span>
              <div className="mt-1">
                <Dropdown value={kind} onChange={setKind} options={KINDS[role]} placeholder="Choose..." label="Type of Leave" />
              </div>
            </div>
            <div className="text-xs font-medium text-slate-700">
              <span>Start Date</span>
              <div className="mt-1">
                <DatePicker value={fromDate} onChange={v => {
                    if (!v) return;
                    setFromDate(v);
                    if (toDate && toDate < v) setToDate(''); // the last day cannot be before the first day
                  }} min={today} label="Start Date" />
              </div>
            </div>
            <div className="text-xs font-medium text-slate-700">
              <span>End Date (empty: one day)</span>
              <div className="mt-1">
                <DatePicker value={toDate} onChange={setToDate} min={fromDate || today} clearable placeholder="One day" label="End Date" />
              </div>
            </div>
            <label className="block text-xs font-medium text-slate-700">
              Total Days
              <input type="text" readOnly tabIndex={-1} value={days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'Auto-calculated'} className={readOnlyClass} />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Reason for Leave (full reason)
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder={isTeacher ? 'Write the whole reason for the leave.' : 'Write the whole reason: what happened, where you go, who is with you. The principal will call your parent to check it.'}
              className={inputClass}
            />
            <span className={`text-[11px] ${reason.trim().length >= MIN_REASON ? 'text-emerald-600' : 'text-slate-400'}`}>
              {reason.trim().length} letters (at least {MIN_REASON})
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={hasProof} onChange={e => setHasProof(e.target.checked)} className="rounded border-slate-300" />
            {isTeacher ? 'I have a certificate / proof and can show it to the principal' : 'I have a medical certificate / proof and can show it to the principal'}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
              <input type="checkbox" checked={declaration} onChange={e => setDeclaration(e.target.checked)} className="rounded border-slate-300" />
              Declaration: I confirm the details are correct.
            </label>
            <label className="block text-xs font-medium text-slate-700">
              {isTeacher ? 'Teacher' : 'Student'} Signature (type your full name)
              <input type="text" value={signature} onChange={e => setSignature(e.target.value)} maxLength={80} className={inputClass} />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {done}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 pt-1">
            <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg shadow-sm flex items-center gap-2">
              <Send className="w-4 h-4" />
              {busy ? 'Sending...' : 'Submit Application'}
            </button>
            <button type="button" onClick={reset} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      </form>

      <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex items-start gap-2">
        {isTeacher ? <UserRound className="w-4 h-4 shrink-0 text-indigo-600" /> : <GraduationCap className="w-4 h-4 shrink-0 text-indigo-600" />}
        <span>
          <b>Note:</b> All leave requests are reviewed by the principal.
          {!isTeacher && ' Your parent gets the same notice as a message, so please tell them before you send it.'}
        </span>
      </p>

      {leaveRequests.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-900">My leave requests</div>
          <ul className="divide-y divide-slate-100">
            {leaveRequests.map(l => {
              const [label, tone] = STATUS[l.status];
              return (
                <li key={l.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{leaveDates(l)}</span>
                    {l.kind && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{l.kind}</span>}
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${tone}`}>{label}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{l.reason}</p>
                  {l.decisionNote && <p className="text-xs text-slate-700 mt-1">Principal: {l.decisionNote}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-slate-400">Asked {formatDateTime(l.createdAt)}</span>
                    {l.status === 'pending' && (
                      <button type="button" onClick={() => void cancelLeave(l.id).catch(() => undefined)} className="text-[11px] font-semibold text-rose-600 hover:underline">
                        Take back
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};
