import React, { useState, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import type { Batch, TimetableSlot } from '../../types';
import { CreateBatchModal } from '../modals/CreateBatchModal';
import { CreateTimetableModal } from '../modals/CreateTimetableModal';
import { EditBatchModal } from '../modals/EditbatchModal';
import { EditTimetableModal } from '../modals/EdittimetableModal';
import {
  Layers,
  Calendar,
  Plus,
  Clock,
  MapPin,
  GraduationCap,
  Trash2,
  Pencil,
  X,
  AlertTriangle,
  CheckCircle2,
  UserCheck
} from 'lucide-react';

const STATUS_STYLE: Record<Batch['status'], string> = {
  ongoing: 'text-emerald-700 bg-emerald-50',
  upcoming: 'text-blue-700 bg-blue-50',
  completed: 'text-slate-600 bg-slate-100'
};

export const BatchesTimetableView: React.FC = () => {
  const {
    batches,
    timetable,
    students,
    attendance,
    exams,
    deleteBatch,
    deleteTimetableSlot
  } = useInstitute();
  const { isAdmin, users, setUserBatches } = useAuth();

  const [activeTab, setActiveTab] = useState<'batches' | 'timetable'>('batches');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<Batch | null>(null);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<TimetableSlot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const days: TimetableSlot['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  const filteredTimetable = useMemo(() => {
    return timetable.filter(slot => selectedBatchFilter === 'all' || slot.batchId === selectedBatchFilter);
  }, [timetable, selectedBatchFilter]);

  // Everything a batch delete would touch
  const deleteImpact = useMemo(() => {
    if (!deleteBatchTarget) return null;
    const id = deleteBatchTarget.id;
    const inBatch = students.filter(s => s.batchId === id);
    return {
      students: inBatch.length,
      archived: inBatch.filter(s => s.status === 'inactive').length,
      slots: timetable.filter(t => t.batchId === id).length,
      attendanceDays: attendance.filter(a => a.batchId === id).length,
      tests: exams.filter(e => e.batchId === id).length,
      teachers: users.filter(u => u.role === 'teacher' && (u.batchIds || []).includes(id))
    };
  }, [deleteBatchTarget, students, timetable, attendance, exams, users]);

  const handleDeleteBatch = async () => {
    if (!deleteBatchTarget || !deleteImpact || deleteImpact.students > 0) return;
    const id = deleteBatchTarget.id;
    const name = deleteBatchTarget.name;

    // Take the batch off every teacher who handled it, then remove it (timetable, attendance, tests go too)
    await Promise.all(
      deleteImpact.teachers.map(t =>
        setUserBatches(
          t.id,
          (t.batchIds || []).filter(batchId => batchId !== id)
        )
      )
    );
    deleteBatch(id);

    setDeleteBatchTarget(null);
    showNotice(`${name} was deleted.`);
  };

  const handleDeleteSlot = () => {
    if (!deleteSlotTarget) return;
    deleteTimetableSlot(deleteSlotTarget.id);
    setDeleteSlotTarget(null);
    showNotice('Class slot was deleted.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Batches & Master Schedule Timetable
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Organize academic batches, faculty allocations, classroom hall capacities, and weekly lecture schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'batches' ? (
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create New Batch
            </button>
          ) : (
            <button
              onClick={() => setIsTimetableModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Schedule Class Period
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg text-xs flex items-center gap-2 border bg-emerald-50 border-emerald-200 text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-600 gap-6">
        <button
          onClick={() => setActiveTab('batches')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'batches'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Batches & Enrollments ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timetable')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'timetable'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Weekly Timetable Matrix ({timetable.length} Slots)</span>
        </button>
      </div>

      {/* Tab: Batches Directory */}
      {activeTab === 'batches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {batches.length === 0 && (
            <div className="md:col-span-2 py-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No batches yet. Create the first batch.
            </div>
          )}

          {batches.map(batch => {
            const batchEnrolled = students.filter(s => s.batchId === batch.id).length;
            const fillRate = batch.maxCapacity > 0 ? Math.round((batchEnrolled / batch.maxCapacity) * 100) : 0;
            const teachers = users.filter(u => u.role === 'teacher' && (u.batchIds || []).includes(batch.id));

            return (
              <div
                key={batch.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                      {batch.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${
                          STATUS_STYLE[batch.status] || STATUS_STYLE.ongoing
                        }`}
                      >
                        {batch.status}
                      </span>
                      <button
                        onClick={() => setEditingBatch(batch)}
                        className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        title="Edit batch"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setConfirmed(false);
                            setDeleteBatchTarget(batch);
                          }}
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                          title="Delete batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{batch.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{batch.courseName}</p>

                  <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        <strong>Faculty:</strong> {batch.facultyName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        <strong>Classroom:</strong> {batch.classroom}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        <strong>Timing:</strong> {batch.startTime} - {batch.endTime} ({batch.scheduleDays.join(', ')})
                      </span>
                    </div>
                    {teachers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          <strong>Teacher logins:</strong> {teachers.map(t => t.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">Batch Enrollment Fill</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {batchEnrolled} / {batch.maxCapacity} Seats ({fillRate}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          fillRate >= 100 ? 'bg-rose-500' : fillRate >= 90 ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, fillRate)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    Subjects: {batch.subjects.slice(0, 2).join(', ')}
                    {batch.subjects.length > 2 && ` +${batch.subjects.length - 2}`}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedBatchFilter(batch.id);
                      setActiveTab('timetable');
                    }}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    View Timetable →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Master Weekly Timetable Matrix */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">Filter by Batch:</span>
              <select
                value={selectedBatchFilter}
                onChange={e => setSelectedBatchFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500">Monday through Saturday Master Academic Grid</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {days.map(day => {
              const daySlots = filteredTimetable.filter(slot => slot.dayOfWeek === day);

              return (
                <div key={day} className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 space-y-2.5">
                  <div className="pb-2 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">{day}</span>
                    <span className="text-[11px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {daySlots.length} Classes
                    </span>
                  </div>

                  {daySlots.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-[11px] italic">No lectures scheduled</div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map(slot => (
                        <div
                          key={slot.id}
                          className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors group relative"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              {slot.startTime}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingSlot(slot)}
                                className="text-slate-400 hover:text-blue-600 p-0.5"
                                title="Edit slot"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeleteSlotTarget(slot)}
                                className="text-slate-400 hover:text-rose-500 p-0.5"
                                title="Delete slot"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{slot.subject}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{slot.batchName}</p>

                          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                            <div>
                              {slot.startTime} - {slot.endTime}
                            </div>
                            <div className="truncate">Mentor: {slot.facultyName}</div>
                            <div className="text-slate-700 font-medium">Room: {slot.classroom}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create modals */}
      {isBatchModalOpen && (
        <CreateBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          onSuccess={() => showNotice('Batch was created.')}
        />
      )}
      {isTimetableModalOpen && (
        <CreateTimetableModal
          isOpen={isTimetableModalOpen}
          onClose={() => setIsTimetableModalOpen(false)}
          onSuccess={() => showNotice('Class slot was added.')}
        />
      )}

      {/* Edit modals */}
      {editingBatch && (
        <EditBatchModal
          batch={editingBatch}
          enrolled={students.filter(s => s.batchId === editingBatch.id).length}
          onClose={() => setEditingBatch(null)}
          onSaved={name => showNotice(`${name} was updated.`)}
        />
      )}

      {editingSlot && (
        <EditTimetableModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSaved={() => showNotice('Class slot was updated.')}
        />
      )}

      {/* Delete slot confirmation */}
      {deleteSlotTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Delete this class slot?</h2>
              <p className="text-sm text-slate-600 mt-2">
                <strong>{deleteSlotTarget.subject}</strong> · {deleteSlotTarget.batchName}
                <br />
                {deleteSlotTarget.dayOfWeek}, {deleteSlotTarget.startTime} - {deleteSlotTarget.endTime}
              </p>
              <div className="pt-5 flex justify-end gap-2">
                <button
                  onClick={() => setDeleteSlotTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSlot}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete batch confirmation */}
      {deleteBatchTarget && deleteImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-rose-50/60">
              <div className="flex items-start gap-3">
                <span className="p-1.5 rounded-lg bg-rose-600 text-white mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {deleteImpact.students > 0 ? 'This batch cannot be deleted yet' : 'Delete batch permanently?'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deleteBatchTarget.name} · <span className="font-mono">{deleteBatchTarget.code}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteBatchTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {deleteImpact.students > 0 ? (
                <>
                  <p className="text-slate-700">
                    <strong>{deleteImpact.students}</strong> {deleteImpact.students === 1 ? 'student is' : 'students are'}{' '}
                    still in this batch
                    {deleteImpact.archived > 0 ? ` (${deleteImpact.archived} archived)` : ''}. Move them to another
                    batch first using <strong>Edit</strong> in Admissions &amp; Students, or delete them there.
                  </p>
                  <div className="pt-3 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => setDeleteBatchTarget(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      OK, got it
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ul className="space-y-1.5 text-slate-700">
                    <li>• The batch itself will be removed.</li>
                    <li>
                      • <strong>{deleteImpact.slots}</strong> timetable {deleteImpact.slots === 1 ? 'slot' : 'slots'},{' '}
                      <strong>{deleteImpact.attendanceDays}</strong> attendance{' '}
                      {deleteImpact.attendanceDays === 1 ? 'day' : 'days'} and <strong>{deleteImpact.tests}</strong>{' '}
                      {deleteImpact.tests === 1 ? 'test' : 'tests'} of this batch will be removed.
                    </li>
                    {deleteImpact.teachers.length > 0 && (
                      <li>
                        • It will be taken off the teacher logins:{' '}
                        <strong>{deleteImpact.teachers.map(t => t.name).join(', ')}</strong>.
                      </li>
                    )}
                  </ul>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span className="text-slate-700">I understand this cannot be undone.</span>
                  </label>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteBatchTarget(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteBatch}
                      disabled={!confirmed}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Batch
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};