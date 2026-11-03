import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam } from '../../types';
import { X, Award, Check } from 'lucide-react';

interface ExamMarksModalProps {
  exam: Exam | null;
  onClose: () => void;
  onPublished?: (examId: string) => void;
}

type Row = { score: string; remarks: string; absent: boolean };

// The wrapper only decides whether to show the form, so the form below always calls the same hooks.
export const ExamMarksModal: React.FC<ExamMarksModalProps> = ({ exam, onClose, onPublished }) => {
  useEscape(onClose);
  if (!exam) return null;
  return <MarksForm key={exam.id} exam={exam} onClose={onClose} onPublished={onPublished} />;
};

const MarksForm: React.FC<{ exam: Exam; onClose: () => void; onPublished?: (examId: string) => void }> = ({
  exam,
  onClose,
  onPublished
}) => {
  const { students, updateExamMarks } = useInstitute();

  // Archived students do not sit tests (unless they already have a result)
  const batchStudents = students.filter(
    s => s.batchId === exam.batchId && (s.status !== 'inactive' || exam.results[s.id])
  );

  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const initial: Record<string, Row> = {};
    batchStudents.forEach(st => {
      const existing = exam.results[st.id];
      initial[st.id] = {
        score: existing && !existing.absent ? String(existing.marksObtained) : '',
        remarks: existing?.remarks || '',
        absent: !!existing?.absent
      };
    });
    return initial;
  });
  const [error, setError] = useState('');

  const update = (studentId: string, patch: Partial<Row>) => {
    setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
    setError('');
  };

  const scoreOf = (row: Row) => (row.score.trim() === '' ? null : Number(row.score));

  const buildResults = (requireAll: boolean) => {
    const results: Record<string, { marksObtained: number; remarks?: string; absent?: boolean }> = {};
    for (const st of batchStudents) {
      const row = rows[st.id];
      if (row.absent) {
        results[st.id] = { marksObtained: 0, remarks: row.remarks.trim() || undefined, absent: true };
        continue;
      }
      const score = scoreOf(row);
      if (score === null) {
        if (requireAll) {
          setError(`Enter marks for ${st.name}, or tick "Absent".`);
          return null;
        }
        continue; // draft: leave the student ungraded
      }
      if (Number.isNaN(score) || score < 0 || score > exam.maxMarks) {
        setError(`Marks for ${st.name} must be between 0 and ${exam.maxMarks}.`);
        return null;
      }
      results[st.id] = { marksObtained: score, remarks: row.remarks.trim() || undefined };
    }
    return results;
  };

  const handleSaveDraft = () => {
    const results = buildResults(false);
    if (!results) return;
    updateExamMarks(exam.id, results, false);
    onClose();
  };

  const handlePublish = () => {
    const results = buildResults(true);
    if (!results) return;
    updateExamMarks(exam.id, results, true);
    if (onPublished) onPublished(exam.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Gradebook & Score Entry</h2>
              <p className="text-xs text-slate-500">
                {exam.title} ({exam.code}) · Max Marks: {exam.maxMarks} · Passing: {exam.passMarks}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-xs text-blue-900 flex justify-between items-center">
            <span>
              Entering scores for <strong>{batchStudents.length}</strong> students in {exam.batchName}.
            </span>
            <span className="font-semibold text-blue-700">Exam Date: {exam.date}</span>
          </div>

          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase">
                <tr>
                  <th className="p-3">Student / Roll No</th>
                  <th className="p-3 w-32">Score (Max: {exam.maxMarks})</th>
                  <th className="p-3 w-20 text-center">Absent</th>
                  <th className="p-3 w-24">Percentage</th>
                  <th className="p-3">Faculty Remark / Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchStudents.map(student => {
                  const row = rows[student.id];
                  const score = scoreOf(row);
                  const graded = !row.absent && score !== null && !Number.isNaN(score);
                  const percent = graded ? Math.round((score / exam.maxMarks) * 100) : null;
                  const isPass = graded && score >= exam.passMarks;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{student.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{student.rollNo}</div>
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          min={0}
                          max={exam.maxMarks}
                          step="any"
                          value={row.absent ? '' : row.score}
                          disabled={row.absent}
                          placeholder="—"
                          onChange={e => update(student.id, { score: e.target.value })}
                          data-marks="1"
                          onKeyDown={e => {
                            // Enter: on to the next student's marks (fast entry without the mouse)
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const boxes = [...document.querySelectorAll<HTMLInputElement>('input[data-marks]:not(:disabled)')];
                            const next = boxes[boxes.indexOf(e.currentTarget) + 1];
                            if (next) {
                              next.focus();
                              next.select();
                            }
                          }}
                          className="w-24 px-2.5 py-1.5 text-sm font-semibold font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.absent}
                          onChange={e => update(student.id, { absent: e.target.checked })}
                          aria-label={`${student.name} was absent`}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                        />
                      </td>

                      <td className="p-3">
                        {row.absent ? (
                          <span className="text-[11px] font-medium text-slate-500">Absent</span>
                        ) : percent === null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <>
                            <div className="font-semibold text-slate-900 font-mono">{percent}%</div>
                            <div className={`text-[11px] font-medium ${isPass ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPass ? 'Pass' : 'Below Cutoff'}
                            </div>
                          </>
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="e.g. Strong conceptual grasp, solve faster"
                          value={row.remarks}
                          onChange={e => update(student.id, { remarks: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Publishing needs marks (or "Absent") for every student. It calculates batch ranks and shows results to students.
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {exam.status === 'published' ? 'Save Changes' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Publish Scorecard & Calculate Ranks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
