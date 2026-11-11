import { Select } from '../ui/Pickers';
import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Salary } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { formatINR, toLocalISODate } from '../utils/helpers';
import { Users, Plus, Pencil, Trash2, CheckCircle2, Check, Wallet } from 'lucide-react';

const ROLE_LABEL: Record<Salary['role'], string> = { teacher: 'Teacher', staff: 'Staff', other: 'Other' };
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const SalaryModal: React.FC<{ salary: Salary | null; onClose: () => void }> = ({ salary, onClose }) => {
  const { addSalary, updateSalary, profile } = useInstitute();
  const [form, setForm] = useState({
    name: salary?.name ?? '',
    role: salary?.role ?? ('teacher' as Salary['role']),
    monthlySalary: salary ? String(salary.monthlySalary) : '',
    active: salary?.active ?? true,
    notes: salary?.notes ?? ''
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.monthlySalary);
    if (!form.name.trim()) return setError('Enter the name.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter the monthly salary (more than 0).');
    const data = { name: form.name.trim(), role: form.role, monthlySalary: Math.round(amount * 100) / 100, active: form.active, notes: form.notes.trim() || undefined };
    if (salary) updateSalary(salary.id, data);
    else addSalary(data);
    onClose();
  };

  return (
    <ModalShell title={salary ? 'Edit salary' : 'Add a person to the salary list'} icon={Users} iconClass="bg-indigo-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Who</label>
            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Salary['role'] })} className={`${inputCls} bg-white`}>
              {(Object.keys(ROLE_LABEL) as Salary['role'][]).map(r => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Monthly salary ({profile.currencySymbol})</label>
            <input type="number" min="0" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Note (subject, joined...)</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
          Still working here (untick when the person has left: no salary is due)
        </label>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

// Who is paid how much every month, and "Pay" for the month (it becomes an expense, so the profit stays right)
export const SalariesPanel: React.FC = () => {
  const { salaries, profile, paySalary, deleteSalary } = useInstitute();
  const cur = profile.currencySymbol;
  const month = toLocalISODate().slice(0, 7);
  const [editing, setEditing] = useState<{ salary: Salary | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Salary | null>(null);

  const active = salaries.filter(s => s.active);
  const payroll = active.reduce((n, s) => n + s.monthlySalary, 0);
  const paid = active.filter(s => s.lastPaidMonth === month).reduce((n, s) => n + s.monthlySalary, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Salaries
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Teachers and staff with their monthly salary. Press <strong>Pay</strong> for the month: it is written as an expense, so the profit
            changes with it.
          </p>
        </div>
        <button onClick={() => setEditing({ salary: null })} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 self-start">
          <Plus className="w-4 h-4" />
          Add person
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Salary every month</div>
          <div className="text-2xl font-bold font-mono mt-1">
            {cur}
            {formatINR(payroll)}
          </div>
          <div className="text-[11px] text-slate-400">{active.length} people</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Paid for {monthLabel(month)}</div>
          <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            {cur}
            {formatINR(paid)}
          </div>
        </div>
        <div className={`bg-white rounded-xl border p-5 shadow-xs ${payroll - paid > 0 ? 'border-amber-300' : 'border-slate-200'}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Still to pay this month</div>
          <div className="text-2xl font-bold font-mono text-amber-800 mt-1">
            {cur}
            {formatINR(Math.max(0, payroll - paid))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {salaries.length === 0 ? (
          <div className="py-14 text-center">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">Nobody on the salary list yet</p>
            <p className="text-xs text-slate-400 mt-1">Press Add person to write down a teacher or a staff member with the monthly salary.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Who</th>
                  <th className="p-3.5 text-right">Monthly salary</th>
                  <th className="p-3.5">{monthLabel(month)}</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaries.map(s => {
                  const isPaid = s.lastPaidMonth === month;
                  return (
                    <tr key={s.id} className={`align-middle ${s.active ? '' : 'opacity-50'}`}>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        {s.notes && <div className="text-[11px] text-slate-500">{s.notes}</div>}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {ROLE_LABEL[s.role]}
                        {!s.active && ' · left'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-semibold">
                        {cur}
                        {formatINR(s.monthlySalary)}
                      </td>
                      <td className="p-3.5">
                        {!s.active ? (
                          <span className="text-slate-400">-</span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => paySalary(s.id, month)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                          >
                            Pay {cur}
                            {formatINR(s.monthlySalary)}
                          </button>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button title="Edit" onClick={() => setEditing({ salary: s })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button title="Remove" onClick={() => setDeleteTarget(s)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <SalaryModal salary={editing.salary} onClose={() => setEditing(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Remove from the salary list?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.name}</strong> is removed from this list. Salaries already paid stay in the expenses.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteSalary(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
