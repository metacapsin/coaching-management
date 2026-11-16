import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { COUNTRIES, dialCodeOf } from '../utils/countries';

// The dial code in front of a contact number (+91 for India). It is also the choice of the country: pressing it opens the list of the countries,
// and the one that is chosen changes the code (and, in the form, the PIN code and the ID that go with the country).
export const DialCodePicker: React.FC<{ country: string; onChange: (country: string) => void }> = ({ country, onChange }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!trigger.current?.contains(n) && !list.current?.contains(n)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // the list is drawn above everything (it is not cut by the scrolling form), under the box, or above it when there is no room below
  const show = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      setPos({ x: Math.min(r.left, window.innerWidth - 270), y: below > 270 ? r.bottom + 4 : Math.max(8, r.top - 264) });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choose the country (the code in front of the number)"
        className="px-2.5 flex items-center gap-1 text-sm font-mono text-slate-700 bg-slate-50 hover:bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg cursor-pointer transition-colors shrink-0"
      >
        {dialCodeOf(country)}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={list} role="listbox" style={{ position: 'fixed', left: pos.x, top: pos.y, width: 264 }} className="z-[70] max-h-64 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl">
          {COUNTRIES.map(c => {
            const on = c.name === country;
            return (
              <button
                key={c.name}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(c.name);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors ${on ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <span>
                  {c.name} <span className="font-mono text-xs text-slate-400">{c.code}</span>
                </span>
                {on && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
