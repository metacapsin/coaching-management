import React, { useState } from 'react';
import { CalendarOff, CheckCircle2, Phone, Send, XCircle } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import type { LeaveRequest } from '../../types';
import { formatDate, formatDateTime, toLocalISODate } from '../utils/helpers';
import { FLASH_CLASS } from '../utils/focusItem';

// Leave of a student, on the Notice Board.
//   student    asks for leave: the dates and the FULL reason; sees the answer of the principal; can take back a waiting request
//   principal  gets the request (bell + "New" here), calls the parent to check the reason, then approves or rejects it
// Nobody else sees it (not a teacher, not a parent); the server keeps it that way.

export const MIN_REASON = 15;
const LEAVE_KINDS = ['Sick', 'Family function', 'Travel', 'Exam / other class', 'Other'];

const daysOf = (l: LeaveRequest) => Math.round((Date.parse(l.toDate) - Date.parse(l.fromDate)) / 86400000) + 1;
export const leaveDates = (l: Pick<LeaveRequest, 'fromDate' | 'toDate'>) =>
  l.fromDate === l.toDate ? formatDate(l.fromDate) : `${formatDate(l.fromDate)} to ${formatDate(l.toDate)}`;

const STATUS: Record<LeaveRequest['status'], [string, string]> = {
  pending: ['Waiting for the principal', 'bg-amber-100 text-amber-800'],
  approved: ['Approved', 'bg-emerald-100 text-emerald-800'],
  rejected: ['Not given', 'bg-rose-100 text-rose-700'],
  cancelled: ['Taken back', 'bg-slate-100 text-slate-600']
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

// ---------- the student ----------

export const StudentLeave: React.FC = () => {
  const { leaveRequests, askLeave, cancelLeave } = useInstitute();
  const today = toLocalISODate();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (reason.trim().length < MIN_REASON) {
      setError(`Write the full reason (at least ${MIN_REASON} letters): why do you need the leave?`);
      return;
    }
    setBusy(true);
    try {
      await askLeave({ fromDate, toDate: toDate || fromDate, reason: reason.trim(), kind });
      setReason('');
      setKind('');
      setToDate('');
      setDone('Sent to the principal and to your parent. He may call your parent to check the reason. The leave is yours only after he approves it.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const lastDay = toDate || fromDate;
  const days = fromDate && lastDay >= fromDate ? Math.round((Date.parse(lastDay) - Date.parse(fromDate)) / 86400000) + 1 : 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
            <CalendarOff className="w-4 h-4" />
          </span>
          Ask for leave
        </h2>
        <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600">
          <li><b className="text-indigo-700">1.</b> You send the notice</li>
          <li><b className="text-indigo-700">2.</b> Your parent gets the message too</li>
          <li><b className="text-indigo-700">3.</b> The principal calls your parent</li>
          <li><b className="text-indigo-700">4.</b> He approves or does not give it</li>
        </ol>
      </div>

      <form onSubmit={submit} className="p-5 space-y-4 border-b border-slate-100">
        <div>
          <div className="text-xs font-medium text-slate-700 mb-1.5">What is the leave for?</div>
          <div className="flex flex-wrap gap-2">
            {LEAVE_KINDS.map(k => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(kind === k ? '' : k)}
                aria-pressed={kind === k}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-700'}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-700">
            First day of leave
            <input type="date" min={today} value={fromDate} onChange={e => setFromDate(e.target.value)} required className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Last day (leave empty for one day)
            <input type="date" min={fromDate || today} value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
        </div>
        {days > 0 && (
          <p className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            Leave: {leaveDates({ fromDate, toDate: lastDay })} · {days} day{days === 1 ? '' : 's'}
          </p>
        )}

        <label className="block text-xs font-medium text-slate-700">
          Why do you need the leave? (full reason)
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="Write the whole reason: what happened, where you go, who is with you. The principal will call your parent to check it."
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className={`text-[11px] ${reason.trim().length >= MIN_REASON ? 'text-emerald-600' : 'text-slate-400'}`}>
            {reason.trim().length} letters (at least {MIN_REASON})
          </span>
        </label>

        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <Phone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Your parent will see this notice in the app too. Please tell them before you send it.
        </p>
        {error && <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {done && <p role="status" className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{done}</p>}
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg shadow-sm flex items-center gap-2">
          <Send className="w-4 h-4" />
          {busy ? 'Sending...' : 'Send to the principal'}
        </button>
      </form>

      {leaveRequests.length > 0 && <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">My leave requests</div>}
      {leaveRequests.length > 0 && (
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
      )}
    </section>
  );
};

// ---------- the principal ----------

const Decide: React.FC<{ leave: LeaveRequest; fresh: boolean; flash: boolean }> = ({ leave, fresh, flash }) => {
  const { decideLeave } = useInstitute();
  const [called, setCalled] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (decision: 'approved' | 'rejected') => {
    setError('');
    if (decision === 'rejected' && note.trim().length < 5) {
      setError('Write why the leave is not given (the student reads it).');
      return;
    }
    setBusy(true);
    try {
      await decideLeave(leave.id, { decision, note: note.trim(), parentConfirmed: called });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <li id={`focus-leave-${leave.id}`} className={`px-5 py-4 transition-shadow ${flash ? FLASH_CLASS : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-900">{leave.studentName}</span>
        <span className="text-[11px] text-slate-500">{[leave.rollNo && `Roll ${leave.rollNo}`, leave.batchName].filter(Boolean).join(' · ')}</span>
        {fresh && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">New</span>}
      </div>
      <p className="text-sm font-semibold text-indigo-700 mt-1">
        Leave: {leaveDates(leave)} ({daysOf(leave)} day{daysOf(leave) === 1 ? '' : 's'})
        {leave.kind && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 align-middle">{leave.kind}</span>}
      </p>
      <p className="text-xs text-slate-700 mt-1 whitespace-pre-line leading-relaxed">Reason: {leave.reason}</p>
      <p className="text-[11px] text-slate-400 mt-1">Asked {formatDateTime(leave.createdAt)}</p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
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
        <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
          <input type="checkbox" checked={called} onChange={e => setCalled(e.target.checked)} className="rounded border-slate-300" />
          I called the parent and the reason is true
        </label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={400}
          placeholder="Note for the student (needed when you do not give the leave)"
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy || !called} onClick={() => void send('approved')} title={called ? 'Give the leave' : 'Call the parent first'} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5">
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
        <p className="text-[11px] text-slate-500">A student who wants to take leave asks you first. Call the parent, then approve or do not give.</p>
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
