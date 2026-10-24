import React, { useState, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { fillTemplate, openWhatsApp } from '../utils/helpers';
import { CreditCard, Search, Plus, Printer, MessageSquare, CheckCircle2 } from 'lucide-react';

interface FeesViewProps {
  onOpenRecordPayment: () => void;
  onViewReceipt: (transactionId: string) => void;
  onSelectStudent: (studentId: string) => void;
  onCollectPayment?: (studentId: string) => void;
}

export const FeesView: React.FC<FeesViewProps> = ({
  onOpenRecordPayment,
  onViewReceipt,
  onSelectStudent,
  onCollectPayment
}) => {
  const { 
    transactions, 
    students, 
    courses, 
    batches, 
    profile, 
    sendNotification, 
    templates 
  } = useInstitute();

  const [activeTab, setActiveTab] = useState<'transactions' | 'defaulters' | 'courses'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  // Overall Financial Calculations
  const totalAssessedFees = students.reduce((acc, s) => acc + Math.max(0, s.totalFees - s.discount), 0);
  const totalCollectedFees = students.reduce((acc, s) => acc + s.feePaid, 0);
  const totalOutstanding = Math.max(0, totalAssessedFees - totalCollectedFees);
  const realizationPercentage = totalAssessedFees > 0 ? Math.round((totalCollectedFees / totalAssessedFees) * 100) : 0;

  // Defaulters calculation
  const defaultersList = useMemo(() => {
    return students
      .map(s => {
        const net = Math.max(0, s.totalFees - s.discount);
        const due = Math.max(0, net - s.feePaid);
        const batch = batches.find(b => b.id === s.batchId);
        return { student: s, net, due, batch };
      })
      .filter(item => item.due > 0)
      .sort((a, b) => b.due - a.due);
  }, [students, batches]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        t.studentName.toLowerCase().includes(q) || 
        t.receiptNo.toLowerCase().includes(q) || 
        t.studentRollNo.toLowerCase().includes(q) ||
        (t.referenceNo && t.referenceNo.toLowerCase().includes(q));

      const matchesMethod = methodFilter === 'all' || t.paymentMethod === methodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [transactions, searchQuery, methodFilter]);

  const handleSendFeeReminder = (item: any) => {
    const template = templates.find(t => t.type === 'fee_due') || templates[0];
    const msg = fillTemplate(template.templateBody, {
      parent_name: item.student.parentName,
      student_name: item.student.name,
      currency: profile.currencySymbol,
      due_amount: item.due.toLocaleString('en-IN'),
      batch_name: item.batch?.name || 'Class'
    });

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
            Track tuition fee ledgers, installments, cash/UPI receipt generation, and automated WhatsApp payment reminders.
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

      {/* Financial Health Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Course Fees</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {profile.currencySymbol}{totalAssessedFees.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Net after scholarships</span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Collected Revenue</span>
          <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            {profile.currencySymbol}{totalCollectedFees.toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">{realizationPercentage}% of total realized</span>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/20 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Pending Dues</span>
          <p className="text-2xl font-bold font-mono text-rose-700 mt-1">
            {profile.currencySymbol}{totalOutstanding.toLocaleString()}
          </p>
          <span className="text-[11px] text-rose-600">{defaultersList.length} students with balance</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Transactions</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {transactions.length} Receipts
          </p>
          <span className="text-[11px] text-slate-400">Vouchers in digital ledger</span>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-600 gap-6">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'transactions'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Payment Receipts History</span>
          <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] text-slate-700">
            {transactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('defaulters')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'defaulters'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Overdue Fee Accounts</span>
          {defaultersList.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 font-bold rounded text-[10px]">
              {defaultersList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'courses'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Standard Fee Structure</span>
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
              <select
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
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
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
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-slate-900 block">{tx.receiptNo}</span>
                        <span className="text-[11px] text-slate-400">Date: {tx.date}</span>
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
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700 text-sm">
                        {profile.currencySymbol}{tx.amount.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => onViewReceipt(tx.id)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Overdue Accounts / Defaulters */}
      {activeTab === 'defaulters' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pending Tuition Fee Defaulters ({defaultersList.length})
              </h3>
              <p className="text-xs text-slate-500">
                Total outstanding arrears across all active batches: <strong>{profile.currencySymbol}{totalOutstanding.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          {defaultersList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All tuition fee accounts are currently cleared!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3.5">Student / Roll No</th>
                    <th className="p-3.5">Enrolled Batch</th>
                    <th className="p-3.5">Parent / Contact</th>
                    <th className="p-3.5 text-right">Total Net Fee</th>
                    <th className="p-3.5 text-right">Paid So Far</th>
                    <th className="p-3.5 text-right">Overdue Balance</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaultersList.map(item => (
                    <tr key={item.student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => onSelectStudent(item.student.id)}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left block"
                        >
                          {item.student.name}
                        </button>
                        <span className="font-mono text-[11px] text-slate-500">{item.student.rollNo}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800">{item.batch?.name}</span>
                        <span className="block text-[11px] text-slate-400">{item.student.targetExam}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium">{item.student.parentName}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{item.student.parentPhone}</span>
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-700">
                        {profile.currencySymbol}{item.net.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-mono text-emerald-700">
                        {profile.currencySymbol}{item.student.feePaid.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-rose-600 text-sm">
                        {profile.currencySymbol}{item.due.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSendFeeReminder(item)}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1"
                            title="Send WhatsApp Fee Reminder"
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp Reminder
                          </button>
                          <button
                            onClick={() =>
                              onCollectPayment ? onCollectPayment(item.student.id) : onSelectStudent(item.student.id)
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                          >
                            Collect
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Standard Course Fee Master */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map(course => (
            <div key={course.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600 uppercase">{course.code}</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{course.name}</h3>
                  <span className="text-xs text-slate-500">{course.category} · Duration: {course.duration}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-slate-900 block">
                    {profile.currencySymbol}{course.standardFee.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400">Standard Program Fee</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {course.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
