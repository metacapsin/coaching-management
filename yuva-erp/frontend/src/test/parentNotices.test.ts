import { describe, expect, it } from 'vitest';
import { dueText, homeworkNotice, studentHomeworkNotice, studentTestNotice, studentTestReminder, testNotice, testReminder, whenText } from '../components/utils/parentNotices';

const who = { parentName: 'Mrs Alice', studentName: 'Alice', coaching: 'Apex Academy' };
const test = { title: 'Unit test 3', subject: 'Physics', date: '2026-11-10', maxMarks: 50, topics: ['Motion', 'Force'] };

describe('the notices to the parents', () => {
  it('says today, tomorrow or the date with the number of days', () => {
    expect(whenText('2026-11-05', '2026-11-05')).toBe('today');
    expect(whenText('2026-11-06', '2026-11-05')).toBe('tomorrow');
    expect(whenText('2026-11-10', '2026-11-05')).toContain('in 5 days');
    expect(whenText('2026-11-10', '2026-11-05')).toContain('10 Nov 2026');
  });

  it('the test notice has the date, the marks and what it covers, and speaks of tomorrow when it is tomorrow', () => {
    const text = testNotice(who, test, '2026-11-05');
    expect(text).toContain('Dear Mrs Alice');
    expect(text).toContain('Alice has a test');
    expect(text).toContain('Unit test 3');
    expect(text).toContain('in 5 days');
    expect(text).toContain('Maximum marks: 50');
    expect(text).toContain('It covers: Motion, Force');
    expect(testNotice(who, test, '2026-11-09')).toContain('has a test tomorrow');
    expect(testNotice(who, { ...test, topics: ['General Full Syllabus'] }, '2026-11-05')).not.toContain('It covers');
  });

  it('the reminder of the day before says TOMORROW', () => {
    const text = testReminder(who, test);
    expect(text).toContain('TOMORROW');
    expect(text).toContain('Alice');
    expect(text).toContain('Unit test 3');
  });

  it('the notices for the student speak to the student, not to the parent', () => {
    const me = { studentName: 'Alice', coaching: 'Apex Academy' };
    const hw = { title: 'Calculus set 4', description: 'Solve questions 1 to 25.', subject: 'Maths', batchName: 'Class 12 Batch', dueDate: '2026-11-06' };
    expect(studentHomeworkNotice(me, hw, '2026-11-05', test)).toContain('Hi Alice, today you got homework in Maths: "Calculus set 4"');
    expect(studentHomeworkNotice(me, hw, '2026-11-05')).toContain('Submit it by tomorrow (6 Nov 2026)');
    expect(studentHomeworkNotice(me, hw, '2026-11-05')).not.toContain('Dear');
    expect(studentTestNotice(me, test, '2026-11-05')).toContain('you have a test on 10 Nov 2026 (in 5 days)');
    expect(studentTestReminder(me, test)).toContain('you have a test TOMORROW');
  });

  it('the homework notice says what it is, until when, and tells a test that is coming', () => {
    const hw = { title: 'Calculus set 4', description: 'Solve questions 1 to 25.', subject: 'Maths', batchName: 'Class 12 Batch', dueDate: '2026-11-07' };
    const text = homeworkNotice(who, hw, '2026-11-05', test);
    expect(text).toContain('today the students of Class 12 Batch got homework in Maths: "Calculus set 4"');
    expect(text).toContain('Solve questions 1 to 25.');
    expect(text).toContain('submit it by 7 Nov 2026 (in 2 days)');
    expect(text).not.toContain('(on ');
    expect(dueText('2026-11-06', '2026-11-05')).toBe('tomorrow (6 Nov 2026)');
    expect(text).toContain('a test is coming');
    expect(text).toContain('Unit test 3');
    expect(homeworkNotice(who, hw, '2026-11-05')).not.toContain('a test is coming');
  });
});
