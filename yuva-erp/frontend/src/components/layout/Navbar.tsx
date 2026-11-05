import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import {
  Search,
  Bell,
  Trash2,
  UserPlus,
  Settings,
  Download,
  ChevronDown,
  X,
  MessageSquare,
  LogOut,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { useAuth, accountLabel } from '../../Context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useLang } from '../../i18n/LangContext';
import { downloadFromServer } from '../utils/api';
import { canManageInstitute } from '../../Context/Access';
import { NoticeBell } from './NoticeBell';
import type { NotificationLog } from '../../types';
import type { TabId } from '../../Context/Access';

export type { TabId };

interface NavbarProps {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  onOpenAdmission: () => void;
  onAddTeacher: () => void; // principal only
  onSelectStudent: (studentId: string) => void;
}

const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Live overview of your institute' },
  students: { title: 'Admissions & Students', subtitle: 'Enroll, search and manage students' },
  attendance: { title: 'Daily Attendance', subtitle: 'Mark roll call and alert parents' },
  fees: { title: 'Fees & Invoicing', subtitle: 'Collect fees, receipts and dues' },
  exams: { title: 'Exams & Results', subtitle: 'Tests, marks, ranks and report cards' },
  batches: { title: 'Batches & Timetable', subtitle: 'Batches, faculty and weekly schedule' },
  notifications: { title: 'Parent Broadcasts', subtitle: 'WhatsApp / SMS alerts and logs' },
  team: { title: 'Team & Access', subtitle: 'Teacher and student accounts, and your password' },
  settings: { title: 'Institute Profile', subtitle: 'Profile, backup and data tools' },
  enquiries: { title: 'Enquiries', subtitle: 'Admission leads and follow-ups' },
  notices: { title: 'Notice Board', subtitle: 'Announcements for students and batches' },
  material: { title: 'Study Material', subtitle: 'Notes, links and homework by batch' },
  reports: { title: 'Reports', subtitle: 'Fees, attendance, results and admissions' },
  expenses: { title: 'Expenses & Profit', subtitle: 'What the coaching spends and what is left' },
  library: { title: 'Library', subtitle: 'Books to read online' }
};

const SEEN_KEY = 'academia_os_notif_seen_v1';

