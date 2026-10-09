import { __ } from '@wordpress/i18n';
import { DestinationsEditor } from './DestinationsEditor';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import type { Loadable } from '../shell/loadable';
import type { Connection, Destination, DestinationType } from '../destinations/api';
import type { Template } from '@renderer/types';

/**
 * The optional second signup's routes, in the same cards as the main one.
 *
 * It subscribes the other channel, so only routes that take that channel can
 * be added — the rule publish enforces on the server. Its selection and its
 * extra-answer map live under its own submission id.
 */
export function SubmissionSettings({ template, primaryChannel, config, available, onChange, types = [], connections = [], onSaved, onConnectionSaved, onRefresh, refreshError = null, testEmail = null }: {
  types?: readonly DestinationType[]; connections?: readonly Connection[];
  onSaved(destinations: readonly Destination[]): void; onConnectionSaved?(connection: Connection): void; onRefresh(): void;
  template?: Template; primaryChannel?: string | null; config: Record<string, unknown>; available: Loadable<readonly Destination[]>;
  testEmail?: string | null; refreshError?: string | null;
  onChange(config: Record<string, unknown>): void;
}) {
  const secondary = template?.tree.submissions[1];
  if (!secondary) return null;
  const channel = primaryChannel === 'phone' || primaryChannel === 'sms' ? 'email' : 'phone';
  const title = channel === 'phone' ? __('Optional SMS signup', 'wconvert') : __('Optional email signup', 'wconvert');
  const description = __('Visitors can skip this signup. Only destinations chosen here receive it.', 'wconvert');
  if (config.capture_mode === 'local') {
    return <Region className="wconvert-destinations-region"><RegionHeader title={title} level={3} description={description} />
      <RegionBody><p className="m-0 text-note">{__('Signups are saved only in WConvert.', 'wconvert')}</p></RegionBody></Region>;
  }
  const settings = (config.submission_settings ?? {}) as Record<string, { destination_ids?: string[] }>;
  const bound = settings[secondary.id]?.destination_ids ?? [];
  const mappings = (config.integration_mappings ?? {}) as Record<string, Record<string, Record<string, string>>>;
  return <DestinationsEditor
    primary={false}
    title={title}
    description={description}
    emptyText={channel === 'phone'
      ? __('This signup is saved in WConvert only. Add an SMS service, or remove the optional SMS signup in Edit campaign.', 'wconvert')
      : __('This signup is saved in WConvert only. Add an email service, or remove the optional email signup in Edit campaign.', 'wconvert')}
    channel={{ channel, strict: true }}
    template={template}
    submissionId={secondary.id}
    bound={bound}
    available={available}
    types={types}
    connections={connections}
    testEmail={testEmail}
    onRefresh={onRefresh}
    refreshError={refreshError}
    onSaved={onSaved}
    onConnectionSaved={onConnectionSaved}
    mappings={mappings[secondary.id] ?? {}}
    onChange={(next) => onChange({
      submission_settings: { ...settings, [secondary.id]: { ...settings[secondary.id], destination_ids: next } },
      integration_mappings: { ...mappings, [secondary.id]: Object.fromEntries(Object.entries(mappings[secondary.id] ?? {}).filter(([id]) => next.includes(id))) },
    })}
    onMappingChange={(destinationId, map) => onChange({ integration_mappings: { ...mappings, [secondary.id]: { ...mappings[secondary.id], [destinationId]: map } } })}
  />;
}
