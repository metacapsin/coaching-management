import { DateInput, Select } from '../ui/Pickers';
import React, { useState, useRef } from 'react';
import { useEscape } from '../ui/useEscape';
import { useInstitute, DEFAULT_PHOTO } from '../../Context/InstituteContext';
import type { PaymentMethod, Student } from '../../types';
import { resizeImageToDataUrl } from '../utils/Imageutils';
import { normalizePhone, toLocalISODate } from '../utils/helpers';
import { nextRollNumber } from '../utils/rollNo';
import { X, UserPlus, Check, ImagePlus, Trash2 } from 'lucide-react';
import { StudentLoginCard, generatePassword } from './StudentLoginCard';

// Details that are already known (for example from an enquiry)
export interface AdmissionPrefill {
  name?: string;
  phone?: string;
  email?: string;
  parentName?: string;
  grade?: string;
  courseId?: string;
}

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (studentName: string, student: Student) => void;
  prefill?: AdmissionPrefill;
}

export const AdmissionModal: React.FC<AdmissionModalProps> = ({ isOpen, onClose, onSuccess, prefill }) => {
  useEscape(onClose);
  const { batches, courses, students, addStudent, addCourse, addBatch, profile } = useInstitute();

  const startCourse = courses.find(c => c.id === prefill?.courseId) || courses[0];

  const [created, setCreated] = useState<Student | null>(null);
  // The student's login is made together with the admission (the principal can switch it off)
  const [makeLogin, setMakeLogin] = useState(true);
  const [loginPassword, setLoginPassword] = useState(generatePassword);
  const [loginAuto, setLoginAuto] = useState<{ email: string; password: string } | null>(null);
  // A program or a batch can be written in right here when the institute has none yet
  const [newProgram, setNewProgram] = useState<{ name: string; fee: string } | null>(null);
  const [newBatch, setNewBatch] = useState<{ name: string; seats: string } | null>(null);
  const [quickError, setQuickError] = useState('');

  const [formData, setFormData] = useState({
    name: prefill?.name ?? '',
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    parentName: prefill?.parentName ?? '',
    parentPhone: prefill?.phone ?? '',
    parentEmail: '',
    grade: prefill?.grade ?? 'Class 12',
    courseId: startCourse?.id || '',
    batchId: batches.find(b => b.courseId === startCourse?.id)?.id || '',
    targetExam: startCourse?.name || '',
    dateOfAdmission: toLocalISODate(),
    status: 'active' as const,
    photoUrl: '',
    address: '',
    dateOfBirth: '',
    totalFees: startCourse?.standardFee || 0,
    discount: 0,
    nextDueDate: '',
    notes: '',
    // Initial payment
    collectInitialPayment: false,
    initialAmount: 0,
    initialMethod: 'UPI' as PaymentMethod,
    initialRef: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Photo upload state (hooks must stay above the early return below)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState('');

  if (!isOpen) return null;

  // The admission is saved: offer the student's login before closing
  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
          <div className="px-6 py-5 border-b border-slate-200 bg-emerald-50 flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Check className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{created.name} was admitted</h2>
              <p className="text-xs text-slate-500">Roll no. {created.rollNo}</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <StudentLoginCard student={created} auto={loginAuto ?? undefined} />
            <StudentLoginCard student={created} parent />
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nextRoll = nextRollNumber(students);
  const courseBatches = batches.filter(b => b.courseId === formData.courseId);

  const handleCourseChange = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    const relatedBatch = batches.find(b => b.courseId === courseId);
    setFormData(prev => ({
      ...prev,
      courseId,
      batchId: relatedBatch ? relatedBatch.id : '',
      totalFees: course ? course.standardFee : prev.totalFees,
      targetExam: course ? course.name : prev.targetExam
    }));
  };

  const saveNewProgram = () => {
    const name = (newProgram?.name || '').trim();
    const fee = Number(newProgram?.fee || 0);
    if (!name) return setQuickError('Write the name of the program.');
    if (!Number.isFinite(fee) || fee < 0) return setQuickError('The fee cannot be negative.');
    const course = addCourse({
      code: name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || `PRG${Date.now().toString().slice(-3)}`,
      name,
      category: 'Engineering',
      duration: '1 Year',
      standardFee: fee,
      description: ''
    });
    // the batch of the new program is written right here (the name is suggested), so exactly the batch the person saves is made
    setFormData(prev => ({ ...prev, courseId: course.id, batchId: '', totalFees: course.standardFee, targetExam: course.name }));
    setNewProgram(null);
    setNewBatch({ name: `${name} - Batch 1`, seats: '30' });
    setQuickError('');
  };

  const saveNewBatch = () => {
    const name = (newBatch?.name || '').trim();
    const seats = Math.floor(Number(newBatch?.seats || 30));
    if (!formData.courseId) return setQuickError('Choose or add a program first.');
    if (!name) return setQuickError('Write the name of the batch.');
    if (!Number.isFinite(seats) || seats < 1) return setQuickError('Write how many seats the batch has.');
    const batch = addBatch({
      code: `BAT-${Date.now().toString().slice(-4)}`,
      name,
      courseId: formData.courseId,
      courseName: courses.find(c => c.id === formData.courseId)?.name || formData.targetExam || 'Program',
      subjects: [],
      facultyName: '',
      classroom: '',
      scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      startTime: '04:30 PM',
      endTime: '07:45 PM',
      maxCapacity: seats,
      status: 'ongoing'
    });
    setFormData(prev => ({ ...prev, batchId: batch.id }));
    setNewBatch(null);
    setQuickError('');
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
      setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
      setPhotoError('');
    } catch {
      setPhotoError('Could not process this image. Try another file.');
    }

    // allow selecting the same file again later
    e.target.value = '';
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Student name is required';
    if (!formData.phone.trim()) errs.phone = 'Student phone is required';
    if (!formData.parentName.trim()) errs.parentName = 'Parent name is required';
    if (!formData.parentPhone.trim()) errs.parentPhone = 'Parent phone is required';
    if (!formData.batchId) errs.batchId = 'Batch assignment is required';
    if (formData.totalFees <= 0) errs.totalFees = 'Total fee must be positive';
    if (formData.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid 10-digit mobile number';
    if (formData.parentPhone.replace(/\D/g, '').length < 10) errs.parentPhone = 'Enter a valid 10-digit mobile number';
    if (makeLogin) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errs.email = 'Enter the email the student will sign in with';
      else if (students.some(st => st.email.toLowerCase() === formData.email.trim().toLowerCase())) errs.email = 'Another student already uses this email';
      if (loginPassword.length < 8) errs.loginPassword = 'The password needs at least 8 characters';
    }
    if (formData.discount < 0 || formData.discount > formData.totalFees) {
      errs.discount = 'Concession must be between 0 and the total fee';
    }
    const net = Math.max(0, formData.totalFees - (formData.discount || 0));
    if (formData.collectInitialPayment) {
      if (!(formData.initialAmount > 0)) errs.initialAmount = 'Enter the deposit amount';
      else if (formData.initialAmount > net) errs.initialAmount = 'Deposit cannot be more than the net fee';
    }
    const chosenBatch = batches.find(b => b.id === formData.batchId);
    if (chosenBatch && students.filter(st => st.batchId === chosenBatch.id).length >= chosenBatch.maxCapacity) {
      errs.batchId = 'This batch is full. Choose another batch.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const initialPayment = formData.collectInitialPayment && formData.initialAmount > 0
      ? {
          amount: Number(formData.initialAmount),
          method: formData.initialMethod,
          ref: formData.initialRef || undefined
        }
      : undefined;

    const newStudent = addStudent({
      name: formData.name.trim(),
      email: formData.email.trim() || `${formData.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: normalizePhone(formData.phone),
      parentName: formData.parentName.trim(),
      parentPhone: normalizePhone(formData.parentPhone),
      parentEmail: formData.parentEmail.trim() || undefined,
      grade: formData.grade,
      courseId: formData.courseId,
      batchId: formData.batchId,
      targetExam: formData.targetExam,
      dateOfAdmission: formData.dateOfAdmission,
      status: formData.status,
      photoUrl: formData.photoUrl || DEFAULT_PHOTO,
      address: formData.address.trim(),
      dateOfBirth: formData.dateOfBirth || undefined,
      totalFees: Number(formData.totalFees),
      discount: Number(formData.discount) || 0,
      nextDueDate: formData.nextDueDate || undefined,
      notes: formData.notes
    }, initialPayment);

    if (onSuccess) onSuccess(newStudent.name, newStudent);
    setLoginAuto(makeLogin ? { email: formData.email.trim(), password: loginPassword } : null);
    setCreated(newStudent); // the last screen makes the login (or offers it) and shows the password
  };

  const netPayable = Math.max(0, formData.totalFees - (formData.discount || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600 text-white">
                <UserPlus className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">New Student Admission</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enroll candidate into academic program, assign batch, configure fee ledger & initial receipt.
            </p>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {(courses.length === 0 || batches.length === 0) && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-semibold">A student needs a program and a batch.</p>
              <p className="mt-1">
                None is written yet. In section 3 below choose <strong>＋ Add a new program</strong> and then <strong>＋ Add a new batch</strong>:
                you can write them in right here.
              </p>
            </div>
          )}
          {/* Section 1: Student Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              1. Student Demographics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Photo Upload */}
              <div className="md:col-span-2 flex items-center gap-4">
                {formData.photoUrl ? (
                  <img
                    src={formData.photoUrl}
                    alt="Student preview"
                    className="w-20 h-20 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                    >
                      {formData.photoUrl ? 'Change Photo' : 'Upload Student Photo'}
                    </button>
                    {formData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoUrl: '' })}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    JPG / PNG / WebP, max 5 MB. Auto-resized for fast loading.
                  </p>
                  {photoError && <p className="text-xs text-rose-600 mt-1">{photoError}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Roll Number</label>
                <div className="px-3 py-2 text-sm font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 flex items-center justify-between">
                  <span>{nextRoll}</span>
                  <span className="text-[10px] font-sans font-normal text-slate-400">Automatic</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aryan Gupta"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Student Mobile / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student Email {makeLogin && <span className="text-rose-500">*</span>}</label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'}`}
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
              </div>

              <div className="md:col-span-2 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={makeLogin} onChange={e => setMakeLogin(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4" />
                  <span className="text-xs font-medium text-slate-800">Create the student's login now (email above + this temporary password)</span>
                </label>
                {makeLogin && (
                  <div className="mt-2 max-w-sm">
                    <div className="flex gap-2">
                      <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <button type="button" onClick={() => setLoginPassword(generatePassword())} className="px-2.5 text-[11px] font-medium text-blue-600 hover:bg-blue-100 rounded-lg">New</button>
                    </div>
                    {errors.loginPassword && <p className="text-xs text-rose-600 mt-1">{errors.loginPassword}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">The student chooses an own password at the first sign in. The password is shown once after the admission.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Current Academic Class</label>
                <Select
                  value={formData.grade}
                  onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Class 9">Class 9 (Foundation)</option>
                  <option value="Class 10">Class 10 (Secondary Board)</option>
                  <option value="Class 11">Class 11 (Senior Secondary)</option>
                  <option value="Class 12">Class 12 (Board & Target Competitions)</option>
                  <option value="Dropper / Repeater">Dropper / Gap Year Special</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 2: Parent / Guardian Details (For Automated Notifications) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                2. Guardian Details (Recipient for Attendance & Fee Alerts)
              </h3>
              <span className="text-xs text-blue-600">SMS & WhatsApp Primary</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parent / Guardian Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Gupta"
                  value={formData.parentName}
                  onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.parentName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.parentName && <p className="text-xs text-rose-600 mt-1">{errors.parentName}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Parent WhatsApp / Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="+91 98111 22334"
                  value={formData.parentPhone}
                  onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.parentPhone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.parentPhone && <p className="text-xs text-rose-600 mt-1">{errors.parentPhone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student's date of birth (optional)</label>
                <DateInput clearable
                  value={formData.dateOfBirth}
                  onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="Apartment, Street, City, Pincode"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Course & Batch Allocation */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              3. Course, Batch & Target Goal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Selected Program</label>
                <Select
                  value={newProgram ? '__new' : formData.courseId}
                  onChange={e => {
                    setQuickError('');
                    if (e.target.value === '__new') {
                      setNewProgram({ name: '', fee: '' });
                    } else {
                      setNewProgram(null);
                      handleCourseChange(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {!formData.courseId && !newProgram && <option value="">Choose a program</option>}
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="__new">＋ Add a new program...</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Batch Assignment <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={newBatch ? '__new' : formData.batchId}
                  onChange={e => {
                    setQuickError('');
                    if (e.target.value === '__new') {
                      setNewBatch({ name: '', seats: '30' });
                    } else {
                      setNewBatch(null);
                      setFormData({ ...formData, batchId: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {!formData.batchId && !newBatch && <option value="">{courseBatches.length === 0 ? 'No batch yet: add one below' : 'Choose a batch'}</option>}
                  {courseBatches.map(b => {
                    const filled = students.filter(st => st.batchId === b.id).length;
                    return (
                      <option key={b.id} value={b.id} disabled={filled >= b.maxCapacity}>
                        {b.name} ({filled}/{b.maxCapacity}
                        {filled >= b.maxCapacity ? ' · Full' : ''})
                      </option>
                    );
                  })}
                  <option value="__new">＋ Add a new batch...</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Exam / Goal</label>
                <input
                  type="text"
                  placeholder="e.g. JEE Advanced 2026, NEET UG"
                  value={formData.targetExam}
                  onChange={e => setFormData({ ...formData, targetExam: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newProgram && (
                <div className="md:col-span-3 p-3.5 rounded-lg bg-blue-50/60 border border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">New program name</label>
                    <input
                      autoFocus
                      value={newProgram.name}
                      onChange={e => setNewProgram({ ...newProgram, name: e.target.value })}
                      placeholder="e.g. JEE 2 Year"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Standard fee</label>
                    <input
                      type="number"
                      min="0"
                      value={newProgram.fee}
                      onChange={e => setNewProgram({ ...newProgram, fee: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveNewProgram} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                      Save program
                    </button>
                    <button type="button" onClick={() => { setNewProgram(null); setQuickError(''); }} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {newBatch && (
                <div className="md:col-span-3 p-3.5 rounded-lg bg-blue-50/60 border border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New batch name</label>
                    <input
                      autoFocus
                      value={newBatch.name}
                      onChange={e => setNewBatch({ ...newBatch, name: e.target.value })}
                      placeholder="e.g. Morning Batch A"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Seats</label>
                    <input
                      type="number"
                      min="1"
                      value={newBatch.seats}
                      onChange={e => setNewBatch({ ...newBatch, seats: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveNewBatch} className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                      Save batch
                    </button>
                    <button type="button" onClick={() => { setNewBatch(null); setQuickError(''); }} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {quickError && <p className="md:col-span-3 text-xs text-rose-600">{quickError}</p>}
            </div>
          </div>

          {/* Section 4: Fees, Scholarship Discount & Payment Deposit */}
          <div className="pt-2 border-t border-slate-100 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>4. Fee Structure & Admission Receipt</span>
              <span className="text-slate-500 font-normal">Currency: {profile.currencySymbol}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Standard Tuition Fee</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.totalFees}
                    onChange={e => setFormData({ ...formData, totalFees: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scholarship / Concession</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.discount}
                    onChange={e => setFormData({ ...formData, discount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Net Payable Balance</label>
                <div className="px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg text-slate-900">
                  {profile.currencySymbol}{netPayable.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mb-4 max-w-xs">
              <label className="block text-xs font-medium text-slate-700 mb-1">Next installment due date</label>
              <DateInput clearable
                value={formData.nextDueDate}
                onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Optional. Used to show overdue fees and in reminders.</p>
            </div>

            {/* Initial Payment Toggle */}
            <div className="pt-3 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={formData.collectInitialPayment}
                  onChange={e => setFormData({ ...formData, collectInitialPayment: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-800">
                  Collect Initial Admission Deposit now & generate instant receipt
                </span>
              </label>

              {formData.collectInitialPayment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Deposit Amount</label>
                    <input
                      type="number"
                      value={formData.initialAmount}
                      onChange={e => setFormData({ ...formData, initialAmount: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
                    <Select
                      value={formData.initialMethod}
                      onChange={e => setFormData({ ...formData, initialMethod: e.target.value as PaymentMethod })}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash (Front Desk)</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Card">Debit / Credit Card</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Transaction Ref / Cheque No</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI/2026/88421"
                      value={formData.initialRef}
                      onChange={e => setFormData({ ...formData, initialRef: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Internal Academic Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Internal Counselor / Academic Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Target IIT Bombay, scored 98% in 10th Maths, needs morning doubt clearance session."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <p className="font-semibold">The admission was not saved. Please fix:</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {Object.values(errors).map(message => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Actions */}
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
              Complete Admission
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};