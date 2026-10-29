import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, CalendarCheck } from 'lucide-react';
import { useLang } from '../../i18n/LangContext';

// The movement of the website: things rise into place when they come into view, numbers count up, the top of the page
// changes its message by itself, and two small buttons float at the corners.
// Many phones switch "reduce animations" on by themselves (battery saving), and then nothing would move at all. So the
// movement that shows the content (rising into place, the changing message, counting up) always runs; only the endless
// decoration (the floating shapes, the pulse of the button) stops for people who asked for less motion.

export const prefersReducedMotion = () => false;

// Becomes true once the element is on the screen (and stays true)
export const useInView = <T extends HTMLElement>(threshold = 0) => {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || prefersReducedMotion());
  useEffect(() => {
    if (seen || !ref.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      // as soon as the top of the block is a little inside the screen (a tall block never has to be mostly visible)
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
};

// A block that rises into place when it comes into view. With `stagger` its children come one after the other.
export const Reveal: React.FC<{ className?: string; stagger?: boolean; children: React.ReactNode }> = ({ className = '', stagger = false, children }) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`${stagger ? 'lp-stagger' : 'lp-reveal'} ${seen ? 'lp-in' : ''} ${className}`}>
      {children}
    </div>
  );
};

// A number that counts up when it comes into view
export const CountUp: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = '' }) => {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [value, setValue] = useState(prefersReducedMotion() || typeof IntersectionObserver === 'undefined' ? to : 0);
  useEffect(() => {
    if (!seen || prefersReducedMotion()) {
      if (seen) setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, to]);
  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
};

// Runs `onTick` every `ms` milliseconds, unless `paused` (or less motion was asked for)
export const useTicker = (onTick: () => void, ms: number, paused: boolean) => {
  const latest = useRef(onTick);
  latest.current = onTick;
  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = setInterval(() => latest.current(), ms);
    return () => clearInterval(id);
  }, [ms, paused]);
};

// The round "up" button (after some scrolling) and the "Book a demo" pill, both floating at the corners
export const FloatingButtons: React.FC = () => {
  const { t } = useLang();
  const [far, setFar] = useState(false);
  useEffect(() => {
    const onScroll = () => setFar(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <>
      {far && (
        <a
          href="#top"
          aria-label={t('Back to the top')}
          className="lp-pop fixed bottom-5 left-4 z-30 w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-lg shadow-black/40 transition-colors"
        >
          <ArrowUp className="w-5 h-5" />
        </a>
      )}
      <a
        href="#demo"
        className="lp-pulse fixed bottom-5 right-4 z-30 px-4 py-3 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-900 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-black/40 transition-colors"
      >
        <CalendarCheck className="w-4 h-4" />
        {t('Book a demo')}
      </a>
    </>
  );
};
