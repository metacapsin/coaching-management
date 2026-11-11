import { DateInput } from '../ui/Pickers';
import React, { useEffect, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { StaffStatus } from '../../types';
import { downloadCsv, toLocalISODate } from '../utils/helpers';
import { CalendarCheck, Check, Download, Save } from 'lucide-react';

const STATUSES: { id: StaffStatus; label: string; on: string }[] = [
  { id: 'present', label: 'Present', on: 'bg-emerald-600 text-white ring-2 ring-emerald-600/30' },
  { id: 'half', label: 'Half day', on: 'bg-amber-500 text-white ring-2 ring-amber-500/30' },
  { id: 'leave', label: 'Leave', on: 'bg-sky-600 text-white ring-2 ring-sky-600/30' },
  { id: 'absent', label: 'Absent', on: 'bg-rose-600 text-white ring-2 ring-rose-600/30' }
];

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// The daily attendance of the teachers and staff on the salary list, and a count for the month
export const StaffAttendancePanel: React.FC = () => {
  const { salaries, staffAttendance, saveStaffAttendance } = useInstitute();
  const people = salaries.filter(s => s.active);
  const [date, setDate] = useState(toLocalISODate());
  const [local, setLocal] = useState<Record<string, StaffStatus>>({});
  const [saved, setSaved] = useState(false);
  const month = date.slice(0, 7);

  // what was saved for this day, or "present" for everybody
  useEffect(() => {
    const row = staffAttendance.find(a => a.date === date);
    const next: Record<string, StaffStatus> = {};
    for (const p of people) next[p.id] = row?.records[p.id] ?? 'present';
    setLocal(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, staffAttendance, salaries]);

  const save = () => {
    saveStaffAttendance(date, local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // counts of the month for every person
  const monthRows = staffAttendance.filter(a => a.date.startsWith(month));
  const count = (id: string, status: StaffStatus) => monthRows.filter(r => r.records[id] === status).length;

  const downloadMonth = () => {
    const rows = people.map(p => [p.name, count(p.id, 'present'), count(p.id, 'half'), count(p.id, 'leave'), count(p.id, 'absent')]);
    downloadCsv(`staff-attendance-${month}.csv`, ['Name', 'Present', 'Half day', 'Leave', 'Absent'], rows);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
            Staff attendance
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mark who came, who took a leave and who was absent. The people come from the <strong>Salaries</strong> tab.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Date</label>
            <DateInput value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white" />
          </div>
          <button
            onClick={save}
            disabled={people.length === 0}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save attendance'}
          </button>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Nobody on the salary list yet</p>
          <p className="text-xs text-slate-400 mt-1">Add the teachers and staff in the Salaries tab first, then mark their attendance here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <ul className="divide-y divide-slate-100">
              {people.map(p => (
                <li key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                    {p.notes && <div className="text-[11px] text-slate-500">{p.notes}</div>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setLocal(prev => ({ ...prev, [p.id]: s.id }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${local[p.id] === s.id ? s.on : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900">{monthLabel(month)}: days of each person</h3>
              <button onClick={downloadMonth} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5 text-center">Present</th>
                    <th className="p-3.5 text-center">Half day</th>
                    <th className="p-3.5 text-center">Leave</th>
                    <th className="p-3.5 text-center">Absent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.map(p => (
                    <tr key={p.id}>
                      <td className="p-3.5 font-medium text-slate-900">{p.name}</td>
                      <td className="p-3.5 text-center font-mono text-emerald-700">{count(p.id, 'present')}</td>
                      <td className="p-3.5 text-center font-mono text-amber-700">{count(p.id, 'half')}</td>
                      <td className="p-3.5 text-center font-mono text-sky-700">{count(p.id, 'leave')}</td>
                      <td className="p-3.5 text-center font-mono text-rose-700">{count(p.id, 'absent')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
