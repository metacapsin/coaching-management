import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// The dropdown and the calendar of the whole app, with the look of the app instead of the plain ones of the browser.
//   Select       a drop-in for <select> (the same <option> children and the same onChange(e) with e.target.value)
//   DateInput    a drop-in for <input type="date"> (value 'YYYY-MM-DD', onChange(e) with e.target.value)
//   Dropdown / DatePicker   the same with plain values (onChange(value))
// The list / calendar opens in a layer of its own (it is never cut off by a table or a window), and opens upwards when there is
// no room below. It closes with a click outside and with Escape.

export type PickerEvent = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };
const eventOf = (value: string, name?: string): PickerEvent => ({ target: { value, name }, currentTarget: { value, name } });

// ---------- the layer ----------

type Pos = { left: number; width: number; top?: number; bottom?: number; up: boolean };

const usePosition = (open: boolean, anchor: React.RefObject<HTMLElement | null>, height: number, minWidth: number): Pos | null => {
  const [pos, setPos] = useState<Pos | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const up = below < height + 12 && r.top > below;
      const width = Math.max(r.width, minWidth);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos(up ? { left, width, bottom: window.innerHeight - r.top + 6, up } : { left, width, top: r.bottom + 6, up });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchor, height, minWidth]);
  return open ? pos : null;
};

const useClose = (open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) => {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (refs.every(r => !r.current || !r.current.contains(e.target as Node))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
};

const Layer = React.forwardRef<HTMLDivElement, { pos: Pos; className?: string; role?: string; label?: string; children: React.ReactNode }>(({ pos, className, role, label, children }, ref) =>
  createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={label}
      style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 80 }}
      className={`bg-white border border-slate-200 rounded-xl shadow-xl ${className ?? ''}`}
    >
      {children}
    </div>,
    document.body
  )
);
Layer.displayName = 'Layer';

// The classes that a native <select> / <input> got for its SIZE in the layout (w-full, sm:w-56, flex-1...) belong to the outside box;
// all the others (padding, border, text size...) to the button that shows the value.
const OUTER = /^(?:[a-z]+:)*(?:w-|min-w-|max-w-|flex-|flex$|grow|shrink|col-span-|self-|basis-|order-|mt-|mb-|ml-|mr-|m-)/;
const splitClass = (className?: string): [string, string] => {
  const outer: string[] = [];
  const inner: string[] = [];
  for (const c of (className ?? '').split(/\s+/).filter(Boolean)) (OUTER.test(c) ? outer : inner).push(c);
  return [outer.join(' '), inner.join(' ')];
};

const DEFAULT_BUTTON = 'px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white';
const buttonBase = 'w-full text-left flex items-center justify-between gap-2 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

// ---------- Select ----------

type Opt = { value: string; label: React.ReactNode; disabled?: boolean };

const textOf = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
};

const collect = (children: React.ReactNode): Opt[] => {
  const out: Opt[] = [];
  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, child => {
      if (!React.isValidElement(child)) return;
      const p = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean; hidden?: boolean };
      if (child.type === React.Fragment || child.type === 'optgroup') return walk(p.children);
      if (child.type === 'option' && !p.hidden) out.push({ value: p.value !== undefined ? String(p.value) : textOf(p.children), label: p.children, disabled: p.disabled });
    });
  };
  walk(children);
  return out;
};

export type SelectProps = {
  value?: string | number;
  onChange?: (e: PickerEvent) => void;
  className?: string;
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  title?: string;
  'aria-label'?: string;
  autoFocus?: boolean;
};

export const Select: React.FC<SelectProps> = ({ value, onChange, className, children, placeholder, disabled, id, name, title, 'aria-label': ariaLabel }) => {
  const options = collect(children);
  const current = value === undefined || value === null ? '' : String(value);
  const selected = options.find(o => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const pos = usePosition(open, box, Math.min(options.length * 38 + 12, 264), 160);
  const [outer, inner] = splitClass(className);
  const autoId = useId();
  useClose(open, () => setOpen(false), [box, layer]);

  const show = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex(o => o.value === current)));
    setOpen(true);
  };
  const pick = (o: Opt) => {
    if (o.disabled) return;
    onChange?.(eventOf(o.value, name));
    setOpen(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show();
      setActive(i => (e.key === 'ArrowDown' ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1)));
    } else if ((e.key === 'Enter' || e.key === ' ') && open && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    }
  };

  const shown = selected ? selected.label : null;
  const empty = !selected || selected.value === '';

  return (
    <div ref={box} className={`relative ${outer || 'inline-block min-w-[9rem]'}`}>
      <button
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? autoId : undefined}
        aria-label={ariaLabel}
        className={`${buttonBase} ${inner || DEFAULT_BUTTON}`}
      >
        <span className={`truncate ${empty ? 'text-slate-400' : ''}`}>{selected ? shown : placeholder ?? ''}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {pos && (
        <Layer ref={layer} pos={pos} className="py-1.5 overflow-y-auto" role="presentation">
          <ul id={autoId} role="listbox" className="max-h-64 overflow-y-auto">
            {options.map((o, i) => (
              <li
                key={`${o.value}-${i}`}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                  e.stopPropagation();
                  pick(o);
                }}
                className={`mx-1.5 px-3 py-2 text-sm rounded-lg flex items-center justify-between gap-2 ${
                  o.disabled ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer'
                } ${i === active && !o.disabled ? 'bg-indigo-50 text-indigo-700' : o.disabled ? '' : 'text-slate-700'} ${o.value === current ? 'font-semibold' : ''}`}
              >
                <span className="min-w-0">{o.label}</span>
                {o.value === current && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
              </li>
            ))}
          </ul>
        </Layer>
      )}
    </div>
  );
};

