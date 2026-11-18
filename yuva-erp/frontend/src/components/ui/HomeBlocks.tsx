import React from 'react';
import type { LucideIcon } from 'lucide-react';

// The building blocks of the home pages (the principal, the teacher, the student and the parent): a banner, big cards with a coloured strip on top,
// small tiles and month cards. One look for all the roles.

// the colours of a card: the strip on top, the box of the icon, the link
export const ACCENTS = {
  blue: { bar: 'from-blue-500 to-sky-400', icon: 'bg-blue-50 text-blue-600', link: 'text-blue-600 hover:bg-blue-50' },
  emerald: { bar: 'from-emerald-500 to-teal-400', icon: 'bg-emerald-50 text-emerald-600', link: 'text-emerald-700 hover:bg-emerald-50' },
  indigo: { bar: 'from-indigo-500 to-violet-400', icon: 'bg-indigo-50 text-indigo-600', link: 'text-indigo-600 hover:bg-indigo-50' },
  amber: { bar: 'from-amber-500 to-orange-400', icon: 'bg-amber-50 text-amber-600', link: 'text-amber-700 hover:bg-amber-50' },
  rose: { bar: 'from-rose-500 to-pink-400', icon: 'bg-rose-50 text-rose-600', link: 'text-rose-700 hover:bg-rose-50' }
} as const;
export type Accent = keyof typeof ACCENTS;

// A big number: a coloured strip on top, an icon, the number, a line under it and (when there is one) a link
export const KpiCard: React.FC<{
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: React.ReactNode;
  note?: React.ReactNode;
  footer?: React.ReactNode;
  link?: { text: string; onClick: () => void };
}> = ({ label, icon: Icon, accent, value, note, footer, link }) => {
  const c = ACCENTS[accent];
  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className={`h-1 bg-gradient-to-r ${c.bar}`} />
      <div className="p-5">
        <div className="flex justify-between items-start gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 leading-snug">{label}</span>
          <span className={`p-2.5 rounded-xl ${c.icon} group-hover:scale-110 transition-transform`}>
            <Icon className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
          {value}
          {note}
        </div>
        {(footer || link) && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="min-w-0">{footer}</span>
            {link && (
              <button onClick={link.onClick} className={`shrink-0 px-2 py-1 -mr-2 rounded-lg font-medium transition-colors ${c.link}`}>
                {link.text}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// A small tile of "today": an icon, the name and the number; a press opens the page
export const TodayTile: React.FC<{ label: string; value: React.ReactNode; icon: LucideIcon; accent: Accent; alert?: boolean; onClick: () => void }> = ({ label, value, icon: Icon, accent, alert, onClick }) => {
  const c = ACCENTS[accent];
  return (
    <button
      onClick={onClick}
      className="text-left relative overflow-hidden bg-white rounded-2xl border border-slate-200 px-4 py-3.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3"
    >
      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${alert ? c.icon : 'bg-slate-100 text-slate-500'}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</span>
        <span className="block text-xl font-bold font-mono text-slate-900 leading-tight mt-0.5">{value}</span>
      </span>
    </button>
  );
};

// A card of "this month": an icon, the name, the number and how it went compared with last month
export const MonthCard: React.FC<{ label: string; icon: LucideIcon; accent: Accent; value: React.ReactNode; trend: React.ReactNode }> = ({ label, icon: Icon, accent, value, trend }) => {
  const c = ACCENTS[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
      <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${c.icon}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</span>
        <div className="mt-1 flex items-center justify-between gap-2">
          {value}
          {trend}
        </div>
      </div>
    </div>
  );
};

// The banner at the top of a home page: a blue gradient, a small label and the date, the greeting, the big title, a line under it and, on the right, the
// shortcuts (`children`). `photo`: a round picture at the left (the student).
export const HomeBanner: React.FC<{
  label: string;
  date?: string;
  greeting?: string;
  title: string;
  lines?: React.ReactNode[];
  photo?: string;
  children?: React.ReactNode;
}> = ({ label, date, greeting, title, lines = [], photo, children }) => (
  <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 text-white shadow-lg bg-gradient-to-br from-[#1565c0] via-[#1b4aa8] to-[#0f1b26]">
    <span className="absolute -top-20 -right-12 w-64 h-64 rounded-full bg-sky-300/20 blur-3xl pointer-events-none" />
    <span className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-indigo-400/15 blur-3xl pointer-events-none" />
    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div className="flex items-center gap-5 min-w-0">
        {photo && <img src={photo} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-[rgb(255_255_255/0.35)] shadow-lg shrink-0" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[rgb(255_255_255/0.16)] text-white">{label}</span>
            {date && <span className="text-xs text-sky-100/85">{date}</span>}
          </div>
          {greeting && <p className="mt-4 text-sm text-sky-100/90">{greeting}</p>}
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${greeting ? 'mt-0.5' : 'mt-3'} break-words`}>{title}</h1>
          {lines.map((l, i) => (
            <p key={i} className="text-xs text-sky-100/80 mt-1.5">
              {l}
            </p>
          ))}
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  </div>
);

// A button for the banner (glass look)
export const BannerButton: React.FC<{ icon: LucideIcon; onClick: () => void; children: React.ReactNode }> = ({ icon: Icon, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3.5 py-2.5 text-xs font-semibold text-white bg-[rgb(255_255_255/0.12)] hover:bg-[rgb(255_255_255/0.22)] border border-[rgb(255_255_255/0.22)] rounded-xl backdrop-blur-sm transition-colors flex items-center gap-2"
  >
    <Icon className="w-4 h-4 text-sky-200" />
    {children}
  </button>
);
