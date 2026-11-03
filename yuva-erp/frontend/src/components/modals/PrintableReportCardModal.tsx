import React from 'react';
import { useEscape } from '../ui/useEscape';
import { OrgLogo } from '../ui/OrgLogo';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam, Student } from '../../types';
import { openWhatsApp, rankOf } from '../utils/helpers';
import { X, Printer, Share2, Award } from 'lucide-react';

interface PrintableReportCardModalProps {
  exam: Exam | null;
  student: Student | null;
  onClose: () => void;
}

export const PrintableReportCardModal: React.FC<PrintableReportCardModalProps> = ({
  exam,
  student,
  onClose
}) => {
  useEscape(onClose);
  const { profile, students, sendNotification } = useInstitute();

  if (!exam || !student) return null;

  const result = exam.results[student.id] || { marksObtained: 0, remarks: 'Participation noted' };
  const score = result.marksObtained;
  const percentage = Math.round((score / exam.maxMarks) * 100);

  // Rank and stats use only students who were graded (not absent / not entered)
  const allBatchStudents = students.filter(s => s.batchId === exam.batchId);
  const allScores = allBatchStudents
    .filter(s => exam.results[s.id] && !exam.results[s.id].absent)
    .map(s => exam.results[s.id].marksObtained);
  const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((acc, v) => acc + v, 0) / allScores.length) : 0;

  const rank = rankOf(score, allScores);
  const percentile =
    allScores.length > 1 ? Math.round((allScores.filter(s => s <= score).length / allScores.length) * 100) : 100;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const message = `Official Scorecard: ${profile.name}\nExam: ${exam.title} (${exam.subject})\nStudent: ${student.name} (${student.rollNo})\nScore: ${score} / ${exam.maxMarks} (${percentage}%)\nBatch Rank: #${rank} of ${allScores.length} candidates (Percentile: ${percentile}%)\nRemarks: ${result.remarks || 'Consistent effort'}\nTarget Exam: ${student.targetExam}\nAccess full analytics on student portal.`;

    sendNotification({
      type: 'exam_result',
      channel: 'whatsapp',
      recipientName: student.parentName,
      recipientPhone: student.parentPhone,
      studentName: student.name,
      studentId: student.id,
      content: `Dispatched test result for ${exam.code}: Score ${score}/${exam.maxMarks} (Rank #${rank})`
    });

    openWhatsApp(student.parentPhone, message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900 print:m-0 print:border-none print:shadow-none print:w-full">
        {/* Modal Toolbar (Hidden on print) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Student Official Evaluation Card</h3>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono text-slate-500">{exam.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp Parent
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Evaluation Sheet */}
        <div className="p-8 print:p-6" id="printable-report-card">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <OrgLogo className="w-8 h-8 rounded-lg" fallbackClass="bg-blue-700 text-white font-bold text-sm" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                    {profile.name}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">{profile.tagline}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 max-w-sm">
                Academic Testing & Performance Division · {profile.address}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-700 text-white rounded">
                Test Scorecard
              </span>
              <p className="text-sm font-mono font-bold text-slate-900 mt-2">{exam.code}</p>
              <p className="text-xs text-slate-500 mt-0.5">Test Date: {exam.date}</p>
            </div>
          </div>

          {/* Student Dossier Strip */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 mb-6 text-xs">
            <div>
              <p><span className="text-slate-500">Student Name:</span> <strong className="text-slate-900">{student.name}</strong></p>
              <p className="mt-1"><span className="text-slate-500">Roll Number:</span> <span className="font-mono font-semibold">{student.rollNo}</span></p>
              <p className="mt-1"><span className="text-slate-500">Parent / Guardian:</span> <span>{student.parentName}</span></p>
            </div>
            <div>
              <p><span className="text-slate-500">Enrolled Batch:</span> <strong className="text-slate-900">{exam.batchName}</strong></p>
              <p className="mt-1"><span className="text-slate-500">Target Competitions:</span> <span>{student.targetExam}</span></p>
              <p className="mt-1"><span className="text-slate-500">Subject / Module:</span> <span>{exam.subject}</span></p>
            </div>
          </div>

          {/* Key Metrics Highlight Box */}
          <div className="grid grid-cols-4 gap-3 text-center mb-6">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
              <span className="text-[11px] font-semibold text-blue-700 uppercase block">Score Obtained</span>
              <span className="text-2xl font-bold font-mono text-blue-900 mt-1 block">
                {score} / {exam.maxMarks}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">{percentage}% Score</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">Batch Rank</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                #{rank} <span className="text-xs font-normal text-slate-500">/ {allScores.length}</span>
              </span>
              <span className="text-[11px] text-slate-500">Class Standing</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">Percentile</span>
              <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                {percentile}%
              </span>
              <span className="text-[11px] text-slate-500">Competitive Index</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">Highest Score</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {highestScore}
              </span>
              <span className="text-[11px] text-slate-500">Batch Avg: {avgScore}</span>
            </div>
          </div>

          {/* Syllabus Topics Tested */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white mb-6 text-xs">
            <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] block mb-2">
              Syllabus Coverage Evaluated
            </span>
            <div className="flex flex-wrap gap-2 text-slate-700">
              {exam.syllabusTopics.map((topic, i) => (
                <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs">
                  • {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Faculty Remarks */}
          <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200 mb-8 text-xs">
            <span className="font-semibold text-amber-900 uppercase tracking-wider text-[11px] block mb-1">
              Faculty Analysis & Mentor Advice:
            </span>
            <p className="text-amber-950 italic text-sm">
              "{result.remarks || 'Satisfactory attempt. Practice time-management drills for speed improvement.'}"
            </p>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs">
            <div className="space-y-3">
              <div className="w-36 border-b border-slate-400 pb-1" />
              <p className="font-semibold text-slate-900">Parent / Guardian Signature</p>
              <p className="text-slate-400">Date of Review: ________________</p>
            </div>

            <div className="text-right space-y-3">
              <div className="w-36 border-b border-slate-400 pb-1 mx-auto text-center font-serif italic text-slate-700">
                &nbsp;
              </div>
              <p className="font-semibold text-slate-900">Academic Director</p>
              <p className="text-slate-400">{profile.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
