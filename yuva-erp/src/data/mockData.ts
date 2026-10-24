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
  AttendanceRecord
} from '../types';

export const initialInstituteProfile: InstituteProfile = {
  name: "Apex Pinnacle Academy",
  tagline: "Premier Coaching for IIT-JEE, NEET & Olympiads",
  registrationNo: "REG-ED-2024-8842",
  address: "Plot 42, Education Hub, Knowledge Corridor, Kota / Bangalore",
  phone: "+91 98765 43210",
  email: "admissions@apexacademy.edu",
  website: "www.apexacademy.edu",
  currencySymbol: "₹",
  academicYear: "2025-2026",
  signatoryTitle: "Academic Director & Head of Admissions",
};

export const initialCourses: Course[] = [
  {
    id: "c1",
    code: "JEE-ADV",
    name: "IIT-JEE Advanced & Mains 2-Year Comprehensive",
    category: "Engineering",
    duration: "2 Years",
    standardFee: 145000,
    description: "Rigorous daily coaching covering Physics, Chemistry, and Advanced Mathematics for JEE aspirants."
  },
  {
    id: "c2",
    code: "NEET-UG",
    name: "NEET Medical Achievers Batch",
    category: "Medical",
    duration: "1 Year",
    standardFee: 130000,
    description: "Deep-dive Biology, Organic/Inorganic Chemistry and Medical Physics with NCERT line-by-line focus."
  },
  {
    id: "c3",
    code: "CBSE-10",
    name: "Class 10 CBSE Board Masterclass",
    category: "Boards",
    duration: "10 Months",
    standardFee: 65000,
    description: "Complete mastery of Mathematics and Science with weekly chapter tests and answer writing drills."
  },
  {
    id: "c4",
    code: "FOUND-9",
    name: "Foundation Class 9 Olympiad & NTSE",
    category: "Foundation",
    duration: "1 Year",
    standardFee: 55000,
    description: "Early conceptual foundation for competitive exams, PRMO, and school topper excellence."
  }
];

export const initialBatches: Batch[] = [
  {
    id: "b1",
    code: "JEE-A-26",
    name: "JEE Advanced Pinnacle Batch A1",
    courseId: "c1",
    courseName: "IIT-JEE Advanced & Mains 2-Year",
    subjects: ["Physics", "Physical Chemistry", "Calculus & Algebra"],
    facultyName: "Dr. Arvind Mehta & Prof. Raman Iyer",
    classroom: "Hall A-101 (Newton Wing)",
    scheduleDays: ["Mon", "Wed", "Fri", "Sat"],
    startTime: "04:30 PM",
    endTime: "07:45 PM",
    maxCapacity: 35,
    enrolledCount: 28,
    status: "ongoing"
  },
  {
    id: "b2",
    code: "NEET-MED-01",
    name: "NEET Super-30 Medical Elite",
    courseId: "c2",
    courseName: "NEET Medical Achievers Batch",
    subjects: ["Botany", "Zoology", "Organic Chemistry", "Physics"],
    facultyName: "Dr. Shalini Sharma & Dr. Vivek Verma",
    classroom: "Lab Hall B-204 (Darwin Wing)",
    scheduleDays: ["Tue", "Thu", "Sat", "Sun"],
    startTime: "08:30 AM",
    endTime: "12:45 PM",
    maxCapacity: 30,
    enrolledCount: 26,
    status: "ongoing"
  },
  {
    id: "b3",
    code: "CBSE-10-ALPHA",
    name: "Class 10 Board Champions Batch",
    courseId: "c3",
    courseName: "Class 10 CBSE Board Masterclass",
    subjects: ["Mathematics", "Physics", "Chemistry", "Biology"],
    facultyName: "Prof. Rajesh Kulkarni",
    classroom: "Room C-102 (Ramanujan Hall)",
    scheduleDays: ["Mon", "Wed", "Fri"],
    startTime: "05:00 PM",
    endTime: "07:00 PM",
    maxCapacity: 25,
    enrolledCount: 22,
    status: "ongoing"
  },
  {
    id: "b4",
    code: "FND-OLYMP-9",
    name: "Junior Olympiad Prodigy Class 9",
    courseId: "c4",
    courseName: "Foundation Class 9 Olympiad & NTSE",
    subjects: ["Mental Ability", "Higher Maths", "Basic Science"],
    facultyName: "Mrs. Ananya Sen",
    classroom: "Room C-105",
    scheduleDays: ["Tue", "Thu", "Sat"],
    startTime: "03:30 PM",
    endTime: "05:00 PM",
    maxCapacity: 25,
    enrolledCount: 18,
    status: "ongoing"
  }
];

