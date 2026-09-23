import { useEffect, useState } from 'react';

/** Narrow editors use drawers; resizing never hides or discards a draft. */
export function useCompactEditor(maxWidth = 1000): boolean {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= maxWidth);
  useEffect(() => {
    const follow = () => setCompact(window.innerWidth <= maxWidth);
    follow();
    window.addEventListener('resize', follow);
    return () => window.removeEventListener('resize', follow);
  }, [maxWidth]);
  return compact;
}
