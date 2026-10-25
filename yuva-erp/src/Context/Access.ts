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
  | 'reports'
  | 'notifications'
  | 'team'
  | 'settings';

export type UserRole = 'super' | 'admin' | 'staff' | 'teacher' | 'student';

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
    'notifications',
    'team',
    'settings'
  ],
  // Front desk / office staff
  staff: [
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
    'notifications',
    'team'
  ],
  // Teacher: own dashboard + own batches only (the server sends only their data)
  teacher: ['dashboard', 'attendance', 'exams', 'notices', 'material', 'team'],
  // Student: own portal, notices and study material of the batch
  student: ['dashboard', 'notices', 'material', 'team']
};

export const canAccessTab = (role: UserRole | undefined, tab: TabId) =>
  !!role && ROLE_TABS[role].includes(tab);

// Admin and office staff manage the institute (admissions, fees, broadcasts)
export const canManageInstitute = (role?: UserRole) => role === 'admin' || role === 'staff';