const typeStyle = (type: string) => {
  switch (type) {
    case 'attendance_absent':
      return 'bg-rose-100 text-rose-700';
    case 'fee_due':
      return 'bg-amber-100 text-amber-700';
    case 'exam_result':
      return 'bg-blue-100 text-blue-700';
    case 'schedule_change':
      return 'bg-indigo-100 text-indigo-700';
    case 'new_student':
      return 'bg-emerald-100 text-emerald-700';
    case 'new_teacher':
      return 'bg-teal-100 text-teal-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenAdmission,
  onAddTeacher,
  onSelectStudent
}) => {
  const { profile, students, batches, notificationLogs, saveState, deleteNotification } = useInstitute();
  const { user, signOut, isAdmin } = useAuth();
  const canManage = canManageInstitute(user?.role);

  // Search state
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Dropdown state
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Unread notifications (count of logs already seen is remembered in the browser)
  const [seenCount, setSeenCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(SEEN_KEY);
      return stored ? Number(stored) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Live clock (updates every 30 seconds)
  const [now, setNow] = useState(new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { t } = useLang();
  const meta =
    activeTab === 'dashboard' && user?.role === 'student'
      ? { title: 'My Portal', subtitle: 'Your attendance, fees, results and timetable' }
      : activeTab === 'dashboard' && user?.role === 'teacher'
      ? { title: 'My Dashboard', subtitle: 'Your batches, classes and students' }
      : TAB_META[activeTab];
  // The lines that only the bell shows (a new student, a new teacher) are also read by the teachers, so the principal deleting
  // one only hides it from the own bell (remembered in this browser). The messages to the parents are really deleted.
  const hiddenKey = `academia_os_bell_hidden_v1_${user?.id ?? 'x'}`;
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const hide = (ids: string[]) => {
    const next = Array.from(new Set([...hiddenIds, ...ids]));
    setHiddenIds(next);
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(next));
    } catch {
      /* ignore storage errors */
    }
  };
  const bellLogs = notificationLogs.filter(l => !hiddenIds.includes(l.id));

  const unread = Math.max(0, bellLogs.length - seenCount);
  // the newest `unread` messages are the ones not seen yet (the list is newest first)
  // (opening the bell marks them seen, so the number is kept while the list is open: the blue dots stay until it is closed)
  const [freshCount, setFreshCount] = useState(0);
  const isNew = (index: number) => index < freshCount;

  const rememberSeen = (count: number) => {
    setSeenCount(count);
    try {
      localStorage.setItem(SEEN_KEY, String(count));
    } catch {
      /* ignore storage errors */
    }
  };

  // Deleting keeps the "seen" count right: it can never be more than the messages that are left
  const removeNotification = (log: NotificationLog, index: number) => {
    setFreshCount(c => (index < c ? c - 1 : c));
    rememberSeen(Math.min(seenCount, Math.max(0, bellLogs.length - 1)));
    if (log.channel === 'app') hide([log.id]);
    else deleteNotification(log.id);
  };
  const removeAllNotifications = () => {
    if (!window.confirm('Delete all notifications from this list?')) return;
    setFreshCount(0);
    rememberSeen(0);
    hide(bellLogs.filter(l => l.channel === 'app').map(l => l.id));
    for (const l of bellLogs) if (l.channel !== 'app') deleteNotification(l.id);
  };
  const recentLogs = bellLogs.slice(0, 6);

  // A click on a line shows the whole message right there (a second click closes it again)
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const toggleLog = (id: string) => setOpenLogId(prev => (prev === id ? null : id));

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (bellRef.current && !bellRef.current.contains(target)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Keyboard shortcuts: "/" focuses search, Esc closes dropdowns
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);

      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setBellOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Student search results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const qDigits = q.replace(/[\s+-]/g, '');

    return students
      .filter(s => {
        const textMatch =
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.parentName.toLowerCase().includes(q) ||
          s.targetExam.toLowerCase().includes(q);

        const phoneMatch =
          qDigits.length >= 3 &&
          (s.phone.replace(/[\s+-]/g, '').includes(qDigits) ||
            s.parentPhone.replace(/[\s+-]/g, '').includes(qDigits));

        return textMatch || phoneMatch;
      })
      .slice(0, 6);
  }, [query, students]);

  const pickStudent = (studentId: string) => {
    onSelectStudent(studentId);
    setQuery('');
    setSearchOpen(false);
    inputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[activeIndex]) pickStudent(results[activeIndex].id);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  };

  const markNotificationsSeen = () => {
    setSeenCount(bellLogs.length);
    try {
      localStorage.setItem(SEEN_KEY, String(bellLogs.length));
    } catch {
      /* ignore storage errors */
    }
  };

  const toggleBell = () => {
    const next = !bellOpen;
    setBellOpen(next);
    setProfileOpen(false);
    setSearchOpen(false);
    if (next) {
      setFreshCount(unread);
      markNotificationsSeen();
    }
  };

  const toggleProfile = () => {
    setProfileOpen(prev => !prev);
    setBellOpen(false);
    setSearchOpen(false);
  };

  const goTo = (tab: TabId) => {
    onNavigate(tab);
    setBellOpen(false);
    setProfileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 print:hidden">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
        {/* Page title */}
        <div className="hidden md:block min-w-0 mr-2 shrink-0 max-w-56">
          <h2 className="text-sm font-bold text-slate-900 truncate leading-tight">{t(meta.title)}</h2>
          <p className="text-[11px] text-slate-500 truncate">{t(meta.subtitle)}</p>
        </div>

        {/* Global student search */}
        <div ref={searchRef} className={`relative flex-1 max-w-xl ${canManage ? '' : 'hidden'}`}>
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search student, roll no, parent phone..."
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-10 py-2 text-xs bg-slate-100/80 border border-transparent rounded-lg focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-700 rounded"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:block absolute right-3 top-2 text-[10px] text-slate-400 border border-slate-300 rounded px-1.5 py-0.5 font-mono bg-white">
              /
            </kbd>
          )}

          {searchOpen && query.trim() && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
              {results.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No student found for "<span className="font-semibold text-slate-700">{query}</span>"
                </div>
              ) : (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Students ({results.length})
                  </div>
                  {results.map((s, i) => {
                    const batch = batches.find(b => b.id === s.batchId);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => pickStudent(s.id)}
                        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                          i === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={s.photoUrl}
                          alt={s.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate">{s.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            <span className="font-mono">{s.rollNo}</span>
                            <span className="mx-1 text-slate-300">·</span>
                            <span>{batch?.name || 'Batch'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 hidden sm:block shrink-0">
                          {s.parentPhone}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle />

          {/* Save status */}
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md ${
              saveState === 'saved'
                ? 'bg-emerald-50 text-emerald-700'
                : saveState === 'saving'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-rose-50 text-rose-700'
            }`}
            title={saveState === 'offline' ? 'Server not reachable. Changes are kept and sent when it is back.' : undefined}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${saveState === 'saved' ? 'bg-emerald-500' : saveState === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
            {saveState === 'saved' ? 'All saved' : saveState === 'saving' ? 'Saving...' : 'Offline'}
          </span>

          {/* Date & time */}
          <div className="hidden xl:block text-right leading-tight pr-1">
            <div className="text-xs font-semibold text-slate-800">
              {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="text-[11px] text-slate-500">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Quick admission */}
          <button
            type="button"
            onClick={onOpenAdmission}
            className={`px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
              canManage ? '' : 'hidden'
            }`}
            title="New Student Admission"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden lg:inline">New Admission</span>
          </button>

          {/* Quick add teacher (principal only: teachers get their login from the principal) */}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={onAddTeacher}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
              title="Add a teacher account"
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span className="hidden lg:inline">Add Teacher</span>
            </button>
          )}

          {/* A teacher, a student or a parent: the notices of the coaching */}
          {!canManage && user?.role !== 'super' && <NoticeBell />}

          {/* Notifications bell */}
          <div ref={bellRef} className={`relative ${canManage ? '' : 'hidden'}`}>
            <button
              type="button"
              onClick={toggleBell}
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Recent Notifications</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{bellLogs.length} total</span>
                    {bellLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={removeAllNotifications}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {recentLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications dispatched yet.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {recentLogs.map((log, index) => (
                      <div
                        key={log.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleLog(log.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleLog(log.id);
                          }
                        }}
                        title="Click to read the whole message"
                        className="group px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${typeStyle(
                              log.type
                            )}`}
                          >
                            {log.type.replace(/_/g, ' ')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {isNew(index) && <span className="w-2 h-2 rounded-full bg-blue-500" title="New" />}
                            <span className="text-[10px] font-mono text-slate-400">{log.timestamp}</span>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation(); // deleting must not open it
                                removeNotification(log, index);
                              }}
                              aria-label="Delete this notification"
                              title="Delete this notification"
                              className="p-1 -mr-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {log.studentName}
                              {log.channel !== 'app' && <span className="font-normal text-slate-500"> · to {log.recipientName}</span>}
                            </div>
                            <p className={`text-[11px] text-slate-500 mt-0.5 ${openLogId === log.id ? 'whitespace-pre-line break-words' : 'line-clamp-2'}`}>{log.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => goTo('notifications')}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors"
                >
                  Open Parent Broadcast Center →
                </button>
              </div>
            )}
          </div>

          {/* Profile menu */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={toggleProfile}
              className="flex items-center gap-2 pl-1 pr-2 py-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {(user?.name || profile.name).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden lg:block text-left leading-tight max-w-36">
                <span className="block text-xs font-semibold text-slate-900 truncate">
                  {user?.name || 'User'}
                </span>
                <span className="block text-[10px] text-slate-500">{accountLabel(user)}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      {accountLabel(user)}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {profile.name} · {profile.academicYear}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => goTo('team')}
                    className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    {isAdmin ? 'Team & Access' : 'My Account'}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => goTo('settings')}
                      className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Institute Profile & Settings
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => goTo('notifications')}
                      className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-slate-400" />
                      Parent Broadcast Center
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        void downloadFromServer('/backup', 'academiaos-backup.json').catch(() => undefined);
                        setProfileOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                      Download Data Backup
                    </button>
                  )}
                </div>

                <div className="py-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="w-full px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};