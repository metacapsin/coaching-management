import { useCallback, useSyncExternalStore } from 'react';

// What one person has already seen, remembered in this browser (the notices and the messages are the coaching's data, so the
// person cannot delete them: "deleted" only means hidden from the own bell).
//   seen          the lines of the bell that were seen (opening the bell)
//   hidden        the lines deleted from the own bell
//   pageNotices   the notices that were seen on the Notice Board page (the number on the sidebar)
//   pageBroadcast the messages that were seen on the Parent Broadcasts page (the number on the sidebar)
export type BellMemory = { seen: string[]; hidden: string[]; pageNotices: string[]; pageBroadcast: string[] };

const EMPTY: BellMemory = { seen: [], hidden: [], pageNotices: [], pageBroadcast: [] };
const KEEP = 600; // the newest ids only: the lists never grow without end

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: BellMemory }>();
const keyOf = (userId?: string) => `academia_os_bell_v2_${userId ?? 'x'}`;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked: then the memory lives only until the page is closed
  }
};

/** The memory of this person. The same object is returned while nothing changed (React needs that). */
export const getBellMemory = (userId?: string): BellMemory => {
  const key = keyOf(userId);
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value = EMPTY;
  if (raw) {
    try {
      const p = JSON.parse(raw);
      value = { seen: list(p.seen), hidden: list(p.hidden), pageNotices: list(p.pageNotices), pageBroadcast: list(p.pageBroadcast) };
    } catch {
      value = EMPTY;
    }
  }
  cache.set(key, { raw, value });
  return value;
};

export const updateBellMemory = (userId: string | undefined, change: (m: BellMemory) => BellMemory): void => {
  const key = keyOf(userId);
  const next = change(getBellMemory(userId));
  const trimmed: BellMemory = {
    seen: next.seen.slice(-KEEP),
    hidden: next.hidden.slice(-KEEP),
    pageNotices: next.pageNotices.slice(-KEEP),
    pageBroadcast: next.pageBroadcast.slice(-KEEP)
  };
  const raw = JSON.stringify(trimmed);
  let stored: string | null = raw;
  try {
    localStorage.setItem(key, raw);
  } catch {
    stored = null;
  }
  cache.set(key, { raw: stored, value: trimmed });
  listeners.forEach(fn => fn());
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = () => fn(); // another tab of the same browser
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};

/** The memory of a person; it re-renders everybody who uses it when it changes (the bell, the sidebar number, the pages). */
export const useBellMemory = (userId?: string) => {
  const memory = useSyncExternalStore(subscribe, () => getBellMemory(userId));
  const update = useCallback((change: (m: BellMemory) => BellMemory) => updateBellMemory(userId, change), [userId]);
  return { memory, update };
};

export const addIds = (current: string[], ids: string[]): string[] => Array.from(new Set([...current, ...ids]));
