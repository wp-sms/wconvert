import type { PresentationSession } from '@loader/types';

declare global { interface Window { __wcvObserve?: (session: PresentationSession) => PresentationSession; __wcvRevenue?: (session: PresentationSession) => PresentationSession; __wcvRevenueResult?: (id: string) => void; } }

/** All observation wrapping lives in the optional asset; absent/failed observers leave presentation intact. */
export function observePresentation(session: PresentationSession): PresentationSession {
  try {
    const observed = window.__wcvObserve?.(session) ?? session;
    return window.__wcvRevenue?.(observed) ?? observed;
  } catch { return session; }
}

export function observeResultClick(id: string): void {
  try { window.__wcvRevenueResult?.(id); } catch { /* Optional observer. */ }
}
