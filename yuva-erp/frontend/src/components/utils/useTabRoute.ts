import { useCallback, useEffect, useState } from 'react';
import type { TabId } from '../../Context/Access';

// Every page of a coaching has its own address (for example /fees). So a reload stays on the page, the Back button of the
// browser goes to the page before, and a page can be opened in a new tab or sent to somebody.
export const TAB_PATHS: Record<TabId, string> = {
  dashboard: '/dashboard',
  students: '/admissions',
  enquiries: '/enquiries',
  attendance: '/attendance',
  fees: '/fees',
  exams: '/exams',
  batches: '/batches',
  notifications: '/broadcasts',
  notices: '/notices',
  material: '/study-material',
  library: '/library',
  reports: '/reports',
  expenses: '/expenses',
  team: '/team',
  settings: '/settings'
};

export const tabPath = (tab: TabId) => TAB_PATHS[tab];

// The page of an address (null when the address is no page)
export const tabFromPath = (pathname: string): TabId | null => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const found = (Object.keys(TAB_PATHS) as TabId[]).find(tab => TAB_PATHS[tab] === clean);
  return found ?? null;
};

// The open page, kept in step with the address. `allowed` says which pages this person may open.
export const useTabRoute = (allowed: (tab: TabId) => boolean): [TabId, (tab: TabId) => void] => {
  const read = (): TabId => {
    const tab = tabFromPath(window.location.pathname);
    return tab && allowed(tab) ? tab : 'dashboard';
  };
  const [tab, setTab] = useState<TabId>(read);

  // an address that is no page (or not allowed) becomes the address of the page that is shown
  useEffect(() => {
    if (window.location.pathname !== TAB_PATHS[tab]) window.history.replaceState(null, '', TAB_PATHS[tab] + window.location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the Back and Forward buttons of the browser
  useEffect(() => {
    const onPop = () => {
      const next = read();
      setTab(next);
      // an address that is no page becomes the address of the page that is shown
      if (window.location.pathname !== TAB_PATHS[next]) window.history.replaceState(null, '', TAB_PATHS[next] + window.location.search);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((next: TabId) => {
    setTab(next);
    if (window.location.pathname !== TAB_PATHS[next]) window.history.pushState(null, '', TAB_PATHS[next]);
    window.scrollTo(0, 0);
  }, []);

  return [tab, go];
};
