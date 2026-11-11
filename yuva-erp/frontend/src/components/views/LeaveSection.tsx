import React, { useState } from 'react';
import { CalendarOff, CheckCircle2, Phone, XCircle } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import type { LeaveRequest } from '../../types';
import { formatDate, formatDateTime } from '../utils/helpers';
import { FLASH_CLASS } from '../utils/focusItem';

// Leave, the part of the PRINCIPAL (on the Notice Board). The form of the student and of the teacher is the page LeavePage.
//   principal  gets the request (bell + "New" here); for a student he calls the parent to check the reason, then approves or rejects it;
//              for a teacher there is no parent to call
// Nobody else sees it (a student and a teacher only see the own requests; a parent gets a text about the student); the server keeps it so.

export const MIN_REASON = 15;

const daysOf = (l: LeaveRequest) => Math.round((Date.parse(l.toDate) - Date.parse(l.fromDate)) / 86400000) + 1;
export const leaveDates = (l: Pick<LeaveRequest, 'fromDate' | 'toDate'>) =>
  l.fromDate === l.toDate ? formatDate(l.fromDate) : `${formatDate(l.fromDate)} to ${formatDate(l.toDate)}`;

export const STATUS: Record<LeaveRequest['status'], [string, string]> = {
  pending: ['Waiting for the principal', 'bg-amber-100 text-amber-800'],
  approved: ['Approved', 'bg-emerald-100 text-emerald-800'],
  rejected: ['Not given', 'bg-rose-100 text-rose-700'],
  cancelled: ['Taken back', 'bg-slate-100 text-slate-600']
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

// ---------- the principal ----------

const Decide: React.FC<{ leave: LeaveRequest; fresh: boolean; flash: boolean }> = ({ leave, fresh, flash }) => {
  const { decideLeave } = useInstitute();
  const isTeacher = leave.role === 'teacher';
  const [called, setCalled] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (decision: 'approved' | 'rejected') => {
    setError('');
    if (decision === 'rejected' && note.trim().length < 5) {
      setError(`Write why the leave is not given (the ${isTeacher ? 'teacher' : 'student'} reads it).`);
      return;
    }
    setBusy(true);
    try {
      await decideLeave(leave.id, { decision, note: note.trim(), parentConfirmed: isTeacher || called });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <li id={`focus-leave-${leave.id}`} className={`px-5 py-4 transition-shadow ${flash ? FLASH_CLASS : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-900">{leave.studentName}</span>
        <span className="text-[11px] text-slate-500">{isTeacher ? ['Teacher', leave.subject].filter(Boolean).join(' · ') : [leave.rollNo && `Roll ${leave.rollNo}`, leave.batchName].filter(Boolean).join(' · ')}</span>
        {fresh && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">New</span>}
      </div>
      <p className="text-sm font-semibold text-indigo-700 mt-1">
        Leave: {leaveDates(leave)} ({daysOf(leave)} day{daysOf(leave) === 1 ? '' : 's'})
        {leave.kind && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 align-middle">{leave.kind}</span>}
      </p>
      <p className="text-xs text-slate-700 mt-1 whitespace-pre-line leading-relaxed">Reason: {leave.reason}</p>
      <p className="text-[11px] text-slate-500 mt-1">
        {leave.hasProof ? 'Has a certificate / proof to show. ' : ''}
        {leave.signature ? `Signed: ${leave.signature}. ` : ''}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">Asked {formatDateTime(leave.createdAt)}</p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        {!isTeacher && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-700">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
          Call the parent to check the reason:
          <strong>{leave.parentName || 'Parent'}</strong>
          {leave.parentPhone ? (
            <a href={`tel:${leave.parentPhone}`} className="font-mono font-semibold text-blue-700 hover:underline">
              {leave.parentPhone}
            </a>
          ) : (
            <span className="text-rose-600">no phone number on the admission form</span>
          )}
        </div>
        )}
        {!isTeacher && (
        <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
          <input type="checkbox" checked={called} onChange={e => setCalled(e.target.checked)} className="rounded border-slate-300" />
          I called the parent and the reason is true
        </label>
        )}
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={400}
          placeholder={`Note for the ${isTeacher ? 'teacher' : 'student'} (needed when you do not give the leave)`}
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy || (!isTeacher && !called)} onClick={() => void send('approved')} title={isTeacher || called ? 'Give the leave' : 'Call the parent first'} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
          <button type="button" disabled={busy} onClick={() => void send('rejected')} className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Do not give
          </button>
        </div>
      </div>
    </li>
  );
};

export const PrincipalLeave: React.FC<{ freshIds: string[]; flashId: string | null }> = ({ freshIds, flashId }) => {
  const { leaveRequests } = useInstitute();
  const waiting = leaveRequests.filter(l => l.status === 'pending');
  const answered = leaveRequests.filter(l => l.status === 'approved' || l.status === 'rejected').slice(0, 15);
  if (!waiting.length && !answered.length) return null;
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CalendarOff className="w-4 h-4 text-indigo-600" />
          Leave requests
          {waiting.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{waiting.length} waiting</span>}
        </h2>
        <p className="text-[11px] text-slate-500">A student or a teacher who wants to take leave asks you first. For a student call the parent first, then approve or do not give.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {waiting.map(l => (
          <Decide key={l.id} leave={l} fresh={freshIds.includes(`leave-${l.id}`)} flash={flashId === `leave-${l.id}`} />
        ))}
        {answered.map(l => {
          const [label, tone] = STATUS[l.status];
          return (
            <li key={l.id} className="px-5 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900">{l.studentName}</span>
                {l.role === 'teacher' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Teacher</span>}
                <span className="text-xs text-slate-600">{leaveDates(l)}</span>
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${tone}`}>{label}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {l.reason}
                {l.decisionNote ? ` · Your note: ${l.decisionNote}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
