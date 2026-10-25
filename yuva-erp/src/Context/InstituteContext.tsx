import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ApiError, pushInstitute, refreshNow, registerFlusher, subscribeSync, useSyncStatus } from '../components/utils/api';
import type { InstituteChanges, InstituteData } from '../components/utils/api';
import { useAuth } from './AuthContext';
import { ConnectionScreen } from '../components/layout/ConnectionScreen';
import { OnboardingScreen } from '../components/layout/OnboardingScreen';
import type { StartMode } from '../components/layout/OnboardingScreen';
import type {
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
  PaymentMethod,
  Enquiry,
  Announcement,
  StudyMaterial
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
  initialNotificationLogs,
  initialEnquiries,
  initialAnnouncements,
  initialMaterials
} from '../data/mockData';
import { nextRollNumber } from '../components/utils/rollNo';
import { toLocalISODate, toLocalDateTime, uid } from '../components/utils/helpers';

export const DEFAULT_PHOTO = '/avatar.svg';

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
  | 'notificationLogs'
  | 'enquiries'
  | 'announcements'
  | 'materials';

const LIST_KEYS: ListKey[] = [
  'courses',
  'batches',
  'students',
  'attendance',
  'transactions',
  'exams',
  'timetable',
  'templates',
  'notificationLogs',
  'enquiries',
  'announcements',
  'materials'
];

// What each kind of account may send (the server checks this again)
const writableKeys = (role?: string): string[] => {
  if (role === 'admin') return ['profile', ...LIST_KEYS];
  if (role === 'staff') return [...LIST_KEYS];
  if (role === 'teacher') return ['attendance', 'exams', 'notificationLogs', 'materials', 'announcements'];
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
  enquiries: Enquiry[];
  announcements: Announcement[];
  materials: StudyMaterial[];
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

export type SaveState = 'saved' | 'saving' | 'offline';

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
  enquiries: Enquiry[];
  announcements: Announcement[];
  materials: StudyMaterial[];

  // Are the changes saved on the server?
  saveState: SaveState;

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
  updateCourse: (id: string, updated: Partial<Omit<Course, 'id'>>) => void;
  deleteCourse: (id: string) => void;

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
  // The receipt stays in the ledger, marked cancelled, and the amount is taken off what the student has paid
  cancelTransaction: (id: string, reason: string) => void;

  // Exam actions
  addExam: (exam: Omit<Exam, 'id' | 'status' | 'results'>) => Exam;
  updateExam: (id: string, updated: Partial<Omit<Exam, 'id' | 'results' | 'status'>>) => void;
  updateExamMarks: (examId: string, results: Record<string, { marksObtained: number; remarks?: string; absent?: boolean }>, publish?: boolean) => void;
  deleteExam: (id: string) => void;

  // Timetable actions
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => TimetableSlot;
  updateTimetableSlot: (id: string, updated: Partial<Omit<TimetableSlot, 'id'>>) => void;
  deleteTimetableSlot: (id: string) => void;

  // Enquiry actions
  addEnquiry: (enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'createdBy'>) => Enquiry;
  updateEnquiry: (id: string, updated: Partial<Omit<Enquiry, 'id'>>) => void;
  deleteEnquiry: (id: string) => void;

  // Notice actions
  addAnnouncement: (notice: Omit<Announcement, 'id' | 'createdAt' | 'authorId' | 'authorName'>) => Announcement;
  updateAnnouncement: (id: string, updated: Partial<Omit<Announcement, 'id'>>) => void;
  deleteAnnouncement: (id: string) => void;

  // Study material actions
  addMaterial: (material: Omit<StudyMaterial, 'id' | 'createdAt' | 'authorId' | 'authorName'>) => StudyMaterial;
  updateMaterial: (id: string, updated: Partial<Omit<StudyMaterial, 'id'>>) => void;
  deleteMaterial: (id: string) => void;

  // Notification actions
  // status: "sent" = the message was opened in WhatsApp, "pending" = waiting to be sent
  sendNotification: (notification: {
    type: NotificationLog['type'];
    channel: NotificationLog['channel'];
    recipientName: string;
    recipientPhone: string;
    studentName: string;
    studentId?: string;
    content: string;
    status?: NotificationLog['status'];
  }) => void;
  updateNotificationStatus: (id: string, status: NotificationLog['status']) => void;
  updateTemplate: (id: string, body: string) => void;

  // Data management
  resetToDemoData: () => void;
  clearAllData: () => void;
}

export const InstituteContext = createContext<InstituteContextType | null>(null);

