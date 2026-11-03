import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Course } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { BookOpen, Check } from 'lucide-react';

interface CourseModalProps {
  course?: Course | null; // empty = a new course
  onClose: () => void;
  onSaved?: (name: string) => void;
}

const CATEGORIES: Course['category'][] = ['Engineering', 'Medical', 'Foundation', 'Boards', 'Commerce', 'Olympiad'];

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

// Add or edit a program (course) and its standard fee
export const CourseModal: React.FC<CourseModalProps> = ({ course, onClose, onSaved }) => {
  const { courses, addCourse, updateCourse, profile } = useInstitute();

  const [form, setForm] = useState({
    code: course?.code ?? '',
    name: course?.name ?? '',
    category: course?.category ?? ('Engineering' as Course['category']),
    duration: course?.duration ?? '1 Year',
    standardFee: course?.standardFee ?? 0,
    description: course?.description ?? ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Program name is required';
    const code = form.code.trim().toUpperCase();
    if (!code) errs.code = 'Code is required';
    else if (courses.some(c => c.id !== course?.id && c.code.toUpperCase() === code)) errs.code = `Code ${code} is already used`;
    if (!form.duration.trim()) errs.duration = 'Duration is required';
    if (!(Number(form.standardFee) >= 0)) errs.standardFee = 'Fee cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      duration: form.duration.trim(),
      standardFee: Number(form.standardFee) || 0,
      description: form.description.trim()
    };
    if (course) updateCourse(course.id, data);
    else addCourse(data);
    onSaved?.(data.name);
    onClose();
  };

  return (
    <ModalShell
      title={course ? 'Edit Program' : 'Add Program'}
      subtitle="A program is what students enrol in. Its standard fee is used at admission."
      icon={BookOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              placeholder="JEE-2Y"
              onChange={e => setForm({ ...form, code: e.target.value })}
              className={`${inputClass(!!errors.code)} font-mono uppercase`}
            />
            {errors.code && <p className="text-xs text-rose-600 mt-1">{errors.code}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Program name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              placeholder="e.g. IIT-JEE 2-Year Comprehensive"
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputClass(!!errors.name)}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as Course['category'] })}
              className={`${inputClass(false)} bg-white`}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Duration</label>
            <input
              type="text"
              value={form.duration}
              placeholder="e.g. 1 Year"
              onChange={e => setForm({ ...form, duration: e.target.value })}
              className={inputClass(!!errors.duration)}
            />
            {errors.duration && <p className="text-xs text-rose-600 mt-1">{errors.duration}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Standard fee ({profile.currencySymbol})</label>
            <input
              type="number"
              min={0}
              value={form.standardFee}
              onChange={e => setForm({ ...form, standardFee: Number(e.target.value) })}
              className={`${inputClass(!!errors.standardFee)} font-mono`}
            />
            {errors.standardFee && <p className="text-xs text-rose-600 mt-1">{errors.standardFee}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            placeholder="What the program covers"
            onChange={e => setForm({ ...form, description: e.target.value })}
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
            {course ? 'Save Changes' : 'Add Program'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