/** A list of plain choices (onChange gets the value). */
export const Dropdown: React.FC<{ value: string; onChange: (value: string) => void; options: string[]; placeholder?: string; label?: string; className?: string }> = ({
  value,
  onChange,
  options,
  placeholder = 'Choose...',
  label,
  className
}) => (
  <Select value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className={className}>
    {options.map(o => (
      <option key={o} value={o}>
        {o}
      </option>
    ))}
  </Select>
);

// ---------- calendar ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0 to 11
const todayIso = () => {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
};
const parts = (v: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null;
};
const nice = (v: string) => {
  const p = parts(v);
  return p ? `${p[2]} ${MONTHS[p[1]].slice(0, 3)} ${p[0]}` : '';
};

export const DatePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  title?: string;
}> = ({ value, onChange, min, max, placeholder = 'Choose a date', clearable = false, disabled, label, className, id, title }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const [view, setView] = useState<[number, number]>([new Date().getFullYear(), new Date().getMonth()]); // year, month
  const [yearPage, setYearPage] = useState(0); // the first year of the page of 12 years
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const pos = usePosition(open, box, 360, 288);
  const [outer, inner] = splitClass(className);
  const today = todayIso();
  useClose(open, () => setOpen(false), [box, layer]);

  const show = () => {
    if (disabled) return;
    const target = value || (min && min > today ? min : max && max < today ? max : today);
    const p = parts(target) ?? parts(today)!;
    setView([p[0], p[1]]);
    setMode('days');
    setOpen(true);
  };
  const move = (by: number) =>
    setView(([y, m]) => {
      const t = y * 12 + m + by;
      return [Math.floor(t / 12), ((t % 12) + 12) % 12];
    });
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const outOfRange = (v: string) => (!!min && v < min) || (!!max && v > max);

  const [year, month] = view;
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  const title12 = `${yearPage} - ${yearPage + 11}`;

  return (
    <div ref={box} className={`relative ${outer || 'inline-block min-w-[9rem]'}`}>
      <button
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className={`${buttonBase} ${inner || DEFAULT_BUTTON}`}
      >
        <span className={`truncate ${value ? '' : 'text-slate-400'}`}>{value ? nice(value) : placeholder}</span>
        <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
      </button>
      {pos && (
        <Layer ref={layer} pos={{ ...pos, width: 288 }} className="p-3" role="dialog" label="Choose a date">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => (mode === 'years' ? setYearPage(p => p - 12) : mode === 'months' ? setView(([y, m]) => [y - 1, m]) : move(-1))}
              aria-label="Previous"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'days') {
                  setYearPage(year - (year % 12));
                  setMode('years');
                } else setMode('days');
              }}
              title="Choose the month and the year"
              className="px-2 py-1 rounded-lg text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              {mode === 'years' ? title12 : mode === 'months' ? year : `${MONTHS[month]} ${year}`}
            </button>
            <button
              type="button"
              onClick={() => (mode === 'years' ? setYearPage(p => p + 12) : mode === 'months' ? setView(([y, m]) => [y + 1, m]) : move(1))}
              aria-label="Next"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {mode === 'years' && (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearPage + i).map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setView(([, m]) => [y, m]);
                    setMode('months');
                  }}
                  className={`py-2 text-xs rounded-lg ${y === year ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {mode === 'months' && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((name, m) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setView(([y]) => [y, m]);
                    setMode('days');
                  }}
                  className={`py-2 text-xs rounded-lg ${m === month ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {mode === 'days' && (
            <>
              <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {WEEK.map(w => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                  if (d === null) return <div key={`b${i}`} />;
                  const v = iso(year, month, d);
                  const disabledDay = outOfRange(v);
                  const selected = v === value;
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={disabledDay}
                      onClick={() => pick(v)}
                      aria-label={nice(v)}
                      aria-pressed={selected}
                      className={`mx-auto w-8 h-8 text-xs rounded-full flex items-center justify-center transition-colors ${
                        selected
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : disabledDay
                          ? 'text-slate-300 cursor-not-allowed'
                          : v === today
                          ? 'text-indigo-700 font-semibold ring-1 ring-indigo-400 hover:bg-indigo-50'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs font-semibold">
            <button type="button" disabled={outOfRange(today)} onClick={() => pick(today)} className="px-2 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:text-slate-300 disabled:hover:bg-transparent">
              Today
            </button>
            {clearable && value && (
              <button type="button" onClick={() => pick('')} className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100">
                Clear
              </button>
            )}
          </div>
        </Layer>
      )}
    </div>
  );
};

// ---------- DateInput: the drop-in for <input type="date"> ----------

export type DateInputProps = {
  value?: string;
  onChange?: (e: PickerEvent) => void;
  min?: string;
  max?: string;
  required?: boolean;
  clearable?: boolean; // for a date that is optional: a Clear button
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  title?: string;
  placeholder?: string;
  'aria-label'?: string;
};

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, min, max, required, clearable, disabled, className, id, name, title, placeholder, 'aria-label': ariaLabel }) => (
  <DatePicker
    value={value ?? ''}
    onChange={v => onChange?.(eventOf(v, name))}
    min={min}
    max={max}
    clearable={!!clearable && !required}
    disabled={disabled}
    className={className}
    id={id}
    title={title}
    placeholder={placeholder}
    label={ariaLabel}
  />
);
