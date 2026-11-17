// The rules and regulations of a coaching for its STUDENTS and their PARENTS (the rules for the teachers are in rules.ts and are different).
// The principal can tick a box in the admission form: then the student and the parent get them by email, and each of them has to read and agree
// to them at the first sign in (like a new teacher does).

import type { Rules } from './rules.ts';

export function studentRulesFor(coaching: string): Rules {
  const c = coaching || 'the coaching';
  return {
    title: `Rules and Regulations for Students and Parents of ${c}`,
    intro:
      `These rules apply to every student of ${c} and to the parents or guardians of the student. They are written so that every student can learn in a calm and safe place, and so that the parents always know what is going on. ` +
      'Please read all of them together. By agreeing, the student and the parent confirm that they have read the rules and will follow them.',
    sections: [
      {
        title: '1. Admission and documents',
        items: [
          'The admission is complete when the form is filled with true details, the first fee is paid (or the plan of the fee is agreed) and the documents asked by the institute are given.',
          'The name, the phone numbers and the email written in the admission form must be true and must be told to the institute again when they change. The institute sends the messages of the student to these numbers and emails.',
          'A student who has passed the 10th class gives the documents asked (for example the Aadhaar card, the transfer certificate, the character certificate and the migration certificate). The institute keeps them safely and only the principal can see them.',
          'A false document or a false detail is a reason to cancel the admission.',
        ],
      },
      {
        title: '2. Fees and payment',
        items: [
          'The fee of the course and the dates of the instalments are written on the receipt and in the login of the student. The fee is paid on or before the due date.',
          'Every payment gets a numbered receipt. Please keep the receipt. Pay only to the institute, at the counter or by the way the institute shows (UPI, bank transfer, cheque or the pay link).',
          'When the fee is late, the institute sends a reminder to the parent by email. A fee that stays unpaid for a long time can stop the classes and the test results of the student, after a notice to the parent.',
          'The fee that was paid is not given back. If a refund is allowed in a special case, the principal decides it and tells it in writing.',
          'A scholarship or a concession is given only as written in the admission form. It can be taken back when the student breaks the rules or when its condition is not kept.',
        ],
      },
      {
        title: '3. Attendance and leave',
        items: [
          'The student attends every class of the batch. The teacher marks the attendance in AcademiaOS and the parent is told by email when the student is absent or late.',
          'A student who must be absent asks for leave in AcademiaOS (Apply for Leave) or the parent informs the institute, with the true reason, before the class when it is known.',
          'A leave because of sickness is told on the first day. A medical certificate can be asked for an absence of more than two days.',
          'A student who is absent without a reason many days, or who is absent in the days of a test, is called by the institute. The parent is informed.',
          'The attendance of the student is looked at when the progress is checked. Very low attendance can stop the student from sitting in the tests.',
        ],
      },
      {
        title: '4. Punctuality and class time',
        items: [
          'The student reaches the class at least five minutes before the start and sits at the place. The class begins and ends at the time of the timetable.',
          'A student who comes late goes in quietly, without disturbing the class. Coming late again and again is noted and the parent is told.',
          'The student does not leave the class in the middle without the permission of the teacher.',
          'A change of the timetable or of the batch is told in the Notice Board of AcademiaOS and by email. Please read the notices.',
        ],
      },
      {
        title: '5. Behaviour and discipline',
        items: [
          'The student behaves with respect towards the teachers, the staff, the other students and the visitors, in the class, in the corridor, outside and in messages.',
          'Abuse, bullying, ragging, threats, fights, jokes about caste, religion, gender, region, looks or marks, and any kind of harassment are strictly not allowed, in person or on the phone and in groups.',
          'Cheating or helping others to cheat in a test, changing a mark, taking another student’s work, or telling a false thing to the institute is a serious break of the rules.',
          'The student dresses neatly and keeps the identity card of the institute when it is given.',
          'Smoking, tobacco, alcohol, drugs, weapons and any dangerous thing are forbidden inside the institute and near it.',
        ],
      },
      {
        title: '6. Study, homework and tests',
        items: [
          'The student does the homework that is given on time and marks it as done in AcademiaOS. The study material is for the own study of the student.',
          'The student sits in every test of the batch. The date of a test is told in advance in the Notice Board and by email.',
          'A student who misses a test because of a real reason (told in advance, or with a certificate) can get another chance when the principal allows it.',
          'The marks, the rank and the report card are kept in the login of the student. The parent sees them and can talk to the principal when something is not clear.',
          'The student asks doubts without fear. A teacher is there to help, and a doubt is never laughed at.',
        ],
      },
      {
        title: '7. Mobile phones and devices',
        items: [
          'A mobile phone is kept switched off or silent inside the class. It is used in the class only when the teacher asks for it.',
          'The student does not take photos, videos or recordings of the classes, the teachers, the other students or the tests, and does not share them, without the permission of the principal.',
          'In an online class the student joins from a quiet place with the camera and the microphone working, and does not share the link with others.',
          'The institute is not responsible for a phone or another valuable thing that is lost. Please do not bring costly things.',
        ],
      },
      {
        title: '8. Safety, health and visitors',
        items: [
          'The student looks after the own safety and the safety of others, keeps the way and the stairs free, and follows the instructions of the staff in an emergency.',
          'A student who is sick, or who has a disease that can spread, stays at home. A serious health problem, an allergy or a medicine that the student needs is told to the institute by the parent.',
          'A visitor meets the principal or the staff in the office and does not go into the classes without permission.',
          'The student leaves the building at the end of the class. The parent tells the institute who will take a small child home.',
        ],
      },
      {
        title: '9. Care of the institute, the library and the material',
        items: [
          'The student keeps the classroom, the desks, the walls, the toilets and the library clean and does not damage them. The cost of a damage done on purpose is paid by the student or the parent.',
          'A book of the library is returned on the due date, in a good condition. A lost or damaged book is replaced or paid.',
          'The study material, the tests and the notes of the institute are only for the students of the institute. They are not sold, copied for others or put on social media.',
        ],
      },
      {
        title: '10. The parent and the institute',
        items: [
          'The parent gives true phone numbers and an email, reads the messages and notices of the institute, and answers when the institute calls.',
          'The parent has a login of its own (read only). It shows the attendance, the fees, the results and the notices of the child. The password is kept private and is not shared.',
          'The parent talks to the principal about a problem with a class or a teacher, and does not ask the teachers for private classes or favours.',
          'The parent comes to the meeting of the parents and to the call of the institute when the progress or the behaviour of the child needs a talk.',
          'The parent does not scold or hit a teacher, a staff member or another student in the institute. A complaint is given to the principal with respect.',
        ],
      },
      {
        title: '11. The AcademiaOS login and privacy',
        items: [
          'At the first sign in the student and the parent choose a password of their own. The password is kept private and is not given to any other person.',
          'Everything that is done with the login of a student is counted as done by that student. A student who finds that somebody else used the login tells the principal at once.',
          'The institute keeps the details of the student and of the parent safely and uses them only for the work of the institute (classes, fees, attendance, tests, notices). They are not sold or given to others, except when the law asks for it.',
          'The institute can send messages and emails about the attendance, the fees, the homework, the tests and the notices.',
        ],
      },
      {
        title: '12. Breaking the rules and leaving the institute',
        items: [
          'A student who breaks a rule is first talked to. The parent is told. For a serious or repeated break (cheating, bullying, damage, harassment, dangerous things) the principal can give a warning, stop the classes for some days or cancel the admission.',
          'A student who wants to leave the institute tells the principal in writing. The fee already paid is dealt with as written in the rule of the fee above.',
          'When the course is over or the student leaves, the library books and the identity card are returned, and the account in AcademiaOS can be closed.',
          'The principal can change a rule when it is needed for the good of the students. A new rule is told in the Notice Board and by email.',
        ],
      },
    ],
    closing:
      'Declaration: We have read and understood all the rules and regulations above. The student and the parent agree to follow them, and know that the institute can take action when they are not followed. We also confirm that the details given in the admission form are true.',
  };
}
