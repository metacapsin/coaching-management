import React, { useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { downloadCsv, formatINR, toLocalISODate } from '../utils/helpers';
import { BarChart3, Download, Printer } from 'lucide-react';

type ReportId = 'fees' | 'attendance' | 'exams' | 'admissions';

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'fees', label: 'Fee Collection' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'exams', label: 'Exam Results' },
  { id: 'admissions', label: 'Admissions' }
];

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const Table: React.FC<{ head: string[]; rows: (string | number)[][]; right?: number[] }> = ({ head, rows, right = [] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs text-left">
      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`p-3 ${right.includes(i) ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="p-8 text-center text-slate-400">
              No data for this report yet.
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/60">
              {r.map((c, j) => (
                <td key={j} className={`p-3 ${right.includes(j) ? 'text-right font-mono' : ''} ${j === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const ReportsView: React.FC = () => {
  const { students, transactions, attendance, exams, batches, profile } = useInstitute();
  const [report, setReport] = useState<ReportId>('fees');
  const cur = profile.currencySymbol;

  const valid = useMemo(() => transactions.filter(t => t.status !== 'cancelled'), [transactions]);

  const fees = useMemo(() => {
    const byMonth = new Map<string, { total: number; count: number }>();
    const byMode = new Map<string, number>();
    for (const t of valid) {
      const k = monthKey(t.date);
      const m = byMonth.get(k) || { total: 0, count: 0 };
      m.total += t.amount;
      m.count += 1;
      byMonth.set(k, m);
      byMode.set(t.paymentMethod, (byMode.get(t.paymentMethod) || 0) + t.amount);
    }
    const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const total = valid.reduce((s, t) => s + t.amount, 0);
    const cancelled = transactions.filter(t => t.status === 'cancelled');
    return { months, modes: [...byMode.entries()].sort((a, b) => b[1] - a[1]), total, cancelled };
  }, [valid, transactions]);

  const att = useMemo(
    () =>
      batches.map(b => {
        const recs = attendance.filter(a => a.batchId === b.id);
        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;
        for (const r of recs) {
          for (const s of Object.values(r.records)) {
            if (s === 'present') present++;
            else if (s === 'absent') absent++;
            else if (s === 'late') late++;
            else excused++;
          }
        }
        const total = present + absent + late + excused;
        const pct = total ? Math.round(((present + late) / total) * 100) : 0;
        return { name: b.name, days: recs.length, present, absent, late, excused, pct };
      }),
    [attendance, batches]
  );

  const ex = useMemo(
    () =>
      exams
        .filter(e => e.status === 'published' || Object.keys(e.results).length > 0)
        .map(e => {
          const rows = Object.values(e.results).filter(r => !r.absent);
          const marks = rows.map(r => r.marksObtained);
          const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
          const passed = rows.filter(r => r.marksObtained >= e.passMarks).length;
          return {
            title: e.title,
            batch: e.batchName,
            date: e.date,
            appeared: rows.length,
            absent: Object.values(e.results).filter(r => r.absent).length,
            avg: Math.round(avg * 10) / 10,
            high: marks.length ? Math.max(...marks) : 0,
            max: e.maxMarks,
            passPct: rows.length ? Math.round((passed / rows.length) * 100) : 0
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [exams]
  );

  const adm = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const s of students) byMonth.set(monthKey(s.dateOfAdmission), (byMonth.get(monthKey(s.dateOfAdmission)) || 0) + 1);
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [students]);

  const tables = {
    fees: {
      head: ['Month', 'Receipts', `Collected (${cur})`],
      rows: fees.months.map(([k, v]) => [monthLabel(k), v.count, formatINR(v.total)]) as (string | number)[][],
      right: [1, 2]
    },
    attendance: {
      head: ['Batch', 'Days marked', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'],
      rows: att.map(a => [a.name, a.days, a.present, a.late, a.absent, a.excused, `${a.pct}%`]) as (string | number)[][],
      right: [1, 2, 3, 4, 5, 6]
    },
    exams: {
      head: ['Test', 'Batch', 'Date', 'Appeared', 'Absent', 'Average', 'Highest', 'Pass %'],
      rows: ex.map(e => [e.title, e.batch, e.date, e.appeared, e.absent, `${e.avg} / ${e.max}`, e.high, `${e.passPct}%`]) as (string | number)[][],
      right: [3, 4, 5, 6, 7]
    },
    admissions: {
      head: ['Month', 'New admissions'],
      rows: adm.map(([k, n]) => [monthLabel(k), n]) as (string | number)[][],
      right: [1]
    }
  };
  const current = tables[report];

  const exportCsv = () => downloadCsv(`report_${report}_${toLocalISODate()}.csv`, current.head, current.rows);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-600 text-white">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Month-wise fees, attendance by batch, exam results and admissions. Export or print any report.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => window.print()} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap print:hidden">
        {REPORTS.map(r => (
          <button
            key={r.id}
            onClick={() => setReport(r.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              report === r.id ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            {REPORTS.find(r => r.id === report)?.label} report
          </h2>
          <p className="text-[11px] text-slate-500">
            {profile.name} · {profile.academicYear} · printed {new Date().toLocaleDateString('en-IN')}
          </p>
        </div>

        {report === 'fees' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 border-b border-slate-100">
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Total collected</div>
              <div className="text-xl font-bold text-emerald-700 font-mono">
                {cur}
                {formatINR(fees.total)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-500">By payment mode</div>
              <div className="text-xs text-slate-700 mt-1 space-y-0.5">
                {fees.modes.length === 0 && <span className="text-slate-400">-</span>}
                {fees.modes.map(([m, v]) => (
                  <div key={m} className="flex justify-between gap-4 max-w-56">
                    <span>{m}</span>
                    <span className="font-mono">
                      {cur}
                      {formatINR(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Cancelled receipts</div>
              <div className="text-xl font-bold text-rose-600 font-mono">{fees.cancelled.length}</div>
              <div className="text-[11px] text-slate-400">Not counted in the totals</div>
            </div>
          </div>
        )}

        <Table head={current.head} rows={current.rows} right={current.right} />
      </div>
    </div>
  );
};
