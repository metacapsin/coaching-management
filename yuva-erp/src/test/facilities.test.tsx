import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { canAccessTab } from '../Context/Access';
import { initialBooks, initialHostelRooms, initialStudents, initialTransportRoutes } from '../data/mockData';

// The page reads and changes its data through the institute context: a fake one with the sample data
const ctx = {
  books: initialBooks,
  transportRoutes: initialTransportRoutes,
  hostelRooms: initialHostelRooms,
  students: initialStudents,
  profile: { currencySymbol: '₹' },
  addBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  updateTransportRoute: vi.fn(),
  deleteTransportRoute: vi.fn(),
  updateHostelRoom: vi.fn(),
  deleteHostelRoom: vi.fn()
};
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ctx }));

import { FacilitiesView } from '../components/views/FacilitiesView';

afterEach(cleanup);

describe('library, transport and hostel', () => {
  it('only the principal and the front desk can open the page', () => {
    expect(canAccessTab('admin', 'facilities')).toBe(true);
    expect(canAccessTab('staff', 'facilities')).toBe(true);
    expect(canAccessTab('teacher', 'facilities')).toBe(false);
    expect(canAccessTab('student', 'facilities')).toBe(false);
    expect(canAccessTab('super', 'facilities')).toBe(false);
  });

  it('the library shows the books, how many are free, and the overdue ones', () => {
    render(<FacilitiesView />);
    expect(screen.getByText('Concepts of Physics (Vol. 1)')).not.toBeNull();
    expect(screen.getByText('2 of 3')).not.toBeNull(); // 3 copies, 1 on loan
    expect(screen.getByText('1 overdue')).not.toBeNull(); // the sample Biology loan is late
  });

  it('the library search narrows the list', () => {
    render(<FacilitiesView />);
    fireEvent.change(screen.getByPlaceholderText(/Search title/), { target: { value: 'chemistry' } });
    expect(screen.getByText('Organic Chemistry')).not.toBeNull();
    expect(screen.queryByText('Concepts of Physics (Vol. 1)')).toBeNull();
  });

  it('the other two tabs show the routes and the rooms', () => {
    render(<FacilitiesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Transport' }));
    expect(screen.getByText(/Route 1: Railway Station/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hostel' }));
    expect(screen.getByText('Room A-101')).not.toBeNull();
    expect(screen.getAllByText('Boys Block A').length).toBe(2); // two rooms in this block
  });
});
