import { __ } from '@wordpress/i18n';
import type { Destination } from '../destinations/api';
import type { Template } from '@renderer/types';

export function SubmissionSettings({ template, primaryChannel, config, destinations, onChange }: {
  template?: Template; primaryChannel?: string | null; config: Record<string, unknown>; destinations: readonly Destination[];
  onChange(config: Record<string, unknown>): void;
}) {
  const secondary = template?.tree.submissions[1];
  if (!secondary) return null;
  const channel = primaryChannel === 'sms' ? 'email' : 'sms';
  const settings = (config.submission_settings ?? {}) as Record<string, { destination_ids?: string[] }>;
  const bound = settings[secondary.id]?.destination_ids ?? [];
  const available = destinations.filter(d => d.requirements?.audience_channels?.includes(channel));
  return <fieldset className="space-y-2 border rounded-md p-4">
    <legend>{channel === 'sms' ? __('Optional SMS signup', 'wconvert') : __('Optional email signup', 'wconvert')}</legend>
    <p>{__('Visitors can skip this signup. Their primary signup remains saved. This step saves its own details only when submitted.', 'wconvert')}</p>
    {config.capture_mode === 'local' ? <p>{__('Signups are saved only in WConvert.', 'wconvert')}</p> : <>
      <p>{__('Only the services selected here receive this signup. Delivery of the primary signup is not repeated.', 'wconvert')}</p>
      {available.length === 0 && <p>{__('Connect a service supporting this channel before publishing.', 'wconvert')}</p>}
      {available.map(d => <label key={d.id} className="block"><input type="checkbox" checked={bound.includes(d.id)} onChange={event => onChange({
        submission_settings: { ...settings, [secondary.id]: { destination_ids: event.target.checked ? [...bound, d.id] : bound.filter(id => id !== d.id) } },
      })} /> {d.label}</label>)}
    </>}
  </fieldset>;
}
