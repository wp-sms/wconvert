import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
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
import { ConnectionForm } from './ConnectionForm';
import { ProviderMark } from './ProviderMark';

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
  onConnectionSaved,
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
  onConnectionSaved?: (connection: Connection) => void;
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
  const [connection, setConnection] = useState<string | null>(destination?.connection ?? (connections.length === 1 ? connections[0].id : null));
  const [newAccount, setNewAccount] = useState<Connection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const accounts = newAccount && !connections.some((account) => account.id === newAccount.id)
    ? [...connections, newAccount] : connections;
  const selectedConnection = connection !== null && accounts.some((account) => account.id === connection) ? connection : null;
  const [schema, setSchema] = useState(type.settings_schema);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [refreshSchema, setRefreshSchema] = useState(0);
  useEffect(() => {
    if (!type.needs_connection || selectedConnection === null) {
      setSchema(type.settings_schema);
      return;
    }
    let active = true;
    setLoadingSchema(true);
    setMetadataError(null);
    void readSelectedSchema(type.id, selectedConnection, refreshSchema > 0).then((result) => {
      if (!active) return;
      setSchema(result.settings_schema);
      setDraft(toDraft(result.settings_schema, destination?.settings ?? {}));
    }).catch(() => {
      if (active) setMetadataError(__('Could not load choices from this account. Check the connection and try again.', 'wconvert'));
    }).finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, [type, selectedConnection, destination, refreshSchema]);
  const label = named ?? suggestedName({ ...type, settings_schema: schema }, draft);
  const fields = Object.entries(schema);
  const id = (key: string) => `wconvert-add-${type.id}-${key}`;
  const problems = (!type.needs_connection || selectedConnection !== null) && !loadingSchema
    ? settingsProblems(type.requirements, fromDraft(schema, draft), schema) : [];
  const noAccounts = type.needs_connection && accounts.length === 0;

  return (
    <>
      {connecting ? <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 font-medium"><ProviderMark type={type} />{sprintf(__('Connect %s', 'wconvert'), type.label)}</div>
        <p className="m-0 text-note text-muted-foreground">{__('We check the account before saving it. You can reuse it for other destinations.', 'wconvert')}</p>
        <ConnectionForm type={type} onCancel={() => setConnecting(false)} onSaved={(account) => {
          setNewAccount(account);
          setConnection(account.id);
          setConnecting(false);
          onConnectionSaved?.(account);
        }} />
      </div> : noAccounts ? <>
      <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
        <p className="m-0 text-body">{sprintf(__('Connect %s to choose where leads go.', 'wconvert'), type.label)}</p>
        <Button type="button" variant="outline" onClick={() => setConnecting(true)}><ProviderMark type={type} />{sprintf(__('Connect %s', 'wconvert'), type.label)}</Button>
      </div>
      <DialogFooter><Button variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button></DialogFooter>
      </> : <>
      {error !== null && <RegionError message={error} />}
      {metadataError !== null && <RegionError message={metadataError} />}
      {loadingSchema && <p role="status">{__('Loading destination choices…', 'wconvert')}</p>}
      {type.needs_connection && selectedConnection !== null && <div><Button type="button" variant="outline" disabled={loadingSchema} onClick={() => setRefreshSchema((old) => old + 1)}>{__('Refresh choices', 'wconvert')}</Button></div>}
      {destination && <DestinationUsageNotice usage={destination.usage} />}
      {problems.map((problem) => <p key={problem} className="m-0 text-note text-warning">{problem}</p>)}

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
            connections={accounts}
            value={selectedConnection}
            onChange={setConnection}
          />
        )}

        {type.needs_connection && accounts.length > 0 && <Button type="button" variant="outline" className="self-start" onClick={() => setConnecting(true)}>
          {sprintf(__('Connect another %s account', 'wconvert'), type.label)}
        </Button>}

        {(!type.needs_connection || selectedConnection !== null) && fields.map(([key, field]) => (
          <div key={key} className="flex flex-col gap-1.5">
            {/*
              Labelled by association where the control is a GROUP, exactly as
              the configured card does it: `<label for>` naming a
              `div[role=group]` is inert, so the group points back here.
            */}
            <Label id={`${id(key)}-label`} htmlFor={isGroup(field) || (type.needs_connection && field.type === 'ids' && field.options?.length === 0) ? undefined : id(key)}>
              {field.label}{type.requirements?.settings[key] ? __(' (required to send)', 'wconvert') : ''}
            </Label>
            {type.needs_connection && field.type === 'ids' && field.options?.length === 0
              ? <Description>{sprintf(__('No %s choices were found in this account. Create one in %s, then refresh choices.', 'wconvert'), field.label, type.label)}</Description>
              : <SettingsControl
                id={id(key)}
                field={field}
                value={draft[key] ?? ''}
                onChange={(value) => setDraft({ ...draft, [key]: value })}
              />}
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
          disabled={busy || loadingSchema || metadataError !== null || (type.needs_connection && (selectedConnection === null || problems.length > 0))}
          onClick={() =>
            onConfirm({
              label,
              connection: selectedConnection,
              settings: { ...destination?.settings, ...fromDraft(schema, draft) },
            })
          }
        >
          {destination === undefined ? __('Add destination', 'wconvert') : __('Save destination', 'wconvert')}
        </Button>
      </DialogFooter>
      </>}
    </>
  );
}
