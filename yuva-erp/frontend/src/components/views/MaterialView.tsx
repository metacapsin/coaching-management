import { Select } from '../ui/Pickers';
import React, { useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { StudyMaterial } from '../../types';
import { MaterialModal, TYPE_LABEL } from '../modals/MaterialModal';
import { formatDate, toLocalISODate } from '../utils/helpers';
import { emailHomeworkNotice } from '../utils/api';
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, FileText, ClipboardList, Search, CheckCircle2, Circle, Send } from 'lucide-react';

const TYPE_STYLE = {
  link: 'bg-blue-100 text-blue-700',
  note: 'bg-slate-100 text-slate-700',
  homework: 'bg-amber-100 text-amber-800'
} as const;

export const MaterialView: React.FC = () => {
  const { materials, batches, students, submissions, deleteMaterial, markHomework, notifyHomework, mayTellAbout, confirmMaterial } = useInstitute();
  const { user } = useAuth();
  const role = user?.role;
  const office = canManageInstitute(role);
  const canWrite = office || role === 'teacher';

  const [batchFilter, setBatchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<{ material: StudyMaterial | null } | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const isStudent = role === 'student';
  const isParent = !!user?.isParent;
  const doneIds = new Set(submissions.map(x => x.materialId + ':' + x.studentId));
  const toggle = async (id: string, done: boolean) => {
    setBusyId(id);
    try {
      await markHomework(id, done);
    } finally {
      setBusyId('');
    }
  };
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const today = toLocalISODate();
  const list = useMemo(
    () =>
      materials
        .filter(m => (batchFilter === 'all' || m.batchId === batchFilter) && (typeFilter === 'all' || m.type === typeFilter))
        .filter(m => {
          const q = query.trim().toLowerCase();
          return !q || [m.title, m.description, m.subject, m.batchName].some(v => (v || '').toLowerCase().includes(q));
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [materials, batchFilter, typeFilter, query]
  );

  // what happened: the parents were told about the homework
  const [notice, setNotice] = useState('');
  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 7000);
  };

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
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title, subject or batch..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {batchOptions.length > 1 && (
          <Select
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
          </Select>
        )}
        <Select
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
        </Select>
      </div>

      {notice && (
        <div role="status" className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
          {notice}
        </div>
      )}

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
                  {(canChange(m) || (m.type === 'homework' && m.confirmed === false)) && (
                    <div className="flex gap-1 shrink-0">
                      {m.type === 'homework' && m.confirmed === false && office && (
                        <span className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg" title="The teacher has to confirm first">
                          Waiting for {m.teacherName || 'the teacher'} to confirm
                        </span>
                      )}
                      {m.type === 'homework' && m.confirmed === false && role === 'teacher' && (!m.teacherId || m.teacherId === user?.id) && mayTellAbout(m.subject) && (
                        <button
                          title="Yes, I gave this homework"
                          onClick={() => {
                            confirmMaterial(m.id);
                            flash('Confirmed. The principal can tell the parents and the students now.');
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Confirm
                        </button>
                      )}
                      {canChange(m) && m.type === 'homework' && m.confirmed !== false && mayTellAbout(m.subject) && (
                        <button
                          title="Tell the parents of this batch about this homework (and a test that is coming)"
                          onClick={async () => {
                            const told = notifyHomework(m);
                            let emailPart = '';
                            try {
                              const r = await emailHomeworkNotice(m.id);
                              emailPart = r.sent > 0 ? ` ${r.sent} email${r.sent === 1 ? ' was' : 's were'} also sent (students, parents and teachers of the batch).` : '';
                            } catch {
                              /* the messages in the app are sent all the same */
                            }
                            flash(told > 0 ? `The ${told} student${told === 1 ? '' : 's'} and the parent${told === 1 ? '' : 's'} were told about this homework.${emailPart}` : 'There is no student in this batch yet.');
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Tell parents
                        </button>
                      )}
                      {canChange(m) && (
                        <>
                          <button title="Edit" onClick={() => setEditing({ material: m })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button title="Delete" onClick={() => setDeleteTarget(m)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
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
                {m.type === 'homework' && isParent && (
                  <p className="mt-3 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    {submissions.some(x => x.materialId === m.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Circle className="w-3.5 h-3.5 text-slate-400" />}
                    {submissions.some(x => x.materialId === m.id) ? 'Your child has done this homework' : 'Not done yet'}
                  </p>
                )}
                {m.type === 'homework' && isStudent && !isParent && (
                  <button
                    onClick={() => void toggle(m.id, !submissions.some(x => x.materialId === m.id))}
                    disabled={busyId === m.id}
                    className={`mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start disabled:opacity-60 ${
                      submissions.some(x => x.materialId === m.id)
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : 'text-slate-700 bg-slate-50 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {submissions.some(x => x.materialId === m.id) ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    {submissions.some(x => x.materialId === m.id) ? 'Done (tap to undo)' : 'Mark as done'}
                  </button>
                )}
                {m.type === 'homework' && !isStudent && (() => {
                  const batchStudents = students.filter(x => x.batchId === m.batchId && x.status !== 'inactive');
                  const done = batchStudents.filter(x => doneIds.has(m.id + ':' + x.id)).length;
                  return (
                    <p className="mt-3 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {done} of {batchStudents.length} students marked it done
                    </p>
                  );
                })()}
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

      {editing && <MaterialModal material={editing.material} onClose={() => setEditing(null)} onSaved={flash} />}

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
