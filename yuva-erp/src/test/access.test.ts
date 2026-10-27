import { describe, expect, it } from 'vitest';
import { canAccessTab, canManageInstitute } from '../Context/Access';

describe('who may open which page', () => {
  it('lets the principal open everything of a coaching, including expenses and settings', () => {
    for (const tab of ['dashboard', 'students', 'fees', 'expenses', 'settings', 'team'] as const) expect(canAccessTab('admin', tab)).toBe(true);
  });

  it('keeps expenses and settings away from the front desk staff', () => {
    expect(canAccessTab('staff', 'fees')).toBe(true);
    expect(canAccessTab('staff', 'expenses')).toBe(false);
    expect(canAccessTab('staff', 'settings')).toBe(false);
  });

  it('gives a teacher only the classroom pages', () => {
    expect(canAccessTab('teacher', 'attendance')).toBe(true);
    expect(canAccessTab('teacher', 'notices')).toBe(true);
    for (const tab of ['fees', 'students', 'expenses', 'reports', 'settings'] as const) expect(canAccessTab('teacher', tab)).toBe(false);
  });

  it('gives a student only the own pages', () => {
    expect(canAccessTab('student', 'material')).toBe(true);
    for (const tab of ['fees', 'attendance', 'exams', 'expenses', 'enquiries'] as const) expect(canAccessTab('student', tab)).toBe(false);
  });

  it('gives the Super Admin no coaching page at all (it has its own screen)', () => {
    for (const tab of ['dashboard', 'students', 'fees', 'expenses'] as const) expect(canAccessTab('super', tab)).toBe(false);
    expect(canAccessTab(undefined, 'dashboard')).toBe(false);
  });

  it('knows who manages a coaching', () => {
    expect(canManageInstitute('admin')).toBe(true);
    expect(canManageInstitute('staff')).toBe(true);
    expect(canManageInstitute('teacher')).toBe(false);
    expect(canManageInstitute('super')).toBe(false);
  });
});
