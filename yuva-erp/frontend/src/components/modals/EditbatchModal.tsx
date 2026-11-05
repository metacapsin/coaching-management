import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import type { Batch } from '../../types';
import { TIME_REGEX, normalizeTime, timeToMinutes } from '../utils/helpers';
import { X, Layers, Check, AlertCircle } from 'lucide-react';

interface EditBatchModalProps {
  batch: Batch;
  enrolled: number; // students currently in this batch
  onClose: () => void;
  onSaved?: (batchName: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

export const EditBatchModal: React.FC<EditBatchModalProps> = ({ batch, enrolled, onClose, onSaved }) => {
  useEscape(onClose);
  const { courses, updateBatch } = useInstitute();
  // the teachers of the coaching (the principal sees them): one of them is the class teacher of the batch
  const { users } = useAuth();
  const teachers = users.filter(u => u.role === 'teacher' && (u.status || 'active') === 'active');

  const [form, setForm] = useState({
    code: batch.code,
    name: batch.name,
    courseId: batch.courseId,
    subjects: batch.subjects.join(', '),
    facultyName: batch.facultyName,
    classTeacherId: batch.classTeacherId ?? '',
    classroom: batch.classroom,
    scheduleDays: batch.scheduleDays,
    startTime: batch.startTime,
    endTime: batch.endTime,
    maxCapacity: batch.maxCapacity,
    status: batch.status
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter(d => d !== day)
        : [...prev.scheduleDays, day]
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Batch name is required';
    if (form.scheduleDays.length === 0) errs.days = 'Select at least one lecture day';
    if (!TIME_REGEX.test(form.startTime.trim())) errs.startTime = 'Use the format 04:30 PM';
    if (!TIME_REGEX.test(form.endTime.trim())) errs.endTime = 'Use the format 07:45 PM';
    if (!errs.startTime && !errs.endTime && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      errs.endTime = 'End time must be after the start time';
    }
    if (!(Number(form.maxCapacity) > 0)) errs.maxCapacity = 'Capacity must be at least 1';
    else if (Number(form.maxCapacity) < enrolled) {
      errs.maxCapacity = `${enrolled} students are already in this batch, so capacity cannot be lower`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const course = courses.find(c => c.id === form.courseId);
    updateBatch(batch.id, {
      code: form.code.trim().toUpperCase() || batch.code,
      name: form.name.trim(),
      courseId: form.courseId,
      courseName: course ? course.name : batch.courseName,
      subjects: form.subjects
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      facultyName: form.facultyName.trim(),
      classTeacherId: form.classTeacherId || undefined,
      classroom: form.classroom.trim(),
      scheduleDays: DAYS.filter(d => form.scheduleDays.includes(d)),
      startTime: normalizeTime(form.startTime),
      endTime: normalizeTime(form.endTime),
      maxCapacity: Number(form.maxCapacity),
      status: form.status
    });

    if (onSaved) onSaved(form.name.trim());
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
              <h2 className="text-lg font-semibold text-slate-900">Edit Batch</h2>
              <p className="text-xs text-slate-500">
                {enrolled} {enrolled === 1 ? 'student' : 'students'} currently enrolled
              </p>
            </div>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batch Code</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className={`${inputClass(false)} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Batch['status'] })}
                className={`${inputClass(false)} bg-white`}
              >
                <option value="ongoing">Ongoing</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Batch Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputClass(!!errors.name)}
            />
            {errors.name && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              A new title is also updated in this batch&apos;s timetable and tests.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Course</label>
            <select
              value={form.courseId}
              onChange={e => setForm({ ...form, courseId: e.target.value })}
              className={`${inputClass(false)} bg-white`}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subjects (comma separated)</label>
            <input
              type="text"
              value={form.subjects}
              onChange={e => setForm({ ...form, subjects: e.target.value })}
              className={inputClass(false)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Faculty / Mentors</label>
            <input
              type="text"
              value={form.facultyName}
              onChange={e => setForm({ ...form, facultyName: e.target.value })}
              className={inputClass(false)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Class teacher</label>
            <select
              value={form.classTeacherId}
              onChange={e => setForm({ ...form, classTeacherId: e.target.value })}
              className={inputClass(false)}
            >
              <option value="">None (only the principal tells the parents about absent / late students)</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.subject ? ` (${t.subject})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Only the class teacher (and the principal) tells the parents when a student is absent or late. With none chosen, the principal does it.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Classroom</label>
              <input
                type="text"
                value={form.classroom}
                onChange={e => setForm({ ...form, classroom: e.target.value })}
                className={inputClass(false)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Student Capacity</label>
              <input
                type="number"
                value={form.maxCapacity}
                onChange={e => setForm({ ...form, maxCapacity: Number(e.target.value) })}
                className={inputClass(!!errors.maxCapacity)}
              />
            </div>
          </div>
          {errors.maxCapacity && <p className="text-xs text-rose-600 -mt-2">{errors.maxCapacity}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Schedule Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(day => {
                const selected = form.scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {errors.days && <p className="text-xs text-rose-600 mt-1">{errors.days}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Class Start Time</label>
              <input
                type="text"
                placeholder="04:30 PM"
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                className={inputClass(!!errors.startTime)}
              />
              {errors.startTime && <p className="text-xs text-rose-600 mt-1">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Class End Time</label>
              <input
                type="text"
                placeholder="07:45 PM"
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                className={inputClass(!!errors.endTime)}
              />
              {errors.endTime && <p className="text-xs text-rose-600 mt-1">{errors.endTime}</p>}
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};