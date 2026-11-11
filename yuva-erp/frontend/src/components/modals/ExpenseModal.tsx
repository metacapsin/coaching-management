import { DateInput, Select } from '../ui/Pickers';
import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Expense, ExpenseCategory, PaymentMethod } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { toLocalISODate } from '../utils/helpers';
import { Wallet, Check } from 'lucide-react';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  salary: 'Salary',
  rent: 'Rent',
  electricity: 'Electricity and internet',
  marketing: 'Marketing',
  maintenance: 'Repair and maintenance',
  stationery: 'Stationery and printing',
  other: 'Other'
};

const METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

const inputClass = (hasError = false) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

// Add or change one expense (money the coaching spent)
export const ExpenseModal: React.FC<{ expense?: Expense | null; onClose: () => void }> = ({ expense, onClose }) => {
  const { addExpense, updateExpense, profile } = useInstitute();

  const [form, setForm] = useState({
    title: expense?.title ?? '',
    category: expense?.category ?? ('other' as ExpenseCategory),
    amount: expense ? String(expense.amount) : '',
    date: expense?.date ?? toLocalISODate(),
    paymentMethod: expense?.paymentMethod ?? ('Cash' as PaymentMethod),
    notes: expense?.notes ?? ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const amount = Number(form.amount);
    if (!form.title.trim()) errs.title = 'What was it for?';
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) errs.amount = 'Enter the amount (more than 0)';
    if (!form.date) errs.date = 'Pick the date';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const data = {
      title: form.title.trim(),
      category: form.category,
      amount: Math.round(amount * 100) / 100,
      date: form.date,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim() || undefined
    };
    if (expense) updateExpense(expense.id, data);
    else addExpense(data);
    onClose();
  };

  return (
    <ModalShell title={expense ? 'Edit Expense' : 'Add Expense'} subtitle="Money the coaching spent" icon={Wallet} iconClass="bg-rose-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            What was it for? <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            autoFocus
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Building rent for October"
            className={inputClass(!!errors.title)}
          />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
            <Select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as ExpenseCategory })}
              className={`${inputClass()} bg-white`}
            >
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map(c => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Amount ({profile.currencySymbol}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className={inputClass(!!errors.amount)}
            />
            {errors.amount && <p className="text-xs text-rose-600 mt-1">{errors.amount}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <DateInput value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass(!!errors.date)} />
            {errors.date && <p className="text-xs text-rose-600 mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Paid by</label>
            <Select
              value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
              className={`${inputClass()} bg-white`}
            >
              {METHODS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass()} />
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {expense ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
