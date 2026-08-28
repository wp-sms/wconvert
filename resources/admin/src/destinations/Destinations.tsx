import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleAlert, CircleCheck, Plug, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { iconFor } from '../icons';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { Description } from '../shell/Description';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionHeader } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import {
  deleteDestination,
  readDestinations,
  rePush,
  saveDestination,
  type Destination,
  type DestinationType,
  type DestinationsPayload,
  type RePushReport,
  type SettingsField,
} from './api';
import { renderingFor } from '../goals/availability';

/**
 * **Where a merchant finds out whether pushing is working.**
 *
 * That is the screen's whole reason to exist. A merchant whose integration
 * broke three days ago has no other way to notice: the [[Lead]]s are in the
 * log, the [[Optin]] is still converting, and nothing else anywhere says the
 * pushes stopped.
 *
 * **What it shows is per-[[Destination]] health and a bounded ring of terminal
 * failures — never a per-Lead delivery column.** There is no such column and
 * there is not going to be one: `push()` is idempotent, so per-Lead delivery
 * state buys efficiency rather than correctness, and health plus a re-push
 * button answers the actual support case (ADR 0008).
 *
 * The two failure displays are not redundant. `consecutive_failures` counts
 * OUTAGES; a Lead rejected for its own sake — a malformed address — leaves it
 * at zero and lands in the ring instead. Showing only one of them would hide
 * exactly one of the two things that go wrong.
 *
 * ============================================================================
 * HEALTH FIRST, SETUP UNDER IT (ADR 0039).
 * ============================================================================
 * This screen used to open with the types list and its **Add** buttons, and put
 * the health of what a merchant already configured underneath. That is
 * backwards for the reason above: nobody opens this page wanting a fifth
 * Destination, they open it because something did not arrive. So a configured
 * Destination is a region of its own — one concern, its own edge — the types
 * list is one region at the bottom named for what it is, and the terminal ring
 * is a third.
 *
 * That also unpicks the block that fused five concerns: the label, its
 * availability, its health, its settings form and **Remove** were one
 * undifferentiated stack. Health leads the region, settings sit under a rule,
 * and Remove is behind a confirm rather than beside the button that repairs
 * things.
 */
