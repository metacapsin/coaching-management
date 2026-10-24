import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam, Student } from '../../types';
import { fillTemplate, rankOf } from '../utils/helpers';
import { CreateExamModal } from '../modals/CreateExamModal';
import { ExamMarksModal } from '../modals/ExamMarksModal';
import { PrintableReportCardModal } from '../modals/PrintableReportCardModal';
import { EditExamModal } from '../modals/EditExamModal';
import { PrintableAdmitCardModal } from '../modals/PrintableAdmitCardModal';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import { Award, Plus, FileText, Printer, Send, Pencil, Trash2, Ticket } from 'lucide-react';

export const ExamsView: React.FC = () => {
  const { exams, students, sendNotification, templates, deleteExam } = useInstitute();
  const { user } = useAuth();
  const office = canManageInstitute(user?.role);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [admitExam, setAdmitExam] = useState<Exam | null>(null);

  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [gradingExam, setGradingExam] = useState<Exam | null>(null);
  const [reportCardStudent, setReportCardStudent] = useState<Student | null>(null);
  const [broadcastSentExamId, setBroadcastSentExamId] = useState<string | null>(null);

  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];
  // Archived students are shown only if they already have a result in this exam
  const examBatchStudents = currentExam
    ? students.filter(s => s.batchId === currentExam.batchId && (s.status !== 'inactive' || currentExam.results[s.id]))
    : [];

  // Calculate stats for currentExam
  const results = currentExam ? currentExam.results : {};
  // Absent students are not part of the statistics
  const scores = Object.values(results)
    .filter(r => !r.absent)
    .map(r => r.marksObtained);
  const gradedCount = scores.length;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const passedCount = scores.filter(s => s >= (currentExam?.passMarks || 0)).length;
  const passRate = gradedCount > 0 ? Math.round((passedCount / gradedCount) * 100) : 0;

  // Ranked list: graded students first (equal marks share a rank), then absent / not graded yet
  const rankedStudents = examBatchStudents
    .map(student => {
      const res = results[student.id];
      const isGraded = !!res && !res.absent;
      const score = isGraded ? res.marksObtained : 0;
      return {
        student,
        score,
        percentage: currentExam && isGraded ? Math.round((score / currentExam.maxMarks) * 100) : 0,
        remarks: res?.remarks || '',
        isGraded,
        isAbsent: !!res?.absent,
        rank: isGraded ? rankOf(score, scores) : null
      };
    })
    .sort((a, b) => (a.isGraded === b.isGraded ? b.score - a.score : a.isGraded ? -1 : 1));

  const handleBroadcastResults = (exam: Exam) => {
    const template = templates.find(t => t.type === 'exam_result') || templates[0];
    if (!template) return;

    rankedStudents.forEach(item => {
      if (!item.isGraded || item.rank === null) return; // absent / not graded: nothing to report
      const st = item.student;

      sendNotification({
        type: 'exam_result',
        channel: 'whatsapp',
        recipientName: st.parentName,
        recipientPhone: st.parentPhone,
        studentName: st.name,
        studentId: st.id,
        content: fillTemplate(template.templateBody, {
          parent_name: st.parentName,
          student_name: st.name,
          exam_name: exam.title,
          exam_date: exam.date,
          marks_obtained: item.score,
          max_marks: exam.maxMarks,
          batch_rank: item.rank,
          remarks: item.remarks || 'Good attempt'
        }),
        status: 'pending'
      });
    });

    setBroadcastSentExamId(exam.id);
    setTimeout(() => setBroadcastSentExamId(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Test Series & Exam Performance
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conduct minor tests, All-India mocks, record marks, compute ranks & percentiles, and print official report cards.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Schedule New Exam
        </button>
      </div>

      {/* Main Grid: Left Column Exam List + Right Column Exam Gradebook/Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Exams Selector */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <span>Tests & Mock Exams ({exams.length})</span>
          </div>

          <div className="space-y-2">
            {exams.map(exam => {
              const isSelected = exam.id === currentExam?.id;
              const isPublished = exam.status === 'published';

              return (
                <div
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-400 shadow-xs ring-1 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-blue-700">
                      {exam.code}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                      isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {exam.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{exam.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{exam.batchName}</p>

                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                    <span>Date: {exam.date}</span>
                    <span className="font-medium text-slate-700">Max: {exam.maxMarks} Marks</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Selected Exam Detail & Student Leaderboard */}
        {currentExam && (
          <div className="lg:col-span-2 space-y-6">
            {/* Exam Detail Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {currentExam.code}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">Subject: {currentExam.subject}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{currentExam.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Batch: {currentExam.batchName} · Held on: {currentExam.date}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdmitExam(currentExam)}
                    className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    Admit Cards
                  </button>
                  {office && (
                    <>
                      <button
                        onClick={() => setEditingExam(currentExam)}
                        title="Edit test details"
                        className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingExam(currentExam)}
                        title="Delete test"
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setGradingExam(currentExam)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Enter / Edit Scores
                  </button>

                  {currentExam.status === 'published' && (
                    <button
                      onClick={() => handleBroadcastResults(currentExam)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        broadcastSentExamId === currentExam.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {broadcastSentExamId === currentExam.id ? 'Dispatched to Parents!' : 'Dispatch to Parents'}
                    </button>
                  )}
                </div>
              </div>

              {/* Exam KPI Stats */}
              <div className="grid grid-cols-4 gap-3 mt-4 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Graded Turnout</span>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {gradedCount} / {examBatchStudents.length}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700 block">Top Score</span>
                  <p className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                    {maxScore} <span className="text-xs font-normal text-slate-400">/ {currentExam.maxMarks}</span>
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Batch Average</span>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {avgScore}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-[10px] uppercase font-semibold text-blue-700 block">Pass Rate</span>
                  <p className="text-xl font-bold font-mono text-blue-900 mt-0.5">
                    {passRate}%
                  </p>
                </div>
              </div>

              {/* Topics Tested */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                <span className="font-semibold text-slate-700 mr-2">Syllabus Evaluated:</span>
                <span className="text-slate-600">{currentExam.syllabusTopics.join(' · ')}</span>
              </div>
            </div>

            {/* Student Leaderboard & Report Cards */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-900">
                  Batch Rank Leaderboard & Scorecards
                </h3>
                <span className="text-xs text-slate-500">
                  {rankedStudents.length} candidates enrolled
                </span>
              </div>

              {rankedStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No students in this batch yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-3.5 w-16 text-center">Rank</th>
                        <th className="p-3.5">Student / Roll No</th>
                        <th className="p-3.5 text-center">Score / Max</th>
                        <th className="p-3.5 text-center">Percentage</th>
                        <th className="p-3.5">Mentor Remarks</th>
                        <th className="p-3.5 text-right">Report Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankedStudents.map(item => {
                        const rankNum = item.rank;
                        const isTop3 = rankNum !== null && rankNum <= 3 && item.score > 0;

                        return (
                          <tr key={item.student.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 text-center">
                              {isTop3 ? (
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  rankNum === 1 ? 'bg-amber-100 text-amber-800' :
                                  rankNum === 2 ? 'bg-slate-200 text-slate-800' :
                                  'bg-amber-50 text-amber-900'
                                }`}>
                                  #{rankNum}
                                </span>
                              ) : rankNum !== null ? (
                                <span className="font-mono text-slate-400">#{rankNum}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="p-3.5">
                              <span className="font-semibold text-slate-900 block">{item.student.name}</span>
                              <span className="font-mono text-[11px] text-slate-500">{item.student.rollNo}</span>
                            </td>

                            <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                              {item.isGraded ? (
                                <>
                                  {item.score} <span className="text-slate-400 font-normal">/ {currentExam.maxMarks}</span>
                                </>
                              ) : (
                                <span className="font-sans font-medium text-slate-400">
                                  {item.isAbsent ? 'Absent' : 'Not graded'}
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 text-center font-mono font-semibold text-blue-700">
                              {item.isGraded ? `${item.percentage}%` : '—'}
                            </td>

                            <td className="p-3.5 text-slate-600 max-w-xs truncate">
                              {item.remarks || <span className="text-slate-300 italic">No notes</span>}
                            </td>

                            <td className="p-3.5 text-right">
                              <button
                                disabled={!item.isGraded}
                                onClick={() => setReportCardStudent(item.student)}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors inline-flex items-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Official Card
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateExamModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      )}

      {gradingExam && (
        <ExamMarksModal key={gradingExam.id} exam={gradingExam} onClose={() => setGradingExam(null)} />
      )}

      {editingExam && <EditExamModal exam={editingExam} onClose={() => setEditingExam(null)} />}
      {admitExam && <PrintableAdmitCardModal exam={admitExam} onClose={() => setAdmitExam(null)} />}

      {deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this test?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deletingExam.title}</strong> and all {Object.keys(deletingExam.results).length} marks entered for it will be deleted.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeletingExam(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteExam(deletingExam.id);
                  setSelectedExamId('');
                  setDeletingExam(null);
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

      <PrintableReportCardModal
        exam={currentExam}
        student={reportCardStudent}
        onClose={() => setReportCardStudent(null)}
      />
    </div>
  );
};
