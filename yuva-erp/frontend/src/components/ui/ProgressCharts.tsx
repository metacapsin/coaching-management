import React from 'react';
import { BarChart3, CalendarCheck } from 'lucide-react';

export interface TestPoint {
  title: string;
  date: string;
  percent: number;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  present: number; // present and late days
  total: number; // marked days
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(2, 4)}`;
const tone = (p: number) => (p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500');

// The progress of a child: one bar for every test (marks in percent, oldest first, so the trend can be read) and the
// attendance of every month. Plain boxes, no chart library.
export const ProgressCharts: React.FC<{ tests: TestPoint[]; months: MonthPoint[] }> = ({ tests, months }) => {
  const shownTests = tests.slice(-8);
  const shownMonths = months.slice(-6);
  const first = shownTests[0]?.percent ?? 0;
  const last = shownTests[shownTests.length - 1]?.percent ?? 0;
  const change = last - first;

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="progress-charts">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Marks in every test</h3>
          </div>
          {shownTests.length > 1 && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% since the first test
            </span>
          )}
        </div>
        {shownTests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">The chart appears after the first test result.</div>
        ) : (
          <div className="p-4">
            <div className="flex items-end gap-2 h-36">
              {shownTests.map((t, i) => (
                <div key={`${t.title}-${i}`} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full" title={`${t.title}: ${t.percent}%`}>
                  <span className="text-[10px] font-semibold text-slate-700 mb-1">{t.percent}%</span>
                  <div className={`w-full rounded-t ${tone(t.percent)}`} style={{ height: `${Math.max(4, t.percent)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              {shownTests.map((t, i) => (
                <span key={`${t.title}-l-${i}`} className="flex-1 min-w-0 text-[9px] text-slate-400 text-center truncate">
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
          <CalendarCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">Attendance of every month</h3>
        </div>
        {shownMonths.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No attendance marked yet.</div>
        ) : (
          <div className="p-4 space-y-3">
            {shownMonths.map(m => {
              const percent = m.total > 0 ? Math.round((m.present / m.total) * 100) : 0;
              return (
                <div key={m.month}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{monthName(m.month)}</span>
                    <span className="font-mono text-slate-600">
                      {percent}% <span className="text-slate-400">({m.present} of {m.total} days)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full ${tone(percent)}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
