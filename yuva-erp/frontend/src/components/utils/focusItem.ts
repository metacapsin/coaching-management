import { useEffect, useRef, useState } from 'react';

// A click on a line of the bell opens its page (the Notice Board, or Parent Broadcasts) and lights up that message there.
// The request is kept in the session too, because the page is not open yet when the bell is clicked.
export type FocusTab = 'notices' | 'notifications';
type FocusRequest = { tab: FocusTab; id: string };

const KEY = 'academia_os_focus_item';
export const FOCUS_EVENT = 'academia-os-focus-item';

export const requestFocus = (request: FocusRequest): void => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(request));
  } catch {
    /* storage can be blocked */
  }
  window.dispatchEvent(new CustomEvent<FocusRequest>(FOCUS_EVENT, { detail: request }));
};

/** The message that was asked for on this page (and forgets it). */
const takeFocus = (tab: FocusTab): string | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const request = JSON.parse(raw) as FocusRequest;
    if (request.tab !== tab) return null;
    sessionStorage.removeItem(KEY);
    return request.id;
  } catch {
    return null;
  }
};

/**
 * For a page: the id of the message to light up (it is scrolled into view, and the light goes out after a moment).
 * `onFocus` is called first, so the page can open the right tab or clear its search.
 * The element of a message has the id `focus-<id>`.
 */
export const useFocusFlash = (tab: FocusTab, onFocus?: (id: string) => void): string | null => {
  const [flashId, setFlashId] = useState<string | null>(null);
  const handler = useRef(onFocus);
  handler.current = onFocus;

  useEffect(() => {
    const show = (id: string | null) => {
      if (!id) return;
      handler.current?.(id);
      setFlashId(id);
    };
    show(takeFocus(tab)); // the page was not open yet
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<FocusRequest>).detail;
      if (detail.tab !== tab) return;
      takeFocus(tab);
      show(detail.id);
    };
    window.addEventListener(FOCUS_EVENT, onEvent);
    return () => window.removeEventListener(FOCUS_EVENT, onEvent);
  }, [tab]);

  useEffect(() => {
    if (!flashId) return;
    const scroll = setTimeout(() => document.getElementById(`focus-${flashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    const off = setTimeout(() => setFlashId(null), 4000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(off);
    };
  }, [flashId]);

  return flashId;
};

export const FLASH_CLASS = 'ring-2 ring-blue-500 shadow-lg bg-blue-50/40';
