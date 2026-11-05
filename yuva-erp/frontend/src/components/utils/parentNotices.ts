import { formatDate } from './helpers';

// The words of the notices to the parents about a test and about homework. They go to ALL the parents of the batch (not one
// student), so every parent knows the date of the test and that homework was given today.

const DAY = 86400000;

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

export type TestInfo = { title: string; subject: string; date: string; maxMarks: number; topics: string[] };
export type HomeworkInfo = { title: string; description: string; subject: string; batchName: string; dueDate?: string };

const topicsOf = (t: TestInfo): string => t.topics.filter(Boolean).filter(x => x !== 'General Full Syllabus').join(', ');

/** A test was scheduled: every parent of the batch is told the date. */
export const testNotice = (who: Who, test: TestInfo, today: string): string =>
  `Dear ${who.parentName}, ${who.studentName} has a test ${whenText(test.date, today)}: ${test.title}${test.subject ? ` (${test.subject})` : ''}. ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} ` +
  `Please make sure ${who.studentName} is well prepared and revises at home. - ${who.coaching}`;

/** The day before the test. */
export const testReminder = (who: Who, test: TestInfo): string =>
  `Reminder: ${who.studentName} has a test TOMORROW (${formatDate(test.date)}): ${test.title}${test.subject ? ` (${test.subject})` : ''}. ` +
  `Maximum marks: ${test.maxMarks}.${topicsOf(test) ? ` It covers: ${topicsOf(test)}.` : ''} ` +
  `Dear ${who.parentName}, please see that ${who.studentName} revises tonight and comes on time. - ${who.coaching}`;

/** Homework was given: every parent of the batch is told what it is and until when it is to be submitted. Tests that are coming
 * are told in the same message, so the parent knows both. */
export const homeworkNotice = (who: Who, hw: HomeworkInfo, today: string, nextTest?: TestInfo): string =>
  `Dear ${who.parentName}, today the students of ${hw.batchName} got homework${hw.subject ? ` in ${hw.subject}` : ''}: "${hw.title}".` +
  `${hw.description ? ` ${hw.description.replace(/\s+/g, ' ').trim()}` : ''}` +
  `${hw.dueDate ? ` Please submit it by ${dueText(hw.dueDate, today)}.` : ''}` +
  `${nextTest ? ` Also note: a test is coming ${whenText(nextTest.date, today)}: ${nextTest.title}${nextTest.subject ? ` (${nextTest.subject})` : ''}.` : ''} ` +
  `Please make sure ${who.studentName} does it. - ${who.coaching}`;
