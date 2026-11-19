import { Select } from '../ui/Pickers';
import React, { useState, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { Pager } from '../ui/Pager';
import { usePaged } from '../utils/usePaged';
import { EditStudentModal } from '../modals/EditstudentModal';
import type { Student } from '../../types';
import { ExportMenu, exportMoney } from '../ui/ExportMenu';
import type { ExportData } from '../ui/ExportMenu';
import { fillTemplate, formatDate, openWhatsApp, payPageLink, plural, toLocalISODate, withPayLink } from '../utils/helpers';
import { useFeeNotice } from '../utils/useFeeNotice';
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
  CheckCircle2,
  Phone,
  Mail,
  CalendarDays,
  Receipt
} from 'lucide-react';

interface AdmissionsViewProps {
  onOpenAdmission: () => void;
  onSelectStudent: (studentId: string) => void;
}

type StatusFilter = 'current' | 'pending' | 'archived' | 'all';

// the photo of a student; with no photo (or a broken link) the initials are shown on an orange circle
const Avatar: React.FC<{ name: string; src?: string; className: string }> = ({ name, src, className }) => {
  const [bad, setBad] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return src && !bad ? (
    <img src={src} alt={name} onError={() => setBad(true)} className={`${className} object-cover`} />
  ) : (
    <div className={`${className} bg-gradient-to-br from-orange-500 to-amber-400 text-white font-bold flex items-center justify-center`}>{initials}</div>
  );
};

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
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // (pages are made below, after the list is filtered)
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      const q = searchQuery.toLowerCase().trim();
      // one letter (A to Z): every student whose name BEGINS with that letter (nothing else is looked at)
      const oneLetter = /^\p{L}$/u.test(q);
      const matchesSearch =
        !q ||
        (oneLetter
          ? st.name.trim().toLowerCase().startsWith(q)
          : st.name.toLowerCase().includes(q) ||
            st.rollNo.toLowerCase().includes(q) ||
            st.parentName.toLowerCase().includes(q) ||
            st.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000') ||
            st.parentPhone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000') ||
            st.targetExam.toLowerCase().includes(q));

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
  // one letter (A to Z) shows ALL the students of that letter at once (no pages), so the principal checks the whole list in one look
  const oneLetterSearch = /^\p{L}$/u.test(searchQuery.trim());
  const paged = usePaged(filteredStudents, oneLetterSearch ? 100000 : 20, `${searchQuery}|${selectedBatch}|${feeFilter}|${statusFilter}`);

  const archivedCount = students.filter(s => s.status === 'inactive').length;
  // New registrations that wait for the principal to confirm the admission and set the fee
  const pendingCount = students.filter(s => s.status === 'trial').length;

  // the list on the screen as a table: for the PDF and for the Excel file
  const exportData = (): ExportData => {
    const sum = filteredStudents.reduce(
      (acc, s) => {
        const net = Math.max(0, s.totalFees - s.discount);
        return { fees: acc.fees + net, paid: acc.paid + s.feePaid, due: acc.due + Math.max(0, net - s.feePaid) };
      },
      { fees: 0, paid: 0, due: 0 }
    );
    return {
      headers: ['Roll No', 'Name', 'Grade', 'Status', 'Target Exam', 'Batch', 'Parent Name', 'Parent Phone', 'Total Fees', 'Discount', 'Paid', 'Balance Due'],
      rows: filteredStudents.map(s => {
        const b = batches.find(item => item.id === s.batchId);
        const net = Math.max(0, s.totalFees - s.discount);
        return [s.rollNo, s.name, s.grade, s.status === 'inactive' ? 'Archived' : s.status, s.targetExam, b?.name || '', s.parentName, s.parentPhone, s.totalFees, s.discount, s.feePaid, Math.max(0, net - s.feePaid)];
      }),
      summary: [
        { label: 'Students', value: filteredStudents.length },
        { label: 'Fees', value: exportMoney(profile.currencySymbol, sum.fees) },
        { label: 'Paid', value: exportMoney(profile.currencySymbol, sum.paid) },
        { label: 'Balance due', value: exportMoney(profile.currencySymbol, sum.due) }
      ],
      colorize: (col, value) => (col === 3 ? (value === 'active' ? 'green' : value === 'Archived' ? 'red' : 'amber') : col === 11 && Number(value) > 0 ? 'red' : undefined)
    };
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
  // The fee is collected on the Fees page; here the office only sends the notice. It goes by email to the parent (with the Pay now
  // button when the UPI id is written) and is in the login of the parent too (the bell and the Notice Board).
  const sendFeeNotice = useFeeNotice({ viaEmail: true }); // (by email: WhatsApp is not opened)
  const handleFeeNotice = (e: React.MouseEvent, s: Student) => {
    e.stopPropagation();
    sendFeeNotice(s, r => showNotice(r.type, r.text));
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

  // attendance of every student in %, from the marks of the teachers (present and late count as present; excused days are left out)
  const attendancePct = useMemo(() => {
    const tally: Record<string, { seen: number; here: number }> = {};
    for (const a of attendance) {
      for (const [sid, st] of Object.entries(a.records)) {
        if (st === 'excused') continue;
        const t = (tally[sid] ||= { seen: 0, here: 0 });
        t.seen += 1;
        if (st === 'present' || st === 'late') t.here += 1;
      }
    }
    const out: Record<string, number | null> = {};
    for (const [sid, t] of Object.entries(tally)) out[sid] = t.seen ? Math.round((t.here / t.seen) * 100) : null;
    return out;
  }, [attendance]);

  // the student shown in the profile panel: the one that was clicked, else the first of the list
  const picked = filteredStudents.find(s => s.id === pickedId) ?? paged.items[0] ?? null;
  const money = (n: number) => `${profile.currencySymbol}${n.toLocaleString('en-IN')}`;
  const feeState = (s: Student) => {
    const net = Math.max(0, s.totalFees - s.discount);
    const balance = Math.max(0, net - s.feePaid);
    const pct = net ? Math.min(100, Math.round((s.feePaid / net) * 100)) : 100;
    return { net, balance, pct };
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
          <ExportMenu filename="student_directory" title="Student directory" subtitle="Admissions and students" coaching={profile.name} build={exportData} disabled={filteredStudents.length === 0} />
          <button
            onClick={onOpenAdmission}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            New Student
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

          <Select
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
          </Select>

          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="current">Current students</option>
            <option value="pending">Awaiting confirmation ({pendingCount})</option>
            <option value="archived">Archived ({archivedCount})</option>
            <option value="all">All students</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'all', label: 'All', on: 'bg-orange-500/20 text-orange-600 ring-1 ring-orange-500/40', hover: 'hover:bg-orange-500/10 hover:text-orange-500' },
                { id: 'due', label: 'Dues Pending', on: 'bg-rose-500/20 text-rose-600 ring-1 ring-rose-500/40', hover: 'hover:bg-rose-500/10 hover:text-rose-500' },
                { id: 'paid', label: 'Clear', on: 'bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/40', hover: 'hover:bg-emerald-500/10 hover:text-emerald-500' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                onClick={() => setFeeFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  feeFilter === f.id ? `${f.on} font-semibold` : `text-slate-600 ${f.hover}`
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

      {/* Students: the list on the left, the profile of the chosen student on the right */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No students found</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing search filters or add a new admission.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 hidden md:table-cell">Batch</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Parent</th>
                    <th className="px-4 py-3">Fees</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.items.map(student => {
                    const batch = batches.find(b => b.id === student.batchId);
                    const { balance, pct } = feeState(student);
                    const att = attendancePct[student.id];
                    const archived = student.status === 'inactive';
                    const active = picked?.id === student.id;
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setPickedId(student.id)}
                        className={`cursor-pointer transition-colors ${archived ? 'opacity-60' : ''} ${
                          active ? 'bg-orange-500/10 shadow-[inset_3px_0_0_#f97316]' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={student.name} src={student.photoUrl} className="w-9 h-9 rounded-full text-[11px] shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                {student.name}
                                {archived && <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Archived</span>}
                                {student.status === 'trial' && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Awaiting confirmation</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono">{student.rollNo}</span>
                                <span className="mx-1 text-slate-300">·</span>
                                {student.grade}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="font-medium text-slate-800">{batch?.name || 'Assigned Batch'}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{student.targetExam}</div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-slate-800">{student.parentName}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{student.parentPhone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {balance > 0 ? `Due ${money(balance)}` : 'Paid'}
                          </span>
                          <div className="mt-1.5 h-1 w-24 rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full rounded-full ${balance > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {att == null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                                <div className={`h-full rounded-full ${att >= 75 ? 'bg-emerald-500' : att >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${att}%` }} />
                              </div>
                              <span className="font-mono text-slate-700">{att}%</span>
                            </div>
                          )}
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

        {/* Student profile */}
        {picked && (() => {
          const batch = batches.find(b => b.id === picked.batchId);
          const { net, balance, pct } = feeState(picked);
          const att = attendancePct[picked.id];
          const archived = picked.status === 'inactive';
          return (
            <aside className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 xl:sticky xl:top-4">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Student profile</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${archived ? 'bg-slate-200 text-slate-600' : picked.status === 'trial' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {archived ? 'Archived' : picked.status === 'trial' ? 'Awaiting' : 'Active'}
                </span>
              </div>
              <div className="mt-3 flex flex-col items-center text-center">
                <Avatar name={picked.name} src={picked.photoUrl} className="w-20 h-20 rounded-full text-xl ring-4 ring-orange-500/20" />
                <h3 className="mt-3 text-base font-bold text-slate-900">{picked.name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="font-mono">{picked.rollNo}</span> · {picked.grade} · {batch?.name || 'No batch'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-[10px] text-slate-500">Attendance</p>
                  <p className="text-sm font-bold text-slate-900">{att == null ? '—' : `${att}%`}</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-[10px] text-slate-500">Paid</p>
                  <p className="text-sm font-bold text-slate-900">{pct}%</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-[10px] text-slate-500">Target</p>
                  <p className="text-sm font-bold text-slate-900 truncate px-1">{picked.targetExam || '—'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Fee balance</span>
                  <span>{money(picked.feePaid)} / {money(net)}</span>
                </div>
                <p className={`mt-1 text-lg font-bold font-mono ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{balance > 0 ? money(balance) : 'Fully paid'}</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${balance > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {picked.nextDueDate && balance > 0 && <p className="mt-2 text-[11px] text-slate-500">Next due: {formatDate(picked.nextDueDate)}</p>}
              </div>

              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Parent</span><span className="ml-auto font-medium">{picked.parentName}</span></div>
                <div className="flex items-center gap-2 text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Parent phone</span><span className="ml-auto font-mono">{picked.parentPhone}</span></div>
                {picked.parentEmail && <div className="flex items-center gap-2 text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Email</span><span className="ml-auto truncate max-w-[60%]">{picked.parentEmail}</span></div>}
                <div className="flex items-center gap-2 text-slate-700"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Admitted</span><span className="ml-auto">{formatDate(picked.dateOfAdmission)}</span></div>
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => onSelectStudent(picked.id)} className="col-span-2 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Open dossier
                </button>
                {balance > 0 && !archived && (
                  <button onClick={e => handleFeeNotice(e, picked)} className="px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center justify-center gap-1.5" title="Email the parent that the fee is not fully paid">
                    <Bell className="w-3.5 h-3.5" /> Send notice
                  </button>
                )}
                <button onClick={e => handleWhatsAppParent(e, picked)} className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </button>
                {picked.status === 'trial' && (
                  <button onClick={() => { setConfirmMode(true); setEditing(picked); }} className="col-span-2 px-3 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg">
                    Confirm admission
                  </button>
                )}
                <button onClick={() => { setConfirmMode(false); setEditing(picked); }} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={e => handleToggleArchive(e, picked)} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1.5">
                  {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {archived ? 'Restore' : 'Archive'}
                </button>
                {isAdmin && (
                  <button onClick={e => openDelete(e, picked)} className="col-span-2 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                  </button>
                )}
              </div>
            </aside>
          );
        })()}
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