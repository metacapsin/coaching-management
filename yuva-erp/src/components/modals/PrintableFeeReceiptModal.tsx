import React from 'react';
import { useEscape } from '../ui/useEscape';
import { OrgLogo } from '../ui/OrgLogo';
import { useInstitute } from '../../Context/InstituteContext';
import type { FeeTransaction } from '../../types';
import { openWhatsApp } from '../utils/helpers';
import { X, Printer, Share2, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PrintableFeeReceiptModalProps {
  transaction: FeeTransaction | null;
  onClose: () => void;
}

export const PrintableFeeReceiptModal: React.FC<PrintableFeeReceiptModalProps> = ({ transaction, onClose }) => {
  useEscape(onClose);
  const { profile, students, sendNotification } = useInstitute();

  if (!transaction) return null;

  const student = students.find(s => s.id === transaction.studentId);

  const totalCourseFees = student ? student.totalFees : 0;
  const discount = student ? student.discount : 0;
  const netPayable = Math.max(0, totalCourseFees - discount);
  // Receipts issued after this update store the balance at the time of payment.
  // Older receipts fall back to the student's current figures.
  const hasSnapshot = typeof transaction.balanceAfter === 'number';
  const outstandingBalance = hasSnapshot
    ? (transaction.balanceAfter as number)
    : Math.max(0, netPayable - (student ? student.feePaid : transaction.amount));
  const totalPaid = hasSnapshot ? Math.max(0, netPayable - outstandingBalance) : student ? student.feePaid : transaction.amount;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!student) return;
    const message = `Official Fee Receipt: ${profile.name}\nReceipt No: ${transaction.receiptNo}\nDate: ${transaction.date}\nStudent: ${student.name} (${student.rollNo})\nBatch: ${transaction.batchName}\nAmount Paid: ${profile.currencySymbol}${transaction.amount.toLocaleString()} via ${transaction.paymentMethod}\nOutstanding Balance: ${profile.currencySymbol}${outstandingBalance.toLocaleString()}\nThank you for choosing ${profile.name}.`;

    sendNotification({
      type: 'fee_due',
      channel: 'whatsapp',
      recipientName: student.parentName,
      recipientPhone: student.parentPhone,
      studentName: student.name,
      studentId: student.id,
      content: `Fee Receipt ${transaction.receiptNo} sent for ${profile.currencySymbol}${transaction.amount}`
    });

    openWhatsApp(student.parentPhone, message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900 print:m-0 print:border-none print:shadow-none print:w-full">
        {/* Top bar (Hidden when printing) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {transaction.status === 'cancelled' ? 'Receipt Cancelled' : 'Receipt Ready'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-mono">{transaction.receiptNo}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp Parent
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Sheet */}
        <div className="relative p-8 print:p-6" id="printable-receipt">
          {transaction.status === 'cancelled' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-7xl font-black tracking-widest text-rose-600/25 -rotate-24 border-8 border-rose-600/25 px-6 py-2 rounded-xl">
                CANCELLED
              </span>
            </div>
          )}
          {/* Institute Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <OrgLogo className="w-8 h-8 rounded-lg" fallbackClass="bg-blue-700 text-white font-bold text-sm" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                    {profile.name}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">{profile.tagline}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                {profile.address} · Contact: {profile.phone} · Reg: {profile.registrationNo}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-slate-900 text-white rounded">
                Official Fee Receipt
              </span>
              <p className="text-sm font-mono font-bold text-slate-900 mt-2">{transaction.receiptNo}</p>
              <p className="text-xs text-slate-500 mt-0.5">Date: {transaction.date}</p>
            </div>
          </div>

          {/* Student & Payment Info Grid */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-lg bg-slate-50 border border-slate-200 mb-6 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Student Name:</span>{' '}
                <span className="font-semibold text-slate-900">{transaction.studentName}</span>
              </div>
              <div>
                <span className="text-slate-500">Roll Number:</span>{' '}
                <span className="font-mono font-semibold text-slate-900">{transaction.studentRollNo}</span>
              </div>
              <div>
                <span className="text-slate-500">Parent / Guardian:</span>{' '}
                <span className="font-medium text-slate-800">{student?.parentName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Parent Phone:</span>{' '}
                <span className="text-slate-800">{student?.parentPhone || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Enrolled Batch:</span>{' '}
                <span className="font-medium text-slate-800">{transaction.batchName}</span>
              </div>
              <div>
                <span className="text-slate-500">Payment Mode:</span>{' '}
                <span className="font-semibold text-slate-900">{transaction.paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500">Ref / Tx ID:</span>{' '}
                <span className="font-mono text-slate-700">{transaction.referenceNo || 'CASH-COUNTER'}</span>
              </div>
              <div>
                <span className="text-slate-500">Installment Number:</span>{' '}
                <span className="text-slate-800">Term {transaction.installmentNo}</span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <table className="w-full text-xs text-left border border-slate-200 rounded-lg mb-6 overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="p-3 border-b border-slate-200">Fee Particulars</th>
                <th className="p-3 border-b border-slate-200 text-right">Amount ({profile.currencySymbol})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 text-slate-800">
                  Total Prescribed Course Fee (Academic Year {profile.academicYear})
                </td>
                <td className="p-3 text-right font-mono text-slate-800">
                  {totalCourseFees.toLocaleString()}
                </td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td className="p-3 text-emerald-700">
                    Less: Merit Scholarship / Concession Applied
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700">
                    - {discount.toLocaleString()}
                  </td>
                </tr>
              )}
              <tr className="bg-slate-50/50 font-medium">
                <td className="p-3 text-slate-900">Net Adjusted Course Fee</td>
                <td className="p-3 text-right font-mono text-slate-900">
                  {netPayable.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-blue-50/50 font-bold text-blue-900">
                <td className="p-3">Current Payment Received (This Receipt)</td>
                <td className="p-3 text-right font-mono text-sm">
                  {profile.currencySymbol}{transaction.amount.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="p-3 text-slate-600">Total Cumulative Fees Paid to Date</td>
                <td className="p-3 text-right font-mono text-slate-700">
                  {profile.currencySymbol}{totalPaid.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">Outstanding Fee Balance</td>
                <td className="p-3 text-right font-mono font-bold text-rose-700">
                  {profile.currencySymbol}{outstandingBalance.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {transaction.notes && (
            <p className="text-xs text-slate-500 italic mb-6">
              Voucher Notes: {transaction.notes}
            </p>
          )}

          {/* Footer Signature & Seal */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs">
            <div className="text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Computer Generated Digital Audit Receipt
              </div>
              <p>Fees once deposited are subject to institute refund terms & conditions.</p>
              <p>Keep this receipt safe for course material and admit card issuance.</p>
            </div>

            <div className="text-right space-y-3">
              <div className="w-36 border-b border-slate-400 pb-1 mx-auto text-center font-serif italic text-slate-700">
                &nbsp;
              </div>
              <p className="font-semibold text-slate-900">{profile.signatoryTitle || 'Authorized Signatory'}</p>
              <p className="text-slate-400">{profile.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
