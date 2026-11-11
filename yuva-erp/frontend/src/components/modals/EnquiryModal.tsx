import { DateInput, Select } from '../ui/Pickers';
import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Enquiry, EnquirySource, EnquiryStatus } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { normalizePhone } from '../utils/helpers';
import { PhoneCall, Check } from 'lucide-react';

interface EnquiryModalProps {
  enquiry?: Enquiry | null; // empty = a new enquiry
  onClose: () => void;
  onSaved?: (name: string) => void;
}

export const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  demo: 'Demo class',
  'follow-up': 'Follow-up',
  enrolled: 'Enrolled',
  lost: 'Lost'
};

export const SOURCE_LABEL: Record<EnquirySource, string> = {
  'walk-in': 'Walk-in',
  phone: 'Phone call',
  website: 'Website',
  referral: 'Referral',
  social: 'Social media',
  other: 'Other'
};

const GRADES = ['Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper / Repeater'];

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

// Add or edit an enquiry (somebody who asked about admission)
export const EnquiryModal: React.FC<EnquiryModalProps> = ({ enquiry, onClose, onSaved }) => {
  const { courses, addEnquiry, updateEnquiry } = useInstitute();

  const [form, setForm] = useState({
    name: enquiry?.name ?? '',
    phone: enquiry?.phone ?? '',
    email: enquiry?.email ?? '',
    parentName: enquiry?.parentName ?? '',
    grade: enquiry?.grade ?? 'Class 12',
    interestedCourseId: enquiry?.interestedCourseId ?? '',
    source: enquiry?.source ?? ('walk-in' as EnquirySource),
    status: enquiry?.status ?? ('new' as EnquiryStatus),
    followUpDate: enquiry?.followUpDate ?? '',
    notes: enquiry?.notes ?? ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid 10-digit mobile number';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      email: form.email.trim() || undefined,
      parentName: form.parentName.trim() || undefined,
      grade: form.grade,
      interestedCourseId: form.interestedCourseId || undefined,
      source: form.source,
      status: form.status,
      followUpDate: form.followUpDate || undefined,
      notes: form.notes.trim()
    };
    if (enquiry) updateEnquiry(enquiry.id, data);
    else addEnquiry(data);
    onSaved?.(data.name);
    onClose();
  };

  return (
    <ModalShell
      title={enquiry ? 'Edit Enquiry' : 'New Enquiry'}
      subtitle="Keep track of everybody who asks about admission"
      icon={PhoneCall}
      iconClass="bg-amber-500"
      width="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Student name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Riya Malhotra"
              className={inputClass(!!errors.name)}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mobile number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="10-digit mobile number"
              className={inputClass(!!errors.phone)}
            />
            {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Parent / guardian name</label>
            <input
              type="text"
              value={form.parentName}
              onChange={e => setForm({ ...form, parentName: e.target.value })}
              className={inputClass(false)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className={inputClass(!!errors.email)}
            />
            {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
            <Select
              value={form.grade}
              onChange={e => setForm({ ...form, grade: e.target.value })}
              className={`${inputClass(false)} bg-white`}
            >
              {GRADES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Interested program</label>
            <Select
              value={form.interestedCourseId}
              onChange={e => setForm({ ...form, interestedCourseId: e.target.value })}
              className={`${inputClass(false)} bg-white`}
            >
              <option value="">Not decided</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">How did they find us?</label>
            <Select
              value={form.source}
              onChange={e => setForm({ ...form, source: e.target.value as EnquirySource })}
              className={`${inputClass(false)} bg-white`}
            >
              {(Object.keys(SOURCE_LABEL) as EnquirySource[]).map(s => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <Select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as EnquiryStatus })}
              className={`${inputClass(false)} bg-white`}
            >
              {(Object.keys(STATUS_LABEL) as EnquiryStatus[]).map(s => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Next follow-up date</label>
            <DateInput clearable
              value={form.followUpDate}
              onChange={e => setForm({ ...form, followUpDate: e.target.value })}
              className={inputClass(false)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="What did they ask? What was promised?"
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
            {enquiry ? 'Save Changes' : 'Add Enquiry'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
