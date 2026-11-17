import React, { useEffect, useState } from 'react';
import { ScrollText, CheckCircle2, Loader2 } from 'lucide-react';
import { request } from '../utils/api';
import { useAuth } from '../../Context/AuthContext';
import { formatDate } from '../utils/helpers';

export interface RulesData {
  coaching: string;
  audience?: 'teacher' | 'student';
  rules: { title: string; intro: string; sections: { title: string; items: string[] }[]; closing: string };
  mustAccept: boolean;
  acceptedAt: string | null;
}

// The text of the rules and regulations for the teachers (the server writes it with the name of the coaching).
// With `publicOrgId` it is the public text of that coaching (the website shows it to anybody who wants to join).
// `audience`: the principal can read the rules for the students and the parents too (the others get the rules that fit them).
export const RulesText: React.FC<{ onLoaded?: (data: RulesData) => void; publicOrgId?: string; audience?: 'teacher' | 'student' }> = ({ onLoaded, publicOrgId, audience }) => {
  const [data, setData] = useState<RulesData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    (publicOrgId
      ? request<RulesData>('GET', `/public/rules/${encodeURIComponent(publicOrgId)}`, undefined, { auth: false })
      : request<RulesData>('GET', audience === 'student' ? '/rules?for=student' : '/rules')
    )
      .then(d => {
        if (!alive) return;
        setData(d);
        onLoaded?.(d);
      })
      .catch(err => alive && setError(err instanceof Error ? err.message : 'The rules could not be loaded.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) {
    return (
      <p className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading the rules...
      </p>
    );
  }
  const r = data.rules;
  return (
    <article className="text-sm text-slate-700 leading-relaxed">
      <h2 className="text-lg font-bold text-slate-900">{r.title}</h2>
      <p className="mt-2">{r.intro}</p>
      {r.sections.map(section => (
        <section key={section.title} className="mt-5">
          <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            {section.items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">{r.closing}</p>
    </article>
  );
};

// The page "Rules & Regulations" (the principal and the teachers read it at any time).
export const RulesView: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<RulesData | null>(null);
  // the principal reads the rules for the teachers and the rules for the students and parents
  const [audience, setAudience] = useState<'teacher' | 'student'>('teacher');
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
            <ScrollText className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rules &amp; Regulations</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {user?.role === 'admin'
            ? audience === 'student'
              ? 'The rules for the students and parents of your coaching. Tick the box in the New Admission form and the student and the parent get them by email and agree to them at the first sign in.'
              : 'The rules for the teachers of your coaching. Every new teacher gets them by email when you add the teacher, and agrees to them at the first sign in.'
            : 'The rules and regulations of your coaching. You agreed to them at your first sign in.'}
        </p>
        {user?.role === 'admin' && (
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {(['teacher', 'student'] as const).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${audience === a ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'}`}
              >
                {a === 'teacher' ? 'For teachers' : 'For students & parents'}
              </button>
            ))}
          </div>
        )}
        {user?.role !== 'admin' && data?.acceptedAt && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            You agreed on {formatDate(data.acceptedAt)}
          </p>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-4xl">
        <RulesText onLoaded={setData} audience={audience} />
      </div>
    </div>
  );
};
