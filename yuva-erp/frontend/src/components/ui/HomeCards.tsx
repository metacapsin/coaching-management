import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { formatDate, toLocalISODate } from '../utils/helpers';
import { Megaphone, BookOpen, PhoneCall, CheckCircle2, Circle, Rocket } from 'lucide-react';

type Go = (tab: string) => void;

const Card: React.FC<{ title: string; icon: React.ReactNode; action?: { label: string; onClick: () => void }; children: React.ReactNode }> = ({
  title,
  icon,
  action,
  children
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {action && (
        <button onClick={action.onClick} className="text-[11px] font-semibold text-blue-600 hover:underline">
          {action.label}
        </button>
      )}
    </div>
    {children}
  </div>
);

// Newest notices first (pinned ones on top)
export const NoticesCard: React.FC<{ onNavigate: Go; limit?: number }> = ({ onNavigate, limit = 3 }) => {
  const { announcements } = useInstitute();
  const list = [...announcements]
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return (
    <Card title="Notice Board" icon={<Megaphone className="w-4 h-4 text-indigo-600" />} action={{ label: 'View all', onClick: () => onNavigate('notices') }}>
      {list.length === 0 ? (
        <p className="p-5 text-xs text-slate-400">No notices yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map(n => (
            <li key={n.id} className="px-5 py-3">
              <div className="text-xs font-semibold text-slate-900">
                {n.pinned && <span className="text-indigo-600 mr-1">Pinned ·</span>}
                {n.title}
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {n.audience === 'all' ? 'Everybody' : n.audience === 'teachers' ? 'Teachers' : n.batchName} · {formatDate(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// Homework with a date coming up, and the latest material
export const MaterialCard: React.FC<{ onNavigate: Go; limit?: number }> = ({ onNavigate, limit = 4 }) => {
  const { materials } = useInstitute();
  const today = toLocalISODate();
  const list = [...materials]
    .sort((a, b) => {
      const aHw = a.type === 'homework' && !!a.dueDate && a.dueDate >= today;
      const bHw = b.type === 'homework' && !!b.dueDate && b.dueDate >= today;
      return Number(bHw) - Number(aHw) || b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limit);

  return (
    <Card title="Study Material & Homework" icon={<BookOpen className="w-4 h-4 text-emerald-600" />} action={{ label: 'View all', onClick: () => onNavigate('material') }}>
      {list.length === 0 ? (
        <p className="p-5 text-xs text-slate-400">Nothing shared yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map(m => (
            <li key={m.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{m.title}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {m.subject} · {m.batchName}
                </div>
              </div>
              {m.type === 'homework' && m.dueDate ? (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${m.dueDate < today ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>
                  Due {formatDate(m.dueDate)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 shrink-0 capitalize">{m.type}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// Enquiries to call back today (or earlier)
export const FollowUpsCard: React.FC<{ onNavigate: Go }> = ({ onNavigate }) => {
  const { enquiries } = useInstitute();
  const today = toLocalISODate();
  const due = enquiries
    .filter(e => e.status !== 'enrolled' && e.status !== 'lost' && !!e.followUpDate && e.followUpDate <= today)
    .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));

  return (
    <Card title={`Follow-ups due (${due.length})`} icon={<PhoneCall className="w-4 h-4 text-amber-600" />} action={{ label: 'Open enquiries', onClick: () => onNavigate('enquiries') }}>
      {due.length === 0 ? (
        <p className="p-5 text-xs text-slate-400">No call-backs are due. Good job!</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {due.slice(0, 5).map(e => (
            <li key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{e.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{e.phone}</div>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${e.followUpDate! < today ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                {e.followUpDate! < today ? 'Overdue ' : 'Today '}
                {formatDate(e.followUpDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// Shown to the principal while the institute is still being set up
export const GettingStarted: React.FC<{ onNavigate: Go; onOpenAdmission: () => void }> = ({ onNavigate, onOpenAdmission }) => {
  const { courses, batches, students, profile } = useInstitute();

  const steps = [
    { done: !!profile.name && profile.name !== 'My Institute', label: 'Fill in the institute profile', hint: 'Name, address and phone appear on receipts', go: () => onNavigate('settings') },
    { done: courses.length > 0, label: 'Add your programs and standard fees', hint: 'Fees & Invoicing → Programs & Standard Fees', go: () => onNavigate('fees') },
    { done: batches.length > 0, label: 'Create a batch', hint: 'Batches & Timetable → New batch', go: () => onNavigate('batches') },
    { done: students.length > 0, label: 'Admit the first student', hint: 'Fees and roll number are filled in for you', go: onOpenAdmission }
  ];
  if (steps.every(s => s.done)) return null;

  return (
    <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-xs">
      <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
        <Rocket className="w-4 h-4" />
        Getting started
      </h3>
      <p className="text-xs text-blue-800/80 mt-0.5">Four small steps and your institute is ready to use.</p>
      <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {steps.map(s => (
          <li key={s.label}>
            <button
              onClick={s.go}
              className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg bg-white/70 hover:bg-white border border-blue-100 transition-colors"
            >
              {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />}
              <span>
                <span className={`block text-xs font-semibold ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{s.label}</span>
                <span className="block text-[11px] text-slate-500">{s.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

