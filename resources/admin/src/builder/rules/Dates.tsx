import { __, sprintf } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { adminSettings } from '../../settings';
import { endsBeforeStart } from './sentence';
import type { Schedule } from '../api';

/**
 * *Between two dates* — when the Campaign runs at all, in the site's wall
 * clock. Stored with no offset (`src/Optin/Schedule.php`), so the merchant
 * reads back what they typed.
 */
export function Dates({ schedule, onSchedule }: { readonly schedule: Schedule; readonly onSchedule: (schedule: Schedule) => void }) {
  const setBoundary = (field: 'starts_at' | 'ends_at', value: string) => {
    const next = { ...schedule };
    if (value === '') delete next[field];
    else next[field] = value.replace('T', ' ').slice(0, 16);
    onSchedule(next);
  };
  const timezone = adminSettings()?.timezone;
  const invalidWindow = endsBeforeStart(schedule);

  return <div className="wconvert-display-dates">
    <Description>{timezone
      /* translators: %s: a timezone name, e.g. “Europe/London”. */
      ? sprintf(__('Dates use your site’s timezone: %s.', 'wconvert'), timezone)
      : __('Dates use your WordPress site’s timezone.', 'wconvert')}</Description>
    <div className="wconvert-display-fields">
      <div><Label htmlFor="wconvert-starts-at">{__('Start showing it on', 'wconvert')}</Label>
        <Input id="wconvert-starts-at" className="w-auto" type="datetime-local" value={(schedule.starts_at ?? '').replace(' ', 'T')}
          onChange={event => setBoundary('starts_at', event.target.value)} />
      </div>
      <div><Label htmlFor="wconvert-ends-at">{__('Stop showing it on', 'wconvert')}</Label>
        <Input id="wconvert-ends-at" className="w-auto" type="datetime-local" value={(schedule.ends_at ?? '').replace(' ', 'T')}
          onChange={event => setBoundary('ends_at', event.target.value)} aria-invalid={invalidWindow || undefined}
          aria-describedby={invalidWindow ? 'wconvert-schedule-error' : undefined} />
      </div>
    </div>
    {invalidWindow && <p id="wconvert-schedule-error" role="alert" className="text-note text-destructive">{__('Choose an end date and time after the start.', 'wconvert')}</p>}
  </div>;
}
