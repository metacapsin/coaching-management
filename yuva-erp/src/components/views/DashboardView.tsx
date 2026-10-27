import React, { useState } from 'react';
import { GettingStarted, FollowUpsCard, NoticesCard } from '../ui/HomeCards';
import { useInstitute } from '../../Context/InstituteContext';
import type { TimetableSlot, Student } from '../../types';
import {
  Users,
  UserPlus,
  CalendarCheck,
  CreditCard,
  Award,
  Bell,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Activity,
  UserX,
  Layers,
  MessageSquare
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenAdmission: () => void;
  onOpenRecordPayment: () => void;
  onSelectStudent: (studentId: string) => void;
  onViewReceipt: (transactionId: string) => void;
  // Optional: opens the payment modal with this student pre-selected
  onCollectPayment?: (studentId: string) => void;
  // Optional (principal only): opens the Add Account window for a new teacher
  onAddTeacher?: () => void;
}

// ---------- Settings ----------

// A student is flagged when attendance is below this %, after at least MIN classes were marked
const LOW_ATTENDANCE_THRESHOLD = 75;
const MIN_CLASSES_FOR_ALERT = 2;

// ---------- Helpers ----------

// Indian number format: 1117500 -> 11,17,500
const formatINR = (n: number) => n.toLocaleString('en-IN');

// Short money labels for chart bars: 65000 -> 65K, 145000 -> 1.5L
const formatCompactINR = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};

// Local date as YYYY-MM-DD (toISOString() would give the UTC date)
const toLocalISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Date -> "2026-10"
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// First day of the month, shifted by `delta` months
const shiftMonth = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);

// "2026-10" -> "Oct 26"
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

// 2026-10-13 -> 13 Oct
const formatShortDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Whole days between two YYYY-MM-DD dates
const daysBetween = (fromIso: string, toIso: string) => {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
};

