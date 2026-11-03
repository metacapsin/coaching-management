import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagerProps {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
}

// "Showing 26-50 of 120" with previous / next buttons. Shows nothing when everything fits on one page.
export const Pager: React.FC<PagerProps> = ({ page, pages, from, to, total, onPage }) => {
  if (pages <= 1) return null;
  return (
    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500 print:hidden">
      <span>
        Showing <strong className="text-slate-700">{from}-{to}</strong> of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 font-mono">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="p-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
