// The rules and regulations of a coaching for its teachers: about two or three pages. The principal reads them in the app (Rules & Regulations), the
// new teacher gets them by email when the account is made, and has to read and agree to them on the first sign in.

export interface RuleSection { title: string; items: string[] }
export interface Rules { title: string; intro: string; sections: RuleSection[]; closing: string }

export function rulesFor(coaching: string): Rules {
  const c = coaching || 'the coaching';
  return {
    title: `Rules and Regulations for Teachers of ${c}`,
    intro:
      `These rules apply to every teacher who works with ${c}. They are written so that the students learn well, the parents trust the institute, and every teacher knows what is expected and what he or she can expect. ` +
      'Please read all of them. By agreeing, the teacher confirms that he or she has read them and will follow them.',
    sections: [
      {
        title: '1. Appointment and conduct',
        items: [
          'The teacher joins on the date of registration written in the registration form, for the subject and the batches that the principal gave.',
          'The details written in the registration form (name, contact numbers, address, qualification, identity number) must be true. A false detail is a reason to end the work.',
          'The teacher behaves with respect towards students, parents, other teachers, the principal and the staff, in the class, in messages and on calls.',
          'The teacher dresses neatly and speaks politely. Abuse, threats, jokes about a student, caste, religion, gender, region or looks are never allowed.',
          'The teacher never teaches the students of this institute in a private tuition on the side, and never asks a student or a parent for money, gifts or favours.',
          'The teacher does not work for a rival coaching in the same area during the time of this agreement without a written permission of the principal.',
        ],
      },
      {
        title: '2. Time and punctuality',
        items: [
          'Every class starts and ends at the time of the timetable. The teacher reaches the class at least 5 minutes before the start.',
          'A class is never left unattended. A teacher who cannot come informs the principal as early as possible, at least one day before when the absence is known.',
          'The time of a class lost by the teacher is covered by an extra class at a time that the principal and the students agree.',
          'Late coming more than three times in a month is noted and talked about with the principal.',
        ],
      },
      {
        title: '3. Teaching and classes',
        items: [
          'The teacher follows the syllabus and the plan given for the batch, and informs the principal when the plan is behind.',
          'The teacher prepares every class, explains with examples, and gives time to the students to ask doubts. A doubt is never laughed at.',
          'The teacher treats every student of the batch fairly. Weak students get extra attention, and no student is shamed in front of others.',
          'Online classes: the teacher joins from a quiet place, with the camera and the microphone working, and does not record or share a class without the permission of the principal.',
          'Corporal punishment of any kind is strictly forbidden. A problem of discipline is told to the principal.',
        ],
      },
      {
        title: '4. Attendance and leave',
        items: [
          'The teacher marks the attendance of the batch in AcademiaOS on the same day, as soon as the class is over. Absent and late students are marked correctly: the parents are told by email.',
          'A teacher who needs leave asks for it in AcademiaOS (Apply for Leave) with the true reason. The principal answers it. A leave that is not given is a day of absence.',
          'A leave of more than one day, or a leave in the days of a test or of the end of a course, needs the permission of the principal before it begins.',
          'A leave because of sickness is told on the first day. A medical certificate may be asked for a leave of more than two days.',
        ],
      },
      {
        title: '5. Students, parents and safety',
        items: [
          'The safety and the dignity of every student come first. A teacher never meets a student alone in a closed place, and never contacts a student on a private account for a personal reason.',
          'The teacher talks to a parent about the study of the child with the knowledge of the principal, and tells the truth about the progress, the attendance and the behaviour of the child.',
          'The information of a student or a parent (phone numbers, addresses, marks, fees) is private. It is never shared outside the institute, never posted, and never used for any other purpose.',
          'A complaint of a student or a parent is told to the principal at once. The teacher does not settle it alone.',
        ],
      },
      {
        title: '6. Tests, marks and results',
        items: [
          'The teacher takes the tests of the subject on the dates of the schedule, checks the answer sheets honestly and enters the marks in AcademiaOS in time.',
          'A mark is never changed to please a student or a parent. A mistake in a mark is corrected openly and told to the principal.',
          'The teacher tells the parents about the test, the homework and the result through the buttons of AcademiaOS, so that every parent gets the same message.',
          'The questions of a test are kept secret before the test. A teacher who tells the questions to a student before the test is dismissed.',
        ],
      },
      {
        title: '7. Homework and study material',
        items: [
          'Homework is given with a clear last date. The teacher checks the homework that is submitted and tells the students what to improve.',
          'The study material shared in AcademiaOS (books, links, notes) must be correct and legal. The teacher does not share a copied book or a pirated file.',
          'The material and the question banks made for the institute belong to the institute. They are not sold or given to another coaching.',
        ],
      },
      {
        title: '8. Use of AcademiaOS and of the account',
        items: [
          'The login of a teacher is personal. The password is never told to anybody, not even to another teacher or to the principal. A teacher who thinks that somebody knows the password changes it at once.',
          'The first password is chosen by the principal. The teacher chooses an own password at the first sign in and keeps it safe.',
          'Everything done with the account of a teacher (attendance, marks, notices, leave) is recorded and is the responsibility of that teacher.',
          'Notices and messages sent through AcademiaOS are polite and about the study. They are not used for advertising or for any personal matter.',
        ],
      },
      {
        title: '9. Fees and money',
        items: [
          'A teacher never takes fees, donations or any money from a student or a parent. All payments are made to the office, and the office gives the receipt.',
          'A teacher who is asked by a parent about a fee sends the parent to the office.',
          'Money, books and things of the institute that are given to a teacher for work are used only for that work and returned when asked.',
        ],
      },
      {
        title: '10. Pay and payment terms',
        items: [
          'The pay (monthly salary, per lecture, per hour or honorarium) and the way and the day of the payment are the ones agreed in the registration form and in the notes of the terms.',
          'The pay is given after the attendance and the classes of the period are checked. Days of absence without leave and classes not taken can be cut from the pay.',
          'Any change of the pay is agreed in writing with the principal. Tax and other cuts that the law demands are made from the pay.',
        ],
      },
      {
        title: '11. Confidentiality and property',
        items: [
          'What the teacher learns about the institute, its students, fees, plans and methods is confidential during the work and after it ends.',
          'The name, the logo and the material of the institute are not used for any private purpose or on social media without the permission of the principal.',
        ],
      },
      {
        title: '12. Discipline and end of the work',
        items: [
          'A teacher who breaks a rule is first talked to. A serious or repeated break (misbehaviour with a student, dishonesty, leaking a test, taking money, sharing private data) can end the work at once.',
          'A teacher who wants to leave the work gives a notice of at least 30 days (or the notice agreed in the terms), and finishes the portion of the syllabus and the tests of that period.',
          'The institute can end the work with a notice of the same time, or without a notice for a serious break of the rules.',
          'At the end of the work, the teacher returns all material and things of the institute, and the account in AcademiaOS is closed.',
        ],
      },
    ],
    closing:
      'Declaration: I have read and understood all the rules and regulations above. I agree to follow them, and I know that the institute can take action when I do not. ' +
      'I also confirm that the details that I gave in the registration form are true.',
  };
}

/** The rules as lines for an email (a title line and the points under it). */
export function rulesAsLines(rules: Rules): string[] {
  const lines: string[] = [rules.intro];
  for (const section of rules.sections) {
    lines.push(section.title);
    for (const item of section.items) lines.push(`• ${item}`);
  }
  lines.push(rules.closing);
  return lines;
}
