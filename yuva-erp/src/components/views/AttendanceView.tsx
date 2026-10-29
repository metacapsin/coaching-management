import React, { useState, useEffect } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { AttendanceStatus } from '../../types';
import { AttendanceAbsentAlertModal } from '../modals/AttendanceAbsentAlertModal';
import { toLocalISODate } from '../utils/helpers';
import { CalendarCheck, Send, Save, Check } from 'lucide-react';

export const AttendanceView: React.FC = () => {
  const { 
    batches, 
    students, 
    attendance, 
    markAttendance, 
    getAttendanceForBatchAndDate 
  } = useInstitute();

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
      const existing = getAttendanceForBatchAndDate(selectedDate, st.batchId);
      if (existing && existing.records[st.id]) {
        initial[st.id] = existing.records[st.id];
      } else {
        // default to present if not marked
        initial[st.id] = 'present';
      }
    });

    setLocalRecords(initial);
  }, [selectedDate, selectedBatchId, students, attendance]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setLocalRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    batchStudents.forEach(st => {
      updated[st.id] = status;
    });
    setLocalRecords(updated);
  };

  const handleSave = () => {
    // The roll call is stored per batch: the list of all students is split by batch
    const byBatch: Record<string, Record<string, AttendanceStatus>> = {};
    batchStudents.forEach(st => {
      (byBatch[st.batchId] ||= {})[st.id] = localRecords[st.id] || 'present';
    });
    Object.entries(byBatch).forEach(([batchId, records]) => markAttendance(selectedDate, batchId, records));
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 3000);
  };

  // Metrics
  const presentCount = Object.values(localRecords).filter(s => s === 'present' || s === 'late').length;
  const absentCount = Object.values(localRecords).filter(s => s === 'absent').length;
  const lateCount = Object.values(localRecords).filter(s => s === 'late').length;
  const totalCount = batchStudents.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Absent students list
  const absentStudents = batchStudents.filter(s => localRecords[s.id] === 'absent');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Daily Student Attendance</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time batch roll call, late logging, attendance analytics, and instant parent absence alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {absentCount > 0 && (
            <button
              onClick={() => setIsAbsentModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              Send Absent Alerts ({absentCount})
            </button>
          )}

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
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Batch Selector */}
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Show
            </label>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium min-w-0 w-full sm:min-w-56 sm:w-auto"
            >
              <option value={ALL}>All students ({students.filter(s => s.status !== 'inactive').length})</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.classroom ? ` (${b.classroom})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Lecture Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Quick Batch Selection Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Bulk:</span>
          <button
            onClick={() => handleMarkAll('present')}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
          >
            All Present
          </button>
          <button
            onClick={() => handleMarkAll('absent')}
            className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
          >
            All Absent
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Total Enrolled</span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
          <span className="text-[10px] text-slate-400">{showAll ? 'Students in all batches' : 'Students in batch'}</span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">Present</span>
          <p className="text-xl font-bold text-emerald-800 mt-0.5">{presentCount - lateCount}</p>
          <span className="text-[10px] text-emerald-600">On-time attendance</span>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/20 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-700">Absent</span>
          <p className="text-xl font-bold text-rose-800 mt-0.5">{absentCount}</p>
          <span className="text-[10px] text-rose-600">Unexcused</span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-3.5 shadow-xs text-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Late Marked</span>
          <p className="text-xl font-bold text-amber-800 mt-0.5">{lateCount}</p>
          <span className="text-[10px] text-amber-600">Arrived after start</span>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-3.5 shadow-xs text-center col-span-2 md:col-span-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-700">Turnout Rate</span>
          <p className="text-xl font-bold text-blue-900 mt-0.5">{attendanceRate}%</p>
          <span className="text-[10px] text-blue-600">Overall batch attendance</span>
        </div>
      </div>

      {/* Attendance Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {showAll ? 'Roll Call: all students' : `Batch Roll Call: ${currentBatch?.name}`}
            </h3>
            <p className="text-xs text-slate-500">
              {showAll
                ? `${batches.length} batch${batches.length === 1 ? '' : 'es'} · the batch of every student is shown`
                : `${currentBatch?.classroom ? `Room: ${currentBatch.classroom} · ` : ''}Timings: ${currentBatch?.startTime} - ${currentBatch?.endTime}`}
            </p>
          </div>
          <span className="text-xs text-slate-500">
            Click status toggle buttons to mark student state
          </span>
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
                  <th className="p-3.5 text-center">Attendance Toggle</th>
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
                          <img
                            src={student.photoUrl}
                            alt={student.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
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
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Present button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            Present
                          </button>

                          {/* Absent button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            Absent
                          </button>

                          {/* Late button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'late')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'late'
                                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                            }`}
                          >
                            Late
                          </button>

                          {/* Excused button */}
                          <button
                            type="button"
                            onClick={() => setStatus(student.id, 'excused')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'excused'
                                ? 'bg-slate-700 text-white shadow-xs ring-2 ring-slate-700/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
        />
      )}
    </div>
  );
};
