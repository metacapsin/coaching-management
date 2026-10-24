import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ApiError, pushInstitute, refreshNow, registerFlusher, subscribeSync } from '../components/utils/api';
import type { InstituteChanges, InstituteData } from '../components/utils/api';
import { useAuth } from './AuthContext';
import { ConnectionScreen } from '../components/layout/ConnectionScreen';
import {
  Student,
  Batch,
  Course,
  FeeTransaction,
  Exam,
  TimetableSlot,
  NotificationLog,
  NotificationTemplate,
  InstituteProfile,
  AttendanceRecord,
  AttendanceStatus,
  PaymentMethod
} from '../types';
import {
  initialInstituteProfile,
  initialCourses,
  initialBatches,
  initialStudents,
  initialAttendanceRecords,
  initialFeeTransactions,
  initialExams,
  initialTimetableSlots,
  initialNotificationTemplates,
  initialNotificationLogs
} from '../data/mockData';
import { nextRollNumber } from '../components/utils/rollNo';
import { toLocalISODate, toLocalDateTime, uid } from '../components/utils/helpers';

// Next receipt number: REC-<year>-<4 digits>, one higher than the highest used so far
const newReceiptSuffix = (receiptNo: string) => receiptNo.split('-').pop() || '';

const nextReceiptNo = (existing: FeeTransaction[], date: string) => {
  const year = date.slice(0, 4) || String(new Date().getFullYear());
  const highest = existing.reduce((max, t) => {
    const m = t.receiptNo.match(/(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `REC-${year}-${String(highest + 1).padStart(4, '0')}`;
};

// ---------- keeping the data in step with the server ----------
//
// The server is the only place the data is stored. This screen keeps a copy in memory and
//  - takes over what the server sends (data changed on another computer, or at sign in)
//  - sends back only what changed here, by record (so two people editing different records
//    never overwrite each other)

type ListKey =
  | 'courses'
  | 'batches'
  | 'students'
  | 'attendance'
  | 'transactions'
  | 'exams'
  | 'timetable'
  | 'templates'
  | 'notificationLogs';

const LIST_KEYS: ListKey[] = [
  'courses',
  'batches',
  'students',
  'attendance',
  'transactions',
  'exams',
  'timetable',
  'templates',
  'notificationLogs'
];

// What each kind of account may send (the server checks this again)
const writableKeys = (role?: string): string[] => {
  if (role === 'admin') return ['profile', ...LIST_KEYS];
  if (role === 'staff') return [...LIST_KEYS];
  if (role === 'teacher') return ['attendance', 'exams', 'notificationLogs'];
  return [];
};

type Identified = { id: string };

interface Values {
  profile: InstituteProfile;
  courses: Course[];
  batches: Batch[];
  students: Student[];
  attendance: AttendanceRecord[];
  transactions: FeeTransaction[];
  exams: Exam[];
  timetable: TimetableSlot[];
  templates: NotificationTemplate[];
  notificationLogs: NotificationLog[];
}

// Compares a list with what the server has, record by record
const diffList = (before: Identified[] | undefined, after: Identified[]) => {
  if (before === after) return null;
  const old = new Map((before ?? []).map(item => [item.id, item]));
  const upsert: Identified[] = [];
  for (const item of after) {
    const previous = old.get(item.id);
    if (previous === undefined || (previous !== item && JSON.stringify(previous) !== JSON.stringify(item))) {
      upsert.push(item);
    }
    old.delete(item.id);
  }
  const remove = [...old.keys()];
  return upsert.length || remove.length ? { upsert, remove } : null;
};

const computeChanges = (values: Values, synced: Record<string, unknown>, role?: string) => {
  const allowed = writableKeys(role);
  const changes: Record<string, unknown> = {};
  const keys: (keyof Values)[] = [];

  if (allowed.includes('profile') && JSON.stringify(values.profile) !== JSON.stringify(synced.profile)) {
    changes.profile = values.profile;
    keys.push('profile');
  }
  for (const key of LIST_KEYS) {
    if (!allowed.includes(key)) continue;
    const change = diffList(synced[key] as Identified[] | undefined, values[key] as Identified[]);
    if (change) {
      changes[key] = change;
      keys.push(key);
    }
  }
  return keys.length ? { changes: changes as InstituteChanges, keys } : null;
};

interface InstituteContextType {
  profile: InstituteProfile;
  courses: Course[];
  batches: Batch[];
  students: Student[];
  attendance: AttendanceRecord[];
  transactions: FeeTransaction[];
  exams: Exam[];
  timetable: TimetableSlot[];
  templates: NotificationTemplate[];
  notificationLogs: NotificationLog[];

  // Profile actions
  updateProfile: (updated: Partial<InstituteProfile>) => void;

  // Student & Admission actions
  addStudent: (student: Omit<Student, 'id' | 'rollNo' | 'feePaid'>, initialPayment?: { amount: number; method: PaymentMethod; ref?: string }) => Student;
  updateStudent: (id: string, updated: Partial<Student>) => void;
  deleteStudent: (id: string) => void;

  // Batch actions
  addBatch: (batch: Omit<Batch, 'id' | 'enrolledCount'>) => Batch;
  updateBatch: (id: string, updated: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;

  // Course actions
  addCourse: (course: Omit<Course, 'id'>) => Course;

  // Attendance actions
  markAttendance: (date: string, batchId: string, records: Record<string, AttendanceStatus>) => void;
  getAttendanceForBatchAndDate: (date: string, batchId: string) => AttendanceRecord | undefined;
  getStudentAttendanceStats: (studentId: string) => { total: number; present: number; absent: number; late: number; excused: number; percentage: number };

  // Fee actions
  recordPayment: (payment: {
    studentId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNo?: string;
    notes?: string;
    date?: string;
  }) => FeeTransaction;
  deleteTransaction: (id: string) => void;

  // Exam actions
  addExam: (exam: Omit<Exam, 'id' | 'status' | 'results'>) => Exam;
  updateExamMarks: (examId: string, results: Record<string, { marksObtained: number; remarks?: string; absent?: boolean }>, publish?: boolean) => void;
  deleteExam: (id: string) => void;

  // Timetable actions
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => TimetableSlot;
  updateTimetableSlot: (id: string, updated: Partial<Omit<TimetableSlot, 'id'>>) => void;
  deleteTimetableSlot: (id: string) => void;

  // Notification actions
  sendNotification: (notification: {
    type: NotificationLog['type'];
    channel: NotificationLog['channel'];
    recipientName: string;
    recipientPhone: string;
    studentName: string;
    studentId?: string;
    content: string;
  }) => void;
  updateTemplate: (id: string, body: string) => void;

  // Data management
  resetToDemoData: () => void;
  exportDatabaseJson: () => void;
  importDatabaseJson: (jsonString: string) => boolean;
}

export const InstituteContext = createContext<InstituteContextType | null>(null);

export const InstituteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const roleRef = useRef(user?.role);
  roleRef.current = user?.role;

  // The first data from the server has arrived
  const [ready, setReady] = useState(false);

  // Sample data is only used to start an institute that has no data on the server yet
  const [profile, setProfile] = useState<InstituteProfile>(initialInstituteProfile);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(initialAttendanceRecords);
  const [transactions, setTransactions] = useState<FeeTransaction[]>(initialFeeTransactions);
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [timetable, setTimetable] = useState<TimetableSlot[]>(initialTimetableSlots);
  const [templates, setTemplates] = useState<NotificationTemplate[]>(initialNotificationTemplates);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(initialNotificationLogs);

  const values: Values = { profile, courses, batches, students, attendance, transactions, exams, timetable, templates, notificationLogs };
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const synced = useRef<Record<string, unknown>>({}); // what the server has
  const dirty = useRef(false); // changes here are waiting to be sent
  const skipped = useRef(false); // newer server data arrived while we were sending
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyServerData = (data: InstituteData) => {
    const mark = (key: string, value: unknown) => {
      synced.current[key] = value;
    };
    if (data.profile !== undefined) { setProfile(data.profile); mark('profile', data.profile); }
    if (data.courses !== undefined) { setCourses(data.courses); mark('courses', data.courses); }
    if (data.batches !== undefined) { setBatches(data.batches); mark('batches', data.batches); }
    if (data.students !== undefined) { setStudents(data.students); mark('students', data.students); }
    if (data.attendance !== undefined) { setAttendance(data.attendance); mark('attendance', data.attendance); }
    if (data.transactions !== undefined) { setTransactions(data.transactions); mark('transactions', data.transactions); }
    if (data.exams !== undefined) { setExams(data.exams); mark('exams', data.exams); }
    if (data.timetable !== undefined) { setTimetable(data.timetable); mark('timetable', data.timetable); }
    if (data.templates !== undefined) { setTemplates(data.templates); mark('templates', data.templates); }
    if (data.notificationLogs !== undefined) { setNotificationLogs(data.notificationLogs); mark('notificationLogs', data.notificationLogs); }
  };

  const takeSkippedData = () => {
    if (skipped.current) {
      skipped.current = false;
      void refreshNow(true);
    }
  };

  // Sends what changed (one request for everything that changed together)
  const flush = async () => {
    pushTimer.current = null;
    const current = valuesRef.current;
    const pending = computeChanges(current, synced.current, roleRef.current);
    if (!pending) {
      dirty.current = false;
      takeSkippedData();
      return;
    }

    try {
      await pushInstitute(pending.changes);
      for (const key of pending.keys) synced.current[key] = current[key];
      dirty.current = pushTimer.current !== null || computeChanges(valuesRef.current, synced.current, roleRef.current) !== null;
      if (!dirty.current) takeSkippedData();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        // no connection, or the server / database has a problem for now: keep the changes and try again
        dirty.current = true;
        pushTimer.current = setTimeout(flush, 3000);
        return;
      }
      if (err instanceof ApiError && err.status === 401) return; // signed out, the session screen takes over
      // The server refused this change: show the server's data again
      console.error('The server did not accept a change:', err);
      dirty.current = false;
      skipped.current = false;
      void refreshNow(true);
    }
  };

  // Data from the server (first load, and changes made on other computers)
  useEffect(
    () =>
      subscribeSync(payload => {
        if (dirty.current) {
          skipped.current = true; // do not overwrite what was just typed; fetch it after sending
          return;
        }
        applyServerData(payload.institute);
        setReady(true);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Send changes shortly after they happen
  useEffect(() => {
    if (!ready) return;
    if (!computeChanges(values, synced.current, roleRef.current)) return;
    dirty.current = true;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(flush, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile, courses, batches, students, attendance, transactions, exams, timetable, templates, notificationLogs]);

  // Signing out sends changes that are still waiting
  useEffect(
    () =>
      registerFlusher(async () => {
        if (pushTimer.current) {
          clearTimeout(pushTimer.current);
          await flush();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    []
  );

  const updateProfile = (updated: Partial<InstituteProfile>) => {
    setProfile(prev => ({ ...prev, ...updated }));
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'rollNo' | 'feePaid'>, initialPayment?: { amount: number; method: PaymentMethod; ref?: string }) => {
    const rollNo = nextRollNumber(students); // automatic: highest roll number in the list + 1
    const studentId = uid('s');
    const initialPaid = initialPayment && initialPayment.amount > 0 ? initialPayment.amount : 0;

    const newStudent: Student = {
      ...studentData,
      id: studentId,
      rollNo,
      feePaid: initialPaid,
      photoUrl: studentData.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    };

    setStudents(prev => [newStudent, ...prev]);

    // Update batch enrolled count
    setBatches(prev => prev.map(b => b.id === newStudent.batchId ? { ...b, enrolledCount: b.enrolledCount + 1 } : b));

    // If initial payment made, record transaction
    if (initialPaid > 0 && initialPayment) {
      const targetBatch = batches.find(b => b.id === newStudent.batchId);
      const today = toLocalISODate();
      const net = Math.max(0, newStudent.totalFees - newStudent.discount);
      const newTx: FeeTransaction = {
        id: uid('tx'),
        receiptNo: nextReceiptNo(transactions, today),
        studentId,
        studentName: newStudent.name,
        studentRollNo: rollNo,
        batchName: targetBatch ? targetBatch.name : 'Enrolled Batch',
        amount: initialPaid,
        paymentMethod: initialPayment.method,
        referenceNo: initialPayment.ref || 'INITIAL-REG-DEP',
        date: today,
        installmentNo: 1,
        notes: 'Initial admission fee payment',
        balanceAfter: Math.max(0, net - initialPaid)
      };
      setTransactions(prev => [newTx, ...prev]);
    }

    return newStudent;
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  // Removes the student and their attendance entries and test results.
  // Fee receipts are kept in the ledger for the institute's accounts.
  const deleteStudent = (id: string) => {
    const target = students.find(s => s.id === id);
    if (target) {
      setBatches(prev => prev.map(b => b.id === target.batchId ? { ...b, enrolledCount: Math.max(0, b.enrolledCount - 1) } : b));
    }
    setStudents(prev => prev.filter(s => s.id !== id));
    setAttendance(prev =>
      prev.map(a =>
        a.records[id]
          ? { ...a, records: Object.fromEntries(Object.entries(a.records).filter(([key]) => key !== id)) }
          : a
      )
    );
    setExams(prev =>
      prev.map(e =>
        e.results[id]
          ? { ...e, results: Object.fromEntries(Object.entries(e.results).filter(([key]) => key !== id)) }
          : e
      )
    );
  };

  const addBatch = (batchData: Omit<Batch, 'id' | 'enrolledCount'>) => {
    const newBatch: Batch = {
      ...batchData,
      id: uid('b'),
      enrolledCount: 0
    };
    setBatches(prev => [...prev, newBatch]);
    return newBatch;
  };

  const updateBatch = (id: string, updated: Partial<Batch>) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));
    // Keep the batch name stored in the timetable and tests in step after a rename
    if (updated.name) {
      const newName = updated.name;
      setTimetable(prev => prev.map(t => t.batchId === id ? { ...t, batchName: newName } : t));
      setExams(prev => prev.map(e => e.batchId === id ? { ...e, batchName: newName } : e));
    }
  };

  const deleteBatch = (id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    setTimetable(prev => prev.filter(t => t.batchId !== id));
    setAttendance(prev => prev.filter(a => a.batchId !== id));
    setExams(prev => prev.filter(e => e.batchId !== id));
  };

  const addCourse = (courseData: Omit<Course, 'id'>) => {
    const newCourse: Course = {
      ...courseData,
      id: uid('c')
    };
    setCourses(prev => [...prev, newCourse]);
    return newCourse;
  };

  const markAttendance = (date: string, batchId: string, records: Record<string, AttendanceStatus>) => {
    setAttendance(prev => {
      const existingIndex = prev.findIndex(a => a.date === date && a.batchId === batchId);
      const newRecord: AttendanceRecord = {
        id: existingIndex >= 0 ? prev[existingIndex].id : uid('att'),
        date,
        batchId,
        records,
        markedBy: user?.name || 'Faculty / Academic Desk',
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = newRecord;
        return copy;
      }
      return [newRecord, ...prev];
    });
  };

  const getAttendanceForBatchAndDate = (date: string, batchId: string) => {
    return attendance.find(a => a.date === date && a.batchId === batchId);
  };

  const getStudentAttendanceStats = (studentId: string) => {
    let total = 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    attendance.forEach(rec => {
      if (rec.records[studentId]) {
        total++;
        const status = rec.records[studentId];
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') {
          late++;
          present++; // count as attended with late note
        } else if (status === 'excused') excused++;
      }
    });

    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;
    return { total, present, absent, late, excused, percentage };
  };

  const recordPayment = ({
    studentId,
    amount,
    paymentMethod,
    referenceNo,
    notes,
    date = toLocalISODate()
  }: {
    studentId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNo?: string;
    notes?: string;
    date?: string;
  }) => {
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');
    if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');

    const netFee = Math.max(0, student.totalFees - student.discount);
    const balanceBefore = Math.max(0, netFee - student.feePaid);
    if (netFee <= 0) throw new Error('The fee for this student is not set yet. Confirm the admission first.');
    if (amount > balanceBefore) {
      throw new Error(`Amount is more than the pending balance (${profile.currencySymbol}${balanceBefore.toLocaleString('en-IN')}).`);
    }

    const batch = batches.find(b => b.id === student.batchId);
    const existingStudentTxs = transactions.filter(t => t.studentId === studentId);
    const installmentNo = existingStudentTxs.reduce((m, t) => Math.max(m, t.installmentNo), 0) + 1;

    const receiptNo = nextReceiptNo(transactions, date);

    const newTx: FeeTransaction = {
      id: uid('tx'),
      receiptNo,
      studentId,
      studentName: student.name,
      studentRollNo: student.rollNo,
      batchName: batch ? batch.name : 'Assigned Batch',
      amount,
      paymentMethod,
      referenceNo: referenceNo || `${paymentMethod}-VCH-${newReceiptSuffix(receiptNo)}`,
      date,
      installmentNo,
      notes,
      balanceAfter: balanceBefore - amount
    };

    setTransactions(prev => [newTx, ...prev]);

    // Update student feePaid
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, feePaid: s.feePaid + amount } : s));

    return newTx;
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      setStudents(prev => prev.map(s => s.id === tx.studentId ? { ...s, feePaid: Math.max(0, s.feePaid - tx.amount) } : s));
    }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addExam = (examData: Omit<Exam, 'id' | 'status' | 'results'>) => {
    const newExam: Exam = {
      ...examData,
      id: uid('ex'),
      status: 'scheduled',
      results: {}
    };
    setExams(prev => [newExam, ...prev]);
    return newExam;
  };

  const updateExamMarks = (examId: string, results: Record<string, { marksObtained: number; remarks?: string; absent?: boolean }>, publish = false) => {
    setExams(prev => prev.map(e => {
      if (e.id === examId) {
        return {
          ...e,
          results,
          // Saving a draft must not hide results that were already published
          status: publish || e.status === 'published' ? 'published' : 'grading'
        };
      }
      return e;
    }));
  };

  const deleteExam = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const addTimetableSlot = (slotData: Omit<TimetableSlot, 'id'>) => {
    const newSlot: TimetableSlot = {
      ...slotData,
      id: uid('tt')
    };
    setTimetable(prev => [...prev, newSlot]);
    return newSlot;
  };

  const updateTimetableSlot = (id: string, updated: Partial<Omit<TimetableSlot, 'id'>>) => {
    setTimetable(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
  };

  const deleteTimetableSlot = (id: string) => {
    setTimetable(prev => prev.filter(s => s.id !== id));
  };

  const sendNotification = (notif: {
    type: NotificationLog['type'];
    channel: NotificationLog['channel'];
    recipientName: string;
    recipientPhone: string;
    studentName: string;
    studentId?: string;
    content: string;
  }) => {
    const newLog: NotificationLog = {
      id: uid('log'),
      timestamp: toLocalDateTime(),
      type: notif.type,
      channel: notif.channel,
      recipientName: notif.recipientName,
      recipientPhone: notif.recipientPhone,
      studentId: notif.studentId,
      studentName: notif.studentName,
      content: notif.content,
      status: 'delivered'
    };
    setNotificationLogs(prev => [newLog, ...prev]);
  };

  const updateTemplate = (id: string, body: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, templateBody: body } : t));
  };

  const resetToDemoData = () => {
    setProfile(initialInstituteProfile);
    setCourses(initialCourses);
    setBatches(initialBatches);
    setStudents(initialStudents);
    setAttendance(initialAttendanceRecords);
    setTransactions(initialFeeTransactions);
    setExams(initialExams);
    setTimetable(initialTimetableSlots);
    setTemplates(initialNotificationTemplates);
    setNotificationLogs(initialNotificationLogs);
  };

  const exportDatabaseJson = () => {
    const data = {
      profile,
      courses,
      batches,
      students,
      attendance,
      transactions,
      exams,
      timetable,
      templates,
      notificationLogs,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academia_os_backup_${toLocalISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDatabaseJson = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (data.students && data.batches && data.courses) {
        if (data.profile) setProfile(data.profile);
        if (data.courses) setCourses(data.courses);
        if (data.batches) setBatches(data.batches);
        if (data.students) setStudents(data.students);
        if (data.attendance) setAttendance(data.attendance);
        if (data.transactions) setTransactions(data.transactions);
        if (data.exams) setExams(data.exams);
        if (data.timetable) setTimetable(data.timetable);
        if (data.templates) setTemplates(data.templates);
        if (data.notificationLogs) setNotificationLogs(data.notificationLogs);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  if (!ready) return <ConnectionScreen message="Loading your institute data..." />;

  return (
    <InstituteContext.Provider
      value={{
        profile,
        courses,
        batches,
        students,
        attendance,
        transactions,
        exams,
        timetable,
        templates,
        notificationLogs,
        updateProfile,
        addStudent,
        updateStudent,
        deleteStudent,
        addBatch,
        updateBatch,
        deleteBatch,
        addCourse,
        markAttendance,
        getAttendanceForBatchAndDate,
        getStudentAttendanceStats,
        recordPayment,
        deleteTransaction,
        addExam,
        updateExamMarks,
        deleteExam,
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        sendNotification,
        updateTemplate,
        resetToDemoData,
        exportDatabaseJson,
        importDatabaseJson
      }}
    >
      {children}
    </InstituteContext.Provider>
  );
};

export const useInstitute = () => {
  const context = useContext(InstituteContext);
  if (!context) {
    throw new Error('useInstitute must be used within an InstituteProvider');
  }
  return context;
};