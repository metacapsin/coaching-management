// Single place that defines which role can open which page.

export type TabId =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'fees'
  | 'exams'
  | 'batches'
  | 'notifications'
  | 'team'
  | 'settings';

export type UserRole = 'admin' | 'staff' | 'teacher' | 'student';

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  // Principal: everything
  admin: ['dashboard', 'students', 'attendance', 'fees', 'exams', 'batches', 'notifications', 'team', 'settings'],
  // Front desk / office staff
  staff: ['dashboard', 'students', 'attendance', 'fees', 'exams', 'batches', 'notifications', 'team'],
  // Teacher: own dashboard + own batches only (data is limited by RoleScope)
  teacher: ['dashboard', 'attendance', 'exams', 'team'],
  // Student: own portal only
  student: ['dashboard', 'team']
};

export const canAccessTab = (role: UserRole | undefined, tab: TabId) =>
  !!role && ROLE_TABS[role].includes(tab);

// Admin and office staff manage the institute (admissions, fees, broadcasts)
export const canManageInstitute = (role?: UserRole) => role === 'admin' || role === 'staff';