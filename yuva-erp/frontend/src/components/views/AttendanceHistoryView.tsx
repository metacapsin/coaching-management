import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown, Clock, Search, UserCheck, UserX, X } from 'lucide-react';
import { AreaChart, DonutChart, KpiCard } from '../ui/HomeBlocks';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
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

// ---- The three filters (batch, subject, teacher) are linked: the filter that was chosen LAST decides and the other two follow it. A teacher teaches some
// subjects in some batches (the account of the teacher and the classes that were marked tell it), so: choose a teacher and the subject and the batch of
// THAT teacher are put in the other two boxes (when there is only one; with more than one the box says "all"), choose a subject and its teacher and batch
// follow, choose a batch and its subject and teacher follow. Every box lists all the values: whatever is chosen, the others change to match it.
type Sel = { batch: string; subject: string; teacher: string };
type Field = keyof Sel;
type Link = { teacher: string; subject: string; batchId: string };
const key = (v: string) => v.trim().toLowerCase();
const splitSubjects = (v?: string) => String(v ?? '').split(/[,&/]/).map(x => x.trim()).filter(Boolean);
const NONE: Sel = { batch: 'all', subject: 'all', teacher: 'all' };

// does this link fit the choices (leaving out the filter `skip`)? A teacher with no subject on record fits every subject.
const fits = (l: Link, sel: Sel, skip?: Field) =>
  (skip === 'batch' || sel.batch === 'all' || l.batchId === sel.batch) &&
  (skip === 'subject' || sel.subject === 'all' || !l.subject || key(l.subject) === sel.subject) &&
  (skip === 'teacher' || sel.teacher === 'all' || key(l.teacher) === sel.teacher);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalISODate(d);
};

