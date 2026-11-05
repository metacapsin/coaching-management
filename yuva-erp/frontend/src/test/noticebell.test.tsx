import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// The bell of everybody: fake contexts
let role = 'teacher';
const deleteNotification = vi.fn();
const announcements = [
  { id: 'an1', title: 'Teachers meeting', body: 'Friday 4 pm', audience: 'teachers', createdAt: '2026-11-05T08:00:00.000Z', authorId: 'x', authorName: 'P' },
  { id: 'an2', title: 'Holiday', body: 'Closed on Friday', audience: 'all', createdAt: '2026-11-04T09:00:00.000Z', authorId: 'x', authorName: 'P', pinned: true },
  { id: 'an3', title: 'My own notice', body: 'Written by me', audience: 'all', createdAt: '2026-11-03T09:00:00.000Z', authorId: 'u-admin', authorName: 'P' }
];
const logs = [
  { id: 'log1', timestamp: '2026-11-05 10:13', type: 'new_student', channel: 'app', studentName: 'Newbie Kid', content: 'Newbie Kid (Roll No: 05) joined Batch A.', batchId: 'b1', status: 'sent' },
  { id: 'log2', timestamp: '2026-11-05 10:39', type: 'fee_due', channel: 'whatsapp', studentName: 'sharique', recipientName: 'khatim', content: 'Dear khatim, a pending installment of 1,45,000 is due.', status: 'pending' }
];
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ({ announcements, notificationLogs: logs, deleteNotification }) }));
vi.mock('../Context/AuthContext', () => ({ useAuth: () => ({ user: { id: `u-${role}`, role } }) }));

import { NoticeBell } from '../components/layout/NoticeBell';

beforeEach(() => {
  localStorage.clear();
  deleteNotification.mockClear();
});
afterEach(cleanup);

const bell = () => screen.getByLabelText('Notifications');

describe('the bell of everybody', () => {
  it('a teacher sees the notices of others and the new student of the batch, with a number on the bell', () => {
    role = 'teacher';
    render(<NoticeBell />);
    expect(bell().textContent).toBe('4'); // the meeting, the holiday, the notice of the principal, the new student (not the fee message)
    fireEvent.click(bell());
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.getByText('Newbie Kid')).not.toBeNull();
    expect(screen.getByText('My own notice')).not.toBeNull(); // written by the principal, so it is a notice of somebody else for the teacher
    expect(screen.queryByText(/sharique/)).toBeNull();
    // opening it means seen: the number is gone
    expect(bell().textContent).toBe('');
  });

  it('the principal also gets the messages to the parents and the new student, and the notices of the teachers', () => {
    role = 'admin';
    render(<NoticeBell onOpenBroadcast={() => undefined} />);
    expect(bell().textContent).toBe('4'); // meeting, holiday, new student, fee message (not the own notice)
    fireEvent.click(bell());
    expect(screen.getByText('sharique · to khatim')).not.toBeNull();
    expect(screen.getByText('Fee due')).not.toBeNull();
    expect(screen.queryByText('My own notice')).toBeNull(); // the notices that I wrote myself are not in my bell
    expect(screen.getByText('Open Parent Broadcast Center →')).not.toBeNull();
  });

  it('a student and a parent only read the notices: no messages to parents, no new student lines, no write button', () => {
    role = 'student';
    render(<NoticeBell />);
    fireEvent.click(bell());
    expect(screen.queryByText('Newbie Kid')).toBeNull();
    expect(screen.queryByText(/sharique/)).toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.queryByText('Open Parent Broadcast Center →')).toBeNull();
  });

  it('a click on a line shows the whole message, a second click folds it, deleting does not open it', () => {
    role = 'teacher';
    render(<NoticeBell />);
    fireEvent.click(bell());
    expect(screen.getByText('Friday 4 pm').className).toContain('line-clamp-1');
    fireEvent.click(screen.getByText('Teachers meeting'));
    expect(screen.getByText('Friday 4 pm').className).not.toContain('line-clamp-1');
    fireEvent.click(screen.getByText('Teachers meeting'));
    expect(screen.getByText('Friday 4 pm').className).toContain('line-clamp-1');
  });

  it('a line can be deleted and everything cleared; it is remembered; only the principal really deletes a message to the parents', () => {
    role = 'teacher';
    const first = render(<NoticeBell />);
    fireEvent.click(bell());
    fireEvent.click(within(screen.getByText('Holiday').closest('div.px-4') as HTMLElement).getByLabelText('Delete this notification'));
    expect(screen.queryByText('Holiday')).toBeNull();
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    first.unmount();
    render(<NoticeBell />); // the next visit: still deleted
    fireEvent.click(bell());
    expect(screen.queryByText('Holiday')).toBeNull();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('Nothing new.')).not.toBeNull();
    expect(deleteNotification).not.toHaveBeenCalled(); // a teacher deletes nothing of the coaching
    cleanup();

    localStorage.clear();
    role = 'admin';
    render(<NoticeBell />);
    fireEvent.click(bell());
    fireEvent.click(within(screen.getByText('sharique · to khatim').closest('div.px-4') as HTMLElement).getByLabelText('Delete this notification'));
    expect(deleteNotification).toHaveBeenCalledWith('log2'); // the message to the parent is really deleted
    fireEvent.click(within(screen.getByText('Newbie Kid').closest('div.px-4') as HTMLElement).getByLabelText('Delete this notification'));
    expect(deleteNotification).toHaveBeenCalledTimes(1); // the new student line only leaves the own bell (the teacher reads it too)
  });
});
