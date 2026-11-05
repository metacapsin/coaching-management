import { describe, expect, it } from 'vitest';
import { dueText, homeworkNotice, lateNotice, sameSubject, studentHomeworkNotice, studentResultNotice, studentTestNotice, studentTestReminder, testNotice, testReminder, whenText } from '../components/utils/parentNotices';

const who = { parentName: 'Mrs Alice', studentName: 'Alice', coaching: 'Apex Academy' };
const test = { title: 'Unit test 3', subject: 'Physics', date: '2026-11-10', maxMarks: 50, topics: ['Motion', 'Force'], teacherName: 'Neha Sharma' };

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
    expect(text).toContain('Alice has a Physics test'); // the subject is named
    expect(text).toContain('Neha Sharma will take the test'); // and the teacher
    expect(text).toContain('Unit test 3');
    expect(text).toContain('in 5 days');
    expect(text).toContain('Maximum marks: 50');
    expect(text).toContain('It covers: Motion, Force');
    expect(testNotice(who, test, '2026-11-09')).toContain('has a Physics test tomorrow');
    expect(testNotice(who, { ...test, teacherName: undefined }, '2026-11-09')).not.toContain('will take the test');
    expect(testNotice(who, { ...test, topics: ['General Full Syllabus'] }, '2026-11-05')).not.toContain('It covers');
  });

  it('the reminder of the day before says TOMORROW', () => {
    const text = testReminder(who, test);
    expect(text).toContain('TOMORROW');
    expect(text).toContain('Alice');
    expect(text).toContain('Unit test 3');
  });

  it('only the teacher of the subject: the same subject matches, another does not, no subject on record is not limited', () => {
    expect(sameSubject('Physics', 'physics')).toBe(true);
    expect(sameSubject('Physics', 'Physics & Mathematics')).toBe(true);
    expect(sameSubject('Physics', 'Maths')).toBe(false);
    expect(sameSubject('Physics', '')).toBe(false);
    expect(sameSubject('', 'Maths')).toBe(true);
    expect(sameSubject(undefined, 'Maths')).toBe(true);
  });

  it('the notice for a late student confirms it to the parent', () => {
    const text = lateNotice(who, 'Class 12 Batch', '2026-11-05');
    expect(text).toContain('Dear Mrs Alice');
    expect(text).toContain('Alice joined the Class 12 Batch class late today (5 Nov 2026)');
    expect(text).toContain('class teacher');
  });

  it('the notices for the student speak to the student, not to the parent', () => {
    const me = { studentName: 'Alice', coaching: 'Apex Academy' };
    const hw = { title: 'Calculus set 4', description: 'Solve questions 1 to 25.', subject: 'Maths', batchName: 'Class 12 Batch', dueDate: '2026-11-06' };
    expect(studentHomeworkNotice(me, { ...hw, teacherName: 'Raman Iyer' }, '2026-11-05', test)).toContain('Hi Alice, today Raman Iyer (Maths teacher) gave you homework: "Calculus set 4"');
    expect(studentHomeworkNotice(me, hw, '2026-11-05')).toContain('today the Maths teacher gave you homework');
    expect(studentHomeworkNotice(me, hw, '2026-11-05')).toContain('Submit it by tomorrow (6 Nov 2026)');
    expect(studentHomeworkNotice(me, hw, '2026-11-05')).not.toContain('Dear');
    expect(studentTestNotice(me, test, '2026-11-05')).toContain('you have a Physics test on 10 Nov 2026 (in 5 days)');
    expect(studentTestNotice(me, test, '2026-11-05')).toContain('Neha Sharma will take the test');
    expect(studentResultNotice(me, { title: 'Unit test 3', subject: 'Physics', score: 42, maxMarks: 50, rank: 2, remarks: 'Well done' })).toContain('the result of Unit test 3 (Physics) is out: you scored 42 out of 50 (rank 2 in the batch). Well done.');
    expect(studentTestReminder(me, test)).toContain('you have a Physics test TOMORROW');
  });

  it('the homework notice says what it is, until when, and tells a test that is coming', () => {
    const hw = { title: 'Calculus set 4', description: 'Solve questions 1 to 25.', subject: 'Maths', batchName: 'Class 12 Batch', dueDate: '2026-11-07' };
    const text = homeworkNotice(who, hw, '2026-11-05', test);
    expect(text).toContain('today the Maths teacher gave the students of Class 12 Batch homework: "Calculus set 4"');
    expect(homeworkNotice(who, { ...hw, teacherName: 'Raman Iyer' }, '2026-11-05')).toContain('today Raman Iyer (Maths teacher) gave the students of Class 12 Batch homework');
    expect(text).toContain('Solve questions 1 to 25.');
    expect(text).toContain('submit it by 7 Nov 2026 (in 2 days)');
    expect(text).not.toContain('(on ');
    expect(dueText('2026-11-06', '2026-11-05')).toBe('tomorrow (6 Nov 2026)');
    expect(text).toContain('a Physics test is coming');
    expect(text).toContain('Unit test 3');
    expect(homeworkNotice(who, hw, '2026-11-05')).not.toContain('a test is coming');
  });
});
