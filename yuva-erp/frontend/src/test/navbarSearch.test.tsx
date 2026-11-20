import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// The top bar reads the institute and the signed in person: small fakes
vi.mock('../Context/InstituteContext', () => ({
  useInstitute: () => ({
    profile: { name: 'Apex Academy', currencySymbol: '₹' },
    students: [{ id: 's1', name: 'Aman Test', rollNo: '101', batchId: 'b1', parentName: 'P', parentPhone: '9876500000', phone: '', status: 'active', grade: 'Class 12', photoUrl: '' }],
    batches: [{ id: 'b1', name: 'Batch A' }],
    saveState: 'saved'
  })
}));
vi.mock('../Context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'admin', name: 'Md Sahil', email: 'a@b.com' }, signOut: vi.fn(), isAdmin: true }),
  accountLabel: () => 'Principal (Administrator)'
}));
vi.mock('../components/layout/NoticeBell', () => ({ NoticeBell: () => <button type="button" aria-label="Notices" /> }));

import { Navbar } from '../components/layout/Navbar';

afterEach(cleanup);

const bar = () =>
  render(<Navbar activeTab="dashboard" onNavigate={vi.fn()} onOpenAdmission={vi.fn()} onAddTeacher={vi.fn()} onSelectStudent={vi.fn()} />);

describe('the top bar on a phone', () => {
  it('has a search icon that opens the search box, and closes it again', () => {
    bar();
    const box = () => screen.getByPlaceholderText(/Search student/).closest('div') as HTMLElement;
    // closed: the box is hidden on a phone (it is shown by the width of the screen from 460 px up)
    expect(box().className).toContain('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Search a student' }));
    expect(box().className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(box().className).toContain('w-full');
    // the icon is now the close button
    fireEvent.click(screen.getByRole('button', { name: 'Close the search' }));
    expect(box().className).toContain('hidden');
  });

  it('closes the box when a student was chosen', () => {
    const onSelect = vi.fn();
    render(<Navbar activeTab="dashboard" onNavigate={vi.fn()} onOpenAdmission={vi.fn()} onAddTeacher={vi.fn()} onSelectStudent={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search a student' }));
    const input = screen.getByPlaceholderText(/Search student/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Aman' } });
    fireEvent.click(screen.getByText('Aman Test'));
    expect(onSelect).toHaveBeenCalledWith('s1');
    expect(screen.getByRole('button', { name: 'Search a student' })).not.toBeNull(); // back to the icon
  });
});
