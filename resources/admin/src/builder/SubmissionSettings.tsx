import { useRef, useState } from 'react';
import { DestinationSetupDialog } from './DestinationSetupDialog';
import { Button } from '../components/ui/button';
import { __ } from '@wordpress/i18n';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import type { Template } from '@renderer/types';

export function SubmissionSettings({ template, primaryChannel, config, destinations, onChange, types = [], connections = [], onSaved }: {
  types?: readonly DestinationType[]; connections?: readonly Connection[]; onSaved?(destinations: readonly Destination[]): void;
  template?: Template; primaryChannel?: string | null; config: Record<string, unknown>; destinations: readonly Destination[];
  onChange(config: Record<string, unknown>): void;
}) {
  const [setup, setSetup] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const secondary = template?.tree.submissions[1];
  if (!secondary) return null;
  const channel = primaryChannel === 'phone' || primaryChannel === 'sms' ? 'email' : 'phone';
  const settings = (config.submission_settings ?? {}) as Record<string, { destination_ids?: string[] }>;
  const bound = settings[secondary.id]?.destination_ids ?? [];
  const available = destinations.filter(d => d.requirements?.audience_channels?.includes(channel));
  return <fieldset className="space-y-2 border rounded-md p-4">
    <legend>{channel === 'phone' ? __('Optional SMS signup', 'wconvert') : __('Optional email signup', 'wconvert')}</legend>
    <p>{__('Visitors can skip this signup. Their primary signup remains saved. This step saves its own details only when submitted.', 'wconvert')}</p>
    {config.capture_mode === 'local' ? <p>{__('Signups are saved only in WConvert.', 'wconvert')}</p> : <>
      <p>{__('Only the services selected here receive this signup. Delivery of the primary signup is not repeated.', 'wconvert')}</p>
      {available.length === 0 && <div><p>{channel === 'phone' ? __('No SMS destination is set up. Add an SMS service, collect only in WConvert, or remove the optional SMS signup in Edit campaign.', 'wconvert') : __('No email destination is set up. Add an email service, collect only in WConvert, or remove the optional email signup in Edit campaign.', 'wconvert')}</p>{onSaved && <Button ref={trigger} type="button" variant="outline" onClick={() => setSetup(true)}>{channel === 'phone' ? __('Set up SMS destination', 'wconvert') : __('Set up email destination', 'wconvert')}</Button>}</div>}
      {available.map(d => <label key={d.id} className="block"><input type="checkbox" checked={bound.includes(d.id)} onChange={event => onChange({
        submission_settings: { ...settings, [secondary.id]: { destination_ids: event.target.checked ? [...bound, d.id] : bound.filter(id => id !== d.id) } },
      })} /> {d.label}</label>)}
    </>}
    {setup && onSaved && <DestinationSetupDialog types={types.filter(type => type.requirements?.audience_channels?.includes(channel))} connections={connections} returnFocusTo={trigger} onClose={() => setSetup(false)} onSaved={onSaved} />}
  </fieldset>;
}