export function Destinations() {
  const [payload, setPayload] = useState<Loadable<DestinationsPayload>>(LOADING);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /*
   * Keyed by Destination, not screen-wide. A re-push report is a fact about ONE
   * Destination, and the shipped version rendered it after every row and never
   * cleared it — so a merchant who replayed one integration read the result
   * under all of them, for the rest of the session (ADR 0039).
   */
  const [reports, setReports] = useState<Record<string, RePushReport>>({});
  const [confirming, setConfirming] = useState<Destination | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPayload(ready(await readDestinations()));
      setError(null);
    } catch (cause) {
      setPayload((current) => (current.status === 'ready' ? current : failed(cause)));
      setError(messageOf(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);

    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const add = (type: DestinationType) =>
    void run(() => saveDestination({ type: type.id, label: type.label, settings: {} }));

  const remove = (destination: Destination) =>
    void run(() => deleteDestination(destination.id));

  const save = (destination: Destination, settings: Record<string, unknown>) =>
    void run(() =>
      saveDestination({
        id: destination.id,
        type: destination.type,
        label: destination.label,
        connection: destination.connection,
        settings,
      }),
    );

  const replay = (destination: Destination) => {
    setBusy(true);

    void (async () => {
      try {
        const report = await rePush(destination.id);

        setReports((current) => ({ ...current, [destination.id]: report }));
        setError(null);
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (payload.status === 'failed') {
    return (
      <Region label={__('Destinations', 'wconvert')}>
        <RegionErrorState
          message={payload.message}
          hint={__('Reload the page to try again.', 'wconvert')}
        />
      </Region>
    );
  }

  const data = payload.status === 'ready' ? payload.data : null;

  return (
    <div className="flex flex-col gap-5">
      {error !== null && (
        <Region label={__('Destinations', 'wconvert')}>
          <RegionError message={error} />
        </Region>
      )}

      {data === null ? (
        <Region label={__('Destinations', 'wconvert')}>
          <DataTable>
            <TableSkeleton columns={3} rows={2} />
          </DataTable>
        </Region>
      ) : (
        <>
          {data.destinations.length === 0 ? (
            <Region label={__('Destinations', 'wconvert')}>
              <EmptyState icon={Plug} title={__('Nothing is being pushed on', 'wconvert')}>
                {__(
                  'Every capture is written to the lead log first and always. Add a destination to send it on as well.',
                  'wconvert',
                )}
              </EmptyState>
            </Region>
          ) : (
            data.destinations.map((destination) => (
              <Configured
                key={destination.id}
                destination={destination}
                schema={
                  data.types.find((type) => type.id === destination.type)?.settings_schema ?? {}
                }
                report={reports[destination.id] ?? null}
                busy={busy}
                onSave={save}
                onRemove={(trigger) => {
                  returnFocus.current = trigger;
                  setConfirming(destination);
                }}
                onRePush={replay}
              />
            ))
          )}

          <Types
            types={data.types}
            configured={data.destinations}
            busy={busy}
            onAdd={add}
          />

          <Failures failures={data.failures} />
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
          }
        }}
        title={__('Remove this destination?', 'wconvert')}
        description={
          confirming === null
            ? ''
            : sprintf(
                /* translators: %s: the name of a Destination. */
                __(
                  'Captures stop being sent to “%s”. Leads already in the log are untouched — the log is not a destination, and is always written first.',
                  'wconvert',
                ),
                confirming.label,
              )
        }
        confirmLabel={__('Remove destination', 'wconvert')}
        returnFocusTo={returnFocus}
        onConfirm={() => {
          const destination = confirming;

          setConfirming(null);

          if (destination !== null) {
            remove(destination);
          }
        }}
      />
    </div>
  );
}

/**
 * One configured Destination: whether it is working, what it is set to, and the
 * one recovery action.
 *
 * **Health is the first thing in the region**, because it is the question the
 * screen exists to answer. It is a `Badge` and a sentence rather than a
 * paragraph that changes class between `description` and `notice notice-warning`
 * — the state a merchant is scanning for should be readable without reading
 * (ADR 0039).
 */
function Configured({
  destination,
  schema,
  report,
  busy,
  onSave,
  onRemove,
  onRePush,
}: {
  destination: Destination;
  /** Every field its TYPE declares, in the order PHP returned them — copy included. */
  schema: DestinationType['settings_schema'];
  report: RePushReport | null;
  busy: boolean;
  onSave: (destination: Destination, settings: Record<string, unknown>) => void;
  onRemove: (trigger: HTMLElement | null) => void;
  onRePush: (destination: Destination) => void;
}) {
  // Seeded once from what is stored. Keyed by field rather than held as one
  // string, because a type declares as many fields as it likes — the WSMS push
  // has one and the lead magnet email has three.
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(schema, destination.settings));
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const failing = destination.health.consecutive_failures > 0;
  const fields = Object.entries(schema);

  return (
    <Region>
      <RegionHeader
        title={destination.label}
        description={
          destination.availability === 'locked'
            ? __(
                'A Pro feature this install does not have, so captures are not being sent.',
                'wconvert',
              )
            : destination.availability === 'unavailable'
              ? __('What it needs is missing, so captures are not being sent.', 'wconvert')
              : undefined
        }
        trailing={
          failing ? (
            <Badge variant="destructive">{__('Failing', 'wconvert')}</Badge>
          ) : destination.availability !== 'ready' ? (
            <Badge variant="warning">{__('Paused', 'wconvert')}</Badge>
          ) : destination.health.last_success_at === null ? (
            <Badge variant="secondary">{__('Not used yet', 'wconvert')}</Badge>
          ) : (
            <Badge variant="success">{__('Delivering', 'wconvert')}</Badge>
          )
        }
      />

      <RegionBody className="flex flex-col gap-3">
        {failing ? (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <CircleAlert />
            <AlertTitle>
              {sprintf(
                /* translators: 1: number of failures in a row, 2: the last error. */
                _n(
                  '%1$d failure in a row. Last error: %2$s',
                  '%1$d failures in a row. Last error: %2$s',
                  destination.health.consecutive_failures,
                  'wconvert',
                ),
                destination.health.consecutive_failures,
                destination.health.last_error ?? '',
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <p className="m-0 flex items-center gap-2 text-muted-foreground">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            {destination.health.last_success_at === null
              ? __('Nothing has been pushed here yet.', 'wconvert')
              : sprintf(
                  /* translators: %s: a date and time. */
                  __('Last successful push: %s', 'wconvert'),
                  destination.health.last_success_at,
                )}
          </p>
        )}

        {destination.health.skipped_captures > 0 && (
          <Alert className="border-warning/30 bg-warning/5 text-warning">
            <TriangleAlert />
            <AlertTitle className="line-clamp-none">
              {sprintf(
                /* translators: 1: number of captures, 2: a date and time. */
                _n(
                  '%1$d capture was not sent, most recently at %2$s. Fix what this destination needs, then re-push.',
                  '%1$d captures were not sent, most recently at %2$s. Fix what this destination needs, then re-push.',
                  destination.health.skipped_captures,
                  'wconvert',
                ),
                destination.health.skipped_captures,
                destination.health.last_skipped_at ?? '',
              )}
            </AlertTitle>
          </Alert>
        )}

        {/*
          **The report is this Destination's and it is rendered here**, under
          the button that produced it, rather than once at the bottom of a
          screen holding four of them.
        */}
        {report !== null && (
          <Alert
            className={
              report.capped
                ? 'border-warning/30 bg-warning/5 text-warning'
                : 'border-success/30 bg-success/5 text-success'
            }
          >
            <RotateCcw />
            <AlertTitle className="line-clamp-none">
              {sprintf(
                /* translators: %d: number of pushes queued. */
                _n('%d lead queued for re-pushing.', '%d Leads queued for re-pushing.', report.jobs, 'wconvert'),
                report.jobs,
              )}
            </AlertTitle>
            {report.capped && (
              <AlertDescription>
                {__('That is the per-run limit — run it again once these have gone through.', 'wconvert')}
              </AlertDescription>
            )}
          </Alert>
        )}
      </RegionBody>

      {/*
        **The fields are the schema, drawn in the order PHP returned them.**
        Both the copy and the CONTROL come from the type's `settingsSchema()`,
        which is what replaces WSMS's five `Supports*` capability interfaces: a
        Destination's fields are a schema rather than a capability, so there is
        one method and no matrix (#4). Before #31 this screen hard-coded the
        one field WSMS declares and read `type` nowhere, which meant the second
        type to declare a field would have rendered none of them.

        A type whose schema is empty — or one this install cannot see, so there
        is no schema to read — gets no form and no Save button, because there
        is nothing to save.
      */}
      {fields.length > 0 && (
        <RegionBody className="flex flex-col gap-4 border-t border-border">
          {fields.map(([key, field]) => (
            <div key={key} className="flex max-w-xl flex-col gap-1.5">
              <Label htmlFor={`wconvert-${destination.id}-${key}`}>{field.label}</Label>
              <SettingsControl
                id={`wconvert-${destination.id}-${key}`}
                field={field}
                value={draft[key] ?? ''}
                onChange={(value) => setDraft({ ...draft, [key]: value })}
              />
              {field.description !== undefined && (
                <Description>{field.description}</Description>
              )}
            </div>
          ))}

          <div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onSave(destination, { ...destination.settings, ...fromDraft(schema, draft) })}
            >
              {__('Save', 'wconvert')}
            </Button>
          </div>
        </RegionBody>
      )}

      {/*
        **Re-push repairs and Remove destroys, and they are not the same
        weight.** They were two `.button`s side by side; now the recovery
        action is the visible one and Remove is a quiet destructive control at
        the far edge, behind a confirm (ADR 0039).
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onRePush(destination)}>
          <RotateCcw aria-hidden="true" />
          {__('Re-push leads since the last success', 'wconvert')}
        </Button>
        <Button
          ref={removeTrigger}
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(removeTrigger.current)}
        >
          <Trash2 aria-hidden="true" />
          {__('Remove', 'wconvert')}
        </Button>
      </div>
    </Region>
  );
}

/**
 * The types this install can reach.
 *
 * `unavailable` is explained and never sold: a merchant with no WP SMS is not
 * missing something we can sell them, and rendering that as an upsell is what
 * ADR 0026 exists to stop.
 *
 * **It sits below the configured Destinations**, because it is setup and the
 * screen's subject is health. It reads as a list of rows with an action each,
 * rather than as a bulleted list with a button loose in the middle of a
 * sentence.
 */
function Types({
  types,
  configured,
  busy,
  onAdd,
}: {
  types: DestinationType[];
  configured: Destination[];
  busy: boolean;
  onAdd: (type: DestinationType) => void;
}) {
  return (
    <Region>
      <RegionHeader
        title={__('Add a destination', 'wconvert')}
        description={__('Where else a captured lead can go.', 'wconvert')}
      />

      {types.length === 0 ? (
        <RegionBody className="text-muted-foreground">
          {__('No destination types are available on this site.', 'wconvert')}
        </RegionBody>
      ) : (
        <ul className="m-0 list-none p-0">
          {types.map((type) => {
            const rendering = renderingFor(type.availability, 'settings_list');
            const TypeIcon = iconFor(type.icon);

            return (
              <li
                key={type.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <TypeIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{type.label}</span>
                </span>

                {/*
                  This is a SETTINGS LIST, so it explains an absence rather than
                  hiding it — the merchant opened this page expecting a list, and
                  silence here is baffling. The cascade is `renderingFor`'s and not
                  one written out again: `locked` and `unavailable` must never
                  collapse into one "not available", because that is exactly how a
                  paying customer gets shown an advertisement for Pro and a merchant
                  gets offered a WP SMS licence we do not sell (ADR 0026).
                */}
                {rendering === 'offer' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || configured.some((destination) => destination.type === type.id)}
                    onClick={() => onAdd(type)}
                  >
                    {__('Add', 'wconvert')}
                  </Button>
                ) : rendering === 'upsell' ? (
                  <span className="text-muted-foreground">{__('Included with Pro.', 'wconvert')}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {sprintf(
                      /* translators: %s: the plugin or platform the Destination needs, e.g. "WP SMS". */
                      __('Needs %s on this site.', 'wconvert'),
                      type.requires_label ?? __('something this site does not have', 'wconvert'),
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Region>
  );
}

/**
 * One control per field kind — **the whole of what a Destination's settings UI
 * can draw.**
 *
 * The precedent is `../builder/controls.tsx`, which does the same job for the
 * rules manifest: a schema kind picks a control, and the `default` case is a
 * text input rather than nothing. That default is what makes a new field kind
 * a DEGRADED control instead of an invisible one — a merchant can still type
 * into it, and the value round-trips as a string.
 *
 * **Every value here is a string except `ids`.** The whole draft is held as
 * text while it is being edited, and {@see fromDraft} is the one place that
 * turns it back into what the server stores. `ids` is the exception because
 * WSMS's `tags` is a list — the shape that shipped, and it round-trips
 * unchanged.
 *
 * There is no `select`: nothing in the Destination schemas offers a closed set
 * of options yet, and inventing the control before a field needs it would be
 * guessing at whether the options travel in the schema or come off the wire.
 */
function SettingsControl({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: SettingsField;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (field.type) {
    /**
     * A comma-separated list, which is what `tags` has always been. The
     * splitting is in {@see fromDraft} rather than here, so a merchant can
     * type a comma without the field reformatting itself under them.
     */
    case 'ids':
      return <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;

    /**
     * `type="url"` for the keyboard and the browser's own hint, and nothing
     * more: the value is not validated here or on the way in. The push checks
     * what it needs at the moment it needs it, which is the same posture the
     * rest of the settings bag takes.
     */
    case 'url':
      return <Input id={id} type="url" value={value} onChange={(e) => onChange(e.target.value)} />;

    case 'multiline':
      return (
        <textarea
          id={id}
          rows={5}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'text':
    default:
      return <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * The field kinds whose stored value is a **list** rather than a string.
 *
 * One place rather than two `=== 'ids'` checks that have to stay in step:
 * {@see toDraft} and {@see fromDraft} are the two halves of one round trip, and
 * a kind added to one but not the other would read back as a different shape
 * than it was saved as. WSMS's `tags` is the only member today.
 *
 * The control switch in {@see SettingsControl} is deliberately NOT driven off
 * this: which control to draw and which shape to store are different questions,
 * and `ids` happens to answer both the same way only because a comma-separated
 * text input is what a list has always been edited with here.
 */
const LIST_KINDS = new Set(['ids']);

/**
 * What is stored, as text a control can edit.
 *
 * Keyed off the SCHEMA rather than off the stored settings, so a field the
 * type declares but nothing has ever saved still gets an empty control — and a
 * stored key the type no longer declares is left alone rather than drawn.
 */
function toDraft(
  schema: DestinationType['settings_schema'],
  settings: Destination['settings']
): Record<string, string> {
  const draft: Record<string, string> = {};

  for (const [key, field] of Object.entries(schema)) {
    const stored = settings[key];

    draft[key] = LIST_KINDS.has(field.type)
      ? (Array.isArray(stored) ? (stored as unknown[]) : []).filter((id) => typeof id === 'string').join(', ')
      : typeof stored === 'string'
        ? stored
        : '';
  }

  return draft;
}

/**
 * The text, back in the shape the server stores.
 *
 * **The caller spreads this over the existing settings rather than replacing
 * them**, so a key this type no longer declares — or one a future version
 * wrote — survives a save from this screen. A settings bag is opaque to the
 * REST layer (`DestinationController::store()` validates nothing in it), and a
 * screen that silently dropped what it could not draw would be the one place
 * that opacity bites.
 */
function fromDraft(
  schema: DestinationType['settings_schema'],
  draft: Record<string, string>
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = draft[key] ?? '';

    settings[key] = LIST_KINDS.has(field.type)
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id !== '')
      : value;
  }

  return settings;
}

/**
 * The terminal-failure ring.
 *
 * These are the Leads that will never land, and **health cannot see them** —
 * a malformed address is not an outage, so it leaves `consecutive_failures` at
 * zero. Without this list there would be nothing anywhere naming them
 * (ADR 0008).
 */
function Failures({ failures }: { failures: DestinationsPayload['failures'] }) {
  if (failures.length === 0) {
    return null;
  }

  return (
    <Region>
      <RegionHeader
        title={__('Leads that could not be delivered', 'wconvert')}
        description={__(
          'These failed for their own reasons, not an outage. Last 200 kept.',
          'wconvert',
        )}
      />
      <DataTable>
        <DataTableHead>
          <DataTableColumn>{__('When', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Lead', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Why', 'wconvert')}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {failures.map((failure) => (
            <DataTableRow key={`${failure.lead}-${failure.at}`}>
              <DataTableCell label={__('When', 'wconvert')}>{failure.at}</DataTableCell>
              <DataTableCell label={__('Lead', 'wconvert')}>
                <code className="font-mono text-xs text-muted-foreground">{failure.lead}</code>
              </DataTableCell>
              <DataTableCell label={__('Why', 'wconvert')} className="whitespace-normal">
                {failure.error}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </Region>
  );
}
