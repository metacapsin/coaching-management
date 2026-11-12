import { cleanName } from '../utils/names';
import React, { useState } from 'react';
import { GraduationCap, Database, Sparkles, ArrowRight } from 'lucide-react';

export type StartMode = 'empty' | 'sample';

interface OnboardingScreenProps {
  onDone: (mode: StartMode, details: { name: string; academicYear: string }) => void;
  initialName?: string; // the name the coaching was registered with
}

// The academic year starts in April: from April 2026 it is 2026-2027, before that 2025-2026
export const defaultAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

// Shown once, to the principal, when the institute has no data yet
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onDone, initialName = '' }) => {
  const [name, setName] = useState(initialName);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [error, setError] = useState('');

  const choose = (mode: StartMode) => {
    if (!name.trim()) {
      setError('Please enter the name of your institute.');
      return;
    }
    if (!/^\d{4}\s*[-/]\s*\d{4}$/.test(academicYear.trim())) {
      setError('Write the academic year like 2026-2027.');
      return;
    }
    onDone(mode, { name: name.trim(), academicYear: academicYear.trim().replace(/\s*[-/]\s*/, '-') });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans antialiased">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Welcome to AcademiaOS</h1>
            <p className="text-xs text-slate-500">Let us set up your institute. This takes a minute.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Institute name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(cleanName(e.target.value));
                  setError('');
                }}
                placeholder="e.g. Yuva Coaching Classes"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Academic year</label>
              <input
                type="text"
                value={academicYear}
                onChange={e => {
                  setAcademicYear(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">How do you want to start?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => choose('empty')}
                className="text-left p-4 rounded-xl border-2 border-blue-600 bg-blue-50/50 hover:bg-blue-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-blue-900">
                  <Database className="w-4 h-4" />
                  Start empty
                </span>
                <span className="block text-xs text-slate-600 mt-1.5 leading-relaxed">
                  For real use. You add your own courses, batches and students. A short checklist on the dashboard shows
                  the steps.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                  Recommended <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => choose('sample')}
                className="text-left p-4 rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Start with sample data
                </span>
                <span className="block text-xs text-slate-600 mt-1.5 leading-relaxed">
                  To look around and try every screen with ready-made students, fees, tests and notices. You can clear it
                  later in Settings.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                  For a demo <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
