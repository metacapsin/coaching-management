import { useEffect, useState } from 'react';

// The part of the address after "#" (for example "#/login"). Page sections of the website ("#features") do not count as a page.
export const useHashRoute = () => {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
};
