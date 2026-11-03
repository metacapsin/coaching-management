import React, { useState } from 'react';
import { useEscape } from '../ui/useEscape';
import { NeedFirst } from '../ui/NeedFirst';
import { useInstitute } from '../../Context/InstituteContext';
import { toLocalISODate } from '../utils/helpers';
import { X, Award, Check } from 'lucide-react';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  useEscape(onClose);
  const { batches, exams, addExam } = useInstitute();

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    batchId: batches[0]?.id || '',
    subject: '',
    date: toLocalISODate(),
    maxMarks: 100,
    passMarks: 35,
    syllabusTopics: ''
  });

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Test title is required');
      return;
    }
    if (!formData.batchId) {
      setError('Batch is required');
      return;
    }
    if (!formData.subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!(Number(formData.maxMarks) > 0)) {
      setError('Maximum marks must be more than zero');
      return;
    }
    if (Number(formData.passMarks) < 0 || Number(formData.passMarks) > Number(formData.maxMarks)) {
      setError('Cutoff marks must be between 0 and the maximum marks');
      return;
    }
    const code = formData.code.trim().toUpperCase();
    if (code && exams.some(e => e.code.toUpperCase() === code)) {
      setError(`Test code ${code} is already used`);
      return;
    }

    const selectedBatch = batches.find(b => b.id === formData.batchId);
    const topics = formData.syllabusTopics
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    addExam({
      code: code || `TEST-${Date.now().toString().slice(-4)}`,
      title: formData.title.trim(),
      batchId: formData.batchId,
      batchName: selectedBatch ? selectedBatch.name : 'Target Batch',
      subject: formData.subject.trim(),
      date: formData.date,
      maxMarks: Number(formData.maxMarks),
      passMarks: Number(formData.passMarks),
      syllabusTopics: topics.length > 0 ? topics : ['General Full Syllabus']
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
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Schedule New Exam / Test</h2>
              <p className="text-xs text-slate-500">Configure test series, syllabus & maximum marks</p>
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
            <NeedFirst title="A test needs a batch.">Create a batch first (Batches &amp; Timetable, Create New Batch).</NeedFirst>
          )}
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Test Code</label>
              <input
                type="text"
                placeholder="e.g. JEE-MT-05"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Batch</label>
              <select
                value={formData.batchId}
                onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Exam Title</label>
            <input
              type="text"
              placeholder="e.g. Minor Test 05: Organic Reactions & Kinematics"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject(s)</label>
              <input
                type="text"
                placeholder="e.g. Physics & Mathematics"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Test Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Maximum Marks</label>
              <input
                type="number"
                value={formData.maxMarks}
                onChange={e => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Qualifying Cutoff Marks</label>
              <input
                type="number"
                value={formData.passMarks}
                onChange={e => setFormData({ ...formData, passMarks: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Syllabus Topics Covered (Comma-separated)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Rotational Motion, Thermodynamics, Hydrocarbons"
              value={formData.syllabusTopics}
              onChange={e => setFormData({ ...formData, syllabusTopics: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              Schedule Exam
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
