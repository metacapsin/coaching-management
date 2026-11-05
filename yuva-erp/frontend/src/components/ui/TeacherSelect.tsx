import React from 'react';
import { useAuth } from '../../Context/AuthContext';
import { sameSubject } from '../utils/parentNotices';

// The teacher who takes a test / gives a homework. The principal chooses it; the notice to the parents and the students names the
// subject and this teacher. The teacher is asked to confirm the date before the principal tells the parents.
export const useTeacherOf = (batchId: string, subject: string) => {
  const { users } = useAuth();
  const teachers = users.filter(u => u.role === 'teacher' && (u.status || 'active') === 'active' && (u.batchIds || []).includes(batchId));
  // the suggestion: the teacher of the batch whose subject is this subject
  const suggested = subject.trim() ? teachers.find(t => !!t.subject && sameSubject(t.subject, subject)) : undefined;
  const resolve = (chosenId: string) => {
    const t = teachers.find(x => x.id === chosenId) ?? suggested;
    return t ? { teacherId: t.id, teacherName: t.name } : undefined;
  };
  return { teachers, suggested, resolve };
};

export const TeacherSelect: React.FC<{
  batchId: string;
  subject: string;
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}> = ({ batchId, subject, value, onChange, label, className }) => {
  const { teachers, suggested } = useTeacherOf(batchId, subject);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={className || 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'}>
        <option value="">{suggested ? `The teacher of ${suggested.subject}: ${suggested.name}` : 'No teacher (nobody to confirm)'}</option>
        {teachers.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.subject ? ` (${t.subject})` : ''}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-400 mt-1">The teacher confirms the date first. Then you tell the parents and the students.</p>
    </div>
  );
};
