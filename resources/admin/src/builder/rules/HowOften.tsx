import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { DisclosureCard } from './DisclosureCard';
import { halves } from './picks';
import { SiteLimitsNote } from './SiteLimitsNote';
import type { Frequency } from '../api';
import type { ConvertingAct } from '../structure/catalogue';

export interface HowOftenProps {
  readonly frequency: Frequency;
  readonly priority: number;
  readonly overlay: boolean;
  /** Custom… is chosen: draw the two pacing fields. */
  readonly custom: boolean;
  readonly reopenEnabled?: boolean;
  readonly act?: ConvertingAct;
  readonly onFrequency: (frequency: Frequency) => void;
  readonly onPriority: (priority: number) => void;
}

/**
 * Everything under the How often picks: Custom's two fields, the stop card,
 * and — on an overlay — what happens when several are ready at once.
 *
 * The pacing itself is the picks' (`picks.ts`). This only ever writes the
 * stop keys and, under Custom, the two pacing numbers.
 */
export function HowOften({ frequency, priority, overlay, custom, reopenEnabled, act = 'submit', onFrequency, onPriority }: HowOftenProps) {
  // The engine defaults both stops to on. Delete the key instead of storing true.
  const setSwitch = (field: 'stopAfterDismiss' | 'stopAfterConversion', on: boolean) => {
    const next = { ...frequency };
    if (on) delete next[field];
    else next[field] = false;
    onFrequency(next);
  };
  const setCount = (field: 'maxImpressions' | 'cooldownDays' | 'maxPerSession', value: string) => {
    const next = { ...frequency };
    const count = Number(value);
    if (value === '' || !Number.isFinite(count) || count < 1) delete next[field];
    else next[field] = Math.floor(count);
    onFrequency(next);
  };
  const capped = frequency.maxImpressions !== undefined;
  const [before, after] = halves(
    /* translators: %s: a number of times, shown as a field. */
    _n('after it has shown %s time in total', 'after it has shown %s times in total', frequency.maxImpressions ?? 3, 'wconvert'));

  return <div className="wconvert-schedule-settings">
    {custom && <div className="wconvert-schedule-fields">
      <div><Label htmlFor="wconvert-session-max">{__('Times per visit', 'wconvert')}</Label>
        <Input id="wconvert-session-max" type="number" min={1} max={100} value={frequency.maxPerSession ?? ''} onChange={event => setCount('maxPerSession', event.target.value)} aria-describedby="wconvert-pacing-help" />
      </div>
      <div><Label htmlFor="wconvert-frequency-cooldown">{__('Days between showings', 'wconvert')}</Label>
        <Input id="wconvert-frequency-cooldown" type="number" min={1} value={frequency.cooldownDays ?? ''}
          onChange={event => setCount('cooldownDays', event.target.value)} aria-describedby="wconvert-pacing-help" />
      </div>
      <p id="wconvert-pacing-help" className="text-note text-muted-foreground">{__('Empty means no limit.', 'wconvert')}</p>
    </div>}

    <div className="wconvert-display-settings" role="group" aria-labelledby="wconvert-stop-heading">
      <p className="wconvert-display-settings__title" id="wconvert-stop-heading">{__('Stop showing it…', 'wconvert')}</p>
      <label className="wconvert-display-setting">
        <input type="checkbox" checked={frequency.stopAfterConversion !== false} onChange={event => setSwitch('stopAfterConversion', event.target.checked)} />
        <span>{act === 'click' ? __('after they click the main button', 'wconvert') : __('after they submit the form', 'wconvert')}</span>
      </label>
      <label className="wconvert-display-setting">
        <input type="checkbox" checked={frequency.stopAfterDismiss !== false} onChange={event => setSwitch('stopAfterDismiss', event.target.checked)} />
        <span>{__('after they close it', 'wconvert')}</span>
      </label>
      <div className="wconvert-display-setting">
        <input type="checkbox" id="wconvert-frequency-capped" checked={capped}
          onChange={event => { const next = { ...frequency }; if (event.target.checked) next.maxImpressions = 3; else delete next.maxImpressions; onFrequency(next); }} />
        <label htmlFor="wconvert-frequency-capped">{before}<TotalField value={frequency.maxImpressions} disabled={!capped} onChange={count => setCount('maxImpressions', count)} />{after}</label>
      </div>
    </div>
    {frequency.maxPerSession !== undefined && frequency.stopAfterDismiss !== false && <p className="wconvert-display-hint">{__('Closing it stops it for good, not just for this visit.', 'wconvert')}</p>}
    {reopenEnabled && <p className="wconvert-display-hint">{__('Your reopen button skips automatic view limits, waiting periods and closing restrictions. Completion stops it; closing the reminder stops this campaign for the visit.', 'wconvert')}</p>}

    <SiteLimitsNote />
    {overlay && <DisclosureCard title={__('If several popups are ready at once', 'wconvert')}
      /* translators: %d: a priority number. */
      current={priority === 0 ? __('Opens in the usual order', 'wconvert') : sprintf(__('Priority %d', 'wconvert'), priority)}>
      <label className="wconvert-display-inline-field" htmlFor="wconvert-priority">{__('Give this one priority', 'wconvert')}
        <Input id="wconvert-priority" type="number" className="max-w-28" value={priority === 0 ? '' : priority} aria-describedby="wconvert-priority-help"
          onChange={event => { const next = Number(event.target.value); onPriority(event.target.value === '' || !Number.isFinite(next) ? 0 : Math.trunc(next)); }} />
      </label>
      <p id="wconvert-priority-help" className="text-note text-muted-foreground">{__('Higher numbers open first. A popup that is already open keeps its place.', 'wconvert')}</p>
    </DisclosureCard>}
  </div>;
}

/** The total, with its own draft so the field may be empty while typing. */
function TotalField({ value, disabled, onChange }: { value: number | undefined; disabled: boolean; onChange: (count: string) => void }) {
  const [draft, setDraft] = useState(String(value ?? 3));
  useEffect(() => { if (value !== undefined) setDraft(current => Number(current) === value ? current : String(value)); }, [value]);
  return <input type="number" className="wconvert-display-setting__number" min={1} aria-label={__('Times in total', 'wconvert')} value={draft} disabled={disabled}
    onChange={event => { setDraft(event.target.value); if (Number(event.target.value) >= 1) onChange(event.target.value); }} />;
}
