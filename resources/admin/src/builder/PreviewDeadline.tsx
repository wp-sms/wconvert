import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

// Gallery previews have no campaign. Keep their sample stable across renders.
const SAMPLE = Date.now() + (2 * 24 + 14) * 60 * 60 * 1000;
type Deadline = { mode: 'sample' | 'live' | 'loading' | 'error'; deadline?: number; retry?: () => void };
const PreviewDeadline = createContext<Deadline>({ mode: 'sample', deadline: SAMPLE });

/** Resolve once per campaign edit, shared by canvas, flow cards and Preview & test.
 * PHP owns wall-time conversion, including ambiguous daylight-saving hours.
 */
export function CampaignPreviewDeadline({ endsAt, children }: { endsAt?: string; children: ReactNode }) {
  const wallTime = endsAt?.trim() ?? '';
  const [resolved, setResolved] = useState<{ wallTime: string; value: Deadline }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wallTime) return;
    const controller = new AbortController();
    let active = true;
    apiFetch<{ ends_at: number | null }>({ path: `/wconvert/v1/schedule/resolve?ends_at=${encodeURIComponent(wallTime)}`, signal: controller.signal })
      .then(value => {
        if (active) setResolved({ wallTime, value: typeof value.ends_at === 'number' && Number.isFinite(value.ends_at)
          ? { mode: 'live', deadline: value.ends_at } : { mode: 'error' } });
      })
      .catch(() => { if (active) setResolved({ wallTime, value: { mode: 'error' } }); });
    return () => { active = false; controller.abort(); };
  }, [wallTime, attempt]);
  const value: Deadline = !wallTime ? { mode: 'sample', deadline: SAMPLE }
    : resolved?.wallTime === wallTime ? resolved.value : { mode: 'loading' };
  return <PreviewDeadline.Provider value={{ ...value, retry: () => { setResolved(undefined); setAttempt(current => current + 1); } }}>
    {value.mode === 'error' && <PreviewDeadlineStatus />}
    {children}
  </PreviewDeadline.Provider>;
}

export function usePreviewDeadline(): Deadline { return useContext(PreviewDeadline); }

export function PreviewDeadlineNote() {
  const { mode } = usePreviewDeadline();
  return <p className="wconvert-panel-hint">{mode === 'sample'
    ? __('Sample countdown. Set an end date to preview the actual time remaining.', 'wconvert')
    : mode === 'loading' ? __('Updating countdown…', 'wconvert')
      : mode === 'error' ? __('Countdown unavailable until the deadline can be loaded.', 'wconvert')
        : __('The preview counts down to this campaign’s end date.', 'wconvert')}</p>;
}


/** Also rendered inside Preview & test, where the parent page is inert. */
export function PreviewDeadlineStatus() {
  const { mode, retry } = usePreviewDeadline();
  if (mode === 'loading') return <p role="status">{__('Loading countdown deadline…', 'wconvert')}</p>;
  if (mode !== 'error') return null;
  return <div role="alert" className="wconvert-panel-warn">
    {__('Could not load the countdown deadline. Check the date and your connection.', 'wconvert')}{' '}
    <button type="button" onClick={retry}>{__('Try again', 'wconvert')}</button>
  </div>;
}
