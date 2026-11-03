import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClass?: string; // background colour of the icon, for example "bg-blue-600"
  onClose: () => void;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

// The frame of a pop-up: dark background, header with a close button, Esc closes it
export const ModalShell: React.FC<ModalShellProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconClass = 'bg-blue-600',
  onClose,
  width = 'md',
  children
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`relative w-full ${WIDTH[width]} bg-white border border-slate-200 rounded-xl shadow-2xl my-8 overflow-hidden text-slate-900 print:shadow-none print:border-none print:my-0 print:max-w-none`}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className={`p-1.5 rounded-lg text-white shrink-0 ${iconClass}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
