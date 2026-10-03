import type { PresentationSession, PayloadEntry, OptinControls } from '@loader/types';

declare global { interface Window { __wcvAct?: (id: string, kind: keyof OptinControls) => void; } }

/** The optional adapter receives identities and acts, never runtime/form objects. */
export function observePresentation(session: PresentationSession): PresentationSession {
  const show = session.show;
  session.show = (entry: PayloadEntry, controls: OptinControls) => {
    for (const kind of Object.keys(controls) as (keyof OptinControls)[]) {
      const act = controls[kind];
      controls[kind] = () => {
        try { window.__wcvAct?.(entry.id, kind); } catch { /* Observation cannot interrupt capture. */ }
        act();
      };
    }
    return show(entry, controls);
  };
  return session;
}
