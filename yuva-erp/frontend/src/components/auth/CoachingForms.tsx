import { Select } from '../ui/Pickers';
import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { ApiError, listCoachings, setPublicOrg } from '../utils/api';
import type { PublicCoaching } from '../utils/api';
import { useLang } from '../../i18n/LangContext';

const fieldCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// Students and teachers sign up to ONE coaching. With only one coaching it is chosen without asking.
export const CoachingPicker: React.FC<{ onChange: (orgId: string) => void }> = ({ onChange }) => {
  const [list, setList] = useState<PublicCoaching[] | null>(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    let alive = true;
    listCoachings()
      .then(items => {
        if (!alive) return;
        setList(items);
        if (items.length === 1) {
          setChosen(items[0].id);
          setPublicOrg(items[0].id);
          onChange(items[0].id);
        }
      })
      .catch(err => alive && setError(err instanceof ApiError ? err.message : 'Could not load the coachings.'));
    return () => {
      alive = false;
      setPublicOrg(null);
      onChange('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    setChosen(id);
    setPublicOrg(id || null);
    onChange(id);
  };

  if (error) return <p className="text-xs text-rose-600 mt-4">{error}</p>;
  if (!list) return <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading coachings...</p>;
  if (list.length === 0)
    return (
      <p className="mt-4 p-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
        No coaching is open for sign-up yet. Please ask your coaching to register first.
      </p>
    );
  if (list.length === 1)
    return (
      <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5" />
        Coaching: <strong className="text-slate-700">{list[0].name}</strong>
      </p>
    );

  return (
    <div className="mt-4">
      <label className="block text-xs font-medium text-slate-700 mb-1">Your coaching</label>
      <Select value={chosen} onChange={e => pick(e.target.value)} className={`${fieldCls} bg-white`}>
        <option value="">Choose your coaching...</option>
        {list.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.city ? ` · ${c.city}` : ''}
          </option>
        ))}
      </Select>
    </div>
  );
};