export const AttendanceHistoryView: React.FC = () => {
  const { attendance, batches, students, profile } = useInstitute();
  const { users } = useAuth();

  const [period, setPeriod] = useState<Period>('7');
  const [day, setDay] = useState(toLocalISODate());
  const [sel, setSel] = useState<Sel>(NONE);
  const batchId = sel.batch;
  const subject = sel.subject; // (the lower case key of the subject)
  const teacher = sel.teacher; // (the lower case key of the name of the teacher)
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const batchName = (id: string) => batches.find(b => b.id === id)?.name || 'Batch';
  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  // who teaches what, where: from the accounts of the teachers (subject and batches) and from the classes that were marked
  const { links, subjectLabel, teacherLabel } = useMemo(() => {
    const map = new Map<string, Link>();
    const sl = new Map<string, string>();
    const tl = new Map<string, string>();
    const add = (teacherName: string, subjectName: string, batch: string) => {
      if (!teacherName && !subjectName && !batch) return;
      if (teacherName) tl.set(key(teacherName), tl.get(key(teacherName)) ?? teacherName);
      if (subjectName) sl.set(key(subjectName), sl.get(key(subjectName)) ?? subjectName);
      map.set(`${key(teacherName)}|${key(subjectName)}|${batch}`, { teacher: teacherName, subject: subjectName, batchId: batch });
    };
    for (const u of users) {
      if (u.role !== 'teacher' || (u.status || 'active') !== 'active') continue;
      const subs = splitSubjects(u.subject);
      const own = u.batchIds ?? [];
      if (!own.length) {
        // a teacher with no batch: he is in the list, and has no students
        if (subs.length) subs.forEach(sj => add(u.name, sj, ''));
        else add(u.name, '', '');
      }
      for (const b of own) {
        if (subs.length) subs.forEach(sj => add(u.name, sj, b));
        else add(u.name, '', b);
      }
    }
    for (const r of attendance) add(teacherOf(r) === '-' ? '' : teacherOf(r), subjectOf(r), r.batchId);
    return { links: Array.from(map.values()), subjectLabel: sl, teacherLabel: tl };
  }, [users, attendance]);

  // the values that a filter can take, given the choices of the other two
  const allowed = (s: Sel, f: Field): string[] => {
    const set = new Set<string>();
    for (const l of links) {
      if (!fits(l, s, f)) continue;
      const v = f === 'batch' ? l.batchId : f === 'subject' ? key(l.subject) : key(l.teacher);
      if (v) set.add(v);
    }
    return Array.from(set);
  };

  // A choice is made: the other two boxes change to what fits THIS choice (the one value of the teacher / subject / batch, or "all" when there are many).
  const choose = (field: Field, value: string) => {
    let cur: Sel = { ...NONE, [field]: value };
    if (value !== 'all') {
      for (let i = 0; i < 3; i++) {
        for (const f of ['batch', 'subject', 'teacher'] as const) {
          if (f === field) continue;
          const ok = allowed(cur, f);
          cur = { ...cur, [f]: ok.length === 1 ? ok[0] : 'all' };
        }
      }
    }
    setSel(cur);
  };
  const filterActive = batchId !== 'all' || subject !== 'all' || teacher !== 'all';

  // every box lists all its values (the choice of one changes the others)
  const batchOptions = allowed(NONE, 'batch').filter(id => batches.some(b => b.id === id));
  const subjectOptions = allowed(NONE, 'subject').sort();
  const teacherOptions = allowed(NONE, 'teacher').sort();
  const subjectText = (k: string) => subjectLabel.get(k) ?? k;
  const teacherText = (k: string) => teacherLabel.get(k) ?? k;

  const sessions = useMemo(() => {
    const from = period === '7' ? daysAgo(6) : period === '30' ? daysAgo(29) : '';
    return attendance
      .filter(r => {
        if (period === 'day' && r.date !== day) return false;
        if (from && r.date < from) return false;
        if (batchId !== 'all' && r.batchId !== batchId) return false;
        if (subject !== 'all' && key(subjectOf(r)) !== subject) return false;
        if (teacher !== 'all' && key(teacherOf(r)) !== teacher) return false;
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

  // joined + late count as "in the class"; the % of the whole list and per day (for the small chart and the trend)
  const marked = totals.joined + totals.notJoined + totals.late;
  const overall = marked > 0 ? Math.round(((totals.joined + totals.late) / marked) * 100) : 0;
  const trend = useMemo(() => {
    const byDay = new Map<string, { here: number; all: number }>();
    for (const r of sessions) {
      const x = byDay.get(r.date) ?? { here: 0, all: 0 };
      for (const st of Object.values(r.records || {})) {
        if (st === 'excused') continue;
        x.all++;
        if (st === 'present' || st === 'late') x.here++;
      }
      byDay.set(r.date, x);
    }
    return Array.from(byDay.entries())
      .filter(([, x]) => x.all > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([d, x]) => ({ label: formatDate(d).slice(0, 6), value: Math.round((x.here / x.all) * 100) }));
  }, [sessions]);

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

  // The students of the chosen teacher / subject / batch, with what each one did in the classes shown
  const roster = useMemo(() => {
    if (!filterActive) return [];
    const batchIds = new Set(links.filter(l => fits(l, sel)).map(l => l.batchId).filter(Boolean));
    const stat = new Map<string, { joined: number; notJoined: number; late: number; excused: number }>();
    for (const r of sessions) {
      for (const [sid, status] of Object.entries(r.records || {})) {
        const x = stat.get(sid) ?? { joined: 0, notJoined: 0, late: 0, excused: 0 };
        if (status === 'present') x.joined++;
        else if (status === 'absent') x.notJoined++;
        else if (status === 'late') x.late++;
        else x.excused++;
        stat.set(sid, x);
      }
    }
    return students
      .filter(st => st.status !== 'inactive' && batchIds.has(st.batchId))
      .map(st => ({ st, x: stat.get(st.id) ?? { joined: 0, notJoined: 0, late: 0, excused: 0 } }))
      .sort((a, b) => (a.st.rollNo || '').localeCompare(b.st.rollNo || '', undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterActive, links, sel, sessions, students]);

  const nameList = (r: AttendanceRecord, status: AttendanceStatus) =>
    Object.entries(r.records || {})
      .filter(([, s]) => s === status)
      .map(([sid]) => studentById.get(sid)?.name)
      .filter(Boolean) as string[];

  const periodText = period === 'day' ? formatDate(day) : period === '7' ? 'last 7 days' : period === '30' ? 'last 30 days' : 'all time';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Attendance</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Every teacher marks the attendance of the own subject (online or offline). Here you see, for each class, who joined, who did not and who joined late.
          </p>
        </div>
        <ExportMenu
          filename={`attendance_history_${period === 'day' ? day : period}`}
          addDate={false}
          title="Attendance history"
          subtitle={`${periodText}${batchId !== 'all' ? ` - ${batchName(batchId)}` : ''}${subject !== 'all' ? ` - ${subjectText(subject)}` : ''}${teacher !== 'all' ? ` - ${teacherText(teacher)}` : ''}`}
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
              onChange={e => choose('batch', e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All batches</option>
              {batchOptions.map(id => (
                <option key={id} value={id}>
                  {batchName(id)}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Subject</label>
            <Select
              value={subject}
              onChange={e => choose('subject', e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All subjects</option>
              {subjectOptions.map(k => (
                <option key={k} value={k}>
                  {subjectText(k)}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Teacher</label>
            <Select
              value={teacher}
              onChange={e => choose('teacher', e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium w-full"
            >
              <option value="all">All teachers</option>
              {teacherOptions.map(k => (
                <option key={k} value={k}>
                  {teacherText(k)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {filterActive && (
          <button type="button" onClick={() => setSel(NONE)} className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
            <X className="w-3.5 h-3.5" />
            Clear batch, subject and teacher
          </button>
        )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Overall attendance"
          icon={CalendarCheck}
          accent="blue"
          value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{marked > 0 ? `${overall}%` : '—'}</span>}
          footer={<>{sessions.length} classes · {periodText}</>}
          spark={trend.map(t => t.value)}
        />
        <KpiCard label="Joined" icon={UserCheck} accent="emerald" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{totals.joined}</span>} footer={<>Students who joined</>} />
        <KpiCard label="Not joined" icon={UserX} accent="rose" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{totals.notJoined}</span>} footer={<>Students who did not join</>} />
        <KpiCard label="Late join" icon={Clock} accent="amber" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{totals.late}</span>} footer={<>Students who joined late</>} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Attendance trend</h2>
            <span className="text-[11px] text-slate-500">% who joined, by day</span>
          </div>
          <div className="mt-3">
            {trend.length < 2 ? (
              <p className="py-14 text-center text-xs text-slate-500">The trend shows when classes of two days are marked.</p>
            ) : (
              <AreaChart id="att-trend" data={trend} format={n => `${n}%`} color="#10b981" height={200} />
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <h2 className="text-sm font-bold text-slate-900">Attendance overview</h2>
          <div className="mt-3">
            <DonutChart
              segments={[
                { value: totals.joined, color: '#10b981' },
                { value: totals.late, color: '#f59e0b' },
                { value: totals.notJoined, color: '#ef4444' }
              ]}
              center={marked > 0 ? `${overall}%` : '—'}
              sub={marked > 0 ? 'joined' : 'nothing marked'}
              size={150}
            />
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Joined<b className="ml-auto text-slate-900">{totals.joined}</b></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Not joined<b className="ml-auto text-slate-900">{totals.notJoined}</b></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Late join<b className="ml-auto text-slate-900">{totals.late}</b></div>
          </div>
        </div>
      </div>

      {/* The students of the chosen teacher / subject / batch */}
      {!q && filterActive && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-900">
              Students{teacher !== 'all' ? ` of ${teacherText(teacher)}` : ''}
              {subject !== 'all' ? ` · ${subjectText(subject)}` : ''}
              {batchId !== 'all' ? ` · ${batchName(batchId)}` : ''} ({roster.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">What each student did in the classes of {periodText}.</p>
          </div>
          {roster.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs">
              <p className="font-semibold text-amber-700">
                {teacher !== 'all' ? `No student studies under ${teacherText(teacher)}.` : 'No student studies here.'}
              </p>
              <p className="text-slate-500 mt-1">
                {teacher !== 'all'
                  ? 'The teacher has no batch, or the batch of the teacher has no student. You can ask the teacher what the reason is.'
                  : 'There is no student in this batch or for this subject.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3 w-14">Roll</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3 text-center">Joined</th>
                    <th className="p-3 text-center">Not joined</th>
                    <th className="p-3 text-center">Late join</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map(({ st, x }) => (
                    <tr key={st.id}>
                      <td className="p-3 font-mono text-slate-400">{st.rollNo}</td>
                      <td className="p-3 font-semibold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{batchName(st.batchId)}</td>
                      <td className="p-3 text-center font-semibold text-emerald-700">{x.joined}</td>
                      <td className="p-3 text-center font-semibold text-rose-700">{x.notJoined}</td>
                      <td className="p-3 text-center font-semibold text-amber-700">{x.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
