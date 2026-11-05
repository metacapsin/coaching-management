import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { openWhatsApp, fillTemplate } from '../utils/helpers';
import { lateNotice } from '../utils/parentNotices';
import { X, Send, MessageSquare, CheckCircle, ShieldAlert } from 'lucide-react';

interface AttendanceAbsentAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  batchId: string;
  absentStudents: Student[];
  lateStudents?: Student[]; // joined late: the parent is told too, so it is confirmed
}

// The attendance alerts to the parents: who is absent, and who joined late. Only the principal and the class teacher of the batch
// get this window (the server checks it too). The parent gets it in the bell of the parent login and on WhatsApp (Parent Broadcasts).
export const AttendanceAbsentAlertModal: React.FC<AttendanceAbsentAlertModalProps> = ({
  isOpen,
  onClose,
  date,
  batchId,
  absentStudents,
  lateStudents = []
}) => {
  useEscape(onClose);
  const { batches, templates, sendNotification, profile } = useInstitute();
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  if (!isOpen) return null;

  const batch = batches.find(b => b.id === batchId);
  const absentTemplate = templates.find(t => t.type === 'attendance_absent') || templates[0];

  type Entry = { student: Student; kind: 'absent' | 'late' };
  const entries: Entry[] = [
    ...absentStudents.map(student => ({ student, kind: 'absent' as const })),
    ...lateStudents.map(student => ({ student, kind: 'late' as const }))
  ];

  const batchNameOf = (student: Student) => batches.find(b => b.id === student.batchId)?.name || batch?.name || 'Class';

  const messageFor = ({ student, kind }: Entry) =>
    kind === 'late'
      ? lateNotice({ parentName: student.parentName, studentName: student.name, coaching: profile.name }, batchNameOf(student), date)
      : fillTemplate(absentTemplate?.templateBody || 'Dear {{parent_name}}, {{student_name}} was absent on {{date}}.', {
          parent_name: student.parentName,
          student_name: student.name,
          roll_no: student.rollNo,
          batch_name: batchNameOf(student),
          date
        });

  const log = (entry: Entry, status: 'pending' | 'sent') =>
    sendNotification({
      type: entry.kind === 'late' ? 'attendance_late' : 'attendance_absent',
      channel: 'whatsapp',
      recipientName: entry.student.parentName,
      recipientPhone: entry.student.parentPhone,
      studentName: entry.student.name,
      studentId: entry.student.id,
      content: messageFor(entry),
      status
    });

  const handleSendAll = () => {
    entries.forEach(entry => log(entry, 'pending'));
    setSentCount(entries.length);
    setBroadcastSent(true);
  };

  const handleOpenIndividualWhatsApp = (entry: Entry) => {
    log(entry, 'sent');
    openWhatsApp(entry.student.parentPhone, messageFor(entry));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-600 text-white">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tell the Parents: Absent and Late Students</h2>
              <p className="text-xs text-slate-500">
                Batch: {batch?.name ?? 'All batches'} · Date: {date} ({absentStudents.length} absent, {lateStudents.length} late)
              </p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {broadcastSent ? (
            <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-emerald-900">The parents were told</h3>
              <p className="text-xs text-emerald-700 max-w-md mx-auto">
                {sentCount} message{sentCount === 1 ? '' : 's'} sent: they are in the bell and on the Notice Board of the parent login. To send them on WhatsApp too, open Parent Broadcasts, Audit Logs, and press Send now on each one (or use the WhatsApp button next to a student to send it right away).
              </p>
              <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 block mb-1">What the parents are told:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  <li>Absent: the standard absent alert of the institute.</li>
                  <li>Late: "your child joined the class late today", so the parent confirms the reason.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Students to tell about ({entries.length})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-60 overflow-y-auto bg-white">
                  {entries.map(entry => (
                    <div key={`${entry.kind}-${entry.student.id}`} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{entry.student.name}</span>
                          <span className="text-[11px] font-mono text-slate-500">({entry.student.rollNo})</span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              entry.kind === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {entry.kind === 'late' ? 'Late' : 'Absent'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Parent: {entry.student.parentName} · Phone: {entry.student.parentPhone}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenIndividualWhatsApp(entry)}
                        className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">Sends the message to the {entries.length} parent{entries.length === 1 ? '' : 's'}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendAll}
                    disabled={entries.length === 0}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Tell All Parents Now
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
