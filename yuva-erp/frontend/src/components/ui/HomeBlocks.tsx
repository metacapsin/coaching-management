import React, { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

// The building blocks of the home pages (the principal, the teacher, the student and the parent): a banner, big cards with a coloured strip on top,
// small tiles and month cards. One look for all the roles.

// the colours of a card: the strip on top, the box of the icon, the link
export const ACCENTS = {
  blue: { bar: 'from-blue-500 to-sky-400', icon: 'bg-blue-50 text-blue-600', link: 'text-blue-600 hover:bg-blue-50' },
  emerald: { bar: 'from-emerald-500 to-teal-400', icon: 'bg-emerald-50 text-emerald-600', link: 'text-emerald-700 hover:bg-emerald-50' },
  // (the blue and indigo of the screens are orange now; the palette's Info blue #3B82F6 keeps one card apart from the orange ones)
  indigo: { bar: 'from-info-500 to-info-400', icon: 'bg-info-50 text-info-500', link: 'text-info-600 hover:bg-info-50' },
  amber: { bar: 'from-amber-500 to-amber-400', icon: 'bg-amber-50 text-amber-600', link: 'text-amber-700 hover:bg-amber-50' },
  rose: { bar: 'from-rose-500 to-rose-400', icon: 'bg-rose-50 text-rose-600', link: 'text-rose-700 hover:bg-rose-50' },
  // purple (written as colours, because violet and purple of the screens are amber): one more card apart from the other five
  violet: { bar: 'from-[#8b5cf6] to-[#a78bfa]', icon: 'bg-[#8b5cf6]/10 text-[#8b5cf6]', link: 'text-[#7c3aed] hover:bg-[#8b5cf6]/10' }
} as const;
export type Accent = keyof typeof ACCENTS;

// the colour of the glow in the corner of a card and of its sparkline
const GLOW: Record<Accent, { glow: string; line: string }> = {
  blue: { glow: 'bg-orange-400', line: '#f97316' },
  emerald: { glow: 'bg-emerald-400', line: '#10b981' },
  indigo: { glow: 'bg-info-400', line: '#3b82f6' },
  amber: { glow: 'bg-amber-400', line: '#f59e0b' },
  rose: { glow: 'bg-rose-400', line: '#ef4444' },
  violet: { glow: 'bg-[#a78bfa]', line: '#8b5cf6' }
};

// A small line chart with a soft area under it (the last numbers of a card). Nothing is shown for fewer than two numbers.
export const Sparkline: React.FC<{ values: number[]; color: string; id: string }> = ({ values, color, id }) => {
  if (values.length < 2) return null;
  const w = 96;
  const h = 34;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
};

// A big number: a coloured strip on top, an icon, the number, a line under it and (when there is one) a link
export const KpiCard: React.FC<{
  label: string;
  icon: LucideIcon;
  accent: Accent;
  value: React.ReactNode;
  note?: React.ReactNode;
  footer?: React.ReactNode;
  link?: { text: string; onClick: () => void };
  spark?: number[]; // the last numbers: a small chart on the right of the number
}> = ({ label, icon: Icon, accent, value, note, footer, link, spark }) => {
  const c = ACCENTS[accent];
  const g = GLOW[accent];
  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className={`h-1 bg-gradient-to-r ${c.bar}`} />
      <span className={`absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-[0.14] blur-2xl pointer-events-none ${g.glow}`} />
      <div className="relative p-5">
        <div className="flex justify-between items-start gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 leading-snug">{label}</span>
          <span className={`p-2.5 rounded-xl ${c.icon} group-hover:scale-110 transition-transform`}>
            <Icon className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 min-w-0">
            {value}
            {note}
          </div>
          {spark && <Sparkline values={spark} color={g.line} id={label.replace(/\W/g, '')} />}
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
  <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 text-white shadow-lg bg-gradient-to-br from-[#f97316] via-[#c2410c] to-[#080f1e]">
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


// A smooth line with a soft area under it, grid lines, labels, and a tooltip that follows the mouse (the fee collection of each month...).
export const AreaChart: React.FC<{
  data: { label: string; value: number }[];
  format: (n: number) => string;
  color?: string;
  height?: number;
  id: string;
}> = ({ data, format, color = '#f97316', height = 230, id }) => {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const W = 640;
  const H = height;
  const left = 46;
  const right = 14;
  const top = 18;
  const bottom = 28;
  const max = Math.max(...data.map(d => d.value), 1);
  // a round top for the grid (1, 2, 5 times a power of ten)
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const niceTop = [1, 2, 2.5, 5, 10].map(m => m * pow).find(v => v >= max) ?? max;
  const x = (i: number) => left + (data.length === 1 ? (W - left - right) / 2 : (i / (data.length - 1)) * (W - left - right));
  const y = (v: number) => top + (1 - v / niceTop) * (H - top - bottom);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  // a smooth curve through the points (Catmull-Rom turned into Bezier curves)
  const curve = pts.length < 2 ? '' : pts.reduce((path, p, i, a) => {
    if (i === 0) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const p0 = a[i - 2] ?? a[i - 1];
    const p1 = a[i - 1];
    const p3 = a[i + 1] ?? p;
    const c1x = p1[0] + (p[0] - p0[0]) / 6;
    const c1y = p1[1] + (p[1] - p0[1]) / 6;
    const c2x = p[0] - (p3[0] - p1[0]) / 6;
    const c2y = p[1] - (p3[1] - p1[1]) / 6;
    return `${path} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }, '');
  const area = pts.length < 2 ? '' : `${curve} L${pts[pts.length - 1][0].toFixed(1)},${H - bottom} L${pts[0][0].toFixed(1)},${H - bottom} Z`;
  const step = Math.ceil(data.length / 9);
  const move = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || data.length === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p[0] - px) < Math.abs(pts[best][0] - px)) best = i;
    });
    setHover(best);
  };
  const hp = hover !== null ? pts[hover] : null;
  return (
    <svg ref={box} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Chart of the fees collected in each month">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={left} x2={W - right} y1={y(niceTop * f)} y2={y(niceTop * f)} stroke="currentColor" className="text-slate-200" strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 4'} />
          <text x={left - 8} y={y(niceTop * f) + 4} textAnchor="end" fontSize="11" className="fill-slate-400">
            {format(niceTop * f)}
          </text>
        </g>
      ))}
      {data.map((d, i) =>
        i % step === 0 || i === data.length - 1 ? (
          <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" className="fill-slate-400">
            {d.label}
          </text>
        ) : null
      )}
      {area && <path d={area} fill={`url(#area-${id})`} />}
      {curve && <path d={curve} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 6 : i === pts.length - 1 ? 5 : 3} fill={color} className="stroke-white dark:stroke-[#1e293b]" strokeWidth="2.5" />
      ))}
      {hp && hover !== null && (
        <g pointerEvents="none">
          <line x1={hp[0]} x2={hp[0]} y1={top} y2={H - bottom} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <g transform={`translate(${Math.min(Math.max(hp[0] - 52, left), W - right - 104)},${Math.max(hp[1] - 46, 2)})`}>
            <rect width="104" height="36" rx="9" fill={color} />
            <text x="52" y="15" textAnchor="middle" fontSize="10.5" fill="#ffffff" opacity="0.9">
              {data[hover].label}
            </text>
            <text x="52" y="29" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#ffffff">
              {format(data[hover].value)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};

// A ring chart: the parts of a whole (joined, not joined, late), with a number in the middle.
export const DonutChart: React.FC<{ segments: { value: number; color: string }[]; center: React.ReactNode; sub?: string; size?: number }> = ({ segments, center, sub, size = 170 }) => {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Ring chart">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-slate-200" strokeWidth="16" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c;
            const gap = segments.filter(x => x.value > 0).length > 1 ? 4 : 0;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(len - gap, 0)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ display: s.value > 0 ? undefined : 'none' }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900 tracking-tight">{center}</span>
        {sub && <span className="text-[11px] text-slate-500 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
};
