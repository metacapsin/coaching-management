import { DateInput, Select } from '../ui/Pickers';
import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Exam } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Award, Check } from 'lucide-react';

interface EditExamModalProps {
  exam: Exam;
  onClose: () => void;
  onSaved?: (title: string) => void;
}

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

// Change the details of a test (title, date, marks, syllabus). The marks already entered are kept.
export const EditExamModal: React.FC<EditExamModalProps> = ({ exam, onClose, onSaved }) => {
  const { batches, exams, updateExam } = useInstitute();
  const hasMarks = Object.keys(exam.results).length > 0;

  const [form, setForm] = useState({
    code: exam.code,
    title: exam.title,
    batchId: exam.batchId,
    subject: exam.subject,
    date: exam.date,
    maxMarks: exam.maxMarks,
    passMarks: exam.passMarks,
    syllabusTopics: exam.syllabusTopics.join(', ')
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Test title is required';
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    const code = form.code.trim().toUpperCase();
    if (code && exams.some(e => e.id !== exam.id && e.code.toUpperCase() === code)) errs.code = `Test code ${code} is already used`;
    if (!(Number(form.maxMarks) > 0)) errs.maxMarks = 'Maximum marks must be more than zero';
    else if (Number(form.passMarks) < 0 || Number(form.passMarks) > Number(form.maxMarks)) {
      errs.passMarks = 'Cutoff must be between 0 and the maximum marks';
    } else {
      // Marks that were already entered must still fit
      const highest = Math.max(0, ...Object.values(exam.results).map(r => r.marksObtained));
      if (hasMarks && Number(form.maxMarks) < highest) {
        errs.maxMarks = `Marks up to ${highest} were already entered, so the maximum cannot be lower`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const batch = batches.find(b => b.id === form.batchId);
    const topics = form.syllabusTopics
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    updateExam(exam.id, {
      code: form.code.trim().toUpperCase() || exam.code,
      title: form.title.trim(),
      batchId: form.batchId,
      batchName: batch ? batch.name : exam.batchName,
      subject: form.subject.trim(),
      date: form.date,
      maxMarks: Number(form.maxMarks),
      passMarks: Number(form.passMarks),
      syllabusTopics: topics.length > 0 ? topics : ['General Full Syllabus']
    });
    onSaved?.(form.title.trim());
    onClose();
  };

  return (
    <ModalShell title="Edit Test" subtitle={`${exam.code} · ${exam.batchName}`} icon={Award} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Test code</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className={`${inputClass(!!errors.code)} font-mono uppercase`}
            />
            {errors.code && <p className="text-xs text-rose-600 mt-1">{errors.code}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Batch</label>
            <Select
              value={form.batchId}
              disabled={hasMarks}
              onChange={e => setForm({ ...form, batchId: e.target.value })}
              className={`${inputClass(false)} bg-white disabled:bg-slate-100 disabled:text-slate-500`}
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {hasMarks && <p className="text-[11px] text-slate-400 mt-1">The batch cannot change after marks were entered.</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Test title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className={inputClass(!!errors.title)}
          />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject(s)</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className={inputClass(!!errors.subject)}
            />
            {errors.subject && <p className="text-xs text-rose-600 mt-1">{errors.subject}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Test date</label>
            <DateInput
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className={inputClass(false)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Maximum marks</label>
            <input
              type="number"
              value={form.maxMarks}
              onChange={e => setForm({ ...form, maxMarks: Number(e.target.value) })}
              className={`${inputClass(!!errors.maxMarks)} font-mono`}
            />
            {errors.maxMarks && <p className="text-xs text-rose-600 mt-1">{errors.maxMarks}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Qualifying cutoff</label>
            <input
              type="number"
              value={form.passMarks}
              onChange={e => setForm({ ...form, passMarks: Number(e.target.value) })}
              className={`${inputClass(!!errors.passMarks)} font-mono`}
            />
            {errors.passMarks && <p className="text-xs text-rose-600 mt-1">{errors.passMarks}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Syllabus topics (comma separated)</label>
          <textarea
            rows={2}
            value={form.syllabusTopics}
            onChange={e => setForm({ ...form, syllabusTopics: e.target.value })}
            className={inputClass(false)}
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
            Save Changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
