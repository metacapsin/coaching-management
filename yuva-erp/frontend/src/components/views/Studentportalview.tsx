import { PrintableMyResultsModal } from '../modals/PrintableMyResultsModal';
import { PrintableFeeReceiptModal } from '../modals/PrintableFeeReceiptModal';
import { ProgressCharts } from '../ui/ProgressCharts';
import React, { useState } from 'react';
import { NoticesCard, MaterialCard } from '../ui/HomeCards';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import type { ScopedResult } from '../layout/Rolescope';
import {
  CalendarCheck,
  CreditCard,
  Award,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Printer,
  CalendarOff
} from 'lucide-react';

import { formatINR, payPageLink, toLocalISODate, timeToMinutes } from '../utils/helpers';

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-rose-100 text-rose-700',
  excused: 'bg-slate-100 text-slate-600'
};

export const StudentPortalView: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate = () => undefined }) => {
  const { user } = useAuth();
  const {
    profile,
    students,
    batches,
    courses,
    timetable,
    attendance,
    transactions: allTransactions,
    exams,
    notificationLogs,
    leaveRequests,
    getStudentAttendanceStats
  } = useInstitute();
  // Cancelled receipts are not money received
  const transactions = allTransactions.filter(t => t.status !== 'cancelled');

  const [showResults, setShowResults] = useState(false);
  const [receiptTx, setReceiptTx] = useState<(typeof allTransactions)[number] | null>(null);

  const student = students[0];

  if (!student) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Student record not found</h2>
        <p className="text-xs text-slate-500 mt-1">
          Your account is not linked to an admission record. Please contact the institute.
        </p>
      </div>
    );
  }

  const now = new Date();
  const todayStr = toLocalISODate(now);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });

  const batch = batches[0];
  const course = courses.find(c => c.id === student.courseId);
  const stats = getStudentAttendanceStats(student.id);

  const netFee = Math.max(0, student.totalFees - student.discount);
  const balance = Math.max(0, netFee - student.feePaid);
  const feeNotSet = netFee <= 0;
  const paidPercent = netFee > 0 ? Math.round((student.feePaid / netFee) * 100) : 0;

  const results = exams
    .filter(e => e.results[student.id])
    .map(e => {
      const r = e.results[student.id] as ScopedResult;
      return { exam: e, result: r, percent: Math.round((r.marksObtained / e.maxMarks) * 100) };
    })
    .sort((a, b) => b.exam.date.localeCompare(a.exam.date));
  const avgPercent =
    results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.percent, 0) / results.length) : null;

  const upcoming = exams
    .filter(e => e.date >= todayStr && !e.results[student.id])
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayClasses = timetable
    .filter(t => t.dayOfWeek === dayName)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const attendanceHistory = attendance
    .map(a => ({ date: a.date, status: a.records[student.id] }))
    .filter(a => a.status)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const myReceipts = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // The data of the progress charts: the marks of every test (oldest first) and the attendance of every month
  const chartTests = [...results].reverse().map(r => ({ title: r.exam.title, date: r.exam.date, percent: r.percent }));
  const byMonth = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const status = a.records[student.id];
    if (!status) continue;
    const month = a.date.slice(0, 7);
    const row = byMonth.get(month) || { present: 0, total: 0 };
    row.total += 1;
    if (status === 'present' || status === 'late') row.present += 1;
    byMonth.set(month, row);
  }
  const chartMonths = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));

  // What needs attention first: a fee that is not fully paid (with the Pay now button when the coaching wrote its UPI id)
  // and the next test (the date, and what it covers)
  const payLink = payPageLink(profile, student.name, balance);
  const nextTest = upcoming[0];
  const daysToTest = nextTest ? Math.round((new Date(`${nextTest.date}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000) : 0;
  const childWord = user?.isParent ? 'your child' : 'you';

  return (
    <div className="space-y-6">
      {student.status === 'trial' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <span>
            Your registration has been received. The institute will confirm your admission, batch and fee
            structure soon. Your roll number is <strong className="font-mono">{student.rollNo}</strong>.
          </span>
        </div>
      )}

      {(balance > 0 && !feeNotSet) || nextTest ? (
        <div className="grid gap-3 md:grid-cols-2">
          {balance > 0 && !feeNotSet && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Fee not fully paid</p>
                <p className="text-2xl font-bold text-rose-800 mt-0.5">
                  {profile.currencySymbol}
                  {formatINR(balance)}
                </p>
                <p className="text-[11px] text-rose-700/80 mt-0.5">pending for {user?.isParent ? student.name : 'you'}</p>
              </div>
              {payLink ? (
                <a href={payLink} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs">
                  Pay now
                </a>
              ) : (
                <span className="text-[11px] text-rose-700/80">Please pay at the office.</span>
              )}
            </div>
          )}
          {nextTest && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Next test of {childWord}</p>
              <p className="text-base font-bold text-amber-900 mt-0.5">{nextTest.title}</p>
              <p className="text-xs text-amber-900/80 mt-0.5">
                {nextTest.subject} · {formatDate(nextTest.date)} · {daysToTest <= 0 ? 'today' : daysToTest === 1 ? 'tomorrow' : `in ${daysToTest} days`} · out of {nextTest.maxMarks}
              </p>
              {nextTest.syllabusTopics.length > 0 && <p className="text-[11px] text-amber-900/70 mt-1">Covers: {nextTest.syllabusTopics.join(', ')}</p>}
            </div>
          )}
        </div>
      ) : null}

      {/* Profile banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center gap-5">
        <img
          src={student.photoUrl}
          alt={student.name}
          className="w-20 h-20 rounded-full object-cover border border-slate-200 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {user?.isParent ? 'Parent Portal' : 'Student Portal'} · {profile.academicYear}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">
            {user?.isParent ? `Hello, parent of ${student.name}` : `Hello, ${student.name}`}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            <span className="font-mono">{student.rollNo}</span> · {student.grade} · Target: {student.targetExam}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {batch?.name || 'Batch'} · {course?.name || 'Program'}
          </p>
        </div>
        <div className="text-xs text-slate-500 md:text-right">
          <div>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="mt-0.5">{batch ? `${batch.classroom} · ${batch.startTime} - ${batch.endTime}` : ''}</div>
        </div>
      </div>

      {/* Leave: a student asks the principal (the form is on the Notice Board); a parent does not get it */}
      {!user?.isParent && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <CalendarOff className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Need a leave?</div>
              <p className="text-xs text-slate-500">
                {leaveRequests[0]
                  ? `Last request: ${formatDate(leaveRequests[0].fromDate)}${leaveRequests[0].toDate !== leaveRequests[0].fromDate ? ` to ${formatDate(leaveRequests[0].toDate)}` : ''} · ${
                      { pending: 'waiting for the principal', approved: 'approved', rejected: 'not given', cancelled: 'taken back' }[leaveRequests[0].status]
                    }`
                  : 'Send a notice to the principal with the dates and the reason. It is a leave only after he approves it.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('notices')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shrink-0"
          >
            Ask for leave
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">My Attendance</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`mt-3 text-3xl font-bold tracking-tight ${
              stats.percentage < 75 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {stats.percentage}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats.present} of {stats.total} classes attended
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee Balance</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`mt-3 text-2xl font-bold font-mono tracking-tight ${
              balance > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {profile.currencySymbol}
            {formatINR(balance)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {feeNotSet ? 'Fee not set yet' : balance > 0 ? `${paidPercent}% of fees paid` : 'All fees cleared'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Score</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">
            {avgPercent !== null ? `${avgPercent}%` : '—'}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {results.length} {results.length === 1 ? 'test' : 'tests'} graded
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming Tests</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <GraduationCap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">{upcoming.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            {upcoming[0] ? `Next: ${formatDate(upcoming[0].date)}` : 'Nothing scheduled'}
          </div>
        </div>
      </div>

      <ProgressCharts tests={chartTests} months={chartMonths} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Today's classes */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <Clock className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">My Classes Today</h3>
              <span className="text-xs text-slate-400">· {todayClasses.length} scheduled</span>
            </div>
            {todayClasses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No classes today.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayClasses.map(slot => (
                  <div key={slot.id} className="p-4 flex items-start gap-3">
                    <div className="text-center min-w-16 py-1 px-2 bg-slate-100 rounded-lg text-xs">
                      <span className="font-semibold text-slate-900 block">{slot.startTime}</span>
                      <span className="text-[10px] text-slate-500">{slot.endTime}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{slot.subject}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {slot.classroom} · Faculty: {slot.facultyName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exam results */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">My Test Results</h3>
              {results.length > 0 && (
                <button
                  onClick={() => setShowResults(true)}
                  className="ml-auto px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print my results
                </button>
              )}
            </div>
            {results.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No published results yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Test</th>
                      <th className="p-3 text-center">Score</th>
                      <th className="p-3 text-center">%</th>
                      <th className="p-3 text-center">Rank</th>
                      <th className="p-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map(({ exam, result, percent }) => (
                      <tr key={exam.id}>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{exam.title}</div>
                          <div className="text-[11px] text-slate-500">{formatDate(exam.date)}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-900">
                          {result.marksObtained} <span className="text-slate-400 font-normal">/ {exam.maxMarks}</span>
                        </td>
                        <td
                          className={`p-3 text-center font-mono font-semibold ${
                            percent >= 70 ? 'text-emerald-600' : percent >= 40 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {percent}%
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700">
                          {result.rank ? `#${result.rank} / ${result.totalGraded}` : '—'}
                          {result.average !== undefined && (
                            <div className="text-[10px] text-slate-400 font-sans">Batch avg {result.average}</div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">{result.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weekly timetable */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900">My Weekly Timetable</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {DAYS.map(day => {
                const slots = timetable
                  .filter(t => t.dayOfWeek === day)
                  .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                return (
                  <div key={day} className="p-3 flex gap-4 text-xs">
                    <div
                      className={`w-10 shrink-0 font-bold uppercase ${
                        day === dayName ? 'text-blue-600' : 'text-slate-500'
                      }`}
                    >
                      {day}
                    </div>
                    {slots.length === 0 ? (
                      <span className="text-slate-300 italic">No classes</span>
                    ) : (
                      <div className="space-y-1.5">
                        {slots.map(slot => (
                          <div key={slot.id}>
                            <span className="font-mono text-slate-500">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="font-semibold text-slate-900">{slot.subject}</span>
                            <span className="text-slate-400"> ({slot.classroom})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Fees */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">My Fees</h3>
            </div>
            <div className="p-4 space-y-2 text-xs border-b border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Total course fee</span>
                <span className="font-mono text-slate-800">
                  {profile.currencySymbol}
                  {formatINR(student.totalFees)}
                </span>
              </div>
              {student.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Scholarship / concession</span>
                  <span className="font-mono text-emerald-700">
                    - {profile.currencySymbol}
                    {formatINR(student.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Paid so far</span>
                <span className="font-mono text-emerald-700">
                  {profile.currencySymbol}
                  {formatINR(student.feePaid)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-700">Balance due</span>
                <span className={`font-mono ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {profile.currencySymbol}
                  {formatINR(balance)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, paidPercent)}%` }} />
              </div>
            </div>
            {myReceipts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No payments yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {myReceipts.map(tx => (
                  <div key={tx.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-semibold text-slate-900 block">{tx.receiptNo}</span>
                      <span className="text-[11px] text-slate-500">
                        {formatDate(tx.date)} · {tx.paymentMethod}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {profile.currencySymbol}
                        {formatINR(tx.amount)}
                      </span>
                      <button
                        onClick={() => setReceiptTx(tx)}
                        title="Open the receipt to print or save as PDF"
                        className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {balance > 0 && (
              <div className="p-3 text-[11px] text-slate-500 bg-amber-50/60 border-t border-amber-100">
                Please pay the balance at the institute front desk. Your receipt will appear here.
              </div>
            )}
          </div>

          {/* Attendance history */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Attendance</h3>
            </div>
            {attendanceHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No attendance marked yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {attendanceHistory.map(h => (
                  <div key={h.date} className="p-3 flex items-center justify-between text-xs">
                    <span className="text-slate-700">{formatDate(h.date)}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        STATUS_STYLE[h.status] || STATUS_STYLE.excused
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming tests */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Upcoming Tests</h3>
            </div>
            {upcoming.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No upcoming tests.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcoming.map(exam => (
                  <div key={exam.id} className="p-3 text-xs">
                    <span className="font-semibold text-slate-900 block">{exam.title}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatDate(exam.date)} · {exam.subject} · Max {exam.maxMarks}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Syllabus: {exam.syllabusTopics.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <Bell className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Messages from the Institute</h3>
            </div>
            {notificationLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                No messages.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {notificationLogs.slice(0, 6).map(log => (
                  <div key={log.id} className="p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase text-slate-500">
                        {log.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-600 mt-1 line-clamp-3">{log.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NoticesCard onNavigate={onNavigate} />
        <MaterialCard onNavigate={onNavigate} />
      </div>

      {receiptTx && <PrintableFeeReceiptModal transaction={receiptTx} onClose={() => setReceiptTx(null)} />}

      {showResults && (
        <PrintableMyResultsModal
          student={student}
          batchName={batches.find(b => b.id === student.batchId)?.name || ''}
          rows={results}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  );
};
