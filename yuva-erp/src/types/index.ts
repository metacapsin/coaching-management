export type StudentStatus = 'active' | 'inactive' | 'trial';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
export type ExamStatus = 'scheduled' | 'grading' | 'published';
export type NotificationChannel = 'whatsapp' | 'sms' | 'email';
export type NotificationType = 'attendance_absent' | 'fee_due' | 'exam_result' | 'general_announcement' | 'schedule_change';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
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
}