export const initialStudents: Student[] = [
  {
    id: "s1",
    rollNo: "01",
    name: "Aarav Sharma",
    email: "aarav.sharma@gmail.com",
    phone: "+91 98231 11223",
    parentName: "Sanjay Sharma",
    parentPhone: "+91 98231 99887",
    parentEmail: "sanjay.sharma@fintech.co",
    grade: "Class 12",
    courseId: "c1",
    batchId: "b1",
    targetExam: "JEE Advanced 2026",
    dateOfAdmission: "2025-04-10",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    address: "B-402, Green Glen Layout, Bellandur, Bangalore",
    totalFees: 145000,
    discount: 15000, // Merit scholarship
    feePaid: 130000, // Fully paid
    notes: "Consistently top 3 ranker in weekly physics problem sets. Target IIT Bombay CS."
  },
  {
    id: "s2",
    rollNo: "02",
    name: "Ananya Deshmukh",
    email: "ananya.d@gmail.com",
    phone: "+91 97112 34567",
    parentName: "Dr. Vikram Deshmukh",
    parentPhone: "+91 97112 88990",
    parentEmail: "drvikram@hospital.org",
    grade: "Class 12",
    courseId: "c2",
    batchId: "b2",
    targetExam: "NEET UG 2026",
    dateOfAdmission: "2025-04-12",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    address: "Flat 12A, Orchid Towers, Indiranagar, Bangalore",
    totalFees: 130000,
    discount: 10000,
    feePaid: 80000, // 40,000 balance
    notes: "Excellent grasp of Botany. Needs extra practice in Electrostatics numericals."
  },
  {
    id: "s3",
    rollNo: "03",
    name: "Rohan Kulkarni",
    email: "rohan.k@gmail.com",
    phone: "+91 99001 22334",
    parentName: "Sunil Kulkarni",
    parentPhone: "+91 99001 77889",
    parentEmail: "sunil.k@techcorp.com",
    grade: "Class 12",
    courseId: "c1",
    batchId: "b1",
    targetExam: "JEE Advanced 2026",
    dateOfAdmission: "2025-04-15",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    address: "Villa 34, Prestige Palms, Whitefield, Bangalore",
    totalFees: 145000,
    discount: 0,
    feePaid: 72500, // 50% paid
    notes: "Strong in Calculus. Absent on 2 consecutive tests due to sports event."
  },
  {
    id: "s4",
    rollNo: "04",
    name: "Diya Narayanan",
    email: "diya.n@gmail.com",
    phone: "+91 98450 55667",
    parentName: "Meenakshi Narayanan",
    parentPhone: "+91 98450 11223",
    parentEmail: "meenakshi@gmail.com",
    grade: "Class 12",
    courseId: "c2",
    batchId: "b2",
    targetExam: "NEET UG 2026",
    dateOfAdmission: "2025-05-02",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    address: "7th Main, 4th Block, Jayanagar, Bangalore",
    totalFees: 130000,
    discount: 5000,
    feePaid: 125000, // Fully paid
    notes: "Consistent 96%+ in Zoology mock papers. Very disciplined."
  },
  {
    id: "s5",
    rollNo: "05",
    name: "Kabir Sengupta",
    email: "kabir.sen@gmail.com",
    phone: "+91 98860 33445",
    parentName: "Debashish Sengupta",
    parentPhone: "+91 98860 99887",
    grade: "Class 10",
    courseId: "c3",
    batchId: "b3",
    targetExam: "CBSE Boards 2026",
    dateOfAdmission: "2025-05-10",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    address: "22/1, Koramangala 5th Block, Bangalore",
    totalFees: 65000,
    discount: 5000,
    feePaid: 35000,
    notes: "Showed massive leap from 72% to 91% in quadratic equations test."
  },
  {
    id: "s6",
    rollNo: "06",
    name: "Meera Patel",
    email: "meera.patel@gmail.com",
    phone: "+91 97401 44556",
    parentName: "Bhavesh Patel",
    parentPhone: "+91 97401 22334",
    parentEmail: "bpatel@exportbiz.com",
    grade: "Class 12",
    courseId: "c1",
    batchId: "b1",
    targetExam: "JEE Mains & BITSAT 2026",
    dateOfAdmission: "2025-05-18",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    address: "Flat 503, Alpine Eco, Marathahalli, Bangalore",
    totalFees: 145000,
    discount: 10000,
    feePaid: 135000,
    notes: "Fast problem solver. Needs speed practice in Organic Chemistry reactions."
  },
  {
    id: "s7",
    rollNo: "07",
    name: "Ishaan Reddy",
    email: "ishaan.reddy@gmail.com",
    phone: "+91 99800 66778",
    parentName: "Kishore Reddy",
    parentPhone: "+91 99800 33445",
    grade: "Class 12",
    courseId: "c2",
    batchId: "b2",
    targetExam: "NEET UG 2026",
    dateOfAdmission: "2025-06-01",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    address: "HSR Layout, Sector 2, Bangalore",
    totalFees: 130000,
    discount: 0,
    feePaid: 50000, // Due 80,000
    notes: "Fee reminder sent on 1st of month. Parent promised payment by 15th."
  },
  {
    id: "s8",
    rollNo: "08",
    name: "Tanya Verma",
    email: "tanya.v@gmail.com",
    phone: "+91 98199 77889",
    parentName: "Alok Verma",
    parentPhone: "+91 98199 44556",
    parentEmail: "alok.verma@consulting.com",
    grade: "Class 9",
    courseId: "c4",
    batchId: "b4",
    targetExam: "PRMO & NSEJS Olympiad",
    dateOfAdmission: "2025-06-15",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    address: "Sobha Silicon Oasis, Hosa Road, Bangalore",
    totalFees: 55000,
    discount: 5000,
    feePaid: 50000,
    notes: "Qualified for Stage 1 Regional Mathematical Olympiad practice."
  },
  {
    id: "s9",
    rollNo: "09",
    name: "Devendra Singhal",
    email: "dev.singhal@gmail.com",
    phone: "+91 98200 88990",
    parentName: "Manoj Singhal",
    parentPhone: "+91 98200 11223",
    grade: "Class 10",
    courseId: "c3",
    batchId: "b3",
    targetExam: "CBSE Boards 2026",
    dateOfAdmission: "2025-06-20",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    address: "Purva Riviera, Marathahalli, Bangalore",
    totalFees: 65000,
    discount: 0,
    feePaid: 65000,
    notes: "Strong in Science, practicing for 100/100 in Board Math."
  },
  {
    id: "s10",
    rollNo: "10",
    name: "Sanya Kapoor",
    email: "sanya.k@gmail.com",
    phone: "+91 98330 44556",
    parentName: "Rajeev Kapoor",
    parentPhone: "+91 98330 99887",
    parentEmail: "rajeev.kapoor@media.in",
    grade: "Class 12",
    courseId: "c1",
    batchId: "b1",
    targetExam: "JEE Advanced 2026",
    dateOfAdmission: "2025-07-01",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
    address: "Brigade Gateway, Malleshwaram, Bangalore",
    totalFees: 145000,
    discount: 10000,
    feePaid: 95000, // Due 40,000
    notes: "Remarkable accuracy in rotational dynamics kinematics."
  }
];

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    id: "att-1",
    date: "2026-10-12",
    batchId: "b1",
    records: {
      "s1": "present",
      "s3": "absent",
      "s6": "present",
      "s10": "present"
    },
    markedBy: "Dr. Arvind Mehta",
    updatedAt: "2026-10-12T17:15:00Z"
  },
  {
    id: "att-2",
    date: "2026-10-12",
    batchId: "b2",
    records: {
      "s2": "present",
      "s4": "present",
      "s7": "absent"
    },
    markedBy: "Dr. Shalini Sharma",
    updatedAt: "2026-10-12T09:10:00Z"
  },
  {
    id: "att-3",
    date: "2026-10-10",
    batchId: "b1",
    records: {
      "s1": "present",
      "s3": "late",
      "s6": "present",
      "s10": "present"
    },
    markedBy: "Prof. Raman Iyer",
    updatedAt: "2026-10-10T16:40:00Z"
  }
];

