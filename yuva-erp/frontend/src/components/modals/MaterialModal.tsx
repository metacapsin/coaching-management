import React, { useState } from 'react';
import { NeedFirst } from '../ui/NeedFirst';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { MaterialType, StudyMaterial } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { BookOpen, Check } from 'lucide-react';

interface MaterialModalProps {
  material?: StudyMaterial | null;
  onClose: () => void;
  onSaved?: (message: string) => void; // for the page: what happened (the parents were told)
}

const inputClass = (hasError = false) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

export const TYPE_LABEL: Record<MaterialType, string> = {
  link: 'Link / file',
  note: 'Note',
  homework: 'Homework'
};

// Add or edit study material for a batch (teachers: only their own batches)
export const MaterialModal: React.FC<MaterialModalProps> = ({ material, onClose, onSaved }) => {
  const { batches, students, addMaterial, updateMaterial } = useInstitute();
  const { user } = useAuth();
  const office = canManageInstitute(user?.role);
  const myBatches = office ? batches : batches.filter(b => (user?.batchIds || []).includes(b.id));

  const [form, setForm] = useState({
    title: material?.title ?? '',
    description: material?.description ?? '',
    type: material?.type ?? ('link' as MaterialType),
    url: material?.url ?? '',
    batchId: material?.batchId ?? myBatches[0]?.id ?? '',
    subject: material?.subject ?? '',
    dueDate: material?.dueDate ?? ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const batch = batches.find(b => b.id === form.batchId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.batchId) errs.batchId = 'Select a batch';
    if (form.type === 'link') {
      if (!/^https?:\/\/\S+$/i.test(form.url.trim())) errs.url = 'Enter a full link starting with http:// or https://';
    } else if (!form.description.trim()) errs.description = 'Write the note / homework';
    if (form.url.trim() && !/^https?:\/\/\S+$/i.test(form.url.trim())) errs.url = 'Enter a full link starting with http:// or https://';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      url: form.url.trim() || undefined,
      batchId: form.batchId,
      batchName: batch?.name || '',
      subject: form.subject.trim() || batch?.subjects?.[0] || 'General',
      dueDate: form.type === 'homework' && form.dueDate ? form.dueDate : undefined
    };
    if (material) updateMaterial(material.id, data);
    else {
      addMaterial(data); // homework: the parents of the batch are told at once
      if (data.type === 'homework') {
        const told = students.filter(s => s.batchId === data.batchId && s.status !== 'inactive').length;
        onSaved?.(told > 0 ? `Homework saved. The ${told} student${told === 1 ? '' : 's'} and the parent${told === 1 ? '' : 's'} were told: it is in their bell and on their Notice Board. The message to the parents also waits in Parent Broadcasts for WhatsApp.` : 'Homework saved. There is no student in this batch yet, so nobody was told.');
      }
    }
    onClose();
  };

  return (
    <ModalShell
      title={material ? 'Edit Study Material' : 'Add Study Material'}
      subtitle="Students of the batch see it on their portal"
      icon={BookOpen}
      iconClass="bg-emerald-600"
      width="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {myBatches.length === 0 && (
            <NeedFirst title="Study material is shared with a batch.">Create a batch first (Batches &amp; Timetable, Create New Batch).</NeedFirst>
          )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as MaterialType })}
              className={`${inputClass()} bg-white`}
            >
              {(Object.keys(TYPE_LABEL) as MaterialType[]).map(t => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Batch</label>
            <select
              value={form.batchId}
              onChange={e => setForm({ ...form, batchId: e.target.value })}
              className={`${inputClass(!!errors.batchId)} bg-white`}
            >
              {myBatches.length === 0 && <option value="">No batch available</option>}
              {myBatches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.batchId && <p className="text-xs text-rose-600 mt-1">{errors.batchId}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Kinematics - chapter notes"
            className={inputClass(!!errors.title)}
          />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              list="material-subjects"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className={inputClass()}
            />
            <datalist id="material-subjects">
              {(batch?.subjects || []).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {form.type === 'homework' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Submit by</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputClass()} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Link {form.type === 'link' && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            placeholder="https://drive.google.com/..."
            className={inputClass(!!errors.url)}
          />
          {errors.url && <p className="text-xs text-rose-600 mt-1">{errors.url}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {form.type === 'link' ? 'Description (optional)' : 'Details'} {form.type !== 'link' && <span className="text-rose-500">*</span>}
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className={inputClass(!!errors.description)}
          />
          {errors.description && <p className="text-xs text-rose-600 mt-1">{errors.description}</p>}
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {material ? 'Save Changes' : 'Add Material'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
