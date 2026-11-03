// Roll numbers are plain running numbers like in a school register: 01, 02, 03 ... 99, 100.
// A new student gets the highest number in the list + 1. The server uses the same rule.
// Gaps left by deleted students are not filled. If the last student is deleted, its number is free again.

const isPlain = (value?: string) => /^\d+$/.test((value ?? '').trim());

export const nextRollNumber = (students: { rollNo?: string }[]): string => {
  const highest = students.reduce((max, s) => (isPlain(s.rollNo) ? Math.max(max, parseInt(s.rollNo as string, 10)) : max), 0);
  return String(highest + 1).padStart(2, '0');
};
