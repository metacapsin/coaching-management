import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, GraduationCap, Megaphone, MessageSquare, Pin, Trash2, UserPlus } from 'lucide-react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { addIds, useBellMemory } from '../utils/bellMemory';
import { requestFocus } from '../utils/focusItem';
import type { TabId } from '../../Context/Access';
import { formatDateTime } from '../utils/helpers';
import type { NotificationLog } from '../../types';

// The bell of everybody (principal, teacher, student, parent). One list, newest first:
//   everybody      the notices of the coaching that somebody else wrote (a notice for all, for the own batch, for the teachers)
//   the principal  also "a new student / teacher" (NOT the messages that he sends to the parents: they are for the parents)
//   a teacher      also "a new student" of the own subject and class
//   a parent       also the messages that the coaching sent about the child (absent, fee, result...)
// A click on a line opens the Notice Board and lights up that message there. The number on the sidebar counts what is new.
// A parent only reads: no page lets a parent or a student write a notice (the server refuses it too).
type Item = {
  id: string;
  kind: 'notice' | 'log';
  log?: NotificationLog;
  label: string;
  tone: string;
  title: string;
  body: string;
  time: number;
  when: string;
  pinned?: boolean;
  tab: 'notices'; // the page of this message
};

const LOG_LABEL: Record<string, [string, string]> = {
  attendance_absent: ['Absent', 'bg-rose-100 text-rose-700'],
  fee_due: ['Fee due', 'bg-amber-100 text-amber-700'],
  exam_result: ['Result', 'bg-blue-100 text-blue-700'],
  schedule_change: ['Schedule', 'bg-indigo-100 text-indigo-700'],
  general_announcement: ['Message', 'bg-slate-100 text-slate-700'],
  new_student: ['New student', 'bg-emerald-100 text-emerald-700'],
  new_teacher: ['New teacher', 'bg-teal-100 text-teal-700']
};

const logTime = (ts: string) => new Date(ts.replace(' ', 'T')).getTime() || 0;

export const NoticeBell: React.FC<{ onOpen: (tab: TabId) => void }> = ({ onOpen }) => {
  const { announcements, notificationLogs } = useInstitute();
  const { user } = useAuth();
  const { memory, update } = useBellMemory(user?.id);
  const [open, setOpen] = useState(false);
  const [freshIds, setFreshIds] = useState<string[]>([]); // the blue dots while the bell is open
  const ref = useRef<HTMLDivElement>(null);
  const role = user?.role;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const items = useMemo(() => {
    const list: Item[] = announcements
      .filter(a => a.authorId !== user?.id) // not the notices that I wrote myself
      .map(a => ({
        id: a.id,
        kind: 'notice' as const,
        label: a.audience === 'all' ? 'Everybody' : a.audience === 'teachers' ? 'Teachers' : a.batchName || 'Batch',
        tone: 'bg-blue-100 text-blue-700',
        title: a.title,
        body: a.body,
        time: new Date(a.createdAt).getTime() || 0,
        when: formatDateTime(a.createdAt),
        pinned: a.pinned,
        tab: 'notices' as const
      }));
    for (const l of notificationLogs) {
      const aboutPeople = l.type === 'new_student' || l.type === 'new_teacher';
      if (role === 'teacher' && l.type !== 'new_student') continue;
      if (role === 'admin' && !aboutPeople) continue; // the messages to the parents are not notifications for the principal
      if (role === 'student' && (!user?.isParent || l.channel === 'app')) continue; // a student gets no message that is for the parent
      if (role !== 'admin' && role !== 'teacher' && role !== 'student') continue;
      const [label, tone] = LOG_LABEL[l.type] ?? ['Message', 'bg-slate-100 text-slate-700'];
      list.push({
        id: l.id,
        kind: 'log',
        log: l,
        label,
        tone,
        title: l.studentName,
        body: l.content,
        time: logTime(l.timestamp),
        when: formatDateTime(l.timestamp.replace(' ', 'T')),
        tab: 'notices'
      });
    }
    return list.filter(i => !memory.hidden.includes(i.id)).sort((x, y) => y.time - x.time);
  }, [announcements, notificationLogs, memory.hidden, role, user?.id]);

  const unread = items.filter(i => !memory.seen.includes(i.id)).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // opening the bell means seen: the red number goes away, the blue dots stay until the bell is closed
      setFreshIds(items.filter(i => !memory.seen.includes(i.id)).map(i => i.id));
      if (unread > 0) update(m => ({ ...m, seen: addIds(m.seen, items.map(i => i.id)) }));
    }
  };

  // Deleting only takes the line out of the own bell (the notices and the messages stay on their page)
  const remove = (item: Item) => update(m => ({ ...m, hidden: addIds(m.hidden, [item.id]) }));
  const removeAll = () => {
    if (!window.confirm('Delete everything from this list? The notices stay on the Notice Board.')) return;
    update(m => ({ ...m, hidden: addIds(m.hidden, items.map(i => i.id)) }));
    setFreshIds([]);
  };

  // A click opens the page of the message and lights it up there; the line counts as read (the number on the sidebar goes down)
  const openItem = (item: Item) => {
    update(m => ({
      ...m,
      seen: addIds(m.seen, [item.id]),
      pageNotices: addIds(m.pageNotices, [item.id])
    }));
    requestFocus({ tab: item.tab, id: item.id }); // before the page opens: it lights up the message
    setOpen(false);
    onOpen(item.tab);
  };

  const iconOf = (item: Item) =>
    item.kind === 'notice' ? <Megaphone className="w-3 h-3" /> : item.log?.type === 'new_student' ? <UserPlus className="w-3 h-3" /> : item.log?.type === 'new_teacher' ? <GraduationCap className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notifications"
        aria-label="Notifications"
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
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">{items.length} total</span>
              {items.length > 0 && (
                <button type="button" onClick={removeAll} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Nothing new.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {items.map(n => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItem(n)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openItem(n);
                    }
                  }}
                  title="Open on the Notice Board"
                  className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${n.tone}`}>
                      {iconOf(n)}
                      {n.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {freshIds.includes(n.id) && <span className="w-2 h-2 rounded-full bg-blue-500" title="New" />}
                      <span className="text-[10px] font-mono text-slate-400">{n.when}</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation(); // deleting must not open it
                          remove(n);
                        }}
                        aria-label="Delete this notification"
                        title="Delete this notification"
                        className="p-1 -mr-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="mt-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1">
                      {n.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                      {n.title}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
