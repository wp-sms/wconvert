import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { adminSettings } from '../../settings';
import { SiteLimitsNote } from './SiteLimitsNote';
import type { Frequency, Schedule } from '../api';
import type { ConvertingAct } from '../structure/catalogue';

export interface HowOftenProps {
  readonly frequency: Frequency;
  readonly schedule: Schedule;
  readonly priority: number;
  readonly overlay: boolean;
  readonly reopenEnabled?: boolean;
  readonly act?: ConvertingAct;
  readonly onFrequency: (frequency: Frequency) => void;
  readonly onSchedule: (schedule: Schedule) => void;
  readonly onPriority: (priority: number) => void;
}

/** Schedule uses the site's wall clock; frequency is an allowance for one browser. */
export function HowOften({ frequency, schedule, priority, overlay, reopenEnabled, act = 'submit', onFrequency, onSchedule, onPriority }: HowOftenProps) {
  const [repeatChoice, setRepeatChoice] = useState<{ mode: 'custom' | 'days'; key: string } | null>(null);
  const repeat = (repeatChoice?.key === repeatKey(frequency) ? repeatChoice.mode : null) ?? ( frequency.maxPerSession === 1 && !frequency.cooldownDays ? 'session'
    : !frequency.maxPerSession && frequency.cooldownDays ? 'days'
      : !frequency.maxPerSession && !frequency.cooldownDays ? 'every' : 'custom');
  const chooseRepeat = (choice: string) => {
    if (choice === 'custom') { setRepeatChoice({ mode: 'custom', key: repeatKey(frequency) }); return; }
    const next = { ...frequency };
    delete next.maxPerSession;
    delete next.cooldownDays;
    if (choice === 'session') next.maxPerSession = 1;
    if (choice === 'days') next.cooldownDays = frequency.cooldownDays || 7;
    setRepeatChoice(choice === 'days' ? { mode: 'days', key: repeatKey(next) } : null);
    onFrequency(next);
  };
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
    if (repeat === 'custom' || repeat === 'days') setRepeatChoice({ mode: repeat, key: repeatKey(next) });
    onFrequency(next);
  };
  const setBoundary = (field: 'starts_at' | 'ends_at', value: string) => {
    const next = { ...schedule };
    if (value === '') delete next[field];
    else next[field] = value.replace('T', ' ').slice(0, 16);
    onSchedule(next);
  };
  const timezone = adminSettings()?.timezone;
  const invalidWindow = !!schedule.starts_at && !!schedule.ends_at && schedule.ends_at <= schedule.starts_at;

  return <div className="wconvert-schedule-settings">
    <fieldset className="wconvert-rule-fieldset">
      <legend>{__('Repeat visits', 'wconvert')}</legend>
      <div className="wconvert-display-field">
        <Label htmlFor="wconvert-repeat">{__('Show automatically', 'wconvert')}</Label>
        <select id="wconvert-repeat" value={repeat} onChange={event => chooseRepeat(event.target.value)}>
          <option value="session">{__('At most once per tab session (recommended)', 'wconvert')}</option>
          <option value="days">{__('Leave days between appearances', 'wconvert')}</option>
          <option value="every">{__('On every eligible page', 'wconvert')}</option>
          <option value="custom">{__('Custom limits', 'wconvert')}</option>
        </select>
        <p className="text-note text-muted-foreground">{__('Limits apply in each visitor’s browser. Clearing browsing data resets them.', 'wconvert')}</p>
      </div>
      {(repeat === 'days' || repeat === 'custom') && <div className="wconvert-schedule-fields">
        {repeat === 'custom' && <div><Label htmlFor="wconvert-session-max">{__('Automatic appearances per tab session', 'wconvert')}</Label>
          <Input id="wconvert-session-max" type="number" min={1} max={100} value={frequency.maxPerSession ?? ''} onChange={event => setCount('maxPerSession', event.target.value)} aria-describedby="wconvert-session-help" />
          <p id="wconvert-session-help" className="text-note text-muted-foreground">{__('Empty means no session limit. If browser storage is blocked, this limit lasts only on the current page.', 'wconvert')}</p>
        </div>}
        <div><Label htmlFor="wconvert-frequency-cooldown">{__('Days to wait between showings', 'wconvert')}</Label>
          <Input id="wconvert-frequency-cooldown" type="number" min={1} value={frequency.cooldownDays ?? ''}
            onChange={event => setCount('cooldownDays', event.target.value)} aria-describedby="wconvert-frequency-cooldown-help" />
          <p id="wconvert-frequency-cooldown-help" className="text-note text-muted-foreground">{__('Empty means no wait. Stop rules still apply.', 'wconvert')}</p>
        </div>
      </div>}
      <div className="wconvert-display-stop">
        <label className="wconvert-frequency-switch">
          <input type="checkbox" checked={frequency.stopAfterConversion !== false} onChange={event => setSwitch('stopAfterConversion', event.target.checked)} />
          {act === 'click' ? __('Stop after they click the main button', 'wconvert') : __('Stop after they submit the form', 'wconvert')}
        </label>
      </div>
      <details className="wconvert-display-disclosure">
        <summary>{__('More repeat controls', 'wconvert')}</summary>
        <div className="wconvert-display-disclosure-body">
          <label className="wconvert-frequency-switch">
            <input type="checkbox" checked={frequency.stopAfterDismiss !== false} onChange={event => setSwitch('stopAfterDismiss', event.target.checked)} />
            {__('Stop showing it once they close it', 'wconvert')}
          </label>
          <div className="wconvert-display-field">
            <Label htmlFor="wconvert-frequency-max">{__('Show it at most this many times', 'wconvert')}</Label>
            <Input id="wconvert-frequency-max" className="max-w-28" type="number" min={1} value={frequency.maxImpressions ?? ''}
              onChange={event => setCount('maxImpressions', event.target.value)} aria-describedby="wconvert-frequency-max-help" />
            <p id="wconvert-frequency-max-help" className="text-note text-muted-foreground">{__('Total per browser, not per day. Empty means no limit.', 'wconvert')}</p>
          </div>
        </div>
      </details>
      {frequency.maxPerSession && frequency.stopAfterDismiss !== false && <p className="wconvert-display-hint">{__('Stop after closing is stronger: closing it can prevent future sessions too.', 'wconvert')}</p>}
      {reopenEnabled && <p className="wconvert-display-hint">{__('Your reopen button skips automatic view limits, waiting periods and closing restrictions. Completion stops it; closing the reminder stops this campaign for the tab session.', 'wconvert')}</p>}
    </fieldset>

    <fieldset className="wconvert-rule-fieldset wconvert-display-schedule">
      <legend>{__('Schedule', 'wconvert')}</legend>
      {!schedule.starts_at && !schedule.ends_at && <p className="text-note text-muted-foreground">{__('Starts when published. Runs until you unpublish it.', 'wconvert')}</p>}
      <details className="wconvert-display-disclosure" open={!!schedule.starts_at || !!schedule.ends_at || undefined}>
        <summary>{__('Set start and end dates', 'wconvert')}</summary>
        <div className="wconvert-display-disclosure-body">
          <Description>{timezone
            ? sprintf(__('Dates use your site’s timezone: %s.', 'wconvert'), timezone)
            : __('Dates use your WordPress site’s timezone.', 'wconvert')}</Description>
          <div className="wconvert-schedule-fields">
            <div><Label htmlFor="wconvert-starts-at">{__('Start showing it on', 'wconvert')}</Label>
              <Input id="wconvert-starts-at" type="datetime-local" value={(schedule.starts_at ?? '').replace(' ', 'T')}
                onChange={event => setBoundary('starts_at', event.target.value)} aria-describedby="wconvert-starts-help" />
              <p id="wconvert-starts-help" className="text-note text-muted-foreground">{__('Leave empty to start when published and its other rules allow.', 'wconvert')}</p>
            </div>
            <div><Label htmlFor="wconvert-ends-at">{__('Stop showing it on', 'wconvert')}</Label>
              <Input id="wconvert-ends-at" type="datetime-local" value={(schedule.ends_at ?? '').replace(' ', 'T')}
                onChange={event => setBoundary('ends_at', event.target.value)} aria-invalid={invalidWindow || undefined}
                aria-describedby={invalidWindow ? 'wconvert-schedule-error' : 'wconvert-ends-help'} />
              <p id="wconvert-ends-help" className="text-note text-muted-foreground">{__('Leave empty to keep running until you unpublish it.', 'wconvert')}</p>
            </div>
          </div>
          {invalidWindow && <p id="wconvert-schedule-error" role="alert" className="text-note text-destructive">{__('Choose an end date and time after the start.', 'wconvert')}</p>}
        </div>
      </details>
    </fieldset>

    <SiteLimitsNote />
    {overlay && <details className="wconvert-rule-advanced">
      <summary>{__('Advanced: competing popups', 'wconvert')}</summary>
      <div className="wconvert-display-disclosure-body">
        <div className="wconvert-display-field">
          <Label htmlFor="wconvert-priority">{__('Priority against other popups', 'wconvert')}</Label>
          <Input id="wconvert-priority" type="number" className="max-w-28" value={priority === 0 ? '' : priority}
            onChange={event => { const next = Number(event.target.value); onPriority(event.target.value === '' || !Number.isFinite(next) ? 0 : Math.trunc(next)); }} />
        </div>
        <Description>{__('When several popups are ready at the same moment, the highest priority wins. A popup that appears earlier keeps the place; closing it does not show another on that page view.', 'wconvert')}</Description>
      </div>
    </details>}
  </div>;
}

/** Keep an in-progress empty field open, but let undo/presets select their actual values. */
function repeatKey(frequency: Frequency): string {
  return `${frequency.maxPerSession ?? ''}/${frequency.cooldownDays ?? ''}`;
}
