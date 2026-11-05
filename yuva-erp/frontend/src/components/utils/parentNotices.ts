import { formatDate } from './helpers';

// The words of the notices to the parents about a test and about homework. They go to ALL the parents of the batch (not one
// student), so every parent knows the date of the test and that homework was given today.

const DAY = 86400000;

/** Is the homework / test of the subject of this teacher? A teacher with no subject on record is not limited. */
export const sameSubject = (teacherSubject?: string, subject?: string): boolean => {
  const mine = String(teacherSubject ?? '').trim().toLowerCase();
  if (!mine) return true;
  const other = String(subject ?? '').trim().toLowerCase();
  return !!other && (other.includes(mine) || mine.includes(other));
};

const dayNumber = (iso: string): number => Math.round(new Date(`${iso}T00:00:00`).getTime() / DAY);

/** "today", "tomorrow", "on 12 Nov 2026 (in 5 days)", or "on 3 Nov 2026" when it is over. */
export const whenText = (date: string, today: string): string => {
  const diff = dayNumber(date) - dayNumber(today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1) return `on ${formatDate(date)} (in ${diff} days)`;
  return `on ${formatDate(date)}`;
};

/** The last day: "today", "tomorrow (8 Nov 2026)", "8 Nov 2026 (in 3 days)". */
export const dueText = (date: string, today: string): string => {
  const diff = dayNumber(date) - dayNumber(today);
  if (diff === 0) return 'today';
  if (diff === 1) return `tomorrow (${formatDate(date)})`;
  if (diff > 1) return `${formatDate(date)} (in ${diff} days)`;
  return formatDate(date);
};

type Who = { parentName: string; studentName: string; coaching: string };

export type TestInfo = { title: string; subject: string; date: string; maxMarks: number; topics: string[]; teacherName?: string };
export type HomeworkInfo = { title: string; description: string; subject: string; batchName: string; dueDate?: string; teacherName?: string };
export type ResultInfo = { title: string; subject: string; score: number; maxMarks: number; rank: number; remarks?: string };

const topicsOf = (t: TestInfo): string => t.topics.filter(Boolean).filter(x => x !== 'General Full Syllabus').join(', ');
/** "a Physics test" / "a test" */
const kindOfTest = (t: TestInfo): string => `${t.subject ? `${t.subject} ` : ''}test`;
/** " Neha Sharma will take the test." */
const takenBy = (t: TestInfo): string => (t.teacherName ? ` ${t.teacherName} will take the test.` : '');
/** "Neha Sharma (Physics teacher)" / "the Physics teacher" */
const giver = (h: HomeworkInfo): string =>
  h.teacherName ? `${h.teacherName}${h.subject ? ` (${h.subject} teacher)` : ''}` : `the ${h.subject || 'class'} teacher`;

/** A test was scheduled: every parent of the batch is told the subject, the date and the teacher. */
export const testNotice = (who: Who, test: TestInfo, today: string): string =>
  `Dear ${who.parentName}, ${who.studentName} has a ${kindOfTest(test)} ${whenText(test.date, today)}: ${test.title}.${takenBy(test)} ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} ` +
  `Please make sure ${who.studentName} is well prepared and revises at home. - ${who.coaching}`;

// ---- the same notices, written for the STUDENT (not "Dear <parent>")
type Me = { studentName: string; coaching: string };

export const studentTestNotice = (me: Me, test: TestInfo, today: string): string =>
  `Hi ${me.studentName}, you have a ${kindOfTest(test)} ${whenText(test.date, today)}: ${test.title}.${takenBy(test)} ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} Revise well and be on time. - ${me.coaching}`;

export const studentTestReminder = (me: Me, test: TestInfo): string =>
  `Reminder: you have a ${kindOfTest(test)} TOMORROW (${formatDate(test.date)}): ${test.title}.${takenBy(test)} ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} Revise tonight and come on time. - ${me.coaching}`;

export const studentHomeworkNotice = (me: Me, hw: HomeworkInfo, today: string, nextTest?: TestInfo): string =>
  `Hi ${me.studentName}, today ${giver(hw)} gave you homework: "${hw.title}".` +
  `${hw.description ? ` ${hw.description.replace(/\s+/g, ' ').trim()}` : ''}` +
  `${hw.dueDate ? ` Submit it by ${dueText(hw.dueDate, today)}.` : ''}` +
  `${nextTest ? ` Also note: a ${kindOfTest(nextTest)} is coming ${whenText(nextTest.date, today)}: ${nextTest.title}.` : ''} - ${me.coaching}`;

/** The result of a test is out (for the student; the parents get the result template of the institute). */
export const studentResultNotice = (me: Me, r: ResultInfo): string =>
  `Hi ${me.studentName}, the result of ${r.title}${r.subject ? ` (${r.subject})` : ''} is out: you scored ${r.score} out of ${r.maxMarks} (rank ${r.rank} in the batch).` +
  `${r.remarks ? ` ${r.remarks}.` : ''} - ${me.coaching}`;

/** The student joined the class late: the parent is told, so it is confirmed (and the reason can be asked). */
export const lateNotice = (who: Who, batchName: string, date: string): string =>
  `Dear ${who.parentName}, this is to confirm that ${who.studentName} joined the ${batchName} class late today (${formatDate(date)}). ` +
  `If there was a problem or a reason for the delay, it is noted. If you did not know about it, please speak to the class teacher. - ${who.coaching}`;

/** The day before the test. */
export const testReminder = (who: Who, test: TestInfo): string =>
  `Reminder: ${who.studentName} has a ${kindOfTest(test)} TOMORROW (${formatDate(test.date)}): ${test.title}.${takenBy(test)} ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} ` +
  `Dear ${who.parentName}, please see that ${who.studentName} revises tonight and comes on time. - ${who.coaching}`;

/** Homework was given: every parent of the batch is told who gave it (subject and teacher), what it is and until when. Tests that are
 * coming are told in the same message, so the parent knows both. */
export const homeworkNotice = (who: Who, hw: HomeworkInfo, today: string, nextTest?: TestInfo): string =>
  `Dear ${who.parentName}, today ${giver(hw)} gave the students of ${hw.batchName} homework: "${hw.title}".` +
  `${hw.description ? ` ${hw.description.replace(/\s+/g, ' ').trim()}` : ''}` +
  `${hw.dueDate ? ` Please submit it by ${dueText(hw.dueDate, today)}.` : ''}` +
  `${nextTest ? ` Also note: a ${kindOfTest(nextTest)} is coming ${whenText(nextTest.date, today)}: ${nextTest.title}.` : ''} ` +
  `Please make sure ${who.studentName} does it. - ${who.coaching}`;