export const initialFeeTransactions: FeeTransaction[] = [
  {
    id: "tx-101",
    receiptNo: "REC-2025-0842",
    studentId: "s1",
    studentName: "Aarav Sharma",
    studentRollNo: "01",
    batchName: "JEE Advanced Pinnacle Batch A1",
    amount: 65000,
    paymentMethod: "UPI",
    referenceNo: "UPI/23901928374/HDFC",
    date: "2025-04-10",
    installmentNo: 1,
    notes: "Admission fee + 1st term installment"
  },
  {
    id: "tx-102",
    receiptNo: "REC-2025-0843",
    studentId: "s1",
    studentName: "Aarav Sharma",
    studentRollNo: "01",
    batchName: "JEE Advanced Pinnacle Batch A1",
    amount: 65000,
    paymentMethod: "Bank Transfer",
    referenceNo: "NEFT-SBI992384112",
    date: "2025-08-05",
    installmentNo: 2,
    notes: "2nd term & Test Series kit fees"
  },
  {
    id: "tx-103",
    receiptNo: "REC-2025-0844",
    studentId: "s2",
    studentName: "Ananya Deshmukh",
    studentRollNo: "02",
    batchName: "NEET Super-30 Medical Elite",
    amount: 80000,
    paymentMethod: "Cheque",
    referenceNo: "CHQ-002931-ICICI",
    date: "2025-04-12",
    installmentNo: 1,
    notes: "First installment cleared"
  },
  {
    id: "tx-104",
    receiptNo: "REC-2025-0845",
    studentId: "s4",
    studentName: "Diya Narayanan",
    studentRollNo: "04",
    batchName: "NEET Super-30 Medical Elite",
    amount: 125000,
    paymentMethod: "UPI",
    referenceNo: "UPI/3910293847/GPAY",
    date: "2025-05-02",
    installmentNo: 1,
    notes: "Full payment with one-shot concession"
  },
  {
    id: "tx-105",
    receiptNo: "REC-2025-0846",
    studentId: "s3",
    studentName: "Rohan Kulkarni",
    studentRollNo: "03",
    batchName: "JEE Advanced Pinnacle Batch A1",
    amount: 72500,
    paymentMethod: "Bank Transfer",
    referenceNo: "IMPS-293847192",
    date: "2025-04-15",
    installmentNo: 1,
    notes: "Term 1 payment"
  },
  {
    id: "tx-106",
    receiptNo: "REC-2025-0847",
    studentId: "s5",
    studentName: "Kabir Sengupta",
    studentRollNo: "05",
    batchName: "Class 10 Board Champions Batch",
    amount: 35000,
    paymentMethod: "Cash",
    referenceNo: "CASH-REC-VCH-88",
    date: "2025-05-10",
    installmentNo: 1,
    notes: "Initial deposit paid at front desk"
  }
];

