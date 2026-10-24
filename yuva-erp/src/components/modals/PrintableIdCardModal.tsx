import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Printer, IdCard } from 'lucide-react';

interface PrintableIdCardModalProps {
  student: Student;
  onClose: () => void;
}

// A student identity card (credit-card size) ready to print
export const PrintableIdCardModal: React.FC<PrintableIdCardModalProps> = ({ student, onClose }) => {
  const { profile, batches } = useInstitute();
  const batch = batches.find(b => b.id === student.batchId);

  return (
    <ModalShell title="Student ID Card" subtitle={student.name} icon={IdCard} iconClass="bg-indigo-600" width="sm" onClose={onClose}>
      <div className="p-6 flex flex-col items-center gap-4">
        <div id="printable-sheet" className="w-80 border-2 border-slate-800 rounded-xl overflow-hidden bg-white text-slate-900">
          <div className="bg-blue-700 text-white px-4 py-2.5 text-center">
            <div className="text-sm font-bold uppercase tracking-tight">{profile.name}</div>
            <div className="text-[10px] opacity-80">{profile.tagline}</div>
          </div>
          <div className="p-4 flex gap-3">
            <img src={student.photoUrl} alt="" className="w-20 h-24 object-cover border border-slate-300 rounded" />
            <dl className="text-xs space-y-1 min-w-0">
              <div className="font-bold text-sm leading-tight">{student.name}</div>
              <div><span className="text-slate-500">Roll No: </span><span className="font-mono font-bold">{student.rollNo}</span></div>
              <div className="truncate"><span className="text-slate-500">Batch: </span>{batch?.name || '-'}</div>
              <div><span className="text-slate-500">Class: </span>{student.grade}</div>
              <div><span className="text-slate-500">Parent: </span>{student.parentName}</div>
              <div><span className="text-slate-500">Phone: </span>{student.parentPhone}</div>
            </dl>
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 flex justify-between">
            <span>Session {profile.academicYear}</span>
            <span>{profile.phone}</span>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 print:hidden"
        >
          <Printer className="w-4 h-4" />
          Print ID Card
        </button>
      </div>
    </ModalShell>
  );
};
