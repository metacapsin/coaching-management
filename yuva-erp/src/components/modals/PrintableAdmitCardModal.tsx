import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { formatDate, plural } from '../utils/helpers';
import { Printer, Ticket } from 'lucide-react';

interface PrintableAdmitCardModalProps {
  exam: Exam;
  onClose: () => void;
}

// Admit cards for every student of the exam's batch (two on a page)
export const PrintableAdmitCardModal: React.FC<PrintableAdmitCardModalProps> = ({ exam, onClose }) => {
  const { profile, students, batches } = useInstitute();
  const batch = batches.find(b => b.id === exam.batchId);
  const list = students.filter(s => s.batchId === exam.batchId && s.status !== 'inactive');

  return (
    <ModalShell
      title="Admit Cards"
      subtitle={`${exam.title} · ${plural(list.length, 'student')}`}
      icon={Ticket}
      iconClass="bg-violet-600"
      width="xl"
      onClose={onClose}
    >
      <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center print:hidden">
        <span className="text-xs text-slate-500">Print all cards, or save them as PDF from the print window.</span>
        <button
          onClick={() => window.print()}
          disabled={list.length === 0}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      <div id="printable-sheet" className="p-6 space-y-5 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-4">
        {list.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No students in this batch.</p>}
        {list.map((s, i) => (
          <div
            key={s.id}
            className={`border-2 border-slate-800 rounded-lg p-5 bg-white text-slate-900 ${i % 2 === 1 ? 'print-page-break' : ''}`}
            style={{ breakInside: 'avoid' }}
          >
            <div className="flex items-start justify-between border-b border-slate-300 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase tracking-tight">{profile.name}</h3>
                <p className="text-[11px] text-slate-500">{profile.address}</p>
              </div>
              <span className="text-xs font-bold uppercase border border-slate-800 px-2 py-1 rounded">Admit Card</span>
            </div>
            <div className="flex gap-4 mt-3">
              <img src={s.photoUrl} alt="" className="w-20 h-24 object-cover border border-slate-300 rounded" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs flex-1">
                <div><dt className="text-slate-500">Student</dt><dd className="font-bold">{s.name}</dd></div>
                <div><dt className="text-slate-500">Roll No.</dt><dd className="font-mono font-bold">{s.rollNo}</dd></div>
                <div><dt className="text-slate-500">Exam</dt><dd className="font-semibold">{exam.title}</dd></div>
                <div><dt className="text-slate-500">Subject</dt><dd className="font-semibold">{exam.subject}</dd></div>
                <div><dt className="text-slate-500">Date</dt><dd className="font-semibold">{formatDate(exam.date)}</dd></div>
                <div><dt className="text-slate-500">Max / Pass marks</dt><dd className="font-semibold">{exam.maxMarks} / {exam.passMarks}</dd></div>
                <div><dt className="text-slate-500">Batch</dt><dd className="font-semibold">{exam.batchName}</dd></div>
                <div><dt className="text-slate-500">Room</dt><dd className="font-semibold">{batch?.classroom || '-'}</dd></div>
              </dl>
            </div>
            <ul className="mt-3 text-[10px] text-slate-500 list-disc pl-4 space-y-0.5">
              <li>Bring this card to the examination room.</li>
              <li>Mobile phones and notes are not allowed in the hall.</li>
            </ul>
            <div className="mt-6 flex justify-between text-[11px] text-slate-600">
              <span className="border-t border-slate-500 pt-1 px-4">Signature of student</span>
              <span className="border-t border-slate-500 pt-1 px-4">{profile.signatoryTitle}</span>
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};
