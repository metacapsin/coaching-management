import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute } from '../../Context/InstituteContext';
import type { TimetableSlot } from '../../types';
import { TIME_REGEX, normalizeTime, timeToMinutes, timesOverlap } from '../utils/helpers';
import { X, Calendar, Check, AlertCircle } from 'lucide-react';

interface EditTimetableModalProps {
  slot: TimetableSlot;
  onClose: () => void;
  onSaved?: () => void;
}

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

export const EditTimetableModal: React.FC<EditTimetableModalProps> = ({ slot, onClose, onSaved }) => {
  useEscape(onClose);
  const { batches, timetable, updateTimetableSlot } = useInstitute();

  const [form, setForm] = useState({
    dayOfWeek: slot.dayOfWeek,
    batchId: slot.batchId,
    subject: slot.subject,
    facultyName: slot.facultyName,
    classroom: slot.classroom,
    startTime: slot.startTime,
    endTime: slot.endTime
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!TIME_REGEX.test(form.startTime.trim())) errs.startTime = 'Use the format 04:30 PM';
    if (!TIME_REGEX.test(form.endTime.trim())) errs.endTime = 'Use the format 06:00 PM';

    if (!errs.startTime && !errs.endTime) {
      if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
        errs.endTime = 'End time must be after the start time';
      } else {
        // Same day, other slots (this slot itself is ignored)
        const sameDay = timetable.filter(t => t.id !== slot.id && t.dayOfWeek === form.dayOfWeek);
        const batchClash = sameDay.find(
          t => t.batchId === form.batchId && timesOverlap(form.startTime, form.endTime, t.startTime, t.endTime)
        );
        const roomClash = sameDay.find(
          t =>
            t.classroom.trim().toLowerCase() === form.classroom.trim().toLowerCase() &&
            form.classroom.trim() !== '' &&
            timesOverlap(form.startTime, form.endTime, t.startTime, t.endTime)
        );
        if (batchClash) {
          errs.startTime = `This batch already has "${batchClash.subject}" from ${batchClash.startTime} to ${batchClash.endTime}`;
        } else if (roomClash) {
          errs.classroom = `${roomClash.classroom} is used by ${roomClash.batchName} from ${roomClash.startTime} to ${roomClash.endTime}`;
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const batch = batches.find(b => b.id === form.batchId);

    updateTimetableSlot(slot.id, {
      dayOfWeek: form.dayOfWeek,
      startTime: normalizeTime(form.startTime),
      endTime: normalizeTime(form.endTime),
      batchId: form.batchId,
      batchName: batch ? batch.name : slot.batchName,
      subject: form.subject.trim(),
      facultyName: form.facultyName.trim() || batch?.facultyName || 'Faculty',
      classroom: form.classroom.trim() || batch?.classroom || 'Classroom'
    });

    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-8 text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Class Slot</h2>
              <p className="text-xs text-slate-500">Change the day, time, room or faculty</p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Day of Week</label>
              <select
                value={form.dayOfWeek}
                onChange={e => setForm({ ...form, dayOfWeek: e.target.value as TimetableSlot['dayOfWeek'] })}
                className={`${inputClass(false)} bg-white`}
              >
                <option value="Mon">Monday</option>
                <option value="Tue">Tuesday</option>
                <option value="Wed">Wednesday</option>
                <option value="Thu">Thursday</option>
                <option value="Fri">Friday</option>
                <option value="Sat">Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batch</label>
              <select
                value={form.batchId}
                onChange={e => setForm({ ...form, batchId: e.target.value })}
                className={`${inputClass(false)} bg-white`}
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject & Topic</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className={inputClass(!!errors.subject)}
            />
            {errors.subject && <p className="text-xs text-rose-600 mt-1">{errors.subject}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Faculty</label>
              <input
                type="text"
                value={form.facultyName}
                onChange={e => setForm({ ...form, facultyName: e.target.value })}
                className={inputClass(false)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Classroom</label>
              <input
                type="text"
                value={form.classroom}
                onChange={e => setForm({ ...form, classroom: e.target.value })}
                className={inputClass(!!errors.classroom)}
              />
            </div>
          </div>
          {errors.classroom && (
            <p className="text-xs text-rose-600 -mt-2 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {errors.classroom}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
              <input
                type="text"
                placeholder="04:30 PM"
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                className={inputClass(!!errors.startTime)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
              <input
                type="text"
                placeholder="06:00 PM"
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                className={inputClass(!!errors.endTime)}
              />
            </div>
          </div>
          {(errors.startTime || errors.endTime) && (
            <p className="text-xs text-rose-600 -mt-2 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {errors.startTime || errors.endTime}
            </p>
          )}

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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
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