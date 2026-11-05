export type StudentStatus = 'active' | 'inactive' | 'trial';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
export type ExamStatus = 'scheduled' | 'grading' | 'published';
export type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'app' | 'student'; // 'student': the copy of a homework / test notice for the student's own login
export type NotificationType = 'attendance_absent' | 'fee_due' | 'exam_result' | 'general_announcement' | 'schedule_change' | 'new_student' | 'new_teacher' | 'homework' | 'test_notice' | 'attendance_late';
export type EnquiryStatus = 'new' | 'contacted' | 'demo' | 'follow-up' | 'enrolled' | 'lost';
export type EnquirySource = 'walk-in' | 'phone' | 'website' | 'referral' | 'social' | 'other';
export type MaterialType = 'link' | 'note' | 'homework';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  dateOfBirth?: string; // YYYY-MM-DD, optional (used for the birthday list)
  grade: string;
  courseId: string;
  batchId: string;
  targetExam: string;
  dateOfAdmission: string;
  status: StudentStatus;
  photoUrl: string;
  address: string;
  totalFees: number;
  discount: number;
  feePaid: number;
  nextDueDate?: string; // YYYY-MM-DD, when the next installment is due
  notes?: string;
}

export interface Batch {
  id: string;
  code: string;
  name: string;
  courseId: string;
  courseName: string;
  subjects: string[];
  facultyName: string;
  classTeacherId?: string; // the class teacher: with the principal, the only one who tells the parents about absent and late students
  classroom: string;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  maxCapacity: number;
  enrolledCount: number;
  status: 'ongoing' | 'upcoming' | 'completed';
}

export interface Course {
  id: string;
  code: string;
  name: string;
  category: 'Engineering' | 'Medical' | 'Foundation' | 'Boards' | 'Commerce' | 'Olympiad';
  duration: string;
  standardFee: number;
  description: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  batchId: string;
  records: Record<string, AttendanceStatus>; // studentId -> status
  markedBy: string;
  updatedAt: string;
}

export interface FeeTransaction {
  id: string;
  receiptNo: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  batchName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  date: string;
  installmentNo: number;
  notes?: string;
  balanceAfter?: number; // fee balance right after this payment (for the receipt)
  // A cancelled receipt stays in the ledger (for the accounts) but is not counted as money received
  status?: 'active' | 'cancelled';
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  batchId: string;
  batchName: string;
  subject: string;
  date: string;
  maxMarks: number;
  passMarks: number;
  status: ExamStatus;
  syllabusTopics: string[];
  results: Record<string, { marksObtained: number; remarks?: string; absent?: boolean }>;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
  startTime: string; // e.g. "08:00 AM"
  endTime: string;   // e.g. "09:30 AM"
  batchId: string;
  batchName: string;
  subject: string;
  facultyName: string;
  classroom: string;
  color?: string;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientName: string;
  recipientPhone: string;
  studentId?: string;
  studentName: string;
  content: string;
  batchId?: string; // 'new_student': the batch, so the teacher of that batch gets the line in the bell
  batchName?: string;
  grade?: string; // 'new_student': the class of the student
  status: 'delivered' | 'sent' | 'pending';
}

export interface NotificationTemplate {
  id: string;
  title: string;
  type: NotificationType;
  channel: NotificationChannel;
  templateBody: string;
  availableTags: string[];
}

export interface InstituteProfile {
  name: string;
  tagline: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  currencySymbol: string;
  academicYear: string;
  signatoryTitle: string;
  upiId?: string; // where parents pay the fee (UPI id like name@bank): the "Pay now" link of a fee notice goes there
  logo?: string; // a small picture (data URL) for the letterhead
  autoFeeReminders?: boolean; // queue the reminders of the overdue fees once a day
  lastAutoReminderDate?: string; // the day it was done (YYYY-MM-DD)
}

// A person who asked about admission but is not a student yet
export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  parentName?: string;
  grade?: string;
  interestedCourseId?: string;
  source: EnquirySource;
  status: EnquiryStatus;
  followUpDate?: string; // YYYY-MM-DD
  notes: string;
  createdAt: string; // ISO date and time
  createdBy?: string;
  convertedStudentId?: string; // set when the enquiry became an admission
}

// A notice for everybody, or for one batch
export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'batch' | 'teachers'; // 'teachers': only the teachers (for example a meeting)
  batchId?: string;
  batchName?: string;
  pinned?: boolean;
  createdAt: string;
  authorId: string;
  authorName: string;
}

// Study material, a note or homework for one batch
export interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  type: MaterialType;
  url?: string;
  batchId: string;
  batchName: string;
  subject: string;
  dueDate?: string; // homework: YYYY-MM-DD
  createdAt: string;
  authorId: string;
  authorName: string;
}

// Money the coaching spends (salary, rent...). Only the principal sees it.
export type ExpenseCategory = 'salary' | 'rent' | 'electricity' | 'marketing' | 'maintenance' | 'stationery' | 'other';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

// A student marked a homework as done (written by the server only)
export interface Submission {
  id: string;
  materialId: string;
  studentId: string;
  doneAt: string;
}

// Somebody who is paid every month (a teacher or other staff). Only the principal sees it.
export interface Salary {
  id: string;
  name: string;
  role: 'teacher' | 'staff' | 'other';
  monthlySalary: number;
  active: boolean;
  lastPaidMonth?: string; // YYYY-MM
  notes?: string;
}

// ---------- library (books the institute shares to read online) ----------

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string; // subject
  description?: string;
  url: string; // where the book can be read (a web link)
}

// ---------- attendance of the teachers and staff ----------

export type StaffStatus = 'present' | 'absent' | 'leave' | 'half';

export interface StaffAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  records: Record<string, StaffStatus>; // salary person id -> status
  updatedAt: string;
}
