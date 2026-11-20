import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// The bar measures the room it has for the search. jsdom has no layout: a fake measuring says how many pixels are free.
let free = 60;
beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    cb: (e: { contentRect: { width: number } }[]) => void;
    constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ contentRect: { width: free } }]);
    }
    disconnect() {}
  };
});
afterEach(cleanup);

const bar = (onSelect = vi.fn()) =>
  render(<Navbar activeTab="dashboard" onNavigate={vi.fn()} onOpenAdmission={vi.fn()} onAddTeacher={vi.fn()} onSelectStudent={onSelect} />);

describe('the search in the top bar', () => {
  it('with little room it is a small icon, and pressed it opens the search box', () => {
    free = 60; // a very small phone, or the cover screen of a folding phone
    bar();
    expect(screen.queryByPlaceholderText(/^Search/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Search a student' }));
    expect(screen.getByPlaceholderText(/^Search/)).not.toBeNull();
  });

  it('with enough room it is the search box at once (no icon), as on a computer', () => {
    free = 320; // a big phone, a folding phone opened, a tablet
    bar();
    expect(screen.getByPlaceholderText(/^Search/)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Search a student' })).toBeNull();
  });

  it('after a student is chosen the box goes back to the icon', () => {
    free = 60;
    const onSelect = vi.fn();
    bar(onSelect);
    fireEvent.click(screen.getByRole('button', { name: 'Search a student' }));
    const input = screen.getByPlaceholderText(/^Search/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Aman' } });
    fireEvent.click(screen.getByText('Aman Test'));
    expect(onSelect).toHaveBeenCalledWith('s1');
    expect(screen.getByRole('button', { name: 'Search a student' })).not.toBeNull();
    expect(screen.queryByPlaceholderText(/^Search/)).toBeNull();
  });
});
