import React, { useState, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { Pager } from '../ui/Pager';
import { usePaged } from '../utils/usePaged';
import { EditStudentModal } from '../modals/EditstudentModal';
import type { Student } from '../../types';
import { csvCell, downloadTextFile, fillTemplate, formatDate, openWhatsApp, payPageLink, plural, toLocalISODate, withPayLink } from '../utils/helpers';
import { emailFeeNotice } from '../utils/api';
import {
  Users,
  UserPlus,
  Search,
  Download,
  Bell,
  MessageSquare,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface AdmissionsViewProps {
  onOpenAdmission: () => void;
  onSelectStudent: (studentId: string) => void;
}

type StatusFilter = 'current' | 'pending' | 'archived' | 'all';

export const AdmissionsView: React.FC<AdmissionsViewProps> = ({
  onOpenAdmission,
  onSelectStudent
}) => {
  const {
    students,
    batches,
    transactions,
    attendance,
    exams,
    updateStudent,
    deleteStudent,
    profile,
    templates,
    sendNotification
  } = useInstitute();
  const { isAdmin, users, removeUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [feeFilter, setFeeFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current');

  const [editing, setEditing] = useState<Student | null>(null);
  const [confirmMode, setConfirmMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // (pages are made below, after the list is filtered)
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        st.name.toLowerCase().includes(q) ||
        st.rollNo.toLowerCase().includes(q) ||
        st.parentName.toLowerCase().includes(q) ||
        st.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000') ||
        st.parentPhone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000') ||
        st.targetExam.toLowerCase().includes(q);

      const matchesBatch = selectedBatch === 'all' || st.batchId === selectedBatch;

      const netPayable = Math.max(0, st.totalFees - st.discount);
      const isDue = netPayable - st.feePaid > 0;
      const matchesFee = feeFilter === 'all' || (feeFilter === 'due' ? isDue : !isDue);

      const archived = st.status === 'inactive';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'archived'
          ? archived
          : statusFilter === 'pending'
          ? st.status === 'trial'
          : !archived);

      return matchesSearch && matchesBatch && matchesFee && matchesStatus;
    });
  }, [students, searchQuery, selectedBatch, feeFilter, statusFilter]);
  const paged = usePaged(filteredStudents, 20, `${searchQuery}|${selectedBatch}|${feeFilter}|${statusFilter}`);

  const archivedCount = students.filter(s => s.status === 'inactive').length;
  // New registrations that wait for the principal to confirm the admission and set the fee
  const pendingCount = students.filter(s => s.status === 'trial').length;

  const handleExportCSV = () => {
    const headers = [
      'Roll No',
      'Name',
      'Grade',
      'Status',
      'Target Exam',
      'Batch',
      'Parent Name',
      'Parent Phone',
      'Total Fees',
      'Discount',
      'Paid',
      'Balance Due'
    ];
    const rows = filteredStudents.map(s => {
      const b = batches.find(item => item.id === s.batchId);
      const net = Math.max(0, s.totalFees - s.discount);
      const bal = Math.max(0, net - s.feePaid);
      return [
        csvCell(s.rollNo),
        csvCell(s.name),
        csvCell(s.grade),
        csvCell(s.status === 'inactive' ? 'Archived' : s.status),
        csvCell(s.targetExam),
        csvCell(b?.name || ''),
        csvCell(s.parentName),
        csvCell(s.parentPhone),
        s.totalFees,
        s.discount,
        s.feePaid,
        bal
      ].join(',');
    });

    // BOM so Excel reads Hindi / accented names correctly
    downloadTextFile(
      `student_directory_${toLocalISODate()}.csv`,
      '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\n')
    );
  };

  const handleWhatsAppParent = (e: React.MouseEvent, s: Student) => {
    e.stopPropagation();
    const net = Math.max(0, s.totalFees - s.discount);
    const bal = Math.max(0, net - s.feePaid);
    const message = `Hello ${s.parentName} ji, greeting from ${profile.name}. Reaching out regarding ${s.name} (${s.rollNo}). Current dues: ${profile.currencySymbol}${bal.toLocaleString('en-IN')}.`;

    sendNotification({
      type: 'general_announcement',
      channel: 'whatsapp',
      recipientName: s.parentName,
      recipientPhone: s.parentPhone,
      studentName: s.name,
      studentId: s.id,
      content: message
    });

    openWhatsApp(s.parentPhone, message);
  };

  // "Send notice": tells the parent that the fee of the child is not fully paid (the amount, and the date if one is set).
  // The fee is collected on the Fees page; here the office only sends the notice. It opens ready in WhatsApp and is kept in
  // Parent Broadcasts.
  const handleFeeNotice = (e: React.MouseEvent, s: Student) => {
    e.stopPropagation();
    if (!s.parentPhone) {
      showNotice('error', `There is no parent number for ${s.name}. Add it in Edit first.`);
      return;
    }
    const net = Math.max(0, s.totalFees - s.discount);
    const bal = Math.max(0, net - s.feePaid);
    const template = templates.find(t => t.type === 'fee_due');
    const payLink = payPageLink(profile, s.name, bal);
    const base = template
      ? fillTemplate(template.templateBody, {
          parent_name: s.parentName,
          student_name: s.name,
          currency: profile.currencySymbol,
          due_amount: bal.toLocaleString('en-IN'),
          due_date: s.nextDueDate ? formatDate(s.nextDueDate) : 'at the earliest',
          batch_name: batches.find(b => b.id === s.batchId)?.name || 'Class'
        })
      : `Hello ${s.parentName} ji, the fee of ${s.name} (${s.rollNo}) at ${profile.name} is not fully paid. Pending: ${profile.currencySymbol}${bal.toLocaleString('en-IN')}. Please pay it at the earliest.`;
    const message = withPayLink(base, payLink);

    sendNotification({
      type: 'fee_due',
      channel: 'whatsapp',
      recipientName: s.parentName,
      recipientPhone: s.parentPhone,
      studentName: s.name,
      studentId: s.id,
      content: message
    });
    openWhatsApp(s.parentPhone, message);
    const payNote = payLink ? ' It has a Pay now link.' : ' Write the UPI id in Institute Profile to add a Pay now link.';
    showNotice('success', `Fee notice for ${s.name} is ready in WhatsApp (pending ${profile.currencySymbol}${bal.toLocaleString('en-IN')}). Press Send there.${payNote}`);
    // the parent who has an email also gets the notice by email, with the same Pay now button
    if (s.parentEmail) {
      emailFeeNotice(s.id)
        .then(r => {
          if (r.notified === 'sent') showNotice('success', `Fee notice for ${s.name} was also emailed to ${s.parentEmail}.${payNote}`);
        })
        .catch(() => undefined);
    }
  };

  // Archive hides a student from attendance rolls but keeps every record
  const handleToggleArchive = (e: React.MouseEvent, s: Student) => {
    e.stopPropagation();
    const archive = s.status !== 'inactive';
    updateStudent(s.id, { status: archive ? 'inactive' : 'active' });
    showNotice('success', archive ? `${s.name} was archived.` : `${s.name} was restored.`);
  };

  const openDelete = (e: React.MouseEvent, s: Student) => {
    e.stopPropagation();
    setConfirmed(false);
    setDeleteTarget(s);
  };

  // What a permanent delete will touch
  const impact = useMemo(() => {
    if (!deleteTarget) return null;
    const receipts = transactions.filter(t => t.studentId === deleteTarget.id);
    return {
      receiptCount: receipts.length,
      receiptTotal: receipts.reduce((acc, t) => acc + t.amount, 0),
      attendanceDays: attendance.filter(a => a.records[deleteTarget.id]).length,
      testResults: exams.filter(e => e.results[deleteTarget.id]).length,
      account: users.find(u => u.studentId === deleteTarget.id)
    };
  }, [deleteTarget, transactions, attendance, exams, users]);

  const handleDelete = () => {
    if (!deleteTarget || !impact) return;
    const name = deleteTarget.name;
    deleteStudent(deleteTarget.id);
    if (impact.account) void removeUser(impact.account.id);
    setDeleteTarget(null);
    showNotice('success', `${name} was permanently deleted.`);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Student Directory & Admissions</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage student registrations, academic enrollment dossiers, batch assignments, and fee status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={onOpenAdmission}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Enroll New Student
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>{pendingCount}</strong> new {pendingCount === 1 ? 'registration is' : 'registrations are'} waiting
            for confirmation. Check the details, set the fee and make the student Active.
          </span>
          <button
            onClick={() => setStatusFilter('pending')}
            className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
          >
            Review now
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll number, parent mobile, target exam..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedBatch}
            onChange={e => setSelectedBatch(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Batches ({batches.length})</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="current">Current students</option>
            <option value="pending">Awaiting confirmation ({pendingCount})</option>
            <option value="archived">Archived ({archivedCount})</option>
            <option value="all">All students</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'all', label: 'All', style: 'text-slate-900' },
                { id: 'due', label: 'Dues Pending', style: 'text-rose-700' },
                { id: 'paid', label: 'Clear', style: 'text-emerald-700' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                onClick={() => setFeeFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  feeFilter === f.id ? `bg-white ${f.style} shadow-xs font-semibold` : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 whitespace-nowrap">
            Showing <strong>{filteredStudents.length}</strong> of {plural(students.length, 'student')}
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No students found</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing search filters or add a new admission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Roll No & Student</th>
                  <th className="p-3.5">Enrolled Batch & Target</th>
                  <th className="p-3.5">Parent / Contact</th>
                  <th className="p-3.5 text-right">Fee Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.items.map(student => {
                  const batch = batches.find(b => b.id === student.batchId);
                  const net = Math.max(0, student.totalFees - student.discount);
                  const balance = Math.max(0, net - student.feePaid);
                  const archived = student.status === 'inactive';

                  return (
                    <tr
                      key={student.id}
                      onClick={() => onSelectStudent(student.id)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer group ${
                        archived ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.photoUrl}
                            alt={student.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                              {student.name}
                              {archived && (
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                                  Archived
                                </span>
                              )}
                              {student.status === 'trial' && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  Awaiting confirmation
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono">{student.rollNo}</span>
                              <span className="mx-1 text-slate-300">·</span>
                              <span>{student.grade}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-medium text-slate-900">{batch?.name || 'Assigned Batch'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>Target: {student.targetExam}</span>
                          <span className="mx-1 text-slate-300">·</span>
                          <span>Adm: {student.dateOfAdmission}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="text-slate-800 font-medium">{student.parentName}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{student.parentPhone}</div>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className={`font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {balance > 0
                            ? `Due: ${profile.currencySymbol}${balance.toLocaleString('en-IN')}`
                            : 'Fully Paid'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Paid: {profile.currencySymbol}
                          {student.feePaid.toLocaleString('en-IN')} / {profile.currencySymbol}
                          {net.toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="p-3.5 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5 flex-wrap"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={e => handleWhatsAppParent(e, student)}
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="WhatsApp Parent"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {balance > 0 && !archived && (
                            <button
                              onClick={e => handleFeeNotice(e, student)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors flex items-center gap-1"
                              title="Tell the parent that the fee is not fully paid"
                            >
                              <Bell className="w-3 h-3" />
                              Send notice
                            </button>
                          )}
                          {student.status === 'trial' && (
                            <button
                              onClick={() => {
                                setConfirmMode(true);
                                setEditing(student);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
                            >
                              Confirm
                            </button>
                          )}
                          <button
                            onClick={() => onSelectStudent(student.id)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            Dossier
                          </button>
                          <button
                            onClick={() => {
                              setConfirmMode(false);
                              setEditing(student);
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1"
                            title="Edit student"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={e => handleToggleArchive(e, student)}
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                            title={archived ? 'Restore student' : 'Archive student'}
                          >
                            {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>
                          {isAdmin && (
                            <button
                              onClick={e => openDelete(e, student)}
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager {...paged} onPage={paged.setPage} />
      </div>

      {/* Edit modal */}
      {editing && (
        <EditStudentModal
          student={editing}
          confirmMode={confirmMode}
          onClose={() => setEditing(null)}
          onSaved={name => showNotice('success', `${name}'s details were updated.`)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && impact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-rose-50/60">
              <div className="flex items-start gap-3">
                <span className="p-1.5 rounded-lg bg-rose-600 text-white mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Delete student permanently?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deleteTarget.name} · <span className="font-mono">{deleteTarget.rollNo}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <ul className="space-y-1.5 text-slate-700">
                <li>
                  • The student profile and photo will be removed.
                </li>
                <li>
                  • <strong>{impact.attendanceDays}</strong> attendance {impact.attendanceDays === 1 ? 'entry' : 'entries'} and{' '}
                  <strong>{impact.testResults}</strong> test {impact.testResults === 1 ? 'result' : 'results'} will be removed.
                </li>
                <li>
                  • <strong>{impact.receiptCount}</strong> fee {impact.receiptCount === 1 ? 'receipt' : 'receipts'} (
                  {profile.currencySymbol}
                  {impact.receiptTotal.toLocaleString('en-IN')}) stay in the fee ledger for your accounts.
                </li>
                {impact.account && (
                  <li>
                    • Their student login (<span className="font-mono">{impact.account.email}</span>) will be removed.
                  </li>
                )}
              </ul>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                Not sure? <strong>Archive</strong> keeps everything and only hides the student from attendance rolls.
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-slate-700">I understand this cannot be undone.</span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateStudent(deleteTarget.id, { status: 'inactive' });
                    showNotice('success', `${deleteTarget.name} was archived.`);
                    setDeleteTarget(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive Instead
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!confirmed}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};