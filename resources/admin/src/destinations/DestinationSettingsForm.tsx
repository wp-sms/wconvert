import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter } from '../components/ui/admin-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { Field } from '../shell/Field';
import { PageError } from '../shell/Region';
import { ConnectionPicker, SettingsControl, fromDraft, isGroup, settingLabel, suggestedName, toDraft } from './settings';
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
 *
 * **It draws the dialog's body and footer** (`AdminDialogBody`,
 * `AdminDialogFooter`); the caller draws only the header. That is what lets
 * the error sit beside the button that caused it, and lets connecting an
 * account open in place with Back rather than as a dialog over this one (§9).
 * `back` replaces the footer's Cancel where this is a step after a provider
 * list.
 */
export function DestinationSettingsForm({
  type,
  connections,
  busy,
  error,
  back,
  onCancel,
  onConfirm,
  destination,
  submitDescription,
  onConnectionSaved,
  onDirtyChange,
  focusField,
  initialConnection,
  note,
}: {
  /** The account to start on where there is no saved one — just connected, from Accounts. */
  initialConnection?: string;
  /** The footer's short note — "Saved just now" where the dialog stays open after a save. */
  note?: ReactNode;
  /** A setting key, or `connection`, to focus once the fields are drawn. */
  focusField?: string;
  type: DestinationType;
  destination?: Destination;
  submitDescription?: string;
  /** Already filtered to this type. */
  connections: readonly Connection[];
  busy: boolean;
  error: string | null;
  /** The footer's start action — Back to the provider list — in place of Cancel. */
  back?: ReactNode;
  onCancel: () => void;
  onConfirm: (draft: {
    label: string;
    connection: string | null;
    settings: Record<string, unknown>;
  }) => void;
  onConnectionSaved?: (connection: Connection) => void;
  /** Whether anything was changed, for the dialog's "Discard changes?". */
  onDirtyChange?: (dirty: boolean) => void;
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
  const [connection, setConnection] = useState<string | null>(destination?.connection ?? initialConnection ?? (connections.length === 1 ? connections[0].id : null));
  const [newAccount, setNewAccount] = useState<Connection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [touched, setTouched] = useState(false);
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
  // Anything typed or chosen, or an account connected on the way — the
  // dialog asks before Escape throws that away.
  const [connectingDirty, setConnectingDirty] = useState(false);
  const dirty = touched || newAccount !== null || (connecting && connectingDirty);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const label = named ?? suggestedName({ ...type, settings_schema: schema }, draft);
  const fields = Object.entries(schema);
  const id = (key: string) => `wconvert-add-${type.id}-${key}`;
  const noAccounts = noAccountsFor(type, connections, newAccount);
  const problems = (!type.needs_connection || selectedConnection !== null) && !loadingSchema
    ? settingsProblems(type.requirements, fromDraft(schema, draft), schema)
    : type.needs_connection && selectedConnection === null && !noAccounts
      ? [__('Choose an account before this destination can send.', 'wconvert')] : [];
  /*
   * **A route that cannot send is refused, whatever its type.** Only a
   * type with an account was held back, so a lead-magnet email with no file
   * link could be added — and the "Needs setup" cards it left behind were
   * exactly what a merchant then found. The reasons are the list above the
   * footer, so the button is `aria-disabled` and described by it rather than
   * greyed with nothing said (§14).
   */
  const refused = problems.length > 0;
  const focused = useRef(false);
  useEffect(() => {
    if (focusField === undefined || focused.current || loadingSchema) return;
    const field = document.getElementById(id(focusField));
    const control = field?.matches('input, select, textarea, button') ? field : field?.querySelector<HTMLElement>('input, select, textarea, button');
    if (control) { control.focus(); focused.current = true; }
  });
  const cancel = back ?? <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>;
  const connect = sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect %s', 'wconvert'), type.label);

  /*
   * **Connecting opens in place, with Back** — never a second dialog over
   * this one (§9). The name and choices typed so far survive the trip,
   * because this component stays mounted underneath it.
   */
  if (connecting) {
    return (
      <ConnectionForm type={type} onCancel={() => setConnecting(false)} onDirtyChange={setConnectingDirty}
        back={<Button type="button" variant="outline" onClick={() => setConnecting(false)}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back', 'wconvert')}
        </Button>}
        onSaved={(account) => {
          setNewAccount(account);
          setConnection(account.id);
          setConnecting(false);
          onConnectionSaved?.(account);
        }} />
    );
  }

  if (noAccounts) {
    return (
      <>
        <AdminDialogBody>
          <div className="flex items-start gap-3 rounded-md border border-border bg-surface p-4">
            <ProviderMark type={type} className="mt-0.5 size-5 shrink-0" />
            <p className="m-0">
              {sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect a %s account to choose where leads go. One account can serve several destinations.', 'wconvert'), type.label)}
            </p>
          </div>
        </AdminDialogBody>
        <AdminDialogFooter back={cancel}>
          <Button type="button" onClick={() => setConnecting(true)}>{connect}</Button>
        </AdminDialogFooter>
      </>
    );
  }

  return (
    <>
      <AdminDialogBody>
        <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          {destination && <div id={id('usage')}><DestinationUsageNotice usage={destination.usage} /></div>}

          <Field label={__('Name', 'wconvert')} htmlFor={id('label')} hintId={id('label-hint')}
            hint={__('What you’ll pick in a campaign’s Destinations tab.', 'wconvert')}>
            <Input
              id={id('label')}
              type="text"
              value={label}
              aria-describedby={id('label-hint')}
              onChange={(event) => { setNamed(event.target.value); setTouched(true); }}
            />
          </Field>

          {type.needs_connection && (
            <div className="flex flex-col items-start gap-1.5">
              <div className="w-full">
                <ConnectionPicker
                  id={id('connection')}
                  connections={accounts}
                  value={selectedConnection}
                  onChange={(value) => { setConnection(value); setTouched(true); }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4">
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => setConnecting(true)}>
                  {sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Connect another %s account', 'wconvert'), type.label)}
                </Button>
                {selectedConnection !== null && <Button type="button" variant="link" className="h-auto p-0" disabled={loadingSchema}
                  onClick={() => setRefreshSchema((old) => old + 1)}>
                  {loadingSchema ? __('Refreshing choices…', 'wconvert') : __('Refresh choices', 'wconvert')}
                </Button>}
              </div>
            </div>
          )}

          {metadataError !== null && <PageError message={metadataError} onRetry={() => setRefreshSchema((old) => old + 1)} />}
          {loadingSchema && <p role="status" className="m-0 text-note text-muted-foreground">
            {sprintf(/* translators: %s: a service, e.g. “Mailchimp”. */ __('Loading choices from %s…', 'wconvert'), type.label)}
          </p>}

          {(!type.needs_connection || selectedConnection !== null) && fields.map(([key, field]) => {
            const required = type.requirements?.settings[key] !== undefined;
            const empty = type.needs_connection && field.type === 'ids' && field.options?.length === 0;
            return (
              <div key={key} className="flex min-w-0 flex-col gap-1.5">
                {/*
                  Labelled by association where the control is a GROUP, exactly as
                  the configured card does it: `<label for>` naming a
                  `div[role=group]` is inert, so the group points back here.
                */}
                <Label id={`${id(key)}-label`} htmlFor={isGroup(field) || empty ? undefined : id(key)}>
                  {settingLabel(field.label, required)}
                </Label>
                {empty
                  ? <Description>{sprintf(
                    /* translators: 1: a setting's name, e.g. “Audience”. 2: a service, e.g. “Mailchimp”. */
                    __('No %1$s choices were found in this account. Create one in %2$s, then refresh choices.', 'wconvert'),
                    field.label, type.label,
                  )}</Description>
                  : <SettingsControl
                    id={id(key)}
                    field={field}
                    value={draft[key] ?? ''}
                    onChange={(value) => { setDraft({ ...draft, [key]: value }); setTouched(true); }}
                  />}
                {field.description !== undefined && <Description>{field.description}</Description>}
              </div>
            );
          })}

          {problems.length > 0 && <ul id={id('problems')} className="m-0 flex list-none flex-col gap-1 p-0 text-note text-warning">
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>}
        </fieldset>
      </AdminDialogBody>

      <AdminDialogFooter back={cancel} error={error} note={note}>
        {/*
          **The button names the outcome**, as every confirm in this admin
          does: a merchant reading *Add destination* has been told what
          pressing it does without having read the sentence above it.
        */}
        <Button
          aria-describedby={[refused ? id('problems') : undefined, submitDescription, destination ? id('usage') : undefined].filter(Boolean).join(' ') || undefined}
          aria-disabled={refused ? true : undefined}
          disabled={busy || loadingSchema || metadataError !== null}
          onClick={() => {
            if (refused) return;
            onConfirm({
              label,
              connection: selectedConnection,
              settings: { ...destination?.settings, ...fromDraft(schema, draft) },
            });
          }}
        >
          {busy
            ? (destination === undefined ? __('Adding…', 'wconvert') : __('Saving…', 'wconvert'))
            : (destination === undefined ? __('Add destination', 'wconvert') : __('Save destination', 'wconvert'))}
        </Button>
      </AdminDialogFooter>
    </>
  );
}

/** A type that runs over an account, with none of that type's accounts to pick. */
function noAccountsFor(type: DestinationType, connections: readonly Connection[], added: Connection | null): boolean {
  return type.needs_connection && connections.length === 0 && added === null;
}
