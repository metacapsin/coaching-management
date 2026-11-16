import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { downloadTablePdf } from '../utils/simplePdf';
import { downloadXlsx } from '../utils/xlsx';
import { formatDate, toLocalISODate } from '../utils/helpers';

type Tone = 'green' | 'red' | 'amber';
const TONE_HEX: Record<Tone, string> = { green: '#15803d', red: '#b91c1c', amber: '#b45309' };

// One "Download" button with a small menu: PDF (to read, print or send) or Excel (to sort, filter and edit). Choosing a kind downloads it at once.
export const DownloadMenu: React.FC<{
  disabled?: boolean;
  onPdf: () => void;
  onExcel: () => void;
  label?: string;
  compact?: boolean;
}> = ({ disabled = false, onPdf, onExcel, label = 'Download', compact = false }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  const item = 'w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 hover:bg-slate-100 focus:outline-none focus:bg-slate-100 transition-colors';
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Download this list (PDF or Excel)"
        className={`${compact ? 'px-3 py-1.5' : 'px-3.5 py-2'} text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all duration-150 enabled:hover:bg-indigo-600 enabled:hover:text-white enabled:hover:border-indigo-600 enabled:hover:shadow-md enabled:active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 z-30 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl">
          <button role="menuitem" type="button" onClick={() => choose(onPdf)} className={item}>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <FileText className="w-4 h-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">PDF</span>
              <span className="block text-[11px] text-slate-500">To read, print or send</span>
            </span>
          </button>
          <button role="menuitem" type="button" onClick={() => choose(onExcel)} className={item}>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">Excel</span>
              <span className="block text-[11px] text-slate-500">To sort, filter and edit</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

/** An amount for a file: the rupee sign cannot be written in a PDF, so it is Rs. there. */
export const exportMoney = (symbol: string, n: number): string => `${symbol === '\u20B9' ? 'Rs. ' : symbol}${n.toLocaleString('en-IN')}`;

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  /** boxes on top of the PDF: { label: 'Students', value: 12 } */
  summary?: { label: string; value: string | number }[];
  /** a colour for a cell: 'green', 'red' or 'amber' (bold and coloured), or nothing */
  colorize?: (column: number, value: string | number) => Tone | undefined;
}

// the width of every column from what is written in it (the longest text, with a minimum and a maximum)
const columnSizes = (headers: string[], rows: (string | number)[][]): number[] =>
  headers.map((h, i) => Math.min(40, Math.max(7, h.length, ...rows.slice(0, 200).map(r => String(r[i] ?? '').length))));

/** The "Download" button of a page that shows a list: it makes a PDF (with the logo and the name of AcademiaOS, the name of the coaching, the
 * date) or an Excel file, and asks where to save it. `build` is called when a kind is chosen, so the list is always the one on the screen. */
export const ExportMenu: React.FC<{
  /** the name of the file, without the kind: "student_directory" */
  filename: string;
  title: string;
  subtitle?: string;
  coaching?: string;
  build: () => ExportData;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
  /** false: the name of the file has its own date (the date of the day is not added) */
  addDate?: boolean;
}> = ({ filename, title, subtitle, coaching, build, disabled, label, compact, addDate = true }) => {
  const today = toLocalISODate();
  const note = [subtitle, `${formatDate(today)}`].filter(Boolean).join(' - ');
  const base = addDate ? `${filename}_${today}` : filename;
  return (
    <DownloadMenu
      disabled={disabled}
      label={label}
      compact={compact}
      onPdf={() => {
        const d = build();
        const sizes = columnSizes(d.headers, d.rows);
        void downloadTablePdf(`${base}.pdf`, {
          title,
          subtitle: `${coaching ? `${coaching} - ` : ''}${note}`,
          headers: d.headers,
          rows: d.rows,
          weights: sizes,
          summary: d.summary,
          brand: { name: 'AcademiaOS', tagline: coaching || 'Coaching institute management' },
          footer: `${coaching ? `${coaching} - ` : ''}made by AcademiaOS`,
          colorize: d.colorize ? (col, value) => {
            const tone = d.colorize!(col, value);
            return tone ? TONE_HEX[tone] : undefined;
          } : undefined
        });
      }}
      onExcel={() => {
        const d = build();
        void downloadXlsx(`${base}.xlsx`, title, d.headers, d.rows, columnSizes(d.headers, d.rows).map(n => n + 3), {
          brand: 'AcademiaOS',
          title: coaching ? `${coaching} - ${title}` : title,
          subtitle: note,
          colorize: d.colorize
        });
      }}
    />
  );
};
