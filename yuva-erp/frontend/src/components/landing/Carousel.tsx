import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTicker } from './LandingMotion';
import { useLang } from '../../i18n/LangContext';

// One slide at a time with arrows, dots and a bar that shows the time left. It moves on by itself (it waits while the
// mouse is over it or after somebody used the arrows) and a swipe on a phone changes the slide too.
export const Carousel: React.FC<{ slides: React.ReactNode[]; label: string; ms?: number }> = ({ slides, label, ms = 6000 }) => {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);
  const [auto, setAuto] = useState(true);
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = slides.length;
  const go = (to: number) => {
    setIndex(((to % count) + count) % count);
    setAuto(false);
  };
  useTicker(() => setIndex(i => (i + 1) % count), ms, hold || !auto || count < 2);
  if (count === 0) return null;

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onTouchStart={e => setTouchX(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        setTouchX(null);
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
      className="relative"
    >
      <div key={index} className="lp-slide" aria-live="polite">
        {slides[index]}
      </div>
      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(index - 1)} aria-label={t('Previous')} className="w-11 h-11 rounded-full border border-white/20 text-slate-200 hover:bg-white/10 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => go(i)} aria-label={`${i + 1} / ${count}`} aria-current={i === index} className="py-4 px-0.5">
                <span className={`block h-2 rounded-full overflow-hidden bg-white/20 transition-all duration-300 ${i === index ? 'w-10' : 'w-2.5 hover:bg-white/40'}`}>
                  {i === index && (auto ? <span key={index} className="lp-bar block h-full bg-sky-400" style={{ animationDuration: `${ms}ms`, animationPlayState: hold ? 'paused' : 'running' }} /> : <span className="block h-full bg-sky-400" />)}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} aria-label={t('Next')} className="w-11 h-11 rounded-full border border-white/20 text-slate-200 hover:bg-white/10 flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
