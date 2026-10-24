import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { CalendarCheck, Clock, Award, Users, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TeacherHomeViewProps {
  onNavigate: (tab: string) => void;
}

const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const timeToMinutes = (t: string) => {
  const m = (t || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

export const TeacherHomeView: React.FC<TeacherHomeViewProps> = ({ onNavigate }) => {
  const { profile, batches, students, timetable, attendance, exams, getStudentAttendanceStats } = useInstitute();
  const { user } = useAuth();

  const now = new Date();
  const todayStr = toLocalISODate(now);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
  const firstName = (user?.name || 'Teacher').split(' ')[0];

  // Data is already limited to this teacher's batches by RoleScope
  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-slate-900">No batches assigned yet</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          The principal has not assigned any batch to your account. Once batches are assigned, your students,
          attendance and tests will appear here.
        </p>
      </div>
    );
  }

  const todayClasses = timetable
    .filter(t => t.dayOfWeek === dayName)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const markedToday = new Set(attendance.filter(a => a.date === todayStr).map(a => a.batchId));

  const upcomingExams = exams
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const pendingMarks = exams.filter(e => e.date <= todayStr && e.status !== 'published');

  const studentRows = students.map(s => {
    const stats = getStudentAttendanceStats(s.id);
    const graded = exams
      .filter(e => e.results[s.id])
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastPercent = graded
      ? Math.round((graded.results[s.id].marksObtained / graded.maxMarks) * 100)
      : null;
    return { student: s, attendance: stats.percentage, classes: stats.total, lastPercent };
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            Teacher Dashboard · {profile.academicYear}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">Welcome, {firstName}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {user?.subject ? `${user.subject} · ` : ''}
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'} · {students.length} students
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('attendance')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <CalendarCheck className="w-4 h-4" />
            Mark Attendance
          </button>
          <button
            onClick={() => onNavigate('exams')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Award className="w-4 h-4 text-amber-600" />
            Tests & Marks
          </button>
        </div>
      </div>

      {pendingMarks.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {pendingMarks.length} {pendingMarks.length === 1 ? 'test is' : 'tests are'} waiting for marks to be
            published.{' '}
            <button onClick={() => onNavigate('exams')} className="font-semibold underline">
              Enter marks
            </button>
          </span>
        </div>
      )}

      {/* My batches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {batches.map(b => {
          const enrolled = students.filter(s => s.batchId === b.id).length;
          const marked = markedToday.has(b.id);
          return (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 truncate">{b.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {b.classroom} · {b.startTime} - {b.endTime}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{b.scheduleDays.join(', ')}</p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                    marked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {marked ? 'Attendance marked today' : 'Not marked today'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {enrolled} students enrolled
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Today's classes */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <Clock className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Today's Classes</h3>
              <span className="text-xs text-slate-400">· {todayClasses.length} scheduled</span>
            </div>
            {todayClasses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No classes scheduled for today.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayClasses.map(slot => (
                  <div key={slot.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="text-center min-w-16 py-1 px-2 bg-slate-100 rounded-lg text-xs">
                        <span className="font-semibold text-slate-900 block">{slot.startTime}</span>
                        <span className="text-[10px] text-slate-500">{slot.endTime}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{slot.subject}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {slot.batchName} · {slot.classroom}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('attendance')}
                      className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                    >
                      Attendance
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My students */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">My Students ({studentRows.length})</h3>
            </div>
            {studentRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No students in your batches yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Student</th>
                      <th className="p-3">Batch</th>
                      <th className="p-3 text-center">Attendance</th>
                      <th className="p-3 text-center">Last Test</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentRows.map(({ student, attendance: att, classes, lastPercent }) => (
                      <tr key={student.id} className="hover:bg-slate-50/60">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={student.photoUrl}
                              alt={student.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">{student.name}</span>
                              <span className="font-mono text-[11px] text-slate-500">{student.rollNo}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-700">
                          {batches.find(b => b.id === student.batchId)?.name}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`font-mono font-semibold ${
                              classes > 0 && att < 75 ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {classes > 0 ? `${att}%` : '—'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700">
                          {lastPercent !== null ? `${lastPercent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming tests */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs h-fit">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
            <Award className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Tests</h3>
          </div>
          {upcomingExams.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              No upcoming tests.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingExams.map(exam => (
                <div key={exam.id} className="p-3 text-xs">
                  <span className="font-semibold text-slate-900 block">{exam.title}</span>
                  <span className="text-[11px] text-slate-500">
                    {exam.batchName} · {formatDate(exam.date)} · Max {exam.maxMarks}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};