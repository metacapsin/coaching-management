import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Megaphone, Pin, Trash2, UserPlus } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { formatDateTime } from '../utils/helpers';

// The bell of a teacher, a student and a parent: the notices that the coaching sent (everybody, or the own batch; the teachers also
// get the notices for the teachers only, like a meeting, and a line when a new student joins one of their batches).
// What was seen and what was deleted is remembered in this browser, for this account. A deleted notice only disappears from
// this bell: it stays on the Notice Board and for everybody else.
type Memory = { seen: string[]; hidden: string[] };

// One line of the bell: a notice, or (for a teacher) a new student in the own batch
type Item = { id: string; kind: 'notice' | 'student'; label: string; title: string; body: string; time: number; pinned?: boolean; when: string };

const read = (key: string): Memory => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (raw && Array.isArray(raw.seen) && Array.isArray(raw.hidden)) return raw;
  } catch {
    /* storage can be blocked */
  }
  return { seen: [], hidden: [] };
};

export const NoticeBell: React.FC<{ onOpenBoard: () => void }> = ({ onOpenBoard }) => {
  const { announcements, notificationLogs } = useInstitute();
  const { user } = useAuth();
  const key = `academia_os_notice_bell_v1_${user?.id ?? 'x'}`;
  const [memory, setMemory] = useState<Memory>(() => read(key));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMemory(read(key)), [key]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const save = (next: Memory) => {
    setMemory(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore storage errors */
    }
  };

  // newest first, the deleted ones are not shown
  const notices = useMemo(() => {
    const list: Item[] = announcements.map(a => ({
      id: a.id,
      kind: 'notice',
      label: a.audience === 'all' ? 'Everybody' : a.audience === 'teachers' ? 'Teachers' : a.batchName || 'Batch',
      title: a.title,
      body: a.body,
      time: new Date(a.createdAt).getTime() || 0,
      pinned: a.pinned,
      when: formatDateTime(a.createdAt)
    }));
    if (user?.role === 'teacher') {
      for (const l of notificationLogs) {
        if (l.type !== 'new_student') continue;
        list.push({
          id: l.id,
          kind: 'student',
          label: 'New student',
          title: l.studentName,
          body: l.content,
          time: new Date(l.timestamp.replace(' ', 'T')).getTime() || 0,
          when: formatDateTime(l.timestamp.replace(' ', 'T'))
        });
      }
    }
    return list.filter(i => !memory.hidden.includes(i.id)).sort((x, y) => y.time - x.time);
  }, [announcements, notificationLogs, memory.hidden, user?.role]);
  const unread = notices.filter(a => !memory.seen.includes(a.id)).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // opening the bell means the notices were seen: the red number goes away (the blue dots stay until it is closed)
    if (next && unread > 0) save({ ...memory, seen: Array.from(new Set([...memory.seen, ...notices.map(n => n.id)])) });
  };

  const remove = (id: string) => save({ seen: memory.seen, hidden: Array.from(new Set([...memory.hidden, id])) });
  const removeAll = () => {
    if (!window.confirm('Delete everything from this list? The notices stay on the Notice Board.')) return;
    save({ seen: memory.seen, hidden: Array.from(new Set([...memory.hidden, ...notices.map(n => n.id)])) });
  };

  // the dots: a notice is "new" while it was not seen before this opening
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    if (open) setFreshIds(notices.filter(n => !memory.seen.includes(n.id)).map(n => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notices from the coaching"
        aria-label="Notices from the coaching"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{user?.role === 'teacher' ? 'Notifications' : 'Notices'}</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">{notices.length} total</span>
              {notices.length > 0 && (
                <button type="button" onClick={removeAll} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {notices.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Nothing new from the coaching.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notices.map(n => (
                <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                        n.kind === 'student' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {n.kind === 'student' ? <UserPlus className="w-3 h-3" /> : <Megaphone className="w-3 h-3" />}
                      {n.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {freshIds.includes(n.id) && <span className="w-2 h-2 rounded-full bg-blue-500" title="New" />}
                      <span className="text-[10px] font-mono text-slate-400">{n.when}</span>
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        aria-label="Delete this from the list"
                        title="Delete this from the list"
                        className="p-1 -mr-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="mt-1.5 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1">
                      {n.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                      {n.title}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenBoard();
            }}
            className="w-full px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors"
          >
            Open Notice Board →
          </button>
        </div>
      )}
    </div>
  );
};