export const InstituteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const roleRef = useRef(user?.role);
  roleRef.current = user?.role;
  const linkStatus = useSyncStatus();

  // The first data from the server has arrived
  const [ready, setReady] = useState(false);
  // A brand-new institute: the principal chooses how to start before anything is saved
  const [onboarding, setOnboarding] = useState(false);
  const [orgName, setOrgName] = useState('');
  const onboardingRef = useRef(false);
  onboardingRef.current = onboarding;
  const [saveState, setSaveState] = useState<SaveState>('saved');

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
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialEnquiries);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [materials, setMaterials] = useState<StudyMaterial[]>(initialMaterials);

  const values: Values = {
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
    enquiries,
    announcements,
    materials
  };
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
    if (data.enquiries !== undefined) { setEnquiries(data.enquiries); mark('enquiries', data.enquiries); }
    if (data.announcements !== undefined) { setAnnouncements(data.announcements); mark('announcements', data.announcements); }
    if (data.materials !== undefined) { setMaterials(data.materials); mark('materials', data.materials); }
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
      setSaveState('saved');
      takeSkippedData();
      return;
    }

    try {
      await pushInstitute(pending.changes);
      for (const key of pending.keys) synced.current[key] = current[key];
      dirty.current = pushTimer.current !== null || computeChanges(valuesRef.current, synced.current, roleRef.current) !== null;
      if (!dirty.current) {
        setSaveState('saved');
        takeSkippedData();
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        // no connection, or the server / database has a problem for now: keep the changes and try again
        dirty.current = true;
        setSaveState('offline');
        pushTimer.current = setTimeout(flush, 3000);
        return;
      }
      if (err instanceof ApiError && err.status === 401) return; // signed out, the session screen takes over
      // The server refused this change: show the server's data again
      console.error('The server did not accept a change:', err);
      dirty.current = false;
      skipped.current = false;
      setSaveState('saved');
      void refreshNow(true);
    }
  };

  // Data from the server (first load, and changes made on other computers)
  useEffect(
    () =>
      subscribeSync(payload => {
        if (onboardingRef.current) return; // the principal is still choosing how to start
        if (dirty.current) {
          skipped.current = true; // do not overwrite what was just typed; fetch it after sending
          return;
        }
        const data = payload.institute;
        // Nothing stored yet and this is the principal: a new institute
        if (roleRef.current === 'admin' && data.students === undefined && data.profile === undefined) {
          setOrgName(payload.org?.name || '');
          setOnboarding(true);
          setReady(true);
          return;
        }
        applyServerData(data);
        setReady(true);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Send changes shortly after they happen
  useEffect(() => {
    if (!ready || onboarding) return;
    if (!computeChanges(values, synced.current, roleRef.current)) return;
    dirty.current = true;
    setSaveState('saving');
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(flush, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onboarding, profile, courses, batches, students, attendance, transactions, exams, timetable, templates, notificationLogs, enquiries, announcements, materials]);

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

  // ----- profile -----

  const updateProfile = (updated: Partial<InstituteProfile>) => {
    setProfile(prev => ({ ...prev, ...updated }));
  };

  // ----- students -----

  const addStudent = (studentData: Omit<Student, 'id' | 'rollNo' | 'feePaid'>, initialPayment?: { amount: number; method: PaymentMethod; ref?: string }) => {
    const rollNo = nextRollNumber(students); // automatic: highest roll number in the list + 1
    const studentId = uid('s');
    const initialPaid = initialPayment && initialPayment.amount > 0 ? initialPayment.amount : 0;

    const newStudent: Student = {
      ...studentData,
      id: studentId,
      rollNo,
      feePaid: initialPaid,
      photoUrl: studentData.photoUrl || DEFAULT_PHOTO
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

  // ----- batches -----

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
    // Keep the batch name stored in the timetable, tests, notices and study material in step after a rename
    if (updated.name) {
      const newName = updated.name;
      setTimetable(prev => prev.map(t => t.batchId === id ? { ...t, batchName: newName } : t));
      setExams(prev => prev.map(e => e.batchId === id ? { ...e, batchName: newName } : e));
      setAnnouncements(prev => prev.map(a => a.batchId === id ? { ...a, batchName: newName } : a));
      setMaterials(prev => prev.map(m => m.batchId === id ? { ...m, batchName: newName } : m));
    }
  };

  const deleteBatch = (id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    setTimetable(prev => prev.filter(t => t.batchId !== id));
    setAttendance(prev => prev.filter(a => a.batchId !== id));
    setExams(prev => prev.filter(e => e.batchId !== id));
    setAnnouncements(prev => prev.filter(a => a.batchId !== id));
    setMaterials(prev => prev.filter(m => m.batchId !== id));
  };

  // ----- courses -----

  const addCourse = (courseData: Omit<Course, 'id'>) => {
    const newCourse: Course = {
      ...courseData,
      id: uid('c')
    };
    setCourses(prev => [...prev, newCourse]);
    return newCourse;
  };

  const updateCourse = (id: string, updated: Partial<Omit<Course, 'id'>>) => {
    setCourses(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    // Batches keep the course name for display
    if (updated.name) {
      const newName = updated.name;
      setBatches(prev => prev.map(b => (b.courseId === id ? { ...b, courseName: newName } : b)));
    }
  };

  const deleteCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // ----- attendance -----

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

  // ----- fees -----

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

  const cancelTransaction = (id: string, reason: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx || tx.status === 'cancelled') return;
    setTransactions(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: 'cancelled', cancelReason: reason, cancelledAt: toLocalDateTime(), cancelledBy: user?.name || undefined }
          : t
      )
    );
    setStudents(prev => prev.map(s => (s.id === tx.studentId ? { ...s, feePaid: Math.max(0, s.feePaid - tx.amount) } : s)));
  };

  // ----- exams -----

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

  const updateExam = (id: string, updated: Partial<Omit<Exam, 'id' | 'results' | 'status'>>) => {
    setExams(prev => prev.map(e => (e.id === id ? { ...e, ...updated } : e)));
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

  // ----- timetable -----

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

  // ----- enquiries -----

  const addEnquiry = (data: Omit<Enquiry, 'id' | 'createdAt' | 'createdBy'>) => {
    const enquiry: Enquiry = { ...data, id: uid('enq'), createdAt: new Date().toISOString(), createdBy: user?.name };
    setEnquiries(prev => [enquiry, ...prev]);
    return enquiry;
  };

  const updateEnquiry = (id: string, updated: Partial<Omit<Enquiry, 'id'>>) => {
    setEnquiries(prev => prev.map(e => (e.id === id ? { ...e, ...updated } : e)));
  };

  const deleteEnquiry = (id: string) => {
    setEnquiries(prev => prev.filter(e => e.id !== id));
  };

  // ----- notices -----

  const addAnnouncement = (data: Omit<Announcement, 'id' | 'createdAt' | 'authorId' | 'authorName'>) => {
    const notice: Announcement = {
      ...data,
      id: uid('ann'),
      createdAt: new Date().toISOString(),
      authorId: user?.id || '',
      authorName: user?.name || ''
    };
    setAnnouncements(prev => [notice, ...prev]);
    return notice;
  };

  const updateAnnouncement = (id: string, updated: Partial<Omit<Announcement, 'id'>>) => {
    setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // ----- study material -----

  const addMaterial = (data: Omit<StudyMaterial, 'id' | 'createdAt' | 'authorId' | 'authorName'>) => {
    const material: StudyMaterial = {
      ...data,
      id: uid('mat'),
      createdAt: new Date().toISOString(),
      authorId: user?.id || '',
      authorName: user?.name || ''
    };
    setMaterials(prev => [material, ...prev]);
    return material;
  };

  const updateMaterial = (id: string, updated: Partial<Omit<StudyMaterial, 'id'>>) => {
    setMaterials(prev => prev.map(m => (m.id === id ? { ...m, ...updated } : m)));
  };

  const deleteMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // ----- messages -----

  const sendNotification = (notif: {
    type: NotificationLog['type'];
    channel: NotificationLog['channel'];
    recipientName: string;
    recipientPhone: string;
    studentName: string;
    studentId?: string;
    content: string;
    status?: NotificationLog['status'];
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
      // Nothing is sent by this app itself: "sent" means the message was opened in WhatsApp
      status: notif.status ?? 'sent'
    };
    setNotificationLogs(prev => [newLog, ...prev]);
  };

  const updateNotificationStatus = (id: string, status: NotificationLog['status']) => {
    setNotificationLogs(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
  };

  const updateTemplate = (id: string, body: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, templateBody: body } : t));
  };

  // ----- data management -----

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
    setEnquiries(initialEnquiries);
    setAnnouncements(initialAnnouncements);
    setMaterials(initialMaterials);
  };

  // Removes everything the institute entered (the profile and the message templates stay)
  const clearAllData = () => {
    setCourses([]);
    setBatches([]);
    setStudents([]);
    setAttendance([]);
    setTransactions([]);
    setExams([]);
    setTimetable([]);
    setNotificationLogs([]);
    setEnquiries([]);
    setAnnouncements([]);
    setMaterials([]);
  };

  // The principal's choice on a brand-new institute
  const finishOnboarding = (mode: StartMode, details: { name: string; academicYear: string }) => {
    const rename = (text: string) => text.split('Apex Pinnacle Academy').join(details.name);
    setProfile({
      ...initialInstituteProfile,
      name: details.name,
      academicYear: details.academicYear,
      ...(mode === 'empty'
        ? { tagline: '', registrationNo: '', address: '', phone: '', email: '', website: '', signatoryTitle: 'Principal' }
        : {})
    });
    setTemplates(initialNotificationTemplates.map(t => ({ ...t, templateBody: rename(t.templateBody) })));
    if (mode === 'empty') clearAllData();
    setOnboarding(false);
  };

  if (!ready) return <ConnectionScreen message="Loading your institute data..." />;
  if (onboarding) return <OnboardingScreen onDone={finishOnboarding} initialName={orgName} />;

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
        enquiries,
        announcements,
        materials,
        saveState: linkStatus === 'offline' ? 'offline' : saveState,
        updateProfile,
        addStudent,
        updateStudent,
        deleteStudent,
        addBatch,
        updateBatch,
        deleteBatch,
        addCourse,
        updateCourse,
        deleteCourse,
        markAttendance,
        getAttendanceForBatchAndDate,
        getStudentAttendanceStats,
        recordPayment,
        cancelTransaction,
        addExam,
        updateExam,
        updateExamMarks,
        deleteExam,
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        addEnquiry,
        updateEnquiry,
        deleteEnquiry,
        addAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        sendNotification,
        updateNotificationStatus,
        updateTemplate,
        resetToDemoData,
        clearAllData
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
