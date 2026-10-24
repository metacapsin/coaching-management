import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { Announcement } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Megaphone, Check } from 'lucide-react';

interface NoticeModalProps {
  notice?: Announcement | null;
  onClose: () => void;
  onSaved?: () => void;
}

const inputClass = (hasError = false) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

// Write or edit a notice. Office staff can write for everybody; a teacher only for their own batches.
export const NoticeModal: React.FC<NoticeModalProps> = ({ notice, onClose, onSaved }) => {
  const { batches, addAnnouncement, updateAnnouncement } = useInstitute();
  const { user } = useAuth();
  const office = canManageInstitute(user?.role);

  const myBatches = office ? batches : batches.filter(b => (user?.batchIds || []).includes(b.id));

  const [form, setForm] = useState({
    title: notice?.title ?? '',
    body: notice?.body ?? '',
    audience: (office ? notice?.audience : 'batch') ?? ('all' as 'all' | 'batch'),
    batchId: notice?.batchId ?? myBatches[0]?.id ?? '',
    pinned: notice?.pinned ?? false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.body.trim()) errs.body = 'Write the message';
    if (form.audience === 'batch' && !form.batchId) errs.batchId = 'Select a batch';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const batch = batches.find(b => b.id === form.batchId);
    const data = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      batchId: form.audience === 'batch' ? form.batchId : undefined,
      batchName: form.audience === 'batch' ? batch?.name : undefined,
      pinned: office ? form.pinned : false
    };
    if (notice) updateAnnouncement(notice.id, data);
    else addAnnouncement(data);
    onSaved?.();
    onClose();
  };

  return (
    <ModalShell
      title={notice ? 'Edit Notice' : 'New Notice'}
      subtitle={office ? 'Visible to students on their portal' : 'For students of your batches'}
      icon={Megaphone}
      iconClass="bg-indigo-600"
      width="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Holiday on Monday"
            className={inputClass(!!errors.title)}
          />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Message <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            className={inputClass(!!errors.body)}
          />
          {errors.body && <p className="text-xs text-rose-600 mt-1">{errors.body}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Who should see it?</label>
            <select
              value={form.audience}
              disabled={!office}
              onChange={e => setForm({ ...form, audience: e.target.value as 'all' | 'batch' })}
              className={`${inputClass()} bg-white`}
            >
              {office && <option value="all">Everybody (all students)</option>}
              <option value="batch">One batch</option>
            </select>
          </div>
          {form.audience === 'batch' && (
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
          )}
        </div>

        {office && (
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}
              className="rounded border-slate-300"
            />
            Pin to the top of the board
          </label>
        )}

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {notice ? 'Save Changes' : 'Publish Notice'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
