import { cleanName } from '../utils/names';
import { Select } from '../ui/Pickers';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../Context/AuthContext';
import type { RegistrationOptions } from '../../Context/AuthContext';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Hash,
  Users,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GRADES = ['Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper / Repeater'];

const fieldClass = (hasError: boolean, extra = '') =>
  `w-full py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${extra} ${
    hasError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
  }`;

const Field: React.FC<{
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email';
  right?: React.ReactNode;
}> = ({ label, icon: Icon, value, onChange, error, type = 'text', placeholder, autoComplete, inputMode, right }) => (
  <div>
    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
    <div className="relative">
      <Icon className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={fieldClass(!!error, `pl-9 ${right ? 'pr-10' : 'pr-3'}`)}
      />
      {right}
    </div>
    {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
  </div>
);

export const StudentSignupForm: React.FC = () => {
  const { registerNewStudent, getRegistrationOptions } = useAuth();

  // Loaded when the form opens: the roll number and the programs / batches the institute offers
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [loadError, setLoadError] = useState('');

  const firstBatchOf = (list: RegistrationOptions, courseId: string) =>
    list.batches.find(b => b.courseId === courseId)?.id || '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [grade, setGrade] = useState('Class 12');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRegistrationOptions()
      .then(loaded => {
        if (cancelled) return;
        setOptions(loaded);
        const firstCourse = loaded.courses[0]?.id || '';
        setCourseId(firstCourse);
        setBatchId(firstBatchOf(loaded, firstCourse));
      })
      .catch(err => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load the registration form.');
      });
    return () => {
      cancelled = true;
    };
  }, [getRegistrationOptions]);

  const courseBatches = options ? options.batches.filter(b => b.courseId === courseId) : [];

  const handleCourseChange = (id: string) => {
    setCourseId(id);
    if (options) setBatchId(firstBatchOf(options, id));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid 10-digit mobile number';
    if (!parentName.trim()) errs.parentName = 'Parent name is required';
    if (parentPhone.replace(/\D/g, '').length < 10) errs.parentPhone = 'Enter a valid 10-digit mobile number';
    if (!courseId) errs.courseId = 'Choose a program';
    if (!batchId) errs.batchId = 'Choose a batch';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Enter a valid email address';

    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errs.password = 'Include at least one letter and one number';
    }
    if (confirm !== password) errs.confirm = 'Passwords do not match';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await registerNewStudent({
        name,
        phone,
        parentName,
        parentPhone,
        grade,
        courseId,
        batchId,
        email,
        password
      });
      if (!result.ok) setFormError(result.error);
    } finally {
      setSubmitting(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(prev => !prev)}
      className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded"
      title={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  if (loadError) {
    return (
      <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">{loadError}</div>
    );
  }

  if (!options) {
    return (
      <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading registration form...
      </div>
    );
  }

  if (options.courses.length === 0 || options.batches.length === 0) {
    return (
      <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
        The institute has not opened any batch for registration yet. Please contact the institute.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
      {/* Automatic roll number */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Hash className="w-4 h-4 text-slate-400" />
          <span>Your roll number</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-slate-900">{options.nextRollNo}</span>
          <span className="block text-[10px] text-slate-400">Assigned automatically</span>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <Field
        label="Student Full Name"
        icon={User}
        value={name}
        onChange={v => setName(cleanName(v))}
        error={errors.name}
        autoComplete="name"
        placeholder="e.g. Aryan Gupta"
      />

      <Field
        label="Student Mobile Number"
        icon={Phone}
        value={phone}
        onChange={setPhone}
        error={errors.phone}
        inputMode="tel"
        autoComplete="tel"
        placeholder="10-digit mobile number"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Parent / Guardian Name"
          icon={Users}
          value={parentName}
          onChange={v => setParentName(cleanName(v))}
          error={errors.parentName}
          placeholder="e.g. Ramesh Gupta"
        />
        <Field
          label="Parent Mobile Number"
          icon={Phone}
          value={parentPhone}
          onChange={setParentPhone}
          error={errors.parentPhone}
          inputMode="tel"
          placeholder="10-digit mobile number"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
          <Select value={grade} onChange={e => setGrade(e.target.value)} className={fieldClass(false, 'px-3')}>
            {GRADES.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Program</label>
          <Select
            value={courseId}
            onChange={e => handleCourseChange(e.target.value)}
            className={fieldClass(!!errors.courseId, 'px-3')}
          >
            {options.courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Batch</label>
          <Select
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            className={fieldClass(!!errors.batchId, 'px-3')}
          >
            {courseBatches.length === 0 && <option value="">No batch for this program</option>}
            {courseBatches.map(b => {
              const full = b.filled >= b.maxCapacity;
              return (
                <option key={b.id} value={b.id} disabled={full}>
                  {b.name} ({b.startTime} - {b.endTime}){full ? ' · Full' : ''}
                </option>
              );
            })}
          </Select>
          {errors.batchId && <p className="text-xs text-rose-600 mt-1">{errors.batchId}</p>}
        </div>
      </div>

      <Field
        label="Email Address"
        icon={Mail}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={setEmail}
        error={errors.email}
      />

      <Field
        label="Password"
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={setPassword}
        error={errors.password}
        right={passwordToggle}
      />

      <Field
        label="Confirm Password"
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Re-enter your password"
        value={confirm}
        onChange={setConfirm}
        error={errors.confirm}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Please wait...
          </>
        ) : (
          'Register as New Student'
        )}
      </button>
    </form>
  );
};