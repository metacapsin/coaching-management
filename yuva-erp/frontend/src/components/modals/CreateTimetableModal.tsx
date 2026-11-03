import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { NeedFirst } from '../ui/NeedFirst';
import { useInstitute } from '../../Context/InstituteContext';
import type { TimetableSlot } from '../../types';
import { TIME_REGEX, normalizeTime, timeToMinutes, timesOverlap } from '../utils/helpers';
import { X, Calendar, Check } from 'lucide-react';

interface CreateTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTimetableModal: React.FC<CreateTimetableModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  useEscape(onClose);
  const { batches, timetable, addTimetableSlot } = useInstitute();

  const [formData, setFormData] = useState({
    dayOfWeek: 'Mon' as TimetableSlot['dayOfWeek'],
    startTime: '04:30 PM',
    endTime: '06:00 PM',
    batchId: batches[0]?.id || '',
    subject: '',
    facultyName: batches[0]?.facultyName || '',
    classroom: batches[0]?.classroom || '',
    color: 'blue'
  });

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!formData.batchId) {
      setError('Batch is required');
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
    const b = batches.find(item => item.id === formData.batchId);
    const room = (formData.classroom.trim() || b?.classroom || '').toLowerCase();

    const sameDay = timetable.filter(t => t.dayOfWeek === formData.dayOfWeek);
    const batchClash = sameDay.find(
      t => t.batchId === formData.batchId && timesOverlap(formData.startTime, formData.endTime, t.startTime, t.endTime)
    );
    if (batchClash) {
      setError(`This batch already has "${batchClash.subject}" from ${batchClash.startTime} to ${batchClash.endTime}`);
      return;
    }
    const roomClash = room
      ? sameDay.find(
          t =>
            t.classroom.trim().toLowerCase() === room &&
            timesOverlap(formData.startTime, formData.endTime, t.startTime, t.endTime)
        )
      : undefined;
    if (roomClash) {
      setError(`${roomClash.classroom} is used by ${roomClash.batchName} from ${roomClash.startTime} to ${roomClash.endTime}`);
      return;
    }

    addTimetableSlot({
      dayOfWeek: formData.dayOfWeek,
      startTime: normalizeTime(formData.startTime),
      endTime: normalizeTime(formData.endTime),
      batchId: formData.batchId,
      batchName: b ? b.name : 'Target Batch',
      subject: formData.subject.trim(),
      facultyName: formData.facultyName.trim() || (b?.facultyName || 'Faculty'),
      classroom: formData.classroom.trim() || (b?.classroom || 'Classroom'),
      color: formData.color
    });

    if (onSuccess) onSuccess();
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
              <h2 className="text-lg font-semibold text-slate-900">Schedule Lecture Period</h2>
              <p className="text-xs text-slate-500">Add timetable class slot to weekly master schedule</p>
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
          {batches.length === 0 && (
            <NeedFirst title="A class time needs a batch.">Create a batch first (Create New Batch above).</NeedFirst>
          )}
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Day of Week</label>
              <select
                value={formData.dayOfWeek}
                onChange={e => setFormData({ ...formData, dayOfWeek: e.target.value as TimetableSlot['dayOfWeek'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Batch</label>
              <select
                value={formData.batchId}
                onChange={e => {
                  const b = batches.find(item => item.id === e.target.value);
                  setFormData({
                    ...formData,
                    batchId: e.target.value,
                    facultyName: b?.facultyName || formData.facultyName,
                    classroom: b?.classroom || formData.classroom
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject & Topic Title</label>
            <input
              type="text"
              placeholder="e.g. Inorganic Chemistry: Periodic Trends"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Faculty Name</label>
              <input
                type="text"
                value={formData.facultyName}
                onChange={e => setFormData({ ...formData, facultyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Classroom / Room</label>
              <input
                type="text"
                value={formData.classroom}
                onChange={e => setFormData({ ...formData, classroom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
              <input
                type="text"
                placeholder="04:30 PM"
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
              <input
                type="text"
                placeholder="06:00 PM"
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Add Class Slot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
