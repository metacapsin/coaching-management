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
  { id: 'log2', timestamp: '2026-11-05 10:39', type: 'fee_due', channel: 'whatsapp', studentName: 'sharique', recipientName: 'khatim', content: 'Dear khatim, a pending installment of 1,45,000 is due.', status: 'pending' },
  { id: 'log3', timestamp: '2026-11-05 11:00', type: 'homework', channel: 'student', studentName: 'Alice', recipientName: 'Alice', content: 'Hi Alice, today you got homework in Maths.', status: 'sent' }
];
const exams = [
  { id: 'ex1', title: 'Unit test 4', subject: 'Physics', batchName: 'Class 12 Batch', date: '2026-11-08', confirmed: false, teacherId: 'u-teacher' },
  { id: 'ex2', title: 'Maths test', subject: 'Maths', batchName: 'Class 12 Batch', date: '2026-11-09', confirmed: false } // another subject
];
const materials = [{ id: 'm1', type: 'homework', title: 'Optics worksheet', subject: 'Physics', batchName: 'Class 12 Batch', dueDate: '2026-11-09', confirmed: false }];
const leaveRequests = [{ id: 'l1', studentId: 's1', studentName: 'Alice', batchName: 'Class 12 Batch', parentName: 'Mrs Verma', parentPhone: '9000000001', fromDate: '2026-11-10', toDate: '2026-11-11', reason: 'A family wedding in another city', status: 'pending', createdAt: '2026-11-05T09:00:00Z' }];
vi.mock('../Context/InstituteContext', () => ({ useInstitute: () => ({ announcements, notificationLogs: logs, exams, materials, leaveRequests }) }));
let subject = '';
vi.mock('../Context/AuthContext', () => ({ useAuth: () => ({ user: { id: `u-${role}${isParent ? '-parent' : ''}`, role, isParent, subject } }) }));

import { NoticeBell } from '../components/layout/NoticeBell';
import { getBellMemory } from '../components/utils/bellMemory';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  isParent = false;
  subject = '';
});
afterEach(cleanup);

const bell = () => screen.getByLabelText('Notifications');
const noop = () => undefined;

describe('the bell of everybody', () => {
  it('a teacher sees the notices of others and the new student of the batch, with a number on the bell', () => {
    role = 'teacher';
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('7'); // the meeting, the holiday, the notice of the principal, the new student, and three things to confirm (no subject on record: not limited)
    fireEvent.click(bell());
    expect(screen.getByText('Teachers meeting')).not.toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.getByText('Newbie Kid')).not.toBeNull();
    expect(screen.getByText('My own notice')).not.toBeNull(); // written by the principal, so it is a notice of somebody else for the teacher
    expect(screen.queryByText(/sharique/)).toBeNull();
    expect(bell().textContent).toBe(''); // opening it means seen: the number is gone
  });

  it('a teacher is asked to confirm a test / homework of the own subject that the principal made; a click opens the page with the Confirm button', () => {
    role = 'teacher';
    subject = 'Physics';
    const opened: string[] = [];
    render(<NoticeBell onOpen={tab => opened.push(tab)} />);
    fireEvent.click(bell());
    expect(screen.getAllByText('Please confirm').length).toBe(2); // the Physics test and the Physics homework (not the Maths test)
    expect(screen.getByText(/Physics homework: Optics worksheet/)).not.toBeNull();
    expect(screen.queryByText(/Maths test/)).toBeNull();
    fireEvent.click(screen.getByText(/Physics homework: Optics worksheet/));
    expect(opened).toEqual(['material']);
  });

  it('only the principal gets the leave request of a student in the bell', () => {
    role = 'admin';
    render(<NoticeBell onOpen={() => undefined} />);
    fireEvent.click(bell());
    expect(screen.getByText('Leave request')).not.toBeNull();
    expect(screen.getByText(/Alice wants leave on/)).not.toBeNull();
    expect(screen.getByText(/A family wedding in another city/)).not.toBeNull();
  });

  it('a teacher, a student and a parent never get the leave request in the bell', () => {
    for (const [r, parent] of [['teacher', false], ['student', false], ['student', true]] as const) {
      role = r;
      isParent = parent;
      const { unmount } = render(<NoticeBell onOpen={() => undefined} />);
      fireEvent.click(bell());
      expect(screen.queryByText('Leave request')).toBeNull();
      unmount();
    }
  });

  it('the principal gets what comes to him (notices of others, a new student) but NOT the messages that he sends to the parents', () => {
    role = 'admin';
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('4'); // meeting, holiday, new student, and the leave request of a student
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

  it('a student gets the notices and the homework / test notice written for the student: no message for the parent, no new student line', () => {
    role = 'student';
    render(<NoticeBell onOpen={noop} />);
    expect(bell().textContent).toBe('4'); // three notices and the homework notice for the student
    fireEvent.click(bell());
    expect(screen.queryByText('Newbie Kid')).toBeNull();
    expect(screen.queryByText(/sharique/)).toBeNull();
    expect(screen.getByText('Holiday')).not.toBeNull();
    expect(screen.getByText('From your coaching')).not.toBeNull();
    expect(screen.getByText('Homework')).not.toBeNull();
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
