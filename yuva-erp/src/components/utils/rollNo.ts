// Roll numbers are always assigned automatically: highest number in the list + 1.
// Example: the list has ... APEX-25-0110, APEX-25-0111  ->  next is APEX-25-0112.
// Gaps left in the middle by deleted students are not filled. If the very last student is deleted,
// its number becomes free again because the list no longer contains it.

export const ROLL_PREFIX = 'APEX-25-';

export const nextRollNumber = (students: { rollNo?: string }[]): string => {
  const used = students.map(s => {
    const match = (s.rollNo || '').match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const next = Math.max(100, ...used) + 1;
  return `${ROLL_PREFIX}${String(next).padStart(4, '0')}`;
};