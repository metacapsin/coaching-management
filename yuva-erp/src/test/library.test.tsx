import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { canAccessTab } from '../Context/Access';

// The page reads the books from the institute context and the role from the sign in: fakes with sample data
const ctx = {
  books: [
    { id: 'b1', title: 'NCERT Physics', author: 'NCERT', category: 'Physics', url: 'https://ncert.nic.in/textbook.php' },
    { id: 'b2', title: 'Organic Chemistry', author: 'Morrison', category: 'Chemistry', url: 'javascript:alert(1)' },
    { id: 'b3', title: 'Botany Notes', author: '', category: 'Biology', url: '' }
  ],
  addBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn()
};
const auth = { user: { role: 'student' } };
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ctx }));
vi.mock('../Context/AuthContext', () => ({ useAuth: () => auth }));

import { LibraryView } from '../components/views/LibraryView';

afterEach(cleanup);

describe('library', () => {
  it('everybody who studies or teaches can open the page, the Super Admin cannot', () => {
    for (const role of ['admin', 'staff', 'teacher', 'student'] as const) expect(canAccessTab(role, 'library')).toBe(true);
    expect(canAccessTab('super', 'library')).toBe(false);
  });

  it('a student sees the books with a Read link and cannot add or delete', () => {
    auth.user.role = 'student';
    render(<LibraryView />);
    expect(screen.getByText('NCERT Physics')).not.toBeNull();
    const read = screen.getAllByRole('link', { name: /Read/ });
    expect(read).toHaveLength(1); // only the book with a safe web link
    expect(read[0].getAttribute('href')).toBe('https://ncert.nic.in/textbook.php');
    expect(read[0].getAttribute('target')).toBe('_blank');
    expect(read[0].getAttribute('rel')).toContain('noopener');
    expect(screen.queryByRole('button', { name: /Add book/ })).toBeNull();
    expect(screen.queryByTitle('Delete')).toBeNull();
  });

  it('the principal can add, edit and delete', () => {
    auth.user.role = 'admin';
    render(<LibraryView />);
    expect(screen.getByRole('button', { name: /Add book/ })).not.toBeNull();
    expect(screen.getAllByTitle('Delete')).toHaveLength(3);
  });

  it('the search narrows the list', () => {
    auth.user.role = 'student';
    render(<LibraryView />);
    fireEvent.change(screen.getByPlaceholderText(/Search title/), { target: { value: 'organic' } });
    expect(screen.getByText('Organic Chemistry')).not.toBeNull();
    expect(screen.queryByText('NCERT Physics')).toBeNull();
  });
});