export const initialExams: Exam[] = [
  {
    id: "ex-1",
    code: "JEE-MT-04",
    title: "Major All-India Mock Test 04 - Mechanics & Optics",
    batchId: "b1",
    batchName: "JEE Advanced Pinnacle Batch A1",
    subject: "Physics & Mathematics",
    date: "2026-10-05",
    maxMarks: 180,
    passMarks: 72,
    status: "published",
    syllabusTopics: [
      "Rigid Body Dynamics", 
      "Geometrical Optics", 
      "Indefinite & Definite Integrals", 
      "Differential Equations"
    ],
    results: {
      "s1": { marksObtained: 164, remarks: "Top score in Institute! Excellent work in mechanics." },
      "s3": { marksObtained: 112, remarks: "Need more practice in ray optics derivations." },
      "s6": { marksObtained: 148, remarks: "Strong mathematics score, minor negative marking in optics." },
      "s10": { marksObtained: 139, remarks: "Consistent problem solving, maintain tempo." }
    }
  },
  {
    id: "ex-2",
    code: "NEET-BIO-06",
    title: "NEET Unit Test: Plant Physiology & Human Reproduction",
    batchId: "b2",
    batchName: "NEET Super-30 Medical Elite",
    subject: "Biology & Organic Chemistry",
    date: "2026-10-08",
    maxMarks: 360,
    passMarks: 180,
    status: "published",
    syllabusTopics: [
      "Photosynthesis & Respiration in Plants", 
      "Human Reproductive System", 
      "Aldehydes & Ketones"
    ],
    results: {
      "s2": { marksObtained: 334, remarks: "Rank 2 in batch. Excellent NCERT conceptual grasp." },
      "s4": { marksObtained: 348, remarks: "Batch Topper! 96.6% accuracy." },
      "s7": { marksObtained: 242, remarks: "Need revision in plant respiration cycle." }
    }
  },
  {
    id: "ex-3",
    code: "CBSE-TERM-1",
    title: "Class 10 Science & Math Term Simulation",
    batchId: "b3",
    batchName: "Class 10 Board Champions Batch",
    subject: "Maths & Science",
    date: "2026-10-18",
    maxMarks: 100,
    passMarks: 35,
    status: "scheduled",
    syllabusTopics: [
      "Quadratic Equations", 
      "Trigonometry", 
      "Light Reflection & Refraction", 
      "Metals & Non-metals"
    ],
    results: {}
  }
];

