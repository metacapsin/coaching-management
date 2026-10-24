import { useEffect, useState } from 'react';

// Splits a long list into pages. Pass a `resetKey` (for example the search text) that sends the list back to page 1.
export const usePaged = <T,>(items: T[], pageSize = 25, resetKey: unknown = '') => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    setPage,
    items: items.slice(start, start + pageSize),
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(items.length, start + pageSize)
  };
};
