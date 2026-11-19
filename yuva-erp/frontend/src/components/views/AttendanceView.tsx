import { DateInput, Select } from '../ui/Pickers';
import React, { useState, useEffect } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import type { AttendanceStatus } from '../../types';
import { AttendanceAbsentAlertModal } from '../modals/AttendanceAbsentAlertModal';
import { ExportMenu } from '../ui/ExportMenu';
import { formatDate, toLocalISODate } from '../utils/helpers';
import { KpiCard } from '../ui/HomeBlocks';
import { CalendarCheck, Send, Save, Check, Clock, UserCheck, UserX } from 'lucide-react';

// the photo of a student; with no photo (or a broken link) the initials are shown on an orange circle
const Avatar: React.FC<{ name: string; src?: string }> = ({ name, src }) => {
  const [bad, setBad] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return src && !bad ? (
    <img src={src} alt={name} onError={() => setBad(true)} className="w-8 h-8 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-orange-500 to-amber-400 text-white text-[11px] font-bold flex items-center justify-center">{initials}</div>
  );
};

export const AttendanceView: React.FC = () => {
  const { 
    batches, 
    students, 
    attendance, 
    markAttendance, 
    getAttendanceForBatchAndDate 
  } = useInstitute();
  const { profile } = useInstitute();
  const { user } = useAuth();

  // The TEACHER marks the attendance of the own SUBJECT (an online or an offline class: who joined, who did not, who was late).
  // The subject is the one of the teacher; a teacher with no subject on record takes the subjects of the own batches.
  const mySubjects = (() => {
    const own = String(user?.subject ?? '').split(/[,&/]/).map(x => x.trim()).filter(Boolean);
    if (own.length) return own;
    const fromBatches = Array.from(new Set(batches.flatMap(b => b.subjects ?? []).map(x => x.trim()).filter(Boolean)));
    return fromBatches.length ? fromBatches : [''];
  })();
  const [subject, setSubject] = useState(mySubjects[0]);
  const subjectLabel = subject || 'your class';

  // '__all' shows every student in one list (the default); a batch can be chosen to see only its students
  const ALL = '__all';
  const [selectedBatchId, setSelectedBatchId] = useState(ALL);
  const showAll = selectedBatchId === ALL;
  const [selectedDate, setSelectedDate] = useState(toLocalISODate());
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Archived students are not on the roll call
  const batchStudents = students.filter(s => (showAll || s.batchId === selectedBatchId) && s.status !== 'inactive');
  const currentBatch = batches.find(b => b.id === selectedBatchId);

  // Local attendance state for current date & batch
  const [localRecords, setLocalRecords] = useState<Record<string, AttendanceStatus>>({});

  // When date or batch changes, sync with stored attendance
  useEffect(() => {
    const initial: Record<string, AttendanceStatus> = {};
    
    batchStudents.forEach(st => {
      const existing = getAttendanceForBatchAndDate(selectedDate, st.batchId, subject);
      if (existing && existing.records[st.id]) {
        initial[st.id] = existing.records[st.id];
      } else {
        // default to present if not marked
        initial[st.id] = 'present';
      }
    });

    setLocalRecords(initial);
  }, [selectedDate, selectedBatchId, subject, students, attendance]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setLocalRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSave = () => {
    // The roll call is stored per batch: the list of all students is split by batch
    const byBatch: Record<string, Record<string, AttendanceStatus>> = {};
    batchStudents.forEach(st => {
      (byBatch[st.batchId] ||= {})[st.id] = localRecords[st.id] || 'present';
    });
    Object.entries(byBatch).forEach(([batchId, records]) => markAttendance(selectedDate, batchId, records, subject));
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 3000);
  };

  // Metrics
  const presentCount = Object.values(localRecords).filter(s => s === 'present' || s === 'late').length;
  const absentCount = Object.values(localRecords).filter(s => s === 'absent').length;
  const lateCount = Object.values(localRecords).filter(s => s === 'late').length;
  const totalCount = batchStudents.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Absent and late students. The parents are told by the CLASS TEACHER of the batch.
  const mayTell = (s: { batchId: string }) => batches.find(b => b.id === s.batchId)?.classTeacherId === user?.id;
  const absentStudents = batchStudents.filter(s => localRecords[s.id] === 'absent' && mayTell(s));
  const lateStudents = batchStudents.filter(s => localRecords[s.id] === 'late' && mayTell(s));
  const toTell = absentStudents.length + lateStudents.length;
  const cannotTell = (absentCount > 0 || lateCount > 0) && toTell === 0;

  return (
    <div className="space-y-6">
      {cannotTell && (
        <div role="status" className="p-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg">
          Only the class teacher of the batch tells the parents about absent and late students. You mark the attendance of your class here; the principal sees it in the history.
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mark Attendance</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Mark who joined your class (online or offline), who did not and who was late. Every subject has its own attendance; the principal sees it in the history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* absent and late students: told to the parents by the class teacher of the batch */}
          {toTell > 0 && (
            <button
              onClick={() => setIsAbsentModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              Tell Parents: Absent / Late ({toTell})
            </button>
          )}

          <ExportMenu
            filename={`attendance_${selectedDate}_${subject || 'class'}${showAll ? '' : `_${currentBatch?.name ?? 'batch'}`}`}
            addDate={false}
            title={`Attendance${subject ? `: ${subject}` : ''}`}
            subtitle={`${showAll ? 'All students' : currentBatch?.name ?? 'Batch'} - ${formatDate(selectedDate)}`}
            coaching={profile.name}
            disabled={batchStudents.length === 0}
            build={() => {
              const marks = batchStudents.map(st => localRecords[st.id] || 'present');
              const count = (k: string) => marks.filter(m => m === k).length;
              return {
                headers: ['Date', 'Subject', 'Roll no', 'Student', 'Batch', 'Status', 'Parent', 'Parent phone'],
                rows: batchStudents.map(st => [selectedDate, subject, st.rollNo, st.name, batches.find(b => b.id === st.batchId)?.name || '', localRecords[st.id] || 'present', st.parentName, st.parentPhone]),
                summary: [
                  { label: 'Students', value: batchStudents.length },
                  { label: 'Present', value: count('present') },
                  { label: 'Absent', value: count('absent') },
                  { label: 'Late', value: count('late') },
                  { label: 'Excused', value: count('excused') }
                ],
                colorize: (col, value) => (col === 5 ? (value === 'present' ? 'green' : value === 'absent' ? 'red' : 'amber') : undefined)
              };
            }}
          />

          <button
            onClick={handleSave}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
              saveFeedback
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saveFeedback ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveFeedback ? 'Saved Successfully' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Control Bar: Date Selector & Batch Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 w-full md:max-w-2xl">
          {/* Batch Selector */}
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Batch
            </label>
            <Select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium min-w-0 w-full"
            >
              <option value={ALL}>All students ({students.filter(s => s.status !== 'inactive').length})</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.classroom ? ` (${b.classroom})` : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Subject: the teacher marks the attendance of the own subject */}
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Subject
            </label>
            {mySubjects.length > 1 ? (
              <Select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium min-w-0 w-full"
              >
                {mySubjects.map(sj => (
                  <option key={sj} value={sj}>
                    {sj || 'General'}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-medium text-slate-700 truncate">{subject || 'General'}</div>
            )}
          </div>

          {/* Date Picker */}
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Date
            </label>
            <DateInput
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Turnout" icon={CalendarCheck} accent="blue" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{attendanceRate}%</span>} footer={<>{presentCount} of {totalCount} students</>} />
        <KpiCard label="Joined" icon={UserCheck} accent="emerald" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{presentCount - lateCount}</span>} footer={<>Joined on time</>} />
        <KpiCard label="Not joined" icon={UserX} accent="rose" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{absentCount}</span>} footer={<>Did not join</>} />
        <KpiCard label="Late join" icon={Clock} accent="amber" value={<span className="text-3xl font-bold text-slate-900 tabular-nums">{lateCount}</span>} footer={<>Joined after the start</>} />
      </div>

      {/* Attendance Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {showAll ? `Roll Call ${subject ? `(${subject})` : ''}: all students` : `Batch Roll Call${subject ? ` (${subject})` : ''}: ${currentBatch?.name}`}
            </h3>
            <p className="text-xs text-slate-500">
              {showAll
                ? `${batches.length} batch${batches.length === 1 ? '' : 'es'} · the batch of every student is shown`
                : `${currentBatch?.classroom ? `Room: ${currentBatch.classroom} · ` : ''}Timings: ${currentBatch?.startTime} - ${currentBatch?.endTime}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocalRecords(Object.fromEntries(batchStudents.map(st => [st.id, 'present' as AttendanceStatus])))}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
          >
            Mark all joined
          </button>
        </div>

        {batchStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {showAll ? 'No student is enrolled yet.' : 'No students currently enrolled in this batch.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5 w-12 text-center">#</th>
                  <th className="p-3.5">Student Information</th>
                  {showAll && <th className="p-3.5">Batch</th>}
                  <th className="p-3.5">Guardian Contact</th>
                  <th className="p-3.5 text-center">Attendance of {subjectLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchStudents.map((student, idx) => {
                  const currentStatus = localRecords[student.id] || 'present';

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} src={student.photoUrl} />
                          <div>
                            <span className="font-semibold text-slate-900 block">{student.name}</span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {student.rollNo} · {student.grade}
                            </span>
                          </div>
                        </div>
                      </td>

                      {showAll && <td className="p-3.5 text-slate-600">{batches.find(b => b.id === student.batchId)?.name || '-'}</td>}

                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium block">{student.parentName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{student.parentPhone}</span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mx-auto">
                          {/* Present button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'present')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30'
                                : 'text-slate-600 hover:bg-emerald-500/10 hover:text-emerald-600'
                            }`}
                          >
                            Joined
                          </button>

                          {/* Absent button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'absent')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30'
                                : 'text-slate-600 hover:bg-rose-500/10 hover:text-rose-600'
                            }`}
                          >
                            Not joined
                          </button>

                          {/* Late button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'late')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'late'
                                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/30'
                                : 'text-slate-600 hover:bg-amber-500/10 hover:text-amber-600'
                            }`}
                          >
                            Late join
                          </button>

                          {/* Excused button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'excused')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'excused'
                                ? 'bg-slate-700 text-white shadow-xs ring-2 ring-slate-700/30'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Excused
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

      {/* Absent Alert Dispatch Modal */}
      {isAbsentModalOpen && (
        <AttendanceAbsentAlertModal
          isOpen={isAbsentModalOpen}
          onClose={() => setIsAbsentModalOpen(false)}
          date={selectedDate}
          batchId={showAll ? '' : selectedBatchId}
          absentStudents={absentStudents}
          lateStudents={lateStudents}
        />
      )}
    </div>
  );
};