export const initialTimetableSlots: TimetableSlot[] = [
  {
    id: "tt-1",
    dayOfWeek: "Mon",
    startTime: "04:30 PM",
    endTime: "06:00 PM",
    batchId: "b1",
    batchName: "JEE Advanced Pinnacle Batch A1",
    subject: "Advanced Physics (Mechanics)",
    facultyName: "Dr. Arvind Mehta",
    classroom: "Hall A-101",
    color: "blue"
  },
  {
    id: "tt-2",
    dayOfWeek: "Mon",
    startTime: "06:15 PM",
    endTime: "07:45 PM",
    batchId: "b1",
    batchName: "JEE Advanced Pinnacle Batch A1",
    subject: "Calculus & Coordinate Geometry",
    facultyName: "Prof. Raman Iyer",
    classroom: "Hall A-101",
    color: "indigo"
  },
  {
    id: "tt-3",
    dayOfWeek: "Mon",
    startTime: "05:00 PM",
    endTime: "07:00 PM",
    batchId: "b3",
    batchName: "Class 10 Board Champions Batch",
    subject: "Mathematics Board Practice",
    facultyName: "Prof. Rajesh Kulkarni",
    classroom: "Room C-102",
    color: "emerald"
  },
  {
    id: "tt-4",
    dayOfWeek: "Tue",
    startTime: "08:30 AM",
    endTime: "10:30 AM",
    batchId: "b2",
    batchName: "NEET Super-30 Medical Elite",
    subject: "Botany & Cell Biology",
    facultyName: "Dr. Shalini Sharma",
    classroom: "Lab Hall B-204",
    color: "teal"
  },
  {
    id: "tt-5",
    dayOfWeek: "Tue",
    startTime: "10:45 AM",
    endTime: "12:45 PM",
    batchId: "b2",
    batchName: "NEET Super-30 Medical Elite",
    subject: "Organic Reaction Mechanisms",
    facultyName: "Dr. Vivek Verma",
    classroom: "Lab Hall B-204",
    color: "amber"
  },
  {
    id: "tt-6",
    dayOfWeek: "Wed",
    startTime: "04:30 PM",
    endTime: "06:00 PM",
    batchId: "b1",
    batchName: "JEE Advanced Pinnacle Batch A1",
    subject: "Physical & Inorganic Chemistry",
    facultyName: "Prof. Raman Iyer",
    classroom: "Hall A-101",
    color: "indigo"
  },
  {
    id: "tt-7",
    dayOfWeek: "Thu",
    startTime: "08:30 AM",
    endTime: "10:30 AM",
    batchId: "b2",
    batchName: "NEET Super-30 Medical Elite",
    subject: "Zoology: Genetics & Evolution",
    facultyName: "Dr. Shalini Sharma",
    classroom: "Lab Hall B-204",
    color: "teal"
  },
  {
    id: "tt-8",
    dayOfWeek: "Fri",
    startTime: "04:30 PM",
    endTime: "07:45 PM",
    batchId: "b1",
    batchName: "JEE Advanced Pinnacle Batch A1",
    subject: "Grand Problem Solving Seminar",
    facultyName: "Dr. Arvind Mehta",
    classroom: "Hall A-101",
    color: "blue"
  },
  {
    id: "tt-9",
    dayOfWeek: "Sat",
    startTime: "09:00 AM",
    endTime: "12:00 PM",
    batchId: "b2",
    batchName: "NEET Super-30 Medical Elite",
    subject: "Full Mock Test & Analysis",
    facultyName: "Faculty Team",
    classroom: "Examination Hall 1",
    color: "rose"
  }
];

