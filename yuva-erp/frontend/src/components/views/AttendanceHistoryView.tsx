import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown, Search } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import { DateInput, Select } from '../ui/Pickers';
import { ExportMenu } from '../ui/ExportMenu';
import { formatDate, toLocalISODate } from '../utils/helpers';
import type { AttendanceRecord, AttendanceStatus } from '../../types';

// The attendance HISTORY for the principal. The principal does not mark the attendance: every teacher marks the own subject (an online or an
// offline class), and here the principal sees, for each day, class and student, who joined, who did not and who joined late.

const STATUS_TEXT: Record<AttendanceStatus, string> = { present: 'Joined', absent: 'Not joined', late: 'Late join', excused: 'Excused' };
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-100 text-emerald-800',
  absent: 'bg-rose-100 text-rose-800',
  late: 'bg-amber-100 text-amber-800',
  excused: 'bg-slate-200 text-slate-700'
};

const WHOLE_DAY = 'Whole day (old mark)';
const subjectOf = (r: AttendanceRecord) => (r.subject ?? '').trim() || WHOLE_DAY;
const teacherOf = (r: AttendanceRecord) => (r.teacherName ?? '').trim() || (r.markedBy ?? '').trim() || '-';

type Period = 'day' | '7' | '30' | 'all';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalISODate(d);
};

