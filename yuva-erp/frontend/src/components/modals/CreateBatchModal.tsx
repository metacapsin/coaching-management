import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { TIME_REGEX, normalizeTime, timeToMinutes } from '../utils/helpers';
import { X, Layers, Check } from 'lucide-react';

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  useEscape(onClose);
  const { courses, batches, addBatch } = useInstitute();
  // the teachers of the coaching (the principal sees them): one of them is the class teacher of the batch
  const { users } = useAuth();
  const teachers = users.filter(u => u.role === 'teacher' && (u.status || 'active') === 'active');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    courseId: courses[0]?.id || '',
    subjects: '',
    facultyName: '',
    classTeacherId: '',
    classroom: '',
    scheduleDays: ['Mon', 'Wed', 'Fri'] as string[],
    startTime: '04:00 PM',
    endTime: '07:30 PM',
    maxCapacity: 30,
    status: 'ongoing' as const
  });

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter(d => d !== day)
        : [...prev.scheduleDays, day]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Batch name is required');
      return;
    }
    if (formData.scheduleDays.length === 0) {
      setError('Please select at least one lecture day');
      return;
    }
    if (!TIME_REGEX.test(formData.startTime.trim()) || !TIME_REGEX.test(formData.endTime.trim())) {
      setError('Use the time format 04:30 PM');
      return;
    }
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) {
      setError('End time must be after the start time');
      return;
    }
    if (!(Number(formData.maxCapacity) > 0)) {
      setError('Capacity must be at least 1');
      return;
    }
    const code = formData.code.trim().toUpperCase();
    if (code && batches.some(b => b.code.toUpperCase() === code)) {
      setError(`Batch code ${code} is already used`);
      return;
    }

    const course = courses.find(c => c.id === formData.courseId);

    addBatch({
      code: code || `BAT-${Date.now().toString().slice(-4)}`,
      name: formData.name.trim(),
      courseId: formData.courseId,
      courseName: course ? course.name : 'Academic Program',
      subjects: formData.subjects.split(',').map(s => s.trim()).filter(Boolean),
      facultyName: formData.facultyName.trim(),
      classTeacherId: formData.classTeacherId || undefined,
      classroom: formData.classroom.trim(),
      scheduleDays: formData.scheduleDays,
      startTime: normalizeTime(formData.startTime),
      endTime: normalizeTime(formData.endTime),
      maxCapacity: Number(formData.maxCapacity) || 30,
      status: formData.status
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create New Academic Batch</h2>
              <p className="text-xs text-slate-500">Configure room, schedule timing, capacity & mentors</p>
            </div>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batch Code</label>
              <input
                type="text"
                placeholder="Auto if empty"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Course</label>
              <select
                value={formData.courseId}
                onChange={e => setFormData({ ...formData, courseId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Batch Title</label>
            <input
              type="text"
              placeholder="e.g. JEE Target 2026 Morning Super-Batch"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Faculty / Mentors</label>
            <input
              type="text"
              placeholder="e.g. Dr. Arvind Mehta & Prof. Raman Iyer"
              value={formData.facultyName}
              onChange={e => setFormData({ ...formData, facultyName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Class teacher</label>
            <select
              value={formData.classTeacherId}
              onChange={e => setFormData({ ...formData, classTeacherId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">None (every teacher of the batch can tell the parents about absent / late students)</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.subject ? ` (${t.subject})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Once you choose a class teacher, only that teacher (and you) tell the parents when a student is absent or late.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Classroom</label>
              <input
                type="text"
                placeholder="e.g. Hall A-102 (Raman Wing)"
                value={formData.classroom}
                onChange={e => setFormData({ ...formData, classroom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Student Capacity</label>
              <input
                type="number"
                value={formData.maxCapacity}
                onChange={e => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Schedule Days</label>
            <div className="flex flex-wrap gap-1.5">
              {daysOfWeek.map(day => {
                const isSelected = formData.scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Class Start Time</label>
              <input
                type="text"
                placeholder="04:30 PM"
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Class End Time</label>
              <input
                type="text"
                placeholder="07:45 PM"
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Create Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
