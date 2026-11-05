import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// The bell of a teacher / student: fake contexts
let role = 'teacher';
const announcements = [
  { id: 'an1', title: 'Teachers meeting', body: 'Friday 4 pm', audience: 'teachers', createdAt: '2026-11-05T08:00:00.000Z', authorId: 'x', authorName: 'P' },
  { id: 'an2', title: 'Holiday', body: 'Closed on Friday', audience: 'all', createdAt: '2026-11-04T09:00:00.000Z', authorId: 'x', authorName: 'P', pinned: true }
];
const logs = [{ id: 'log1', timestamp: '2026-11-05 10:13', type: 'new_student', channel: 'app', studentName: 'Newbie Kid', content: 'Newbie Kid (Roll No: 05) joined Batch A.', batchId: 'b1', status: 'sent' }];
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ({ announcements, notificationLogs: logs }) }));
vi.mock('../Context/AuthContext', () => ({ useAuth: () => ({ user: { id: `u-${role}`, role } }) }));

import { NoticeBell } from '../components/layout/NoticeBell';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the bell of a teacher and a student', () => {
  it('a teacher sees the meeting notice, the notice for everybody and the new student of the batch, with a number on the bell', () => {
    role = 'teacher';
    render(<NoticeBell onOpenBoard={() => undefined} />);
    expect(screen.getByLabelText('Notices from the coaching').textContent).toBe('3');
    fireEvent.click(screen.getByLabelText('Notices from the coaching'));
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.getByText('Newbie Kid')).not.toBeNull();
    expect(screen.getByText('New student')).not.toBeNull();
    // opening it means seen: the number is gone
    expect(screen.getByLabelText('Notices from the coaching').textContent).toBe('');
  });

  it('a student does not get the new student lines', () => {
    role = 'student';
    render(<NoticeBell onOpenBoard={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Notices from the coaching'));
    expect(screen.queryByText('Newbie Kid')).toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
  });

  it('a line can be deleted, and everything can be cleared; it is remembered', () => {
    role = 'teacher';
    const { unmount } = render(<NoticeBell onOpenBoard={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Notices from the coaching'));
    fireEvent.click(within(screen.getByText('Holiday').closest('div.px-4') as HTMLElement).getByLabelText('Delete this from the list'));
    expect(screen.queryByText('Holiday')).toBeNull();
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    unmount();
    render(<NoticeBell onOpenBoard={() => undefined} />); // the next visit: still deleted
    fireEvent.click(screen.getByLabelText('Notices from the coaching'));
    expect(screen.queryByText('Holiday')).toBeNull();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('Nothing new from the coaching.')).not.toBeNull();
  });
});
