import { Select } from '../ui/Pickers';
import React, { useState, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Course, FeeTransaction, Student } from '../../types';
import { CourseModal } from '../modals/CourseModal';
import { CancelReceiptModal } from '../modals/CancelReceiptModal';
import { Pager } from '../ui/Pager';
import { usePaged } from '../utils/usePaged';
import { emailFeeNotice } from '../utils/api';
import { daysBetween, downloadCsv, fillTemplate, formatDate, openWhatsApp, payPageLink, plural, toLocalISODate, withPayLink } from '../utils/helpers';
import {
  CreditCard,
  Search,
  Plus,
  Printer,
  MessageSquare,
  Mail,
  CheckCircle2,
  Download,
  Ban,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface FeesViewProps {
  onOpenRecordPayment: () => void;
  onViewReceipt: (transactionId: string) => void;
  onSelectStudent: (studentId: string) => void;
  onCollectPayment?: (studentId: string) => void;
}

interface DefaulterRow {
  student: Student;
  net: number;
  due: number;
  batchName: string;
  overdueDays: number; // 0 when the due date has not passed (or there is none)
}

export const FeesView: React.FC<FeesViewProps> = ({
  onOpenRecordPayment,
  onViewReceipt,
  onSelectStudent
}) => {
  const { transactions, students, courses, batches, profile, sendNotification, templates, deleteCourse, notificationLogs } = useInstitute();

  const [activeTab, setActiveTab] = useState<'transactions' | 'defaulters' | 'courses'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [courseModal, setCourseModal] = useState<{ course: Course | null } | null>(null);
  const [deleteCourseTarget, setDeleteCourseTarget] = useState<Course | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FeeTransaction | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 7000);
  };

  const today = toLocalISODate();

  // Overall Financial Calculations (a cancelled receipt is no money received: the student's paid amount already excludes it)
  const totalAssessedFees = students.reduce((acc, s) => acc + Math.max(0, s.totalFees - s.discount), 0);
  const totalCollectedFees = students.reduce((acc, s) => acc + s.feePaid, 0);
  const totalOutstanding = Math.max(0, totalAssessedFees - totalCollectedFees);
  const realizationPercentage = totalAssessedFees > 0 ? Math.round((totalCollectedFees / totalAssessedFees) * 100) : 0;
  const receiptCount = transactions.filter(t => t.status !== 'cancelled').length;

  // Defaulters: overdue accounts first, then the biggest balance
  const defaultersList = useMemo<DefaulterRow[]>(() => {
    return students
      .map(s => {
        const net = Math.max(0, s.totalFees - s.discount);
        const due = Math.max(0, net - s.feePaid);
        const batch = batches.find(b => b.id === s.batchId);
        const overdueDays = s.nextDueDate ? Math.max(0, daysBetween(s.nextDueDate, today)) : 0;
        return { student: s, net, due, batchName: batch?.name || '', overdueDays };
      })
      .filter(item => item.due > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays || b.due - a.due);
  }, [students, batches, today]);

  const overdueCount = defaultersList.filter(d => d.overdueDays > 0).length;
  const shownDefaulters = overdueOnly ? defaultersList.filter(d => d.overdueDays > 0) : defaultersList;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter(t => {
      const matchesSearch =
        !q ||
        t.studentName.toLowerCase().includes(q) ||
        t.receiptNo.toLowerCase().includes(q) ||
        t.studentRollNo.toLowerCase().includes(q) ||
        (t.referenceNo && t.referenceNo.toLowerCase().includes(q));
      const matchesMethod = methodFilter === 'all' || t.paymentMethod === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [transactions, searchQuery, methodFilter]);

  const txPaged = usePaged(filteredTransactions, 20, `${searchQuery}|${methodFilter}`);
  const defaulterPaged = usePaged(shownDefaulters, 20, overdueOnly);

  const reminderText = (item: DefaulterRow) => {
    const template = templates.find(t => t.type === 'fee_due') || templates[0];
    if (!template) return null;
    return withPayLink(
      fillTemplate(template.templateBody, {
        parent_name: item.student.parentName,
        student_name: item.student.name,
        currency: profile.currencySymbol,
        due_amount: item.due.toLocaleString('en-IN'),
        due_date: item.student.nextDueDate ? formatDate(item.student.nextDueDate) : 'at the earliest',
        batch_name: item.batchName || 'Class'
      }),
      payPageLink(profile, item.student.name, item.due)
    );
  };

  // One click: a reminder for every account shown goes to the message queue ("Waiting to be sent"). Whoever
  // already has a reminder waiting is skipped, so pressing it twice does not send twice.
  const handleQueueAll = () => {
    const waiting = new Set(notificationLogs.filter(l => l.type === 'fee_due' && l.status === 'pending').map(l => l.studentId));
    let queued = 0;
    let skipped = 0;
    for (const item of shownDefaulters) {
      const msg = reminderText(item);
      if (!msg) break;
      if (waiting.has(item.student.id)) {
        skipped++;
        continue;
      }
      sendNotification({
        type: 'fee_due',
        channel: 'whatsapp',
        recipientName: item.student.parentName,
        recipientPhone: item.student.parentPhone,
        studentName: item.student.name,
        studentId: item.student.id,
        content: msg,
        status: 'pending'
      });
      queued++;
    }
    showNotice(
      queued > 0 ? 'success' : 'error',
      queued > 0
        ? `${queued} reminder${queued === 1 ? '' : 's'} added to the queue${skipped ? ` (${skipped} already waiting)` : ''}. Open Parent Broadcasts, then Message History, and press Send now on each.`
        : skipped > 0
        ? 'Every reminder is already waiting in the queue.'
        : 'No account to remind.'
    );
  };

  // "Send notice": the parent gets the fee notice by EMAIL (with the Pay now button when the UPI id is written) and in the own login (the bell
  // and the Notice Board: the message is kept for the parent there). The money is written in the Fees page when it arrives.
  const [sending, setSending] = useState<string | null>(null);
  const handleSendNotice = async (item: DefaulterRow) => {
    const s = item.student;
    if (sending) return;
    setSending(s.id);
    try {
      const msg = reminderText(item);
      const waiting = notificationLogs.some(l => l.type === 'fee_due' && l.studentId === s.id && l.status === 'pending');
      if (msg && !waiting) {
        sendNotification({
          type: 'fee_due',
          channel: 'whatsapp',
          recipientName: s.parentName,
          recipientPhone: s.parentPhone,
          studentName: s.name,
          studentId: s.id,
          content: msg
        });
      }
      if (!s.parentEmail) {
        showNotice('error', `${s.name} has no parent email, so the notice is only in the parent login (bell and Notice Board). Add the email in Edit to send it by email.`);
        return;
      }
      const r = await emailFeeNotice(s.id);
      showNotice(
        r.notified === 'sent' ? 'success' : 'error',
        r.notified === 'sent' ? `The fee notice for ${s.name} was emailed to ${s.parentEmail} and is in the parent login too.` : `The email for ${s.name} could not be sent. The notice is in the parent login (bell and Notice Board).`
      );
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'The notice could not be sent.');
    } finally {
      setSending(null);
    }
  };

  const handleSendFeeReminder = (item: DefaulterRow) => {
    const msg = reminderText(item);
    if (!msg) return;

    sendNotification({
      type: 'fee_due',
      channel: 'whatsapp',
      recipientName: item.student.parentName,
      recipientPhone: item.student.parentPhone,
      studentName: item.student.name,
      studentId: item.student.id,
      content: msg
    });

    openWhatsApp(item.student.parentPhone, msg);
  };

  const exportTransactions = () => {
    downloadCsv(
      `fee_receipts_${today}.csv`,
      ['Receipt No', 'Date', 'Roll No', 'Student', 'Batch', 'Mode', 'Reference', 'Amount', 'Status', 'Cancel reason'],
      filteredTransactions.map(t => [
        t.receiptNo,
        t.date,
        t.studentRollNo,
        t.studentName,
        t.batchName,
        t.paymentMethod,
        t.referenceNo || '',
        t.amount,
        t.status === 'cancelled' ? 'Cancelled' : 'Received',
        t.cancelReason || ''
      ])
    );
  };

  // ----- programs -----

  const courseUsage = (course: Course) => ({
    batches: batches.filter(b => b.courseId === course.id).length,
    students: students.filter(s => s.courseId === course.id).length
  });

  const handleDeleteCourse = () => {
    if (!deleteCourseTarget) return;
    const usage = courseUsage(deleteCourseTarget);
    if (usage.batches > 0 || usage.students > 0) {
      showNotice('error', 'This program is still used by batches or students, so it cannot be deleted.');
    } else {
      deleteCourse(deleteCourseTarget.id);
      showNotice('success', `${deleteCourseTarget.name} was deleted.`);
    }
    setDeleteCourseTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fee Management & Invoicing</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track tuition fee ledgers, installments, cash/UPI receipt generation, and WhatsApp payment reminders.
          </p>
        </div>

        <button
          onClick={onOpenRecordPayment}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Record Fee Payment
        </button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Financial Health Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Course Fees</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {profile.currencySymbol}{totalAssessedFees.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-400">Net after scholarships</span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Collected Revenue</span>
          <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            {profile.currencySymbol}{totalCollectedFees.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">{realizationPercentage}% of total realized</span>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/20 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Pending Dues</span>
          <p className="text-2xl font-bold font-mono text-rose-700 mt-1">
            {profile.currencySymbol}{totalOutstanding.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-rose-600">
            {plural(defaultersList.length, 'student')} with balance{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Transactions</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{receiptCount} Receipts</p>
          <span className="text-[11px] text-slate-400">
            {transactions.length - receiptCount > 0 ? `${transactions.length - receiptCount} cancelled` : 'Vouchers in digital ledger'}
          </span>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-600 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Payment Receipts History</span>
          <span className="px-1.5 bg-slate-100 rounded text-[10px] text-slate-700">{transactions.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('defaulters')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'defaulters'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Overdue Fee Accounts</span>
          {defaultersList.length > 0 && (
            <span className="px-1.5 bg-rose-100 text-rose-700 font-bold rounded text-[10px]">{defaultersList.length}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'courses'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Programs & Standard Fees</span>
          <span className="px-1.5 bg-slate-100 rounded text-[10px] text-slate-700">{courses.length}</span>
        </button>
      </div>

      {/* Tab: Payment Receipts */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, roll number, receipt number or UTR reference..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Method:</span>
              <Select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Modes</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </Select>
              <button
                onClick={exportTransactions}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {transactions.length === 0 ? 'No receipts yet. Record the first fee payment.' : 'No receipt matches your search.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3.5">Receipt No & Date</th>
                      <th className="p-3.5">Student / Roll No</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5">Payment Mode & Ref</th>
                      <th className="p-3.5 text-right">Amount Paid</th>
                      <th className="p-3.5 text-right">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {txPaged.items.map(tx => {
                      const cancelled = tx.status === 'cancelled';
                      return (
                        <tr key={tx.id} className={`hover:bg-slate-50/60 transition-colors ${cancelled ? 'bg-slate-50/60' : ''}`}>
                          <td className="p-3.5">
                            <span className={`font-mono font-bold block ${cancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                              {tx.receiptNo}
                            </span>
                            <span className="text-[11px] text-slate-400">Date: {formatDate(tx.date)}</span>
                            {cancelled && (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                Cancelled
                              </span>
                            )}
                          </td>

                          <td className="p-3.5">
                            <button
                              onClick={() => onSelectStudent(tx.studentId)}
                              className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                            >
                              {tx.studentName}
                            </button>
                            <span className="font-mono text-[11px] text-slate-500">{tx.studentRollNo}</span>
                          </td>

                          <td className="p-3.5">
                            <span className="text-slate-800">{tx.batchName}</span>
                            <span className="block text-[11px] text-slate-400">Term #{tx.installmentNo}</span>
                          </td>

                          <td className="p-3.5">
                            <span className="font-medium text-slate-900">{tx.paymentMethod}</span>
                            <span className="block font-mono text-[11px] text-slate-400">
                              {tx.referenceNo || 'Counter receipt'}
                            </span>
                            {cancelled && tx.cancelReason && (
                              <span className="block text-[11px] text-rose-600 mt-0.5">Reason: {tx.cancelReason}</span>
                            )}
                          </td>

                          <td
                            className={`p-3.5 text-right font-mono font-bold text-sm ${
                              cancelled ? 'text-slate-400 line-through' : 'text-emerald-700'
                            }`}
                          >
                            {profile.currencySymbol}{tx.amount.toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onViewReceipt(tx.id)}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors inline-flex items-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                View
                              </button>
                              {!cancelled && (
                                <button
                                  onClick={() => setCancelTarget(tx)}
                                  title="Cancel this receipt"
                                  className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                                >
                                  <Ban className="w-3.5 h-3.5" />
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
            )}
            <Pager {...txPaged} onPage={txPaged.setPage} />
          </div>
        </div>
      )}

      {/* Tab: Overdue Accounts / Defaulters */}
      {activeTab === 'defaulters' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pending Tuition Fees ({shownDefaulters.length})
              </h3>
              <p className="text-xs text-slate-500">
                Total outstanding: <strong>{profile.currencySymbol}{totalOutstanding.toLocaleString('en-IN')}</strong>. Accounts past
                their due date come first.
              </p>
            </div>
            <button
              onClick={handleQueueAll}
              disabled={shownDefaulters.length === 0}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Queue reminders for all ({shownDefaulters.length})
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={e => setOverdueOnly(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              Show only overdue ({overdueCount})
            </label>
          </div>

          {shownDefaulters.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              {overdueOnly ? 'No account is past its due date.' : 'All tuition fee accounts are currently cleared!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3.5">Student / Roll No</th>
                    <th className="p-3.5">Enrolled Batch</th>
                    <th className="p-3.5">Parent / Contact</th>
                    <th className="p-3.5 text-right">Paid / Net Fee</th>
                    <th className="p-3.5">Next Due Date</th>
                    <th className="p-3.5 text-right">Balance</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaulterPaged.items.map(item => (
                    <tr key={item.student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => onSelectStudent(item.student.id)}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                        >
                          {item.student.name}
                        </button>
                        <span className="font-mono text-[11px] text-slate-500">{item.student.rollNo}</span>
                        {item.student.status === 'inactive' && (
                          <span className="ml-1.5 text-[10px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                            Archived
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800">{item.batchName || 'Batch'}</span>
                        <span className="block text-[11px] text-slate-400">{item.student.targetExam}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium">{item.student.parentName}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{item.student.parentPhone}</span>
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-700">
                        <span className="text-emerald-700">{item.student.feePaid.toLocaleString('en-IN')}</span> /{' '}
                        {item.net.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3.5">
                        {item.student.nextDueDate ? (
                          <>
                            <span className="text-slate-800">{formatDate(item.student.nextDueDate)}</span>
                            {item.overdueDays > 0 ? (
                              <span className="block text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.overdueDays} {item.overdueDays === 1 ? 'day' : 'days'} overdue
                              </span>
                            ) : (
                              <span className="block text-[11px] text-slate-400">Not due yet</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">Not set</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-rose-600 text-sm">
                        {profile.currencySymbol}{item.due.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSendFeeReminder(item)}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1"
                            title="Send WhatsApp Fee Reminder"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Remind
                          </button>
                          <button
                            onClick={() => void handleSendNotice(item)}
                            disabled={sending !== null}
                            title="Send the fee notice by email to the parent (it is in the parent login too)"
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md transition-colors flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            {sending === item.student.id ? 'Sending…' : 'Send notice'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager {...defaulterPaged} onPage={defaulterPaged.setPage} />
        </div>
      )}

      {/* Tab: Programs and their standard fees */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Programs are what students enrol in. Create a batch for a program, then admit students to it.
            </p>
            <button
              onClick={() => setCourseModal({ course: null })}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Program
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-14 text-center text-xs text-slate-500">
              <p className="font-medium text-slate-700 text-sm">No program yet</p>
              <p className="mt-1">Add your first program (for example "IIT-JEE 2-Year") with its fee.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map(course => {
                const usage = courseUsage(course);
                return (
                  <div key={course.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-blue-600 uppercase">{course.code}</span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{course.name}</h3>
                        <span className="text-xs text-slate-500">
                          {course.category} · Duration: {course.duration}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold font-mono text-slate-900 block">
                          {profile.currencySymbol}{course.standardFee.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-slate-400">Standard fee</span>
                      </div>
                    </div>

                    {course.description && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {course.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500">
                        {usage.batches} {usage.batches === 1 ? 'batch' : 'batches'} · {usage.students}{' '}
                        {usage.students === 1 ? 'student' : 'students'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCourseModal({ course })}
                          className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteCourseTarget(course)}
                          title="Delete program"
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {courseModal && (
        <CourseModal
          course={courseModal.course}
          onClose={() => setCourseModal(null)}
          onSaved={name => showNotice('success', `${name} was saved.`)}
        />
      )}

      {cancelTarget && (
        <CancelReceiptModal
          transaction={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={receiptNo => showNotice('success', `Receipt ${receiptNo} was cancelled.`)}
        />
      )}

      {deleteCourseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this program?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteCourseTarget.name}</strong>
              {(() => {
                const usage = courseUsage(deleteCourseTarget);
                return usage.batches > 0 || usage.students > 0
                  ? ` is still used by ${usage.batches} batch(es) and ${usage.students} student(s), so it cannot be deleted. Move or delete those first.`
                  : ' will be removed.';
              })()}
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteCourseTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              {(() => {
                const usage = courseUsage(deleteCourseTarget);
                return usage.batches === 0 && usage.students === 0 ? (
                  <button
                    onClick={handleDeleteCourse}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
