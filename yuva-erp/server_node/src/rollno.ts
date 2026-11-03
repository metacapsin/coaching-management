// Roll numbers are plain running numbers like in a school register: 01, 02, 03 ... 99, 100.
// A new student gets the highest number in the list + 1.

export const isPlain = (value: any): boolean => /^\d+$/.test(String(value ?? '').trim());

export const formatRoll = (n: number): string => String(n).padStart(2, '0');

export function highestPlain(students: any[]): number {
  let best = 0;
  for (const s of students) if (isPlain(s.rollNo)) best = Math.max(best, parseInt(String(s.rollNo).trim(), 10));
  return best;
}

export const nextRollNumber = (students: any[]): string => formatRoll(highestPlain(students) + 1);

function tailNumber(value: any): number {
  const m = /(\d+)\D*$/.exec(String(value || ''));
  return m ? parseInt(m[1], 10) : 0;
}

/** Older data used numbers like APEX-25-0101. Those students get plain numbers in the same order
 * (APEX-25-0101 -> 01, APEX-25-0102 -> 02 ...). Returns { student id: new roll number }. */
export function renumberLegacyRolls(students: any[]): Record<string, string> {
  const legacy = students
    .filter((s) => !isPlain(s.rollNo))
    .sort((a, b) => tailNumber(a.rollNo) - tailNumber(b.rollNo) || String(a.dateOfAdmission || '').localeCompare(String(b.dateOfAdmission || '')));
  let next = highestPlain(students) + 1;
  const mapping: Record<string, string> = {};
  for (const s of legacy) {
    mapping[s.id] = formatRoll(next);
    next += 1;
  }
  return mapping;
}
