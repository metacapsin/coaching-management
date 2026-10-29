import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { HI } from './hi';

// Hindi / English. The English text is the key: `t('Sign in')` gives the Hindi text when Hindi is chosen and the
// English text when there is no Hindi for it (so nothing ever shows empty).
export type Lang = 'en' | 'hi';
const KEY = 'academiaos.lang';

const readLang = (): Lang => {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
};

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string) => string;
}

const LangContext = createContext<LangValue>({ lang: 'en', setLang: () => {}, t: s => s });

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode: the choice lasts until the page closes */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<LangValue>(() => ({ lang, setLang, t: s => (lang === 'hi' ? HI[s] ?? s : s) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLang = () => useContext(LangContext);

export const LangToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
      aria-label={lang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}
      className={`px-2 sm:px-2.5 py-2 text-xs whitespace-nowrap font-semibold rounded-lg border border-current/30 hover:bg-white/10 ${className}`}
    >
      {lang === 'hi' ? 'English' : 'हिंदी'}
    </button>
  );
};