export const initialNotificationTemplates: NotificationTemplate[] = [
  {
    id: "tpl-1",
    title: "Absent Alert (Immediate)",
    type: "attendance_absent",
    channel: "whatsapp",
    templateBody: "Dear {{parent_name}}, this is to inform you that your ward {{student_name}} (Roll No: {{roll_no}}) was absent from the {{batch_name}} lecture on {{date}}. Regular attendance is critical for exam preparation. Please connect with the academy if this absence was unexpected. - Apex Pinnacle Academy",
    availableTags: ["parent_name", "student_name", "roll_no", "batch_name", "date"]
  },
  {
    id: "tpl-2",
    title: "Exam Scorecard & Batch Rank",
    type: "exam_result",
    channel: "whatsapp",
    templateBody: "Dear {{parent_name}}, the results for '{{exam_name}}' held on {{exam_date}} have been announced. {{student_name}} scored {{marks_obtained}} / {{max_marks}} (Rank: #{{batch_rank}} in batch). Teacher Remarks: {{remarks}}. Access full topic analysis on the student portal. - Apex Pinnacle Academy",
    availableTags: ["parent_name", "student_name", "exam_name", "exam_date", "marks_obtained", "max_marks", "batch_rank", "remarks"]
  },
  {
    id: "tpl-3",
    title: "Tuition Fee Due Reminder",
    type: "fee_due",
    channel: "whatsapp",
    templateBody: "Dear {{parent_name}}, this is a friendly reminder that a pending installment of {{currency}}{{due_amount}} for {{student_name}}'s coaching program ({{batch_name}}) is due. Kindly clear the dues to ensure uninterrupted study material dispatch and portal access. Receipt will be generated instantly upon payment. - Apex Pinnacle Academy Accounts Desk",
    availableTags: ["parent_name", "student_name", "currency", "due_amount", "batch_name"]
  },
  {
    id: "tpl-4",
    title: "Class Reschedule & Extra Lecture",
    type: "schedule_change",
    channel: "sms",
    templateBody: "Notice: An extra lecture of {{subject}} for batch {{batch_name}} is scheduled on {{date}} at {{time}} in {{classroom}}. Attendance is mandatory. - Apex Pinnacle Academy",
    availableTags: ["subject", "batch_name", "date", "time", "classroom"]
  },
  {
    id: "tpl-5",
    title: "General Circular / Holiday Announcement",
    type: "general_announcement",
    channel: "whatsapp",
    templateBody: "Dear Parents and Students, the institute will remain closed on {{date}} on account of {{occasion}}. Regular batch timetable resumes the following day. Self-study assignments have been dispatched. - Apex Pinnacle Academy",
    availableTags: ["date", "occasion"]
  }
];

export const initialNotificationLogs: NotificationLog[] = [
  {
    id: "log-1",
    timestamp: "2026-10-12 17:20",
    type: "attendance_absent",
    channel: "whatsapp",
    recipientName: "Sunil Kulkarni",
    recipientPhone: "+91 99001 77889",
    studentName: "Rohan Kulkarni",
    content: "Dear Sunil Kulkarni, this is to inform you that your ward Rohan Kulkarni (Roll No: 03) was absent from the JEE Advanced Pinnacle Batch A1 lecture on 2026-10-12...",
    status: "delivered"
  },
  {
    id: "log-2",
    timestamp: "2026-10-12 09:25",
    type: "attendance_absent",
    channel: "whatsapp",
    recipientName: "Kishore Reddy",
    recipientPhone: "+91 99800 33445",
    studentName: "Ishaan Reddy",
    content: "Dear Kishore Reddy, this is to inform you that your ward Ishaan Reddy (Roll No: 07) was absent from the NEET Super-30 Medical Elite lecture on 2026-10-12...",
    status: "delivered"
  },
  {
    id: "log-3",
    timestamp: "2026-10-09 11:00",
    type: "exam_result",
    channel: "whatsapp",
    recipientName: "Dr. Vikram Deshmukh",
    recipientPhone: "+91 97112 88990",
    studentName: "Ananya Deshmukh",
    content: "Dear Dr. Vikram Deshmukh, the results for 'NEET Unit Test: Plant Physiology & Human Reproduction' have been announced. Ananya Deshmukh scored 334 / 360 (Rank: #2 in batch)...",
    status: "delivered"
  },
  {
    id: "log-4",
    timestamp: "2026-10-06 18:30",
    type: "exam_result",
    channel: "sms",
    recipientName: "Sanjay Sharma",
    recipientPhone: "+91 98231 99887",
    studentName: "Aarav Sharma",
    content: "Dear Sanjay Sharma, the results for 'Major All-India Mock Test 04' have been announced. Aarav Sharma scored 164 / 180 (Rank: #1 in batch). Batch Topper!",
    status: "delivered"
  }
];
