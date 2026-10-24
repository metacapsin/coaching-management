import React, { useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Enquiry, EnquiryStatus } from '../../types';
import { EnquiryModal, STATUS_LABEL, SOURCE_LABEL } from '../modals/EnquiryModal';
import { AdmissionModal } from '../modals/AdmissionModal';
import { Pager } from '../ui/Pager';
import { usePaged } from '../utils/usePaged';
import { downloadCsv, formatDate, formatDateTime, openWhatsApp, toLocalISODate } from '../utils/helpers';
import {
  PhoneCall,
  Plus,
  Search,
  Download,
  MessageSquare,
  Pencil,
  Trash2,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  CalendarClock
} from 'lucide-react';

const STATUS_STYLE: Record<EnquiryStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-indigo-100 text-indigo-700',
  demo: 'bg-violet-100 text-violet-700',
  'follow-up': 'bg-amber-100 text-amber-700',
  enrolled: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-slate-200 text-slate-600'
};

const isOpen = (e: Enquiry) => e.status !== 'enrolled' && e.status !== 'lost';

export const EnquiriesView: React.FC = () => {
  const { enquiries, courses, batches, profile, updateEnquiry, deleteEnquiry } = useInstitute();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | EnquiryStatus>('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [editing, setEditing] = useState<{ enquiry: Enquiry | null } | null>(null);
  const [converting, setConverting] = useState<Enquiry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const today = toLocalISODate();
  const isDue = (e: Enquiry) => isOpen(e) && !!e.followUpDate && e.followUpDate <= today;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return enquiries.filter(e => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.parentName || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && e.phone.replace(/\D/g, '').includes(qDigits));
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'due' ? isDue(e) : e.status === statusFilter);
      const matchesSource = sourceFilter === 'all' || e.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiries, search, statusFilter, sourceFilter, today]);

  const paged = usePaged(filtered, 15, `${search}|${statusFilter}|${sourceFilter}`);

  const total = enquiries.length;
  const openCount = enquiries.filter(isOpen).length;
  const dueCount = enquiries.filter(isDue).length;
  const enrolledCount = enquiries.filter(e => e.status === 'enrolled').length;
  const conversion = total > 0 ? Math.round((enrolledCount / total) * 100) : 0;

  const courseName = (id?: string) => courses.find(c => c.id === id)?.name || '';

  const handleWhatsApp = (e: Enquiry) => {
    const course = courseName(e.interestedCourseId);
    openWhatsApp(
      e.phone,
      `Hello ${e.parentName || e.name}, thank you for your interest in ${profile.name}${
        course ? ` (${course})` : ''
      }. Please let us know a convenient time to talk about admission. - ${profile.name}`
    );
    if (e.status === 'new') updateEnquiry(e.id, { status: 'contacted' });
  };

  const startConvert = (e: Enquiry) => {
    if (batches.length === 0) {
      showNotice('error', 'Create a batch first (Batches & Timetable), then admit the student.');
      return;
    }
    setConverting(e);
  };

  const handleExport = () => {
    downloadCsv(
      `enquiries_${today}.csv`,
      ['Name', 'Mobile', 'Parent', 'Class', 'Program', 'Source', 'Status', 'Follow-up', 'Notes', 'Created'],
      filtered.map(e => [
        e.name,
        e.phone,
        e.parentName || '',
        e.grade || '',
        courseName(e.interestedCourseId),
        SOURCE_LABEL[e.source],
        STATUS_LABEL[e.status],
        e.followUpDate || '',
        e.notes,
        e.createdAt.slice(0, 10)
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500 text-white">
              <PhoneCall className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enquiries & Admission Leads</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Record everybody who asks about admission, follow up on time and turn the enquiry into an admission in one click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setEditing({ enquiry: null })}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Enquiry
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
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">All enquiries</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
          <span className="text-[11px] text-slate-400">{openCount} still open</span>
        </div>
        <button
          onClick={() => setStatusFilter('due')}
          className={`text-left bg-white rounded-xl border p-4 shadow-xs transition-colors ${
            dueCount > 0 ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' : 'border-slate-200'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Follow-ups due</span>
          <p className="text-2xl font-bold text-amber-800 mt-1">{dueCount}</p>
          <span className="text-[11px] text-amber-600">Today or earlier. Click to see them</span>
        </button>
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Admitted</span>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{enrolledCount}</p>
          <span className="text-[11px] text-emerald-600">Became students</span>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Conversion</span>
          <p className="text-2xl font-bold text-blue-900 mt-1">{conversion}%</p>
          <span className="text-[11px] text-blue-600">Enquiries that joined</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, parent or mobile number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All statuses</option>
          <option value="due">Follow-up due ({dueCount})</option>
          {(Object.keys(STATUS_LABEL) as EnquiryStatus[]).map(s => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-slate-500">
            <PhoneCall className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">{total === 0 ? 'No enquiries yet' : 'No enquiry matches'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {total === 0 ? 'Add the first enquiry when somebody asks about admission.' : 'Try clearing the search or the filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Student / Contact</th>
                  <th className="p-3.5">Interested In</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Follow-up</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.items.map(e => {
                  const due = isDue(e);
                  const overdue = due && e.followUpDate! < today;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{e.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{e.phone}</div>
                        {e.parentName && <div className="text-[11px] text-slate-400">Parent: {e.parentName}</div>}
                        {e.notes && <div className="text-[11px] text-slate-500 mt-1 max-w-xs line-clamp-2">{e.notes}</div>}
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-800">{courseName(e.interestedCourseId) || <span className="text-slate-300">Not decided</span>}</div>
                        {e.grade && <div className="text-[11px] text-slate-400">{e.grade}</div>}
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-700">{SOURCE_LABEL[e.source]}</div>
                        <div className="text-[11px] text-slate-400">{formatDateTime(e.createdAt)}</div>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={e.status}
                          onChange={ev => updateEnquiry(e.id, { status: ev.target.value as EnquiryStatus })}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${STATUS_STYLE[e.status]}`}
                          aria-label={`Status of ${e.name}`}
                        >
                          {(Object.keys(STATUS_LABEL) as EnquiryStatus[]).map(s => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5">
                        {e.followUpDate && isOpen(e) ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                              overdue ? 'bg-rose-100 text-rose-700' : due ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <CalendarClock className="w-3 h-3" />
                            {overdue ? 'Overdue · ' : due ? 'Today · ' : ''}
                            {formatDate(e.followUpDate)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleWhatsApp(e)}
                            title="Message on WhatsApp"
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {e.status !== 'enrolled' && (
                            <button
                              onClick={() => startConvert(e)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              Admit
                            </button>
                          )}
                          <button
                            onClick={() => setEditing({ enquiry: e })}
                            title="Edit"
                            className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            title="Delete"
                            className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {editing && (
        <EnquiryModal
          enquiry={editing.enquiry}
          onClose={() => setEditing(null)}
          onSaved={name => showNotice('success', `${name}'s enquiry was saved.`)}
        />
      )}

      {converting && (
        <AdmissionModal
          isOpen
          prefill={{
            name: converting.name,
            phone: converting.phone,
            email: converting.email,
            parentName: converting.parentName,
            grade: converting.grade,
            courseId: converting.interestedCourseId
          }}
          onClose={() => setConverting(null)}
          onSuccess={(name, student) => {
            updateEnquiry(converting.id, { status: 'enrolled', convertedStudentId: student.id, followUpDate: undefined });
            showNotice('success', `${name} was admitted (roll no. ${student.rollNo}).`);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this enquiry?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.phone}) will be removed from the list.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteEnquiry(deleteTarget.id);
                  showNotice('success', 'Enquiry was deleted.');
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