export const AttendanceHistoryView: React.FC = () => {
  const { attendance, batches, students, profile } = useInstitute();

  const [period, setPeriod] = useState<Period>('7');
  const [day, setDay] = useState(toLocalISODate());
  const [batchId, setBatchId] = useState('all');
  const [subject, setSubject] = useState('all');
  const [teacher, setTeacher] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const batchName = (id: string) => batches.find(b => b.id === id)?.name || 'Batch';
  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const subjects = useMemo(() => Array.from(new Set(attendance.map(subjectOf))).sort(), [attendance]);
  const teachers = useMemo(() => Array.from(new Set(attendance.map(teacherOf))).sort(), [attendance]);

  const sessions = useMemo(() => {
    const from = period === '7' ? daysAgo(6) : period === '30' ? daysAgo(29) : '';
    return attendance
      .filter(r => {
        if (period === 'day' && r.date !== day) return false;
        if (from && r.date < from) return false;
        if (batchId !== 'all' && r.batchId !== batchId) return false;
        if (subject !== 'all' && subjectOf(r) !== subject) return false;
        if (teacher !== 'all' && teacherOf(r) !== teacher) return false;
        return true;
      })
      .sort((a, b) => (a.date === b.date ? batchName(a.batchId).localeCompare(batchName(b.batchId)) || subjectOf(a).localeCompare(subjectOf(b)) : b.date.localeCompare(a.date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, period, day, batchId, subject, teacher, batches]);

  const count = (r: AttendanceRecord, status: AttendanceStatus) => Object.values(r.records || {}).filter(s => s === status).length;
  const totals = sessions.reduce(
    (t, r) => ({ joined: t.joined + count(r, 'present'), notJoined: t.notJoined + count(r, 'absent'), late: t.late + count(r, 'late') }),
    { joined: 0, notJoined: 0, late: 0 }
  );

  // One student: every class of the student in the chosen period, newest first
  const q = search.trim().toLowerCase();
  const studentRows = useMemo(() => {
    if (!q) return [];
    const rows: { date: string; subject: string; batch: string; teacher: string; student: string; roll: string; status: AttendanceStatus }[] = [];
    for (const r of sessions) {
      for (const [sid, status] of Object.entries(r.records || {})) {
        const st = studentById.get(sid);
        if (!st || !(st.name.toLowerCase().includes(q) || st.rollNo.toLowerCase().includes(q))) continue;
        rows.push({ date: r.date, subject: subjectOf(r), batch: batchName(r.batchId), teacher: teacherOf(r), student: st.name, roll: st.rollNo, status });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sessions, studentById, batches]);

  const nameList = (r: AttendanceRecord, status: AttendanceStatus) =>
    Object.entries(r.records || {})
      .filter(([, s]) => s === status)
      .map(([sid]) => studentById.get(sid)?.name)
      .filter(Boolean) as string[];

  const periodText = period === 'day' ? formatDate(day) : period === '7' ? 'last 7 days' : period === '30' ? 'last 30 days' : 'all time';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Attendance History</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Every teacher marks the attendance of the own subject (online or offline). Here you see, for each class, who joined, who did not and who joined late. You do not
            mark the attendance yourself.
          </p>
        </div>
        <ExportMenu
          filename={`attendance_history_${period === 'day' ? day : period}`}
          addDate={false}
          title="Attendance history"
          subtitle={`${periodText}${batchId !== 'all' ? ` - ${batchName(batchId)}` : ''}${subject !== 'all' ? ` - ${subject}` : ''}${teacher !== 'all' ? ` - ${teacher}` : ''}`}
          coaching={profile.name}
          disabled={sessions.length === 0}
          build={() => {
            const rows: (string | number)[][] = [];
            for (const r of sessions) {
              for (const [sid, status] of Object.entries(r.records || {})) {
                const st = studentById.get(sid);
                if (!st) continue;
                if (q && !(st.name.toLowerCase().includes(q) || st.rollNo.toLowerCase().includes(q))) continue;
                rows.push([r.date, batchName(r.batchId), subjectOf(r), teacherOf(r), st.rollNo, st.name, STATUS_TEXT[status]]);
              }
            }
            return {
              headers: ['Date', 'Batch', 'Subject', 'Teacher', 'Roll no', 'Student', 'Status'],
              rows,
              summary: [
                { label: 'Classes marked', value: sessions.length },
                { label: 'Joined', value: totals.joined },
                { label: 'Not joined', value: totals.notJoined },
                { label: 'Late join', value: totals.late }
              ],
              colorize: (col, value) => (col === 6 ? (value === 'Joined' ? 'green' : value === 'Not joined' ? 'red' : 'amber') : undefined)
            };
          }}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Period</label>
            <Select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="day">One day</option>
              <option value="all">All time</option>
            </Select>
          </div>
          {period === 'day' && (
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Date</label>
              <DateInput
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          )}
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Batch</label>
            <Select
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Subject</label>
            <Select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All subjects</option>
              {subjects.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Teacher</label>
            <Select
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All teachers</option>
              {teachers.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search one student (name or roll no) to see every class of the student"
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Classes marked</span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{sessions.length}</p>
          <span className="text-[10px] text-slate-400">{periodText}</span>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">Joined</span>
          <p className="text-xl font-bold text-emerald-800 mt-0.5">{totals.joined}</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-700">Not joined</span>
          <p className="text-xl font-bold text-rose-800 mt-0.5">{totals.notJoined}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Late join</span>
          <p className="text-xl font-bold text-amber-800 mt-0.5">{totals.late}</p>
        </div>
      </div>

      {q ? (
        /* One student: every class */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-900">Classes of the student ({periodText})</h3>
          </div>
          {studentRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No class of this student is marked in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Teacher</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentRows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="p-3 font-semibold text-slate-900">
                        {r.student} <span className="font-mono text-[11px] text-slate-400">{r.roll}</span>
                      </td>
                      <td className="p-3 text-slate-700">{r.subject}</td>
                      <td className="p-3 text-slate-600">{r.teacher}</td>
                      <td className="p-3 text-slate-600">{r.batch}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center text-slate-400 text-xs shadow-xs">
          No class is marked in this period. When a teacher marks the attendance of a class, it shows here.
        </div>
      ) : (
        /* Every class: who joined, who did not */
        <div className="space-y-3">
          {sessions.map(r => {
            const isOpen = !!open[r.id];
            const absent = nameList(r, 'absent');
            const late = nameList(r, 'late');
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                  className="w-full text-left p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {subjectOf(r)} <span className="font-normal text-slate-500">· {batchName(r.batchId)}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(r.date)} · marked by {teacherOf(r)}
                    </p>
                    {(absent.length > 0 || late.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {absent.map(n => (
                          <span key={`a-${n}`} className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800">
                            {n}: not joined
                          </span>
                        ))}
                        {late.map(n => (
                          <span key={`l-${n}`} className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                            {n}: late join
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-semibold">
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">Joined {count(r, 'present')}</span>
                    <span className="px-2 py-1 rounded bg-rose-100 text-rose-800">Not joined {count(r, 'absent')}</span>
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">Late {count(r, 'late')}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="p-3 w-14">Roll</th>
                          <th className="p-3">Student</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(r.records || {})
                          .map(([sid, status]) => ({ st: studentById.get(sid), status }))
                          .filter(x => x.st)
                          .sort((a, b) => (a.st!.rollNo || '').localeCompare(b.st!.rollNo || '', undefined, { numeric: true }))
                          .map(({ st, status }) => (
                            <tr key={st!.id}>
                              <td className="p-3 font-mono text-slate-400">{st!.rollNo}</td>
                              <td className="p-3 font-semibold text-slate-900">{st!.name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_TEXT[status]}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
