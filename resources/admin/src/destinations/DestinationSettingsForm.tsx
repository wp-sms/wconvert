import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { RegionError } from '../shell/Region';
import { ConnectionPicker, SettingsControl, fromDraft, isGroup, suggestedName, toDraft } from './settings';
import type { Connection, Destination, DestinationType } from './api';
import { readSelectedSchema } from './api';
import { DestinationUsageNotice } from './DestinationUsageNotice';
import { settingsProblems } from './requirements';

/**
 * The three questions, and the state behind them.
 *
 * Mounted only while the dialog is open, so `useState` seeds itself from the
 * type every time it opens — which is what keeps this out of an effect.
 */
export function DestinationSettingsForm({
  type,
  connections,
  busy,
  error,
  onCancel,
  onConfirm,
  destination,
  submitDescription,
}: {
  type: DestinationType;
  destination?: Destination;
  submitDescription?: string;
  /** Already filtered to this type. */
  connections: readonly Connection[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (draft: {
    label: string;
    connection: string | null;
    settings: Record<string, unknown>;
  }) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    toDraft(type.settings_schema, destination?.settings ?? {}),
  );
  /**
   * **Null while the name is still the suggestion's**, and a string from the
   * moment the merchant types.
   *
   * The suggestion follows what they point the route at — tick *Newsletter*
   * and the name becomes *"MailPoet — Newsletter"* — which is only helpful
   * while they have not written their own. A merchant who typed *"Black Friday
   * signups"* and then changed the list must not have their words overwritten,
   * and one who has typed nothing must not be left with a stale name from
   * before they chose.
   */
  const [named, setNamed] = useState<string | null>(destination?.label ?? null);
  /**
   * Which account this route runs over. Null is *"not chosen"*, and it is also
   * what every type free ships stores: `needs_connection` is false for all
   * three, so no picker is drawn and this never moves (#35).
   */
  const [connection, setConnection] = useState<string | null>(destination?.connection ?? null);
  const [schema, setSchema] = useState(type.settings_schema);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [refreshSchema, setRefreshSchema] = useState(0);
  useEffect(() => {
    if (!type.needs_connection || connection === null) {
      setSchema(type.settings_schema);
      return;
    }
    let active = true;
    setLoadingSchema(true);
    setMetadataError(null);
    void readSelectedSchema(type.id, connection, refreshSchema > 0).then((result) => {
      if (!active) return;
      setSchema(result.settings_schema);
      setDraft(toDraft(result.settings_schema, destination?.settings ?? {}));
    }).catch(() => {
      if (active) setMetadataError(__('Could not load this account’s audiences. Check the account and try again.', 'wconvert'));
    }).finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, [type, connection, destination, refreshSchema]);
  const label = named ?? suggestedName({ ...type, settings_schema: schema }, draft);
  const fields = Object.entries(schema);
  const id = (key: string) => `wconvert-add-${type.id}-${key}`;

  return (
    <>
      {error !== null && <RegionError message={error} />}
      {metadataError !== null && <RegionError message={metadataError} />}
      {loadingSchema && <p>{__('Loading audiences…', 'wconvert')}</p>}
      {type.needs_connection && connection !== null && <Button type="button" size="sm" variant="outline" disabled={loadingSchema} onClick={() => setRefreshSchema((old) => old + 1)}>{__('Refresh audiences', 'wconvert')}</Button>}
      {destination && <DestinationUsageNotice usage={destination.usage} />}
      {settingsProblems(type.requirements, fromDraft(schema, draft), schema).map((problem) =>
        <p key={problem} className="m-0 text-note text-warning">{problem}</p>)}

      <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('label')}>{__('Name', 'wconvert')}</Label>
          <Input
            id={id('label')}
            type="text"
            value={label}
            onChange={(event) => setNamed(event.target.value)}
          />
          <Description>
            {__('A name to recognize when choosing campaign destinations.', 'wconvert')}
          </Description>
        </div>

        {type.needs_connection && (
          <ConnectionPicker
            id={id('connection')}
            connections={connections}
            value={connection}
            onChange={setConnection}
          />
        )}

        {fields.map(([key, field]) => (
          <div key={key} className="flex flex-col gap-1.5">
            {/*
              Labelled by association where the control is a GROUP, exactly as
              the configured card does it: `<label for>` naming a
              `div[role=group]` is inert, so the group points back here.
            */}
            <Label id={`${id(key)}-label`} htmlFor={isGroup(field) ? undefined : id(key)}>
              {field.label}{type.requirements?.settings[key] ? __(' (required to send)', 'wconvert') : ''}
            </Label>
            <SettingsControl
              id={id(key)}
              field={field}
              value={draft[key] ?? ''}
              onChange={(value) => setDraft({ ...draft, [key]: value })}
            />
            {field.description !== undefined && <Description>{field.description}</Description>}
          </div>
        ))}
      </fieldset>

      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          {__('Cancel', 'wconvert')}
        </Button>
        {/*
          **The button names the outcome**, as every confirm in this admin
          does: a merchant reading *Add destination* has been told what
          pressing it does without having read the sentence above it.
        */}
        <Button
          aria-describedby={submitDescription}
          disabled={busy || loadingSchema || metadataError !== null || (type.needs_connection && connection === null)}
          onClick={() =>
            onConfirm({
              label,
              connection,
              settings: { ...destination?.settings, ...fromDraft(schema, draft) },
            })
          }
        >
          {destination === undefined ? __('Add destination', 'wconvert') : __('Save destination', 'wconvert')}
        </Button>
      </DialogFooter>
    </>
  );
}
