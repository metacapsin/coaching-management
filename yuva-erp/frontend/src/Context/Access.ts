// Single place that defines which role can open which page.

export type TabId =
  | 'dashboard'
  | 'students'
  | 'enquiries'
  | 'attendance'
  | 'fees'
  | 'exams'
  | 'batches'
  | 'notices'
  | 'material'
  | 'leave'
  | 'reports'
  | 'expenses'
  | 'library'
  | 'notifications'
  | 'team'
  | 'settings';

export type UserRole = 'super' | 'admin' | 'teacher' | 'student';

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  // Super admin: has its own screen (the list of coachings), no coaching pages
  super: [],
  // Principal: everything
  admin: [
    'dashboard',
    'students',
    'enquiries',
    'attendance',
    'fees',
    'exams',
    'batches',
    'notices',
    'material',
    'reports',
    'expenses',
    'library',
    'notifications',
    'team',
    'settings'
  ],
  // Teacher: own dashboard + own batches only (the server sends only their data)
  // (leave: a teacher asks for the own leave; the principal decides)
  teacher: ['dashboard', 'attendance', 'exams', 'notices', 'material', 'leave', 'library', 'team'],
  // Student: own portal, notices and study material of the batch
  // (leave: a student asks; the page itself says a parent only reads)
  student: ['dashboard', 'notices', 'material', 'leave', 'library', 'team']
};

export const canAccessTab = (role: UserRole | undefined, tab: TabId) =>
  !!role && ROLE_TABS[role].includes(tab);

// Only the principal manages the institute (admissions, fees, broadcasts)
export const canManageInstitute = (role?: UserRole) => role === 'admin';
