import React, { useState, useRef } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { resizeImageToDataUrl } from '../utils/Imageutils';
import { X, Pencil, Check, ImagePlus, Trash2 } from 'lucide-react';

interface EditStudentModalProps {
  student: Student;
  onClose: () => void;
  onSaved?: (studentName: string) => void;
  // Opened from "Confirm" on a new registration: status becomes Active and the fee must be set
  confirmMode?: boolean;
}

const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
  }`;

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, onClose, onSaved, confirmMode = false }) => {
  const { batches, courses, updateStudent, updateBatch, profile } = useInstitute();

  const [form, setForm] = useState({
    name: student.name,
    phone: student.phone,
    email: student.email,
    grade: student.grade,
    status: confirmMode && student.status === 'trial' ? ('active' as Student['status']) : student.status,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    parentEmail: student.parentEmail || '',
    address: student.address,
    courseId: student.courseId,
    batchId: student.batchId,
    targetExam: student.targetExam,
    dateOfAdmission: student.dateOfAdmission,
    totalFees:
      student.totalFees > 0
        ? student.totalFees
        : confirmMode
        ? courses.find(c => c.id === student.courseId)?.standardFee || 0
        : 0,
    discount: student.discount,
    notes: student.notes || '',
    photoUrl: student.photoUrl
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const netPayable = Math.max(0, Number(form.totalFees) - (Number(form.discount) || 0));
  const balance = Math.max(0, netPayable - student.feePaid);

  const handleCourseChange = (courseId: string) => {
    const relatedBatch = batches.find(b => b.courseId === courseId);
    setForm(prev => ({ ...prev, courseId, batchId: relatedBatch ? relatedBatch.id : prev.batchId }));
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5 MB');
      return;
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setForm(prev => ({ ...prev, photoUrl: dataUrl }));
      setPhotoError('');
    } catch {
      setPhotoError('Could not process this image. Try another file.');
    }
    e.target.value = '';
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Student name is required';
    if (!form.phone.trim()) errs.phone = 'Student phone is required';
    if (!form.parentName.trim()) errs.parentName = 'Parent name is required';
    if (!form.parentPhone.trim()) errs.parentPhone = 'Parent phone is required';
    if (!form.batchId) errs.batchId = 'Batch is required';
    if (!(Number(form.totalFees) > 0)) errs.totalFees = 'Total fee must be positive';
    if (Number(form.discount) < 0) errs.discount = 'Discount cannot be negative';
    else if (netPayable < student.feePaid) {
      errs.discount = `Net fee cannot be less than the ${profile.currencySymbol}${student.feePaid.toLocaleString(
        'en-IN'
      )} already paid`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    updateStudent(student.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      grade: form.grade,
      status: form.status,
      parentName: form.parentName.trim(),
      parentPhone: form.parentPhone.trim(),
      parentEmail: form.parentEmail.trim() || undefined,
      address: form.address.trim(),
      courseId: form.courseId,
      batchId: form.batchId,
      targetExam: form.targetExam.trim(),
      dateOfAdmission: form.dateOfAdmission,
      totalFees: Number(form.totalFees),
      discount: Number(form.discount) || 0,
      notes: form.notes,
      photoUrl: form.photoUrl || DEFAULT_PHOTO
    });

    // Keep the stored seat counts of the batches in step when the batch changes
    if (form.batchId !== student.batchId) {
      const oldBatch = batches.find(b => b.id === student.batchId);
      const newBatch = batches.find(b => b.id === form.batchId);
      if (oldBatch) updateBatch(oldBatch.id, { enrolledCount: Math.max(0, oldBatch.enrolledCount - 1) });
      if (newBatch) updateBatch(newBatch.id, { enrolledCount: newBatch.enrolledCount + 1 });
    }

    if (onSaved) onSaved(form.name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600 text-white">
                <Pencil className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                {confirmMode ? 'Confirm Admission' : 'Edit Student'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-mono">{student.rollNo}</span> ·{' '}
              {confirmMode
                ? 'Check the details, set the fee structure and save to make the student Active.'
                : 'Update details, photo, batch and fee structure.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Student */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">1. Student Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex items-center gap-4">
                <img
                  src={form.photoUrl || DEFAULT_PHOTO}
                  alt="Student"
                  className="w-20 h-20 rounded-full object-cover border border-slate-300"
                />
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      Change Photo
                    </button>
                    {form.photoUrl !== DEFAULT_PHOTO && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, photoUrl: DEFAULT_PHOTO })}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">JPG / PNG / WebP, max 5 MB. Auto-resized.</p>
                  {photoError && <p className="text-xs text-rose-600 mt-1">{photoError}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputClass(!!errors.name)}
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Student Mobile <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputClass(!!errors.phone)}
                />
                {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputClass(false)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
                  <select
                    value={form.grade}
                    onChange={e => setForm({ ...form, grade: e.target.value })}
                    className={`${inputClass(false)} bg-white`}
                  >
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Dropper / Repeater">Dropper / Repeater</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as Student['status'] })}
                    className={`${inputClass(false)} bg-white`}
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="inactive">Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Guardian */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">2. Guardian Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parent / Guardian Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.parentName}
                  onChange={e => setForm({ ...form, parentName: e.target.value })}
                  className={inputClass(!!errors.parentName)}
                />
                {errors.parentName && <p className="text-xs text-rose-600 mt-1">{errors.parentName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parent Mobile <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.parentPhone}
                  onChange={e => setForm({ ...form, parentPhone: e.target.value })}
                  className={inputClass(!!errors.parentPhone)}
                />
                {errors.parentPhone && <p className="text-xs text-rose-600 mt-1">{errors.parentPhone}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Parent Email</label>
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={e => setForm({ ...form, parentEmail: e.target.value })}
                  className={inputClass(false)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className={inputClass(false)}
                />
              </div>
            </div>
          </div>

          {/* Course / batch */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              3. Course, Batch & Target
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Program</label>
                <select
                  value={form.courseId}
                  onChange={e => handleCourseChange(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Batch <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.batchId}
                  onChange={e => setForm({ ...form, batchId: e.target.value })}
                  className={`${inputClass(!!errors.batchId)} bg-white`}
                >
                  {batches
                    .filter(b => b.courseId === form.courseId || b.id === form.batchId)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Exam</label>
                <input
                  type="text"
                  value={form.targetExam}
                  onChange={e => setForm({ ...form, targetExam: e.target.value })}
                  className={inputClass(false)}
                />
              </div>
            </div>
          </div>

          {/* Fees */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>4. Fee Structure</span>
              <span className="text-slate-500 font-normal">Currency: {profile.currencySymbol}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Standard Fee</label>
                <input
                  type="number"
                  value={form.totalFees}
                  onChange={e => setForm({ ...form, totalFees: Number(e.target.value) })}
                  className={inputClass(!!errors.totalFees)}
                />
                {errors.totalFees && <p className="text-xs text-rose-600 mt-1">{errors.totalFees}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scholarship / Concession</label>
                <input
                  type="number"
                  value={form.discount}
                  onChange={e => setForm({ ...form, discount: Number(e.target.value) })}
                  className={inputClass(!!errors.discount)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Already Paid</label>
                <div className="px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg text-emerald-700">
                  {profile.currencySymbol}
                  {student.feePaid.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Balance Due</label>
                <div
                  className={`px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg ${
                    balance > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {profile.currencySymbol}
                  {balance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            {errors.discount && <p className="text-xs text-rose-600 mt-2">{errors.discount}</p>}
            <p className="text-[11px] text-slate-400 mt-2">
              Payments are recorded from Fees & Invoicing, so &quot;Already Paid&quot; is not edited here.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className={inputClass(false)}
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {confirmMode ? 'Confirm & Save' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};