import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const KEY = 'academia_os_theme_v1';

const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
};

const preferred = (): Theme =>
  stored() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const apply = (theme: Theme) => document.documentElement.classList.toggle('dark', theme === 'dark');

// The page is always printed on white paper, whatever theme is on the screen
if (typeof window !== 'undefined') {
  let before: Theme = 'light';
  window.addEventListener('beforeprint', () => {
    before = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    apply('light');
  });
  window.addEventListener('afterprint', () => apply(before));
}

// Sun / moon button: switches between the light and the dark look, remembered in this browser
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useState<Theme>(preferred);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the choice then lasts until the page is closed */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ${className}`}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};
