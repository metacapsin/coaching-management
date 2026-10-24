// Roll numbers are plain running numbers like in a school register: 01, 02, 03 ... 99, 100.
// A new student gets the highest number in the list + 1.

const isPlain = value => /^\d+$/.test(String(value ?? '').trim());

export const formatRoll = n => String(n).padStart(2, '0');

const highestPlain = students =>
  students.reduce((max, s) => (isPlain(s.rollNo) ? Math.max(max, parseInt(s.rollNo, 10)) : max), 0);

export const nextRollNumber = students => formatRoll(highestPlain(students) + 1);

const tailNumber = value => {
  const m = String(value ?? '').match(/(\d+)\D*$/);
  return m ? parseInt(m[1], 10) : 0;
};

// Older data used numbers like APEX-25-0101. Those students get plain numbers in the same order
// (APEX-25-0101 -> 01, APEX-25-0102 -> 02 ...). Receipts keep the roll number of their student.
// Returns how many students were renumbered.
export const renumberLegacyRolls = state => {
  const institute = state.institute;
  const students = institute && Array.isArray(institute.students) ? institute.students : null;
  if (!students) return 0;

  const legacy = students
    .filter(s => !isPlain(s.rollNo))
    .sort(
      (a, b) =>
        tailNumber(a.rollNo) - tailNumber(b.rollNo) || String(a.dateOfAdmission).localeCompare(String(b.dateOfAdmission))
    );
  if (legacy.length === 0) return 0;

  let next = highestPlain(students) + 1;
  const newRoll = new Map();
  for (const s of legacy) newRoll.set(s.id, formatRoll(next++));

  institute.students = students.map(s => (newRoll.has(s.id) ? { ...s, rollNo: newRoll.get(s.id) } : s));
  if (Array.isArray(institute.transactions)) {
    institute.transactions = institute.transactions.map(t =>
      newRoll.has(t.studentId) ? { ...t, studentRollNo: newRoll.get(t.studentId) } : t
    );
  }
  return newRoll.size;
};
