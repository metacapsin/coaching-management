import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// The bell of everybody: fake contexts
let role = 'teacher';
let isParent = false;
const announcements = [
  { id: 'an1', title: 'Teachers meeting', body: 'Friday 4 pm', audience: 'teachers', createdAt: '2026-11-05T08:00:00.000Z', authorId: 'x', authorName: 'P' },
  { id: 'an2', title: 'Holiday', body: 'Closed on Friday', audience: 'all', createdAt: '2026-11-04T09:00:00.000Z', authorId: 'x', authorName: 'P', pinned: true },
  { id: 'an3', title: 'My own notice', body: 'Written by me', audience: 'all', createdAt: '2026-11-03T09:00:00.000Z', authorId: 'u-admin', authorName: 'P' }
];
const logs = [
  { id: 'log1', timestamp: '2026-11-05 10:13', type: 'new_student', channel: 'app', studentName: 'Newbie Kid', content: 'Newbie Kid (Roll No: 05) joined Batch A.', batchId: 'b1', status: 'sent' },
  { id: 'log2', timestamp: '2026-11-05 10:39', type: 'fee_due', channel: 'whatsapp', studentName: 'sharique', recipientName: 'khatim', content: 'Dear khatim, a pending installment of 1,45,000 is due.', status: 'pending' }
];
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ({ announcements, notificationLogs: logs }) }));
vi.mock('../Context/AuthContext', () => ({ useAuth: () => ({ user: { id: `u-${role}${isParent ? '-parent' : ''}`, role, isParent } }) }));

import { NoticeBell } from '../components/layout/NoticeBell';
import { getBellMemory } from '../components/utils/bellMemory';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  isParent = false;
});
afterEach(cleanup);

const bell = () => screen.getByLabelText('Notifications');
const noop = () => undefined;

describe('the bell of everybody', () => {
  it('a teacher sees the notices of others and the new student of the batch, with a number on the bell', () => {
    role = 'teacher';
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('4'); // the meeting, the holiday, the notice of the principal, the new student (not the fee message)
    fireEvent.click(bell());
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.getByText('Newbie Kid')).not.toBeNull();
    expect(screen.getByText('My own notice')).not.toBeNull(); // written by the principal, so it is a notice of somebody else for the teacher
    expect(screen.queryByText(/sharique/)).toBeNull();
    expect(bell().textContent).toBe(''); // opening it means seen: the number is gone
  });

  it('the principal gets what comes to him (notices of others, a new student) but NOT the messages that he sends to the parents', () => {
    role = 'admin';
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('3'); // meeting, holiday, new student
    fireEvent.click(bell());
    expect(screen.getByText('Newbie Kid')).not.toBeNull();
    expect(screen.queryByText('sharique')).toBeNull(); // the fee message is for the parent
    expect(screen.queryByText('Fee due')).toBeNull();
    expect(screen.queryByText('My own notice')).toBeNull(); // the notices that I wrote myself are not in my bell
  });

  it('a parent gets the notices and the messages of the coaching about the child; a student gets no message that is for the parent', () => {
    role = 'student';
    isParent = true;
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('4'); // three notices and the fee message (not the line about a new student)
    fireEvent.click(bell());
    expect(screen.getByText('sharique')).not.toBeNull();
    expect(screen.getByText('Fee due')).not.toBeNull();
    expect(screen.queryByText('Newbie Kid')).toBeNull();
  });

  it('a student only reads the notices: no message for the parent, no new student line', () => {
    role = 'student';
    render(<NoticeBell onOpen={noop} />);
    fireEvent.click(bell());
    expect(screen.queryByText('Newbie Kid')).toBeNull();
    expect(screen.queryByText(/sharique/)).toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
  });

  it('a click opens the Notice Board with that message and counts as read', () => {
    role = 'admin';
    const opened: string[] = [];
    render(<NoticeBell onOpen={tab => opened.push(tab)} />);
    fireEvent.click(bell());
    fireEvent.click(screen.getByText('Holiday'));
    expect(opened).toEqual(['notices']);
    expect(JSON.parse(sessionStorage.getItem('academia_os_focus_item') as string)).toEqual({ tab: 'notices', id: 'an2' });
    expect(getBellMemory('u-admin').pageNotices).toContain('an2'); // the number of the Notice Board goes down

    fireEvent.click(bell());
    fireEvent.click(screen.getByText('Newbie Kid'));
    expect(opened[1]).toBe('notices'); // a new student is shown on the Notice Board too
    expect(screen.queryByText('Nothing new.')).toBeNull();
  });

  it('a line can be deleted and everything cleared; it is remembered', () => {
    role = 'teacher';
    const first = render(<NoticeBell onOpen={noop} />);
    fireEvent.click(bell());
    fireEvent.click(within(screen.getByText('Holiday').closest('div.px-4') as HTMLElement).getByLabelText('Delete this notification'));
    expect(screen.queryByText('Holiday')).toBeNull();
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    first.unmount();
    render(<NoticeBell onOpen={noop} />); // the next visit: still deleted
    fireEvent.click(bell());
    expect(screen.queryByText('Holiday')).toBeNull();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('Nothing new.')).not.toBeNull();
  });
});
