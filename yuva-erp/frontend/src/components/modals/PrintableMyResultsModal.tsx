import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam, Student } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { formatDate } from '../utils/helpers';
import { Printer, Award } from 'lucide-react';

export interface ResultRow {
  exam: Exam;
  result: { marksObtained: number; remarks?: string; rank?: number; totalGraded?: number; average?: number };
  percent: number;
}

// A student prints the own published results (the rank and the average come from the server, never the classmates' marks)
export const PrintableMyResultsModal: React.FC<{ student: Student; batchName: string; rows: ResultRow[]; onClose: () => void }> = ({
  student,
  batchName,
  rows,
  onClose
}) => {
  const { profile } = useInstitute();
  const total = rows.reduce((n, r) => n + r.result.marksObtained, 0);
  const max = rows.reduce((n, r) => n + r.exam.maxMarks, 0);

  return (
    <ModalShell title="My Results" subtitle={student.name} icon={Award} iconClass="bg-amber-500" width="lg" onClose={onClose}>
      <div className="px-6 py-3 border-b border-slate-100 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>
      <div id="printable-sheet" className="p-6 text-slate-900 bg-white">
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <h3 className="text-lg font-bold uppercase tracking-tight">{profile.name}</h3>
          <p className="text-[11px] text-slate-500">
            {profile.address} · {profile.phone}
          </p>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs mb-4">
          <div>
            <div className="text-slate-500">Student</div>
            <div className="font-bold text-sm">{student.name}</div>
          </div>
          <div>
            <div className="text-slate-500">Roll no.</div>
            <div className="font-mono font-bold text-sm">{student.rollNo}</div>
          </div>
          <div>
            <div className="text-slate-500">Batch</div>
            <div className="font-semibold">{batchName}</div>
          </div>
          <div>
            <div className="text-slate-500">Printed on</div>
            <div className="font-semibold">{formatDate(new Date().toISOString().slice(0, 10))}</div>
          </div>
        </div>
        <table className="w-full text-xs text-left border border-slate-300">
          <thead className="bg-slate-100 uppercase font-semibold">
            <tr>
              <th className="p-2 border-b border-slate-300">Test</th>
              <th className="p-2 border-b border-slate-300">Date</th>
              <th className="p-2 border-b border-slate-300 text-right">Marks</th>
              <th className="p-2 border-b border-slate-300 text-right">%</th>
              <th className="p-2 border-b border-slate-300 text-right">Rank</th>
              <th className="p-2 border-b border-slate-300">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ exam, result, percent }) => (
              <tr key={exam.id} className="border-b border-slate-200">
                <td className="p-2 font-semibold">{exam.title}</td>
                <td className="p-2">{formatDate(exam.date)}</td>
                <td className="p-2 text-right font-mono">
                  {result.marksObtained} / {exam.maxMarks}
                </td>
                <td className="p-2 text-right font-mono">{percent}%</td>
                <td className="p-2 text-right font-mono">{result.rank ? `#${result.rank} of ${result.totalGraded}` : '-'}</td>
                <td className="p-2">{result.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-bold bg-slate-50">
                <td className="p-2" colSpan={2}>
                  Total
                </td>
                <td className="p-2 text-right font-mono">
                  {total} / {max}
                </td>
                <td className="p-2 text-right font-mono">{max > 0 ? Math.round((total / max) * 100) : 0}%</td>
                <td className="p-2" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No published results yet.</p>}
        <div className="mt-8 flex justify-end text-[11px] text-slate-600">
          <span className="border-t border-slate-500 pt-1 px-6">{profile.signatoryTitle}</span>
        </div>
      </div>
    </ModalShell>
  );
};
