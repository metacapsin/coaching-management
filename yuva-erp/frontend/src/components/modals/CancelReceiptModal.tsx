import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { FeeTransaction } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Ban } from 'lucide-react';

interface CancelReceiptModalProps {
  transaction: FeeTransaction;
  onClose: () => void;
  onCancelled?: (receiptNo: string) => void;
}

// Cancels a receipt (wrong amount, bounced cheque...). It stays in the ledger marked as cancelled.
export const CancelReceiptModal: React.FC<CancelReceiptModalProps> = ({ transaction, onClose, onCancelled }) => {
  const { cancelTransaction, profile } = useInstitute();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError('Please write the reason (at least a few words).');
      return;
    }
    cancelTransaction(transaction.id, reason.trim());
    onCancelled?.(transaction.receiptNo);
    onClose();
  };

  return (
    <ModalShell
      title="Cancel Receipt"
      subtitle={`${transaction.receiptNo} · ${transaction.studentName}`}
      icon={Ban}
      iconClass="bg-rose-600"
      onClose={onClose}
      width="sm"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
          The amount <strong className="font-mono">{profile.currencySymbol}{transaction.amount.toLocaleString('en-IN')}</strong> will
          be taken off what {transaction.studentName} has paid, so the balance becomes due again. The receipt stays in the
          ledger, marked <strong>Cancelled</strong>, and cannot be undone.
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            autoFocus
            placeholder="e.g. Cheque bounced / wrong amount entered"
            onChange={e => {
              setReason(e.target.value);
              setError('');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Keep receipt
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Ban className="w-4 h-4" />
            Cancel Receipt
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
