import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { NeedFirst } from '../ui/NeedFirst';
import { useInstitute } from '../../Context/InstituteContext';
import type { PaymentMethod, FeeTransaction } from '../../types';
import { toLocalISODate } from '../utils/helpers';
import { X, CreditCard, Check, AlertCircle } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  preselectedStudentId?: string;
  onClose: () => void;
  onPaymentSuccess?: (transaction: FeeTransaction) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  preselectedStudentId,
  onClose,
  onPaymentSuccess
}) => {
  useEscape(onClose);
  const { students, recordPayment, profile } = useInstitute();

  // Archived students cannot pay; a pre-selected student is always kept in the list
  const payableStudents = students.filter(s => s.status !== 'inactive' || s.id === preselectedStudentId);
  const [studentId, setStudentId] = useState(preselectedStudentId || (payableStudents[0]?.id || ''));
  const [amount, setAmount] = useState<number>(() => {
    const first = students.find(s => s.id === (preselectedStudentId || payableStudents[0]?.id));
    return first ? Math.max(0, first.totalFees - first.discount - first.feePaid) : 0;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toLocalISODate());
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const currentStudent = students.find(s => s.id === studentId);
  const netFee = currentStudent ? Math.max(0, currentStudent.totalFees - currentStudent.discount) : 0;
  const currentPaid = currentStudent ? currentStudent.feePaid : 0;
  const currentBalance = Math.max(0, netFee - currentPaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please select a student');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    if (netFee <= 0) {
      setError('The fee for this student is not set yet. Confirm the admission first.');
      return;
    }
    if (amount > currentBalance) {
      setError(`Amount is more than the pending balance (${profile.currencySymbol}${currentBalance.toLocaleString('en-IN')}).`);
      return;
    }

    try {
      const tx = recordPayment({
        studentId,
        amount: Number(amount),
        paymentMethod,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        date
      });

      if (onPaymentSuccess) {
        onPaymentSuccess(tx);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const handleSetQuickAmount = (val: number) => {
    setAmount(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Record Fee Collection</h2>
              <p className="text-xs text-slate-500">Collect installment, generate receipt voucher & update ledger</p>
            </div>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {students.length === 0 && (
            <NeedFirst title="There is no student yet.">A fee is collected from a student. Admit the first student with New Admission, then come back here.</NeedFirst>
          )}
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Student</label>
            <select
              value={studentId}
              onChange={e => {
                setStudentId(e.target.value);
                const s = students.find(item => item.id === e.target.value);
                if (s) {
                  const bal = Math.max(0, s.totalFees - s.discount - s.feePaid);
                  if (bal > 0) setAmount(bal);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {payableStudents.map(s => {
                const bal = Math.max(0, s.totalFees - s.discount - s.feePaid);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNo}) — Bal: {profile.currencySymbol}{bal.toLocaleString()}
                  </option>
                );
              })}
            </select>
          </div>

          {currentStudent && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">Total Net Fee</span>
                <span className="font-semibold text-slate-800">{profile.currencySymbol}{netFee.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Paid So Far</span>
                <span className="font-semibold text-emerald-700">{profile.currencySymbol}{currentPaid.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Pending Due</span>
                <span className="font-bold text-rose-600">{profile.currencySymbol}{currentBalance.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-slate-700">Payment Amount ({profile.currencySymbol})</label>
              {currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() => handleSetQuickAmount(currentBalance)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Pay full due ({profile.currencySymbol}{currentBalance.toLocaleString()})
                </button>
              )}
            </div>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Cash">Cash (Counter Deposit)</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Debit / Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Collection Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Ref / UTR / Cheque #</label>
            <input
              type="text"
              placeholder="e.g. UPI/2026/091244 or Cheque #88219"
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ledger Remarks / Notes</label>
            <input
              type="text"
              placeholder="e.g. Term 2 installment cleared"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirm & Generate Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
