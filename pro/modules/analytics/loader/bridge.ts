import type { PresentationSession } from '@loader/types';

declare global { interface Window { __wcvObserve?: (session: PresentationSession) => PresentationSession; } }

/** All observation wrapping lives in the optional asset; absent/failed observers leave presentation intact. */
export function observePresentation(session: PresentationSession): PresentationSession {
  try { return window.__wcvObserve?.(session) ?? session; }
  catch { return session; }
}
