import { DateInput, Select } from '../ui/Pickers';
import React, { useEffect, useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { NeedFirst } from '../ui/NeedFirst';
import { useInstitute } from '../../Context/InstituteContext';
import type { PaymentMethod, FeeTransaction } from '../../types';
import { openWhatsApp, toLocalISODate } from '../utils/helpers';
import { PAYMENT_MODES, receiptWhatsAppMessage } from '../utils/receiptPdf';
import { X, CreditCard, Check, AlertCircle, MessageCircle } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  preselectedStudentId?: string;
  onClose: () => void;
  // `emailToParent`: the principal asked to send the receipt (PDF) to the parent by email
  onPaymentSuccess?: (transaction: FeeTransaction, options?: { emailToParent: boolean }) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  preselectedStudentId,
  onClose,
  onPaymentSuccess
}) => {
  useEscape(onClose);
  const { students, recordPayment, updateStudent, sendNotification, profile } = useInstitute();

  // Archived students cannot pay; a pre-selected student is always kept in the list
  const payableStudents = students.filter(s => s.status !== 'inactive' || s.id === preselectedStudentId);
  const [studentId, setStudentId] = useState(preselectedStudentId || (payableStudents[0]?.id || ''));
  // The amount is what the PARENT paid: the principal writes it (nothing is filled in), so no payment is made from this page.
  const [amount, setAmount] = useState<number>(0);
  const [emailToParent, setEmailToParent] = useState(false);
  // a student with no parent email: the principal writes it right here (it is saved on the student)
  const [parentEmailText, setParentEmailText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toLocalISODate());
  const [error, setError] = useState('');

  const startEmail = !!students.find(s => s.id === studentId)?.parentEmail?.trim();
  useEffect(() => {
    // the box is ticked at first when the student has a parent email; the email written for another student is not kept
    setEmailToParent(startEmail);
    setParentEmailText('');
  }, [studentId, startEmail]);

  if (!isOpen) return null;

  const currentStudent = students.find(s => s.id === studentId);
  const netFee = currentStudent ? Math.max(0, currentStudent.totalFees - currentStudent.discount) : 0;
  const currentPaid = currentStudent ? currentStudent.feePaid : 0;
  const currentBalance = Math.max(0, netFee - currentPaid);
  const parentHasEmail = !!currentStudent?.parentEmail?.trim();
  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save(false);
  };

  // `viaWhatsApp`: the "Save & Send on WhatsApp" button: the receipt is made and WhatsApp opens for the phone number of the parent (no email is needed)
  const save = (viaWhatsApp: boolean) => {
    if (!studentId) {
      setError('Please select a student');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Write the amount that the parent paid');
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
    if (!viaWhatsApp && emailToParent && !parentHasEmail && !validEmail(parentEmailText)) {
      setError('Write the email of the parent to send the receipt, or remove the tick.');
      return;
    }

    try {
      // the email written in this form is kept on the student (so the next receipts and notices can use it)
      if (emailToParent && !parentHasEmail && validEmail(parentEmailText)) updateStudent(studentId, { parentEmail: parentEmailText.trim() });
      const tx = recordPayment({
        studentId,
        amount: Number(amount),
        paymentMethod,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        date
      });

      // WhatsApp: the receipt goes to the phone number of the parent (the window of WhatsApp opens from this click)
      if (viaWhatsApp && currentStudent?.parentPhone) {
        const bal = typeof tx.balanceAfter === 'number' ? tx.balanceAfter : currentBalance;
        sendNotification({
          type: 'fee_due',
          channel: 'whatsapp',
          recipientName: currentStudent.parentName,
          recipientPhone: currentStudent.parentPhone,
          studentName: currentStudent.name,
          studentId: currentStudent.id,
          content: `Fee Receipt ${tx.receiptNo} sent for ${profile.currencySymbol}${tx.amount}`
        });
        openWhatsApp(currentStudent.parentPhone, receiptWhatsAppMessage(tx, currentStudent.rollNo, profile.name, profile.currencySymbol, bal));
      }
      if (onPaymentSuccess) {
        onPaymentSuccess(tx, { emailToParent: emailToParent && (parentHasEmail || validEmail(parentEmailText)) });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
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
              <h2 className="text-lg font-semibold text-slate-900">Fee Received from Parent</h2>
              <p className="text-xs text-slate-500">Write how the parent paid the fee, then make the receipt and send it to the parent as a PDF</p>
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Student whose fee the parent paid</label>
            <Select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
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
            </Select>
          </div>

          {currentStudent && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs grid grid-cols-3 gap-2">
              <div className="col-span-3 pb-2 mb-1 border-b border-slate-200">
                <span className="text-slate-500">Paid by the parent: </span>
                <span className="font-semibold text-slate-800">{currentStudent.parentName || '-'}</span>
                {currentStudent.parentPhone && <span className="text-slate-500 font-mono"> · {currentStudent.parentPhone}</span>}
              </div>
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
              <label className="block text-xs font-medium text-slate-700">Amount paid by the parent ({profile.currencySymbol})</label>
            </div>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={amount || ''}
              onChange={e => {
                setAmount(Number(e.target.value));
                setError('');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">How did the parent pay?</label>
              <Select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PAYMENT_MODES.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date received</label>
              <DateInput
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {paymentMethod === 'Cash' ? 'Note of the cash (optional)' : paymentMethod === 'Cheque' ? 'Cheque number' : 'Transaction Ref / UTR number'}
            </label>
            <input
              type="text"
              placeholder={paymentMethod === 'Cash' ? 'e.g. given by the mother at the counter' : paymentMethod === 'Cheque' ? 'e.g. Cheque #88219' : 'e.g. UPI/2026/091244'}
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (optional)</label>
            <input
              type="text"
              placeholder="e.g. Term 2 installment cleared"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3 rounded-lg border bg-blue-50/60 border-blue-100">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailToParent}
                onChange={e => setEmailToParent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 w-4 h-4 shrink-0"
              />
              <span className="text-xs">
                <span className="font-medium text-slate-800">Send the receipt (PDF) to the parent by email</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {parentHasEmail ? `It goes to ${currentStudent?.parentEmail}.` : 'This student has no parent email yet. Write it below (it is saved on the student), or use the Send on WhatsApp button below to send it to the phone number of the parent.'}
                </span>
              </span>
            </label>
            {emailToParent && !parentHasEmail && (
              <input
                type="email"
                value={parentEmailText}
                onChange={e => {
                  setParentEmailText(e.target.value);
                  setError('');
                }}
                placeholder="parent@example.com"
                className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={!currentStudent?.parentPhone}
              title={currentStudent?.parentPhone ? `Save the payment, make the receipt and open WhatsApp for ${currentStudent.parentPhone}` : 'This student has no parent phone number'}
              className="px-3 py-2 text-sm font-medium whitespace-nowrap text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              Send on WhatsApp
            </button>
            <button
              type="submit"
              className="px-3.5 py-2 text-sm font-medium whitespace-nowrap text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Generate Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
