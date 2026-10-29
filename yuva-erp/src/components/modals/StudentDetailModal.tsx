import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import { Student } from '../../types';
import { X, MessageSquare, CreditCard, Printer, IdCard, UserPlus, CalendarX, Award, Bell, Ban } from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { PrintableIdCardModal } from './PrintableIdCardModal';
import { StudentLoginCard } from './StudentLoginCard';

interface StudentDetailModalProps {
  student: Student | null;
  onClose: () => void;
  onCollectPayment: (studentId: string) => void;
  onViewReceipt: (transactionId: string) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onCollectPayment,
  onViewReceipt
}) => {
  useEscape(onClose);
  const { 
    batches, 
    courses, 
    transactions, 
    exams, 
    attendance,
    notificationLogs,
    getStudentAttendanceStats, 
    profile, 
    sendNotification 
  } = useInstitute();

  const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'attendance' | 'exams' | 'timeline'>('overview');
  const [showIdCard, setShowIdCard] = useState(false);

  if (!student) return null;

  const batch = batches.find(b => b.id === student.batchId);
  const course = courses.find(c => c.id === student.courseId);
  const studentTxs = transactions.filter(t => t.studentId === student.id);
  const attStats = getStudentAttendanceStats(student.id);

  // Everything that happened with this student, newest first
  type TimelineEvent = { date: string; icon: React.ReactNode; title: string; detail?: string; tone: string };
  const timeline: TimelineEvent[] = [
    {
      date: student.dateOfAdmission,
      icon: <UserPlus className="w-3.5 h-3.5" />,
      title: 'Admitted',
      detail: `Roll no. ${student.rollNo}${batch ? ` · ${batch.name}` : ''}`,
      tone: 'bg-blue-100 text-blue-700'
    },
    ...studentTxs.map(t => ({
      date: t.date,
      icon: t.status === 'cancelled' ? <Ban className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />,
      title: t.status === 'cancelled' ? `Receipt ${t.receiptNo} cancelled` : `Paid ${profile.currencySymbol}${t.amount.toLocaleString('en-IN')}`,
      detail: `${t.receiptNo} · ${t.paymentMethod}${t.status === 'cancelled' && t.cancelReason ? ` · ${t.cancelReason}` : ''}`,
      tone: t.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
    })),
    ...attendance.flatMap(a => {
      const status = a.records[student.id];
      return status === 'absent' || status === 'late'
        ? [{ date: a.date, icon: <CalendarX className="w-3.5 h-3.5" />, title: status === 'absent' ? 'Absent' : 'Late', detail: undefined, tone: status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800' }]
        : [];
    }),
    ...exams.flatMap(e => {
      const r = e.results[student.id];
      return r
        ? [
            {
              date: e.date,
              icon: <Award className="w-3.5 h-3.5" />,
              title: e.title,
              detail: r.absent ? 'Absent' : `${r.marksObtained} / ${e.maxMarks} marks`,
              tone: 'bg-violet-100 text-violet-700'
            }
          ]
        : [];
    }),
    ...notificationLogs
      .filter(l => l.studentId === student.id)
      .map(l => ({
        date: (l.timestamp || '').slice(0, 10),
        icon: <Bell className="w-3.5 h-3.5" />,
        title: `Message to parent (${l.type.replace(/_/g, ' ')})`,
        detail: l.status === 'pending' ? 'Waiting to be sent' : 'Sent',
        tone: 'bg-slate-100 text-slate-700'
      }))
  ]
    .filter(e => !!e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const netPayable = Math.max(0, student.totalFees - student.discount);
  const outstanding = Math.max(0, netPayable - student.feePaid);

  // Student exam results
  const studentExams = exams
    .filter(e => e.results[student.id])
    .map(e => ({
      exam: e,
      result: e.results[student.id],
      percentage: Math.round((e.results[student.id].marksObtained / e.maxMarks) * 100)
    }));

  const handleOpenWhatsApp = () => {
    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, '');
    const message = `Namaste ${student.parentName} ji, updating you regarding ${student.name} (${student.rollNo}) at ${profile.name}. Current Attendance: ${attStats.percentage}%, Outstanding Fee Balance: ${profile.currencySymbol}${outstanding.toLocaleString()}. Please let us know if you have any questions.`;
    
    sendNotification({
      type: 'general_announcement',
      channel: 'whatsapp',
      recipientName: student.parentName,
      recipientPhone: student.parentPhone,
      studentName: student.name,
      content: `Direct WhatsApp inquiry sent regarding academic progress`
    });

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handlePrintDossier = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <img
              src={student.photoUrl}
              alt={student.name}
              className="w-12 h-12 rounded-full object-cover border border-slate-300"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{student.name}</h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                  {student.rollNo}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  student.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {student.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.grade} · {batch?.name || 'Batch'} · Target: {student.targetExam}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp Parent
            </button>
            <button
              onClick={() => setShowIdCard(true)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Print ID Card"
            >
              <IdCard className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrintDossier}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors print:hidden"
              title="Print Dossier"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex gap-4 text-xs font-medium text-slate-600 bg-white">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            Student Dossier
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'fees' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Fee Ledger</span>
            {outstanding > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'attendance' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            Attendance ({attStats.percentage}%)
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'exams' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            Test Performance ({studentExams.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'timeline' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            Timeline
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* The student's own login (the principal makes it) */}
              <StudentLoginCard key={student.id} student={student} />
              <StudentLoginCard key={`${student.id}-parent`} student={student} parent />

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500 block">Attendance Rate</span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block">
                    {attStats.percentage}%
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {attStats.present} present of {attStats.total} marked lectures
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500 block">Fee Balance</span>
                  <span className={`text-xl font-bold mt-1 block ${outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {profile.currencySymbol}{outstanding.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {profile.currencySymbol}{student.feePaid.toLocaleString()} paid of {profile.currencySymbol}{netPayable.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500 block">Exams Attempted</span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block">
                    {studentExams.length} Tests
                  </span>
                  <span className="text-[11px] text-slate-500">
                    All-India & Minor Series
                  </span>
                </div>
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Academic Profile */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                    Academic Enrollment
                  </h3>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Course / Program:</span>
                    <span className="font-medium text-slate-800 text-right">{course?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Assigned Batch:</span>
                    <span className="font-medium text-slate-800 text-right">{batch?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Classroom:</span>
                    <span className="text-slate-700">{batch?.classroom}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Timing:</span>
                    <span className="text-slate-700">{batch?.startTime} - {batch?.endTime}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Admission Date:</span>
                    <span className="text-slate-700">{student.dateOfAdmission}</span>
                  </div>
                </div>

                {/* Guardian / Contact Profile */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                    Guardian & Contact
                  </h3>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Parent / Guardian:</span>
                    <span className="font-medium text-slate-800">{student.parentName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Parent Mobile:</span>
                    <span className="font-mono text-slate-800">{student.parentPhone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Student Mobile:</span>
                    <span className="font-mono text-slate-800">{student.phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Student Email:</span>
                    <span className="text-slate-700">{student.email}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Address:</span>
                    <span className="text-slate-700 text-right">{student.address}</span>
                  </div>
                </div>
              </div>

              {student.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                  <span className="font-semibold text-amber-900 block mb-0.5">Faculty / Counselor Notes:</span>
                  <p className="text-amber-800">{student.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500">Current Outstanding Balance</span>
                  <p className={`text-2xl font-bold font-mono ${outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {profile.currencySymbol}{outstanding.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total: {profile.currencySymbol}{netPayable.toLocaleString()} · Paid: {profile.currencySymbol}{student.feePaid.toLocaleString()}
                  </p>
                </div>

                {outstanding > 0 && (
                  <button
                    onClick={() => onCollectPayment(student.id)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    Collect Payment Now
                  </button>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Payment History & Receipts ({studentTxs.length})
                </h4>
                {studentTxs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No transactions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                    {studentTxs.map(tx => (
                      <div key={tx.id} className={`p-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${tx.status === 'cancelled' ? 'opacity-60' : ''}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-semibold text-slate-900 ${tx.status === 'cancelled' ? 'line-through' : ''}`}>{tx.receiptNo}</span>
                            {tx.status === 'cancelled' && (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700" title={tx.cancelReason}>Cancelled</span>
                            )}
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 font-medium">{tx.paymentMethod}</span>
                            {tx.referenceNo && (
                              <span className="text-[11px] text-slate-400">({tx.referenceNo})</span>
                            )}
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Installment #{tx.installmentNo} · Date: {tx.date}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`font-mono font-bold text-slate-900 ${tx.status === 'cancelled' ? 'line-through' : ''}`}>
                            {profile.currencySymbol}{tx.amount.toLocaleString()}
                          </span>
                          <button
                            onClick={() => onViewReceipt(tx.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                          >
                            View Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 block font-semibold text-lg">{attStats.present}</span>
                  <span className="text-emerald-600">Present</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-rose-800 block font-semibold text-lg">{attStats.absent}</span>
                  <span className="text-rose-600">Absent</span>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-800 block font-semibold text-lg">{attStats.late}</span>
                  <span className="text-amber-600">Late Marked</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-800 block font-semibold text-lg">{attStats.percentage}%</span>
                  <span className="text-slate-500">Overall Rate</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
                <p className="text-slate-600 leading-relaxed">
                  The student has maintained a <strong className="text-slate-900">{attStats.percentage}%</strong> attendance record across academic lectures.
                  Parents receive automated WhatsApp and SMS alerts for any unexcused absences.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Everything about {student.name}, newest first</h4>
              <ol className="relative border-l border-slate-200 ml-3 space-y-4">
                {timeline.map((e, i) => (
                  <li key={i} className="ml-5">
                    <span className={`absolute -left-3.5 w-7 h-7 rounded-full flex items-center justify-center ${e.tone}`}>{e.icon}</span>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-900">{e.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{formatDate(e.date)}</span>
                    </div>
                    {e.detail && <p className="text-[11px] text-slate-500 mt-0.5">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Mock Tests & Assessment Results
              </h4>
              {studentExams.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No graded tests recorded for this student yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {studentExams.map(({ exam, result, percentage }) => (
                    <div key={exam.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[11px] font-mono text-blue-600 uppercase font-semibold">{exam.code}</span>
                          <h5 className="text-sm font-semibold text-slate-900">{exam.title}</h5>
                          <span className="text-xs text-slate-500">Date: {exam.date} · Subject: {exam.subject}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold font-mono text-slate-900">
                            {result.marksObtained} / {exam.maxMarks}
                          </span>
                          <span className={`block text-xs font-semibold ${percentage >= 70 ? 'text-emerald-600' : percentage >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {percentage}% Score
                          </span>
                        </div>
                      </div>

                      {result.remarks && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-md italic">
                          Faculty Remark: "{result.remarks}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showIdCard && <PrintableIdCardModal student={student} onClose={() => setShowIdCard(false)} />}
    </div>
  );
};
