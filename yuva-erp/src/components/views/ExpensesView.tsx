import React, { useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Expense, ExpenseCategory } from '../../types';
import { ExpenseModal, CATEGORY_LABEL } from '../modals/ExpenseModal';
import { Pager } from '../ui/Pager';
import { SalariesPanel } from './SalariesPanel';
import { usePaged } from '../utils/usePaged';
import { downloadCsv, formatDate, formatINR, toLocalISODate } from '../utils/helpers';
import { Wallet, Plus, Download, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const BAR_COLOR: Record<ExpenseCategory, string> = {
  salary: 'bg-indigo-500',
  rent: 'bg-violet-500',
  electricity: 'bg-amber-500',
  marketing: 'bg-pink-500',
  maintenance: 'bg-orange-500',
  stationery: 'bg-sky-500',
  other: 'bg-slate-400'
};

const ExpensesPanel: React.FC = () => {
  const { expenses, transactions, profile, deleteExpense } = useInstitute();
  const cur = profile.currencySymbol;

  const thisMonth = monthKey(toLocalISODate());
  const [period, setPeriod] = useState<string>(thisMonth); // 'YYYY-MM' or 'all'
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all');
  const [editing, setEditing] = useState<{ expense: Expense | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // the months of the last year, and any older month that has an entry
  const months = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    for (let i = 0; i < 12; i++) set.add(monthKey(toLocalISODate(new Date(now.getFullYear(), now.getMonth() - i, 1))));
    expenses.forEach(e => set.add(monthKey(e.date)));
    transactions.forEach(t => t.status !== 'cancelled' && set.add(monthKey(t.date)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [expenses, transactions]);

  const inPeriod = (date: string) => period === 'all' || monthKey(date) === period;

  const list = useMemo(
    () =>
      expenses
        .filter(e => inPeriod(e.date) && (category === 'all' || e.category === category))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, period, category]
  );
  const paged = usePaged(list, 15, `${period}|${category}`);

  const spent = expenses.filter(e => inPeriod(e.date)).reduce((n, e) => n + e.amount, 0);
  const collected = transactions.filter(t => t.status !== 'cancelled' && inPeriod(t.date)).reduce((n, t) => n + t.amount, 0);
  const profit = collected - spent;
  const margin = collected > 0 ? Math.round((profit / collected) * 100) : 0;

  const byCategory = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    for (const e of expenses.filter(x => inPeriod(x.date))) totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, period]);

  const periodName = period === 'all' ? 'All time' : monthLabel(period);

  const exportCsv = () =>
    downloadCsv(
      `expenses_${period}_${toLocalISODate()}.csv`,
      ['Date', 'What for', 'Type', 'Amount', 'Paid by', 'Notes'],
      list.map(e => [e.date, e.title, CATEGORY_LABEL[e.category], e.amount, e.paymentMethod || '', e.notes || ''])
    );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-600 text-white">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Expenses & Profit</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Write down what the coaching spends. Profit is the fees collected minus these expenses. Only the principal can see this page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setEditing({ expense: null })}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All time</option>
          {months.map(m => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value as 'all' | ExpenseCategory)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All types</option>
          {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map(c => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">Showing: {periodName}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Fees collected</div>
          <div className="text-2xl font-bold text-emerald-800 font-mono mt-1">
            {cur}
            {formatINR(collected)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Expenses</div>
          <div className="text-2xl font-bold text-rose-700 font-mono mt-1">
            {cur}
            {formatINR(spent)}
          </div>
        </div>
        <div className={`bg-white rounded-xl border p-5 shadow-xs ${profit >= 0 ? 'border-blue-200' : 'border-amber-300'}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${profit >= 0 ? 'text-blue-700' : 'text-amber-800'}`}>
            {profit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {profit >= 0 ? 'Profit' : 'Loss'}
          </div>
          <div className={`text-2xl font-bold font-mono mt-1 ${profit >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
            {profit < 0 ? '-' : ''}
            {cur}
            {formatINR(Math.abs(profit))}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{collected > 0 ? `${margin}% of the fees collected` : 'No fees collected in this period'}</div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Where the money went</h2>
          <div className="space-y-2.5">
            {byCategory.map(([cat, total]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700">{CATEGORY_LABEL[cat]}</span>
                  <span className="font-mono text-slate-600">
                    {cur}
                    {formatINR(total)} · {spent > 0 ? Math.round((total / spent) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${BAR_COLOR[cat]}`} style={{ width: `${spent > 0 ? (total / spent) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {list.length === 0 ? (
          <div className="py-14 text-center">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No expense in this period</p>
            <p className="text-xs text-slate-400 mt-1">Press Add Expense to write down salary, rent, bills and other costs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">What for</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Paid by</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.items.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/60 align-top">
                    <td className="p-3.5 whitespace-nowrap text-slate-600">{formatDate(e.date)}</td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-900">{e.title}</div>
                      {e.notes && <div className="text-[11px] text-slate-500 mt-0.5">{e.notes}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{CATEGORY_LABEL[e.category]}</span>
                    </td>
                    <td className="p-3.5 text-slate-600">{e.paymentMethod || '-'}</td>
                    <td className="p-3.5 text-right font-mono font-semibold text-rose-700">
                      {cur}
                      {formatINR(e.amount)}
                    </td>
                    <td className="p-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button title="Edit" onClick={() => setEditing({ expense: e })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button title="Delete" onClick={() => setDeleteTarget(e)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager {...paged} onPage={paged.setPage} />
      </div>

      {editing && <ExpenseModal expense={editing.expense} onClose={() => setEditing(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this expense?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.title}</strong> ({cur}
              {formatINR(deleteTarget.amount)}) will be removed. The profit changes with it.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteExpense(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Two tabs: what the coaching spends, and the salaries (paying one writes an expense)
export const ExpensesView: React.FC = () => {
  const [tab, setTab] = useState<'expenses' | 'salaries'>('expenses');
  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit print:hidden">
        {([
          { id: 'expenses', label: 'Expenses and profit' },
          { id: 'salaries', label: 'Salaries' }
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === t.id ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'expenses' ? <ExpensesPanel /> : <SalariesPanel />}
    </div>
  );
};
