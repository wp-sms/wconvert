import type { PresentationSession } from '@loader/types';

declare global { interface Window { __wcvObserve?: (session: PresentationSession) => PresentationSession; __wcvRevenue?: (session: PresentationSession) => PresentationSession; __wcvRevenueResult?: (id: string) => void; } }

/** All observation wrapping lives in the optional asset; absent/failed observers leave presentation intact. */
export function observePresentation(session: PresentationSession): PresentationSession {
  for (const observer of [window.__wcvObserve, window.__wcvRevenue]) {
    try { if (observer) session = observer(session); } catch { /* Optional observer. */ }
  }
  return session;
}
