import React, { useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { StudyMaterial } from '../../types';
import { MaterialModal, TYPE_LABEL } from '../modals/MaterialModal';
import { formatDate, toLocalISODate } from '../utils/helpers';
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, FileText, ClipboardList } from 'lucide-react';

const TYPE_STYLE = {
  link: 'bg-blue-100 text-blue-700',
  note: 'bg-slate-100 text-slate-700',
  homework: 'bg-amber-100 text-amber-800'
} as const;

export const MaterialView: React.FC = () => {
  const { materials, batches, deleteMaterial } = useInstitute();
  const { user } = useAuth();
  const role = user?.role;
  const office = canManageInstitute(role);
  const canWrite = office || role === 'teacher';

  const [batchFilter, setBatchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<{ material: StudyMaterial | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const today = toLocalISODate();
  const list = useMemo(
    () =>
      materials
        .filter(m => (batchFilter === 'all' || m.batchId === batchFilter) && (typeFilter === 'all' || m.type === typeFilter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [materials, batchFilter, typeFilter]
  );

  const canChange = (m: StudyMaterial) => office || (role === 'teacher' && m.authorId === user?.id);
  const batchOptions = batches.filter(b => materials.some(m => m.batchId === b.id) || canWrite);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Study Material & Homework</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {canWrite ? 'Share notes, links and homework with the students of a batch.' : 'Notes, links and homework from your teachers.'}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setEditing({ material: null })}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 self-start"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        {batchOptions.length > 1 && (
          <select
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All batches</option>
            {batchOptions.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Nothing here yet</p>
          <p className="text-xs text-slate-400 mt-1">{canWrite ? 'Add the first note, link or homework.' : 'New material will show here.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(m => {
            const Icon = m.type === 'homework' ? ClipboardList : m.type === 'note' ? FileText : ExternalLink;
            const late = m.type === 'homework' && !!m.dueDate && m.dueDate < today;
            return (
              <article key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLE[m.type]}`}>
                      <Icon className="w-3 h-3" />
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {m.subject} · {m.batchName}
                    </span>
                  </div>
                  {canChange(m) && (
                    <div className="flex gap-1 shrink-0">
                      <button title="Edit" onClick={() => setEditing({ material: m })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button title="Delete" onClick={() => setDeleteTarget(m)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h2 className="text-sm font-bold text-slate-900 mt-3">{m.title}</h2>
                {m.description && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">{m.description}</p>}
                {m.dueDate && (
                  <p className={`text-[11px] font-semibold mt-2 ${late ? 'text-rose-600' : 'text-amber-700'}`}>
                    Submit by {formatDate(m.dueDate)}
                    {late && ' (date is over)'}
                  </p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    {m.authorName} · {formatDate(m.createdAt)}
                  </span>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && <MaterialModal material={editing.material} onClose={() => setEditing(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this material?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.title}</strong> will be removed for the students.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMaterial(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
