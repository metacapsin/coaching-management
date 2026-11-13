// The attendance percentage of the month goes by email to the parent of every student (only the parent). The principal can send it for a
// month by a button, and the server sends the one of the last month by itself at the start of a new month. Each student gets it once for
// a month (the second try, by hand or by the clock, skips the ones that already got it).

import { mail, fromPerson } from './http.ts';
import { text } from './validate.ts';
import type { Store } from './store.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthName = (month: string): string => `${MONTHS[parseInt(month.slice(5, 7), 10) - 1] ?? month} ${month.slice(0, 4)}`;

/** The month before `now`, as YYYY-MM. */
export function previousMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MonthStat { present: number; late: number; absent: number; excused: number; total: number; pct: number }

/** The marks of every student in a month (YYYY-MM): { studentId: stat }. */
export function monthStats(attendance: any[], month: string): Map<string, MonthStat> {
  const out = new Map<string, MonthStat>();
  for (const rec of attendance) {
    if (!rec || typeof rec.date !== 'string' || !rec.date.startsWith(month) || !rec.records) continue;
    for (const [sid, status] of Object.entries<any>(rec.records)) {
      const s = out.get(sid) ?? { present: 0, late: 0, absent: 0, excused: 0, total: 0, pct: 0 };
      if (status === 'present') s.present++;
      else if (status === 'late') s.late++;
      else if (status === 'absent') s.absent++;
      else s.excused++;
      s.total++;
      s.pct = Math.round(((s.present + s.late) / s.total) * 100);
      out.set(sid, s);
    }
  }
  return out;
}

/** Sends the attendance of `month` to the parents of the coaching `store` belongs to. `from` is the principal; `loginLink` is the link
 * of the button (empty: no button). Returns how many parents got it, how many had no email, how many already had it. */
export async function sendMonthlyAttendance(store: Store, coaching: string, month: string, from: any, loginLink: string): Promise<{ sent: number; noEmail: number; already: number }> {
  const stats = monthStats(await store.find('attendance'), month);
  const students = (await store.find('students')).filter((st: any) => st.status !== 'inactive' && stats.has(st.id));
  let sent = 0;
  let noEmail = 0;
  let already = 0;
  for (const st of students) {
    const to = text(st.parentEmail, 150).toLowerCase();
    if (!to.includes('@')) {
      noEmail++;
      continue;
    }
    if (!(await store.claimAbsenceMail(`att-month:${month}:${st.id}`))) {
      already++;
      continue;
    }
    const m = stats.get(st.id)!;
    const [ok] = mail(
      to,
      `Attendance of ${st.name} for ${monthName(month)}: ${m.pct}%`,
      `Attendance in ${monthName(month)}: ${m.pct}%`,
      [`${st.name} was present in ${m.pct}% of the classes marked in ${monthName(month)} at ${coaching}.`, 'This email is only to tell you about the attendance. You do not have to answer it.'],
      {
        details: [
          ['Student', st.name],
          ['Month', monthName(month)],
          ['Days marked', String(m.total)],
          ['Present', String(m.present)],
          ['Late', String(m.late)],
          ['Absent', String(m.absent)],
          ['Excused', String(m.excused)],
          ['Attendance', `${m.pct}%`],
        ],
        ...(loginLink ? { button: ['Sign in as Parent', loginLink] as [string, string] } : {}),
        note: 'Attendance counts the days present and the days late.',
        name: st.parentName,
        from: from ? fromPerson(from, coaching) : undefined,
      },
    );
    if (ok) sent++;
    else await store.unclaimAbsenceMail(`att-month:${month}:${st.id}`); // (nothing went out: it can be tried again)
  }
  return { sent, noEmail, already };
}