// "04:30 PM" -> minutes since midnight
const timeToMinutes = (t: string) => {
  const m = (t || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

// Round avatar: shows the photo, or initials if the photo is missing/broken
const Avatar: React.FC<{ name: string; photoUrl?: string; size?: string }> = ({
  name,
  photoUrl,
  size = 'w-8 h-8'
}) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!photoUrl || failed) {
    return (
      <div
        className={`${size} rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center border border-slate-200 shrink-0`}
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      onError={() => setFailed(true)}
      className={`${size} rounded-full object-cover border border-slate-200 shrink-0`}
    />
  );
};

// "vs last month" arrow label
const TrendLabel: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-slate-400">No activity yet</span>;
  }
  if (previous === 0) {
    return <span className="text-[11px] text-emerald-600 font-medium">New this month</span>;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) {
    return <span className="text-[11px] text-slate-500">Same as last month</span>;
  }
  const up = change > 0;
  return (
    <span className={`text-[11px] font-medium flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(change)}% vs last month
    </span>
  );
};

type FeeRange = '6M' | '12M' | 'ALL';

const MAX_BAR_PX = 112;

// ---------- Component ----------

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAdmission,
  onOpenRecordPayment,
  onSelectStudent,
  onViewReceipt,
  onCollectPayment,
  onAddTeacher
}) => {
  const {
    profile,
    students,
    batches,
    transactions: allTransactions,
    exams,
    attendance,
    timetable,
    templates,
    sendNotification,
    getStudentAttendanceStats,
    enquiries
  } = useInstitute();
  // Cancelled receipts are not money received
  const transactions = allTransactions.filter(t => t.status !== 'cancelled');

  const [feeRange, setFeeRange] = useState<FeeRange>('ALL');
  const [alertedIds, setAlertedIds] = useState<string[]>([]);

  const now = new Date();
  const todayStr = toLocalISODate(now);

  // The strip "Today": what needs the principal's eyes right now
  const collectedToday = transactions.filter(t => t.date === todayStr).reduce((n, t) => n + t.amount, 0);
  const followUpsDue = enquiries.filter(e => e.status !== 'enrolled' && e.status !== 'lost' && !!e.followUpDate && e.followUpDate <= todayStr).length;
  const overdueFees = students.filter(
    s => s.status !== 'inactive' && !!s.nextDueDate && s.nextDueDate < todayStr && s.totalFees - s.discount - s.feePaid > 0
  ).length;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });

  // ----- Students -----
  // Archived students are not counted as enrolled
  const currentStudents = students.filter(s => s.status !== 'inactive');
  const activeStudents = currentStudents.filter(s => s.status === 'active');
  const totalEnrolled = currentStudents.length;
  const activePercent = totalEnrolled > 0 ? Math.round((activeStudents.length / totalEnrolled) * 100) : 0;

  // ----- Fee metrics -----
  const totalCourseFees = students.reduce((acc, s) => acc + Math.max(0, s.totalFees - s.discount), 0);
  const totalCollected = students.reduce((acc, s) => acc + s.feePaid, 0);
  const totalDues = Math.max(0, totalCourseFees - totalCollected);
  const feeCollectionRate = totalCourseFees > 0 ? Math.round((totalCollected / totalCourseFees) * 100) : 0;

  // ----- Today's attendance (real data only) -----
  const todayAttendanceRecords = attendance.filter(a => a.date === todayStr);
  let totalMarkedToday = 0;
  let presentToday = 0;
  let absentToday = 0;

  todayAttendanceRecords.forEach(rec => {
    const records: Record<string, string> = rec.records || {};
    Object.values(records).forEach(status => {
      totalMarkedToday++;
      if (status === 'present' || status === 'late') presentToday++;
      if (status === 'absent') absentToday++;
    });
  });

  const markedBatchCount = todayAttendanceRecords.length;
  const todayAttendanceRate =
    totalMarkedToday > 0 ? Math.round((presentToday / totalMarkedToday) * 100) : 0;

  // ----- Students absent today (for parent alerts) -----
  const absentTodayList: { student: Student; batchName: string }[] = [];
  todayAttendanceRecords.forEach(rec => {
    const records: Record<string, string> = rec.records || {};
    Object.entries(records).forEach(([studentId, status]) => {
      if (status === 'absent') {
        const student = students.find(s => s.id === studentId);
        if (student) {
          absentTodayList.push({
            student,
            batchName: batches.find(b => b.id === rec.batchId)?.name || 'Batch'
          });
        }
      }
    });
  });

  const handleAlertParent = (student: Student, batchName: string) => {
    const template = templates.find(t => t.type === 'attendance_absent') || templates[0];
    let msg =
      template?.templateBody || 'Dear {{parent_name}}, {{student_name}} was absent on {{date}}.';
    msg = msg
      .replace(/{{parent_name}}/g, student.parentName)
      .replace(/{{student_name}}/g, student.name)
      .replace(/{{roll_no}}/g, student.rollNo)
      .replace(/{{batch_name}}/g, batchName)
      .replace(/{{date}}/g, todayStr);

    sendNotification({
      type: 'attendance_absent',
      channel: 'whatsapp',
      recipientName: student.parentName,
      recipientPhone: student.parentPhone,
      studentName: student.name,
      content: msg
    });

    setAlertedIds(prev => (prev.includes(student.id) ? prev : [...prev, student.id]));

    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ----- Attendance trend: last 7 days -----
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const iso = toLocalISODate(d);
    let total = 0;
    let present = 0;
    attendance
      .filter(a => a.date === iso)
      .forEach(rec => {
        const records: Record<string, string> = rec.records || {};
        Object.values(records).forEach(s => {
          total++;
          if (s === 'present' || s === 'late') present++;
        });
      });
    return {
      iso,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      rate: total > 0 ? Math.round((present / total) * 100) : null,
      isToday: iso === todayStr
    };
  });
  const daysWithData = last7Days.filter(d => d.rate !== null);
  const weekAverage =
    daysWithData.length > 0
      ? Math.round(daysWithData.reduce((acc, d) => acc + (d.rate as number), 0) / daysWithData.length)
      : null;

  // ----- Low attendance students -----
  const lowAttendanceList = currentStudents
    .map(s => ({ student: s, stats: getStudentAttendanceStats(s.id) }))
    .filter(item => item.stats.total >= MIN_CLASSES_FOR_ALERT && item.stats.percentage < LOW_ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.stats.percentage - b.stats.percentage)
    .slice(0, 4);

  // ----- Monthly fee collection chart -----
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let monthCount = feeRange === '6M' ? 6 : feeRange === '12M' ? 12 : 6;
  if (feeRange === 'ALL') {
    const dates = transactions
      .map(t => t.date)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      const first = new Date(`${dates[0].slice(0, 7)}-01T00:00:00`);
      const span =
        (currentMonthStart.getFullYear() - first.getFullYear()) * 12 +
        (currentMonthStart.getMonth() - first.getMonth()) +
        1;
      monthCount = Math.min(24, Math.max(6, span));
    }
  }

  const feeMonths = Array.from({ length: monthCount }, (_, i) => {
    const key = monthKeyOf(shiftMonth(currentMonthStart, -(monthCount - 1 - i)));
    const total = transactions
      .filter(t => (t.date || '').startsWith(key))
      .reduce((acc, t) => acc + t.amount, 0);
    return { key, label: monthLabel(key), total };
  });
  const maxMonthTotal = Math.max(...feeMonths.map(m => m.total), 0);
  const rangeTotal = feeMonths.reduce((acc, m) => acc + m.total, 0);
  const rangeAverage = feeMonths.length > 0 ? Math.round(rangeTotal / feeMonths.length) : 0;

  // ----- This month vs last month -----
  const thisMonthKey = monthKeyOf(now);
  const prevMonthKey = monthKeyOf(shiftMonth(currentMonthStart, -1));
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  const admissionsThisMonth = students.filter(s => (s.dateOfAdmission || '').startsWith(thisMonthKey)).length;
  const admissionsPrevMonth = students.filter(s => (s.dateOfAdmission || '').startsWith(prevMonthKey)).length;

  const txThisMonth = transactions.filter(t => (t.date || '').startsWith(thisMonthKey));
  const txPrevMonth = transactions.filter(t => (t.date || '').startsWith(prevMonthKey));
  const collectedThisMonth = txThisMonth.reduce((acc, t) => acc + t.amount, 0);
  const collectedPrevMonth = txPrevMonth.reduce((acc, t) => acc + t.amount, 0);

  // ----- Batch capacity (actual enrolled students) -----
  const batchCapacity = batches.map(b => {
    const enrolled = students.filter(s => s.batchId === b.id).length;
    const percent = b.maxCapacity > 0 ? Math.round((enrolled / b.maxCapacity) * 100) : 0;
    return { batch: b, enrolled, percent, seatsLeft: Math.max(0, b.maxCapacity - enrolled) };
  });

  // ----- Fee defaulters (highest balance first) -----
  const feeDefaulters = students
    .map(s => {
      const net = Math.max(0, s.totalFees - s.discount);
      const balance = Math.max(0, net - s.feePaid);
      return { student: s, balance };
    })
    .filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 4);

  // ----- Recent admissions (newest first) -----
  const recentAdmissions = [...students]
    .sort((a, b) => (b.dateOfAdmission || '').localeCompare(a.dateOfAdmission || ''))
    .slice(0, 5);

  // ----- Recent receipts (newest first) -----
  const recentReceipts = [...transactions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  // ----- Exams -----
  const publishedExams = exams.filter(e => e.status === 'published').length;
  const upcomingExams = exams
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const upcomingExamCount = exams.filter(e => e.date >= todayStr).length;

  // ----- Today's classes (only today's weekday, in time order) -----
  const todayClasses = timetable
    .filter(t => t.dayOfWeek === dayName)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const visibleClasses = todayClasses.slice(0, 5);

  const getSlotStatus = (slot: TimetableSlot): 'done' | 'live' | 'upcoming' => {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    if (nowMinutes >= end) return 'done';
    if (nowMinutes >= start) return 'live';
    return 'upcoming';
  };

  return (
    <div className="space-y-6">
      <GettingStarted onNavigate={onNavigate} onOpenAdmission={onOpenAdmission} />

      {/* Top Banner & Quick Action Shortcuts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Academic Session {profile.academicYear}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {now.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Welcome to {profile.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Institute Management Command Center · Real-time admissions, attendance, fees & exam analytics.
          </p>
        </div>

        {/* Quick Launch Buttons (New Admission lives in the sidebar and top navbar) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('attendance')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            Mark Attendance
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-blue-600" />
            Collect Fee
          </button>
          <button
            onClick={() => onNavigate('notifications')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            Broadcast Alert
          </button>
          {onAddTeacher && (
            <button
              onClick={onAddTeacher}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Add Teacher
            </button>
          )}
        </div>
      </div>

      {/* Today */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Collected today", value: `${profile.currencySymbol}${collectedToday.toLocaleString('en-IN')}`, tab: 'fees', tone: 'text-emerald-700' },
          { label: 'Absent today', value: absentToday, tab: 'attendance', tone: absentToday > 0 ? 'text-rose-700' : 'text-slate-900' },
          { label: 'Follow-ups due', value: followUpsDue, tab: 'enquiries', tone: followUpsDue > 0 ? 'text-amber-700' : 'text-slate-900' },
          { label: 'Overdue fee accounts', value: overdueFees, tab: 'fees', tone: overdueFees > 0 ? 'text-rose-700' : 'text-slate-900' }
        ].map(item => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.tab)}
            className="text-left bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${item.tone}`}>{item.value}</div>
          </button>
        ))}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Enrolled Students
            </span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {totalEnrolled}
            </span>
            {totalEnrolled > 0 && (
              <span className="text-xs text-emerald-600 font-medium flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                {activePercent}% Active
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>Across {batches.length} Batches</span>
            <button onClick={() => onNavigate('students')} className="text-blue-600 hover:underline">
              View Roster →
            </button>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Attendance Today
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {totalMarkedToday > 0 ? `${todayAttendanceRate}%` : '—'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {totalMarkedToday > 0 ? `${presentToday} Present` : 'Not marked yet'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>
              {totalMarkedToday > 0 ? `${absentToday} Absent · ` : ''}
              {markedBatchCount}/{batches.length} batches marked
            </span>
            <button onClick={() => onNavigate('attendance')} className="text-emerald-700 hover:underline">
              Take Roll →
            </button>
          </div>
        </div>

        {/* Fee Collection */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Revenue Collected
            </span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {profile.currencySymbol}{formatINR(totalCollected)}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              {feeCollectionRate}% Realized
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>Pending: {profile.currencySymbol}{formatINR(totalDues)}</span>
            <button onClick={() => onNavigate('fees')} className="text-indigo-600 hover:underline">
              Ledger →
            </button>
          </div>
        </div>

        {/* Tests */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tests & Exams
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {exams.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {publishedExams} Published
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>{upcomingExamCount} Upcoming</span>
            <button onClick={() => onNavigate('exams')} className="text-amber-700 hover:underline">
              Leaderboard →
            </button>
          </div>
        </div>
      </div>

      {/* This Month Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            New Admissions · {monthName}
          </span>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">{admissionsThisMonth}</span>
            <TrendLabel current={admissionsThisMonth} previous={admissionsPrevMonth} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Fees Collected · {monthName}
          </span>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {profile.currencySymbol}{formatINR(collectedThisMonth)}
            </span>
            <TrendLabel current={collectedThisMonth} previous={collectedPrevMonth} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Receipts Issued · {monthName}
          </span>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">{txThisMonth.length}</span>
            <TrendLabel current={txThisMonth.length} previous={txPrevMonth.length} />
          </div>
        </div>
      </div>

      {/* Charts Row: Fee Collection + Attendance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Fee Collection Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Monthly Fee Collection</h3>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['6M', '12M', 'ALL'] as FeeRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setFeeRange(range)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    feeRange === range
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range === 'ALL' ? 'All' : range}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 mb-4">
              <span>
                Total:{' '}
                <strong className="font-mono text-slate-900">
                  {profile.currencySymbol}{formatINR(rangeTotal)}
                </strong>
              </span>
              <span>
                Monthly average:{' '}
                <strong className="font-mono text-slate-900">
                  {profile.currencySymbol}{formatINR(rangeAverage)}
                </strong>
              </span>
            </div>

            {rangeTotal === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                No fee payments recorded in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 min-w-max sm:min-w-0 sm:w-full">
                  {feeMonths.map(m => (
                    <div
                      key={m.key}
                      className="flex-1 min-w-[38px] flex flex-col items-center gap-1"
                      title={`${m.label}: ${profile.currencySymbol}${formatINR(m.total)}`}
                    >
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: MAX_BAR_PX + 20 }}>
                        <span className="text-[10px] font-mono text-slate-500 mb-0.5 h-3.5">
                          {m.total > 0 ? `${profile.currencySymbol}${formatCompactINR(m.total)}` : ''}
                        </span>
                        <div
                          className={`w-full max-w-[28px] rounded-t transition-all ${
                            m.total > 0
                              ? m.key === thisMonthKey
                                ? 'bg-indigo-600'
                                : 'bg-indigo-400'
                              : 'bg-slate-200'
                          }`}
                          style={{
                            height:
                              m.total > 0
                                ? Math.max(4, Math.round((m.total / maxMonthTotal) * MAX_BAR_PX))
                                : 2
                          }}
                        />
                      </div>
                      <span
                        className={`text-[10px] whitespace-nowrap ${
                          m.key === thisMonthKey ? 'font-semibold text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Trend (last 7 days) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Attendance · Last 7 Days</h3>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Open →
            </button>
          </div>

          <div className="p-4">
            <div className="text-xs text-slate-500 mb-4">
              {weekAverage !== null ? (
                <>
                  Average turnout:{' '}
                  <strong className="font-mono text-slate-900">{weekAverage}%</strong>
                  <span className="text-slate-400"> · {daysWithData.length} of 7 days marked</span>
                </>
              ) : (
                'No attendance marked in the last 7 days.'
              )}
            </div>

            <div className="flex items-end gap-2">
              {last7Days.map(day => {
                const barColor =
                  day.rate === null
                    ? 'bg-slate-200'
                    : day.rate >= 85
                    ? 'bg-emerald-500'
                    : day.rate >= LOW_ATTENDANCE_THRESHOLD
                    ? 'bg-amber-400'
                    : 'bg-rose-500';
                return (
                  <div
                    key={day.iso}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={day.rate === null ? `${day.iso}: not marked` : `${day.iso}: ${day.rate}% present`}
                  >
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: MAX_BAR_PX + 20 }}>
                      <span className="text-[10px] font-mono text-slate-500 mb-0.5 h-3.5">
                        {day.rate !== null ? `${day.rate}%` : '–'}
                      </span>
                      <div
                        className={`w-full max-w-[24px] rounded-t transition-all ${barColor}`}
                        style={{
                          height: day.rate !== null ? Math.max(4, Math.round((day.rate / 100) * MAX_BAR_PX)) : 2
                        }}
                      />
                    </div>
                    <span
                      className={`text-[10px] ${day.isToday ? 'font-semibold text-slate-700' : 'text-slate-400'}`}
                    >
                      {day.isToday ? 'Today' : day.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500" /> 85%+
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-400" /> {LOW_ATTENDANCE_THRESHOLD}-84%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-rose-500" /> Below {LOW_ATTENDANCE_THRESHOLD}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attention Row: Absent Today, Low Attendance, Batch Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Absent Today */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-900">Absent Today</h3>
              {absentTodayList.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 rounded">
                  {absentTodayList.length}
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Attendance →
            </button>
          </div>

          {totalMarkedToday === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-400">
              Today's attendance is not marked yet.
              <div className="mt-2">
                <button
                  onClick={() => onNavigate('attendance')}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  Mark Attendance
                </button>
              </div>
            </div>
          ) : absentTodayList.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
              No absentees today. Full turnout!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {absentTodayList.map(({ student, batchName }) => {
                const alerted = alertedIds.includes(student.id);
                return (
                  <div
                    key={student.id}
                    className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={student.name} photoUrl={student.photoUrl} />
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left block truncate"
                        >
                          {student.name}
                        </button>
                        <span className="text-[11px] text-slate-500 block truncate">{batchName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAlertParent(student, batchName)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border flex items-center gap-1 shrink-0 transition-colors ${
                        alerted
                          ? 'text-slate-500 bg-slate-50 border-slate-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                      }`}
                      title="Send absence alert to parent on WhatsApp"
                    >
                      {alerted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Alerted
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3 h-3" />
                          Alert Parent
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Attendance */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Low Attendance (&lt;{LOW_ATTENDANCE_THRESHOLD}%)
              </h3>
            </div>
          </div>

          {lowAttendanceList.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
              No student is below {LOW_ATTENDANCE_THRESHOLD}% attendance.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowAttendanceList.map(({ student, stats }) => (
                <div
                  key={student.id}
                  className="p-3 hover:bg-slate-50/50 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={student.name} photoUrl={student.photoUrl} />
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left block truncate"
                        >
                          {student.name}
                        </button>
                        <span className="text-[11px] text-slate-500 block">
                          {stats.present} of {stats.total} classes attended
                        </span>
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        stats.percentage < 50 ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      {stats.percentage}%
                    </span>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stats.percentage < 50 ? 'bg-rose-500' : 'bg-amber-400'}`}
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Batch Capacity */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Batch Capacity</h3>
            </div>
            <button
              onClick={() => onNavigate('batches')}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Batches →
            </button>
          </div>

          {batchCapacity.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">No batches created yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {batchCapacity.map(({ batch, enrolled, percent, seatsLeft }) => (
                <div key={batch.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">{batch.name}</span>
                    <span className="font-mono text-slate-600 shrink-0">
                      {enrolled}/{batch.maxCapacity}
                    </span>
                  </div>
                  <div className="mt-1.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        percent >= 100 ? 'bg-rose-500' : percent >= 90 ? 'bg-amber-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] mt-1 block ${
                      seatsLeft === 0 ? 'text-rose-600 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {seatsLeft === 0 ? 'Batch full' : `${seatsLeft} seats left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Left Column (Timetable & Dues) + Right Column (Admissions, Receipts, Tests) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Class Schedule */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Today's Class Schedule</h3>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  {todayClasses.length} {todayClasses.length === 1 ? 'Session' : 'Sessions'} Scheduled
                </span>
              </div>
              <button
                onClick={() => onNavigate('batches')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Full Timetable Grid →
              </button>
            </div>

            {visibleClasses.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No classes scheduled for today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleClasses.map(slot => {
                  const status = getSlotStatus(slot);
                  return (
                    <div
                      key={slot.id}
                      className={`p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors ${
                        status === 'done' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-center min-w-16 py-1 px-2 bg-slate-100 rounded-lg text-xs">
                          <span className="font-semibold text-slate-900 block">{slot.startTime}</span>
                          <span className="text-[10px] text-slate-500">{slot.endTime}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900">{slot.subject}</h4>
                            {status === 'live' && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                LIVE NOW
                              </span>
                            )}
                            {status === 'done' && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Completed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {slot.batchName} · <span className="text-slate-700 font-medium">{slot.classroom}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Faculty: {slot.facultyName}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigate('attendance')}
                        className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        Attendance
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {todayClasses.length > visibleClasses.length && (
              <div className="px-4 py-2.5 text-xs text-center text-slate-500 border-t border-slate-100">
                +{todayClasses.length - visibleClasses.length} more classes today ·{' '}
                <button onClick={() => onNavigate('batches')} className="text-blue-600 hover:underline">
                  View full timetable
                </button>
              </div>
            )}
          </div>

          {/* Pending Fee Reminders / Defaulters Alert */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-900">Overdue Tuition Accounts Requiring Follow-Up</h3>
              </div>
              <button
                onClick={() => onNavigate('fees')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                View All Defaulters →
              </button>
            </div>

            {feeDefaulters.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                All tuition fee accounts are cleared!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {feeDefaulters.map(({ student, balance }) => (
                  <div
                    key={student.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={student.name} photoUrl={student.photoUrl} />
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectStudent(student.id)}
                            className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {student.name}
                          </button>
                          <span className="font-mono text-[11px] text-slate-400">({student.rollNo})</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Parent: {student.parentName} · Phone: {student.parentPhone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono font-bold text-rose-600 block">
                          {profile.currencySymbol}{formatINR(balance)}
                        </span>
                        <span className="text-[10px] text-slate-400">Balance Due</span>
                      </div>

                      <button
                        onClick={() =>
                          onCollectPayment ? onCollectPayment(student.id) : onOpenRecordPayment()
                        }
                        className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                      >
                        Collect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Admissions, Receipts, Upcoming Tests */}
        <div className="space-y-6">
          {/* Recent Admissions */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Recent Enrollments</h3>
              </div>
              <button
                onClick={() => onNavigate('students')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Directory →
              </button>
            </div>

            {recentAdmissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No students enrolled yet.
                <div className="mt-2">
                  <button
                    onClick={onOpenAdmission}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Add First Student
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAdmissions.map(student => (
                  <div
                    key={student.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={student.name} photoUrl={student.photoUrl} />
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left block truncate"
                        >
                          {student.name}
                        </button>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {student.targetExam} · {student.grade}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {formatShortDate(student.dateOfAdmission)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Fee Receipts */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Recent Fee Receipts</h3>
              </div>
              <button
                onClick={() => onNavigate('fees')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                All Receipts →
              </button>
            </div>

            {recentReceipts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No fee receipts yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentReceipts.map(tx => (
                  <div
                    key={tx.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 block truncate">{tx.studentName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {tx.receiptNo} · {tx.paymentMethod}
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-mono font-bold text-slate-900">
                        {profile.currencySymbol}{formatINR(tx.amount)}
                      </span>
                      <button
                        onClick={() => onViewReceipt(tx.id)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View Receipt"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tests */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-900">Upcoming Tests</h3>
              </div>
              <button
                onClick={() => onNavigate('exams')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                All Tests →
              </button>
            </div>

            {upcomingExams.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No upcoming tests scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingExams.map(exam => {
                  const daysLeft = daysBetween(todayStr, exam.date);
                  const badgeStyle =
                    daysLeft === 0
                      ? 'bg-rose-100 text-rose-700'
                      : daysLeft <= 3
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700';
                  const badgeText =
                    daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`;

                  return (
                    <div
                      key={exam.id}
                      className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block truncate">{exam.title}</span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {exam.batchName} · {formatShortDate(exam.date)}
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${badgeStyle}`}>
                        {badgeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FollowUpsCard onNavigate={onNavigate} />
        <NoticesCard onNavigate={onNavigate} />
      </div>
    </div>
  );
};
