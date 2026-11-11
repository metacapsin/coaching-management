import React, { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { request } from '../utils/api';
import { useAuth } from '../../Context/AuthContext';

// For the PRINCIPAL only: until the own Gmail of the coaching is connected, every email of the coaching goes out from the account of the
// platform (so the receivers see that address). This bar tells him, and opens the place where he connects his own Gmail.

const key = (id?: string) => `academia_os_mailbanner_${id ?? 'x'}`;
const read = (id?: string): boolean => {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
};

export const MailBanner: React.FC<{ onConnect: () => void }> = ({ onConnect }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(() => read(user?.id));

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let alive = true;
    request<{ connected: boolean }>('GET', '/mail-settings')
      .then(r => alive && setConnected(r.connected))
      .catch(() => alive && setConnected(null));
    return () => {
      alive = false;
    };
  }, [user?.role]);

  if (user?.role !== 'admin' || connected !== false || hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(key(user?.id), '1');
    } catch {
      /* it only comes back next time */
    }
  };

  return (
    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-3 shadow-xs">
      <Mail className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 leading-relaxed">
        <b>Your emails go out from the AcademiaOS account.</b> Connect your own Gmail, and every email of your coaching (new accounts, leave, notices, password
        codes) shows <b>your</b> email address as the sender.
        <div className="mt-2">
          <button onClick={onConnect} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
            Connect my Gmail
          </button>
        </div>
      </div>
      <button onClick={hide} aria-label="Hide" title="Hide" className="p-1 text-indigo-500 hover:text-indigo-800">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
