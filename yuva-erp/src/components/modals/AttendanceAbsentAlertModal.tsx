import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { openWhatsApp, fillTemplate } from '../utils/helpers';
import { X, Send, MessageSquare, CheckCircle, ShieldAlert } from 'lucide-react';

interface AttendanceAbsentAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  batchId: string;
  absentStudents: Student[];
}

export const AttendanceAbsentAlertModal: React.FC<AttendanceAbsentAlertModalProps> = ({
  isOpen,
  onClose,
  date,
  batchId,
  absentStudents
}) => {
  const { batches, templates, sendNotification } = useInstitute();
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  if (!isOpen) return null;

  const batch = batches.find(b => b.id === batchId);
  const absentTemplate = templates.find(t => t.type === 'attendance_absent') || templates[0];

  const formatMessageForStudent = (student: Student) => {
    return fillTemplate(
      absentTemplate?.templateBody || 'Dear {{parent_name}}, {{student_name}} was absent on {{date}}.',
      {
        parent_name: student.parentName,
        student_name: student.name,
        roll_no: student.rollNo,
        batch_name: batch?.name || 'Class',
        date
      }
    );
  };

  const handleSendAll = () => {
    absentStudents.forEach(st => {
      const content = formatMessageForStudent(st);
      sendNotification({
        type: 'attendance_absent',
        channel: 'whatsapp',
        recipientName: st.parentName,
        recipientPhone: st.parentPhone,
        studentName: st.name,
        studentId: st.id,
        content,
        status: 'pending'
      });
    });
    setSentCount(absentStudents.length);
    setBroadcastSent(true);
  };

  const handleOpenIndividualWhatsApp = (student: Student) => {
    const content = formatMessageForStudent(student);
    sendNotification({
      type: 'attendance_absent',
      channel: 'whatsapp',
      recipientName: student.parentName,
      recipientPhone: student.parentPhone,
      studentName: student.name,
      studentId: student.id,
      content,
      status: 'sent'
    });
    openWhatsApp(student.parentPhone, content);
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
              <h2 className="text-lg font-semibold text-slate-900">
                Dispatch Absent Alerts to Parents
              </h2>
              <p className="text-xs text-slate-500">
                Batch: {batch?.name} · Date: {date} ({absentStudents.length} Absent Students)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {broadcastSent ? (
            <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-emerald-900">
                Alerts Dispatched Successfully!
              </h3>
              <p className="text-xs text-emerald-700 max-w-md mx-auto">
                {sentCount} alerts were added to the message queue. Open Parent Broadcasts, then Message History, and press Send now on each one (or use the WhatsApp button next to a student to send it right away).
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 block mb-1">Standard Institute Alert Template:</span>
                <p className="italic bg-white p-2.5 rounded border border-slate-200 text-slate-700">
                  "{absentTemplate?.templateBody}"
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Absent Students to Notify ({absentStudents.length})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-60 overflow-y-auto bg-white">
                  {absentStudents.map(student => (
                    <div key={student.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{student.name}</span>
                          <span className="text-[11px] font-mono text-slate-500">({student.rollNo})</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Parent: {student.parentName} · Phone: {student.parentPhone}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenIndividualWhatsApp(student)}
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
                <span className="text-xs text-slate-500">
                  Sends automated notifications to all {absentStudents.length} parents
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendAll}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Broadcast All Alerts Now
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
