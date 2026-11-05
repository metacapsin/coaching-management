import React, { useEffect, useMemo, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { Announcement } from '../../types';
import { NoticeModal } from '../modals/NoticeModal';
import { formatDateTime } from '../utils/helpers';
import { addIds, useBellMemory } from '../utils/bellMemory';
import { FLASH_CLASS, useFocusFlash } from '../utils/focusItem';
import { Megaphone, Plus, Pencil, Trash2, Pin, PinOff, Users, Search, UserPlus, GraduationCap } from 'lucide-react';

export const NoticesView: React.FC = () => {
  const { announcements, updateAnnouncement, deleteAnnouncement, notificationLogs } = useInstitute();
  const { user } = useAuth();
  const role = user?.role;
  const office = canManageInstitute(role);
  const canWrite = office || role === 'teacher';

  const [editing, setEditing] = useState<{ notice: Announcement | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [query, setQuery] = useState('');

  // A notice that somebody else wrote and that was not seen before gets a "New" tag while this page is open. Opening the page
  // means seen: the number on the sidebar goes away.
  const { memory, update } = useBellMemory(user?.id);
  const [freshIds, setFreshIds] = useState<string[]>([]);

  // What happened with people (a new student, a new teacher) is shown here too, for the principal and for a teacher: it is the
  // same as the lines of the bell. (A teacher only gets the new students of the own subject and class from the server.)
  const activity = useMemo(
    () => (role === 'admin' || role === 'teacher' ? notificationLogs.filter(l => l.type === 'new_student' || l.type === 'new_teacher') : []),
    [notificationLogs, role]
  );

  useEffect(() => {
    const unseen = [
      ...announcements.filter(a => a.authorId !== user?.id).map(a => a.id),
      ...activity.map(l => l.id)
    ].filter(id => !memory.pageNotices.includes(id));
    if (!unseen.length) return;
    setFreshIds(prev => addIds(prev, unseen));
    update(m => ({ ...m, pageNotices: addIds(m.pageNotices, unseen) }));
  }, [announcements, activity, memory.pageNotices, user?.id, update]);

  // Opened from the bell: scroll to that message and light it up for a moment
  const flashId = useFocusFlash('notices', () => setQuery(''));

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...announcements]
      .filter(n => !q || [n.title, n.body, n.batchName, n.authorName].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt));
  }, [announcements, query]);

  // A teacher can change only what they wrote themselves
  const canChange = (n: Announcement) => office || (role === 'teacher' && n.authorId === user?.id);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notice Board</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {canWrite
              ? 'Announcements appear on the student portal at once. Use "pin" for important ones.'
              : 'Announcements from your institute and your teachers.'}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setEditing({ notice: null })}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 self-start"
          >
            <Plus className="w-4 h-4" />
            New Notice
          </button>
        )}
      </div>

      {announcements.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notices by title, message, batch or writer..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        </div>
      )}

      {activity.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">New students and teachers</h2>
            <p className="text-[11px] text-slate-500">What happened in your coaching, newest first.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {activity.map(l => (
              <li
                key={l.id}
                id={`focus-${l.id}`}
                className={`px-5 py-3 flex items-start gap-3 transition-shadow ${flashId === l.id ? FLASH_CLASS : ''}`}
              >
                <span className={`mt-0.5 p-1.5 rounded-lg ${l.type === 'new_student' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'}`}>
                  {l.type === 'new_student' ? <UserPlus className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{l.studentName}</span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{l.type === 'new_student' ? 'New student' : 'New teacher'}</span>
                    {freshIds.includes(l.id) && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">New</span>}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{l.content}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(l.timestamp.replace(' ', 'T'))}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No notices yet</p>
          <p className="text-xs text-slate-400 mt-1">{canWrite ? 'Publish the first notice.' : 'New notices will show here.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(n => (
            <article
              key={n.id}
              id={`focus-${n.id}`}
              className={`bg-white rounded-xl border p-5 shadow-xs transition-shadow ${n.pinned ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'} ${
                flashId === n.id ? FLASH_CLASS : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.pinned && <Pin className="w-3.5 h-3.5 text-indigo-600" />}
                    <h2 className="text-sm font-bold text-slate-900">{n.title}</h2>
                    {freshIds.includes(n.id) && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">New</span>}
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      <Users className="w-3 h-3" />
                      {n.audience === 'all' ? 'Everybody' : n.audience === 'teachers' ? 'Teachers' : n.batchName || 'Batch'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">{n.body}</p>
                  <p className="text-[11px] text-slate-400 mt-3">
                    {n.authorName} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {canChange(n) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {office && (
                      <button
                        title={n.pinned ? 'Unpin' : 'Pin to top'}
                        onClick={() => updateAnnouncement(n.id, { pinned: !n.pinned })}
                        className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                      >
                        {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      title="Edit"
                      onClick={() => setEditing({ notice: n })}
                      className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => setDeleteTarget(n)}
                      className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <NoticeModal notice={editing.notice} onClose={() => setEditing(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this notice?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.title}</strong> will disappear from the board.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteAnnouncement(deleteTarget.id);
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
