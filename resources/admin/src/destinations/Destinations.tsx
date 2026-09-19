import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { DestinationUsageNotice } from './DestinationUsageNotice';
import { settingsProblems } from './requirements';
import {
  CircleAlert,
  CircleCheck,
  ChevronDown,
  Info,
  Lock,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { iconFor } from '../icons';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AddDestinationDialog } from './AddDestinationDialog';
import { SendTestDialog } from './SendTestDialog';
import { destinationHref, leadsHref, sendingIssuesHref } from '../nav';
import { useSettingsEditing, type SettingsEditing } from '../settings-page/useSettingsEditing';
import type { EditingState } from '../hooks/useAdminNavigation';
import { Code } from '../shell/Code';
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
import {
  PageError,
  Region,
  RegionBody,
  RegionError,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { PageAction } from '../shell/PageActions';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import {
  deleteDestination,
  readDestinations,
  rePush,
  saveDestination,
  testConnection,
  type Connection,
  type Destination,
  type DestinationType,
  type DestinationsPayload,
  type RePushReport,
  type TestReport,
} from './api';
import {
  ConnectionPicker,
  SettingsControl,
  fromDraft,
  isGroup,
  targetSaid,
  toDraft,
} from './settings';
import { renderingFor, tierName, tierProductName } from '../goals/availability';
import { issueCount } from './issueCount';

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
export function Destinations({ destinationId, mode = 'settings', onEditingStateChange, onIssueCount }: {
  readonly destinationId?: string; mode?: 'settings' | 'issues'; onEditingStateChange?: SettingsEditing; onIssueCount?: (count: number | null) => void;
} = {}) {
  const [payload, setPayload] = useState<Loadable<DestinationsPayload>>(LOADING);
  /*
   * **The read's own failure, and the only screen-wide one left.** A refresh
   * that fails is a fact about the whole payload — every region on the screen
   * is now showing something that may have moved — so it belongs above all of
   * them rather than inside one. Every failure a BUTTON caused is keyed below.
   */
  const [fetchError, setFetchError] = useState<string | null>(null);
  useEffect(() => { onIssueCount?.(payload.status === 'ready' && fetchError === null ? issueCount(payload.data) : null); }, [payload, fetchError, onIssueCount]);
  /*
   * **Keyed by what the action ran against, not one string for the screen.**
   * One `error` meant a failed save on the third Destination reported at the
   * top of the page, four regions away from the Save button that caused it,
   * and the merchant had to guess which row it was about — the placement
   * failure ADR 0039 names. The key is the Destination, or the TYPE for an
   * Add, which is the one action that has no Destination yet.
   */
  const [errors, setErrors] = useState<Record<string, string>>({});
  /*
   * **Per row, not per screen.** One boolean was handed to every Configured
   * region and to the types list, so saving one Destination disabled Save,
   * Re-push, Remove and every Add button on the screen for the length of that
   * one request. Same shape, and the same reason, as {@see OptinList}.
   */
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const startOperation = (id: string) => setBusyIds((held) => new Set([...held, id]));
  const finishOperation = (id: string) => setBusyIds((held) => new Set([...held].filter((pending) => pending !== id)));
  /*
   * Keyed by Destination, not screen-wide. A re-push report is a fact about ONE
   * Destination, and the shipped version rendered it after every row and never
   * cleared it — so a merchant who replayed one integration read the result
   * under all of them, for the rest of the session (ADR 0039).
   */
  const [reports, setReports] = useState<Record<string, RePushReport>>({});
  /*
   * A test's answer, keyed the same way and for the same reason: it is a fact
   * about ONE Destination, and a merchant testing two integrations must not
   * read the second answer under the first.
   */
  const [tests, setTests] = useState<Record<string, TestReport>>({});
  const [confirming, setConfirming] = useState<Destination | null>(null);
  const [replaying, setReplaying] = useState<Destination | null>(null);
  const [sending, setSending] = useState<{ destination: Destination; settingsDirty: boolean } | null>(null);
  /**
   * The type being added, which is also whether the Add dialog is open.
   *
   * **Adding is a step now rather than a click.** A [[Destination]] is a named
   * route, and the three things that make one — the name, the account and what
   * inside it the route points at — are asked before it exists (#89). Held
   * here rather than inside {@see Types} because the dialog needs the payload's
   * `connections`, and because the failure it may produce is already keyed here
   * by the type's id.
   */
  const [adding, setAdding] = useState<DestinationType | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const addTrigger = useRef<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const fetchRequest = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [draftStates, setDraftStates] = useState<Record<string, EditingState>>({});
  const reportDraft = useCallback((id: string, state: EditingState) => {
    setDraftStates((held) => ({ ...held, [id]: state }));
  }, []);
  const dirty = adding !== null || Object.values(draftStates).some((state) => state.dirty);
  useSettingsEditing(dirty, busyIds.size > 0 || sending !== null, onEditingStateChange);

  const refresh = useCallback(async () => {
    const request = ++fetchRequest.current;
    setRefreshing(true);
    try {
      const next = await readDestinations();
      if (request !== fetchRequest.current) return;
      setPayload(ready(next));
      setFetchError(null);
      /*
       * **A report does not outlive the read that makes it stale.** It says
       * how many Leads were queued a moment ago, and after this read the
       * health sitting beside it has moved on while the sentence has not.
       * `setReports` only ever ADDS, so without this the merchant who
       * re-pushed once read that count under the same Destination for the
       * rest of the session — including after later refreshes made it wrong.
       */
      setReports({});
      setTests({});
    } catch (cause) {
      if (request !== fetchRequest.current) return;
      setPayload((current) => (current.status === 'ready' ? current : failed(cause)));
      setFetchError(messageOf(cause));
    } finally {
      if (request === fetchRequest.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const requests = fetchRequest;
    void refresh();
    return () => { requests.current++; };
  }, [refresh]);

  // Cleared on the retry that works, and only for the thing that was retried:
  // a successful save on one Destination says nothing about the one that
  // failed two regions up.
  const cleared = (current: Record<string, string>, id: string): Record<string, string> =>
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));

  const run = async (id: string, action: () => Promise<unknown>) => {
    startOperation(id);

    try {
      await action();
      setErrors((current) => cleared(current, id));
      await refresh();
    } catch (cause) {
      setErrors((current) => ({ ...current, [id]: messageOf(cause) }));
    } finally {
      finishOperation(id);
    }
  };

  /**
   * Create the route the dialog was filled in for.
   *
   * **The dialog is closed inside the action rather than beside it**, so it
   * closes only on a save that worked: `run()` refreshes after the action
   * resolves and keys the error by the type when it throws, and a failure that
   * dropped the dialog would take the merchant's typed name with it.
   */
  const add = (
    type: DestinationType,
    draft: { label: string; connection: string | null; settings: Record<string, unknown> },
  ) =>
    void run(type.id, async () => {
      await saveDestination({
        type: type.id,
        label: draft.label,
        connection: draft.connection,
        settings: draft.settings,
      });

      setAdding(null);
    });

  const remove = (destination: Destination) =>
    void run(destination.id, () => deleteDestination(destination.id));

  const save = (
    destination: Destination,
    edit: { label: string; connection: string | null; settings: Record<string, unknown> },
  ) =>
    void run(destination.id, () =>
      saveDestination({
        id: destination.id,
        type: destination.type,
        label: edit.label,
        connection: edit.connection,
        settings: edit.settings,
      }),
    );

  // Not `run()`, because a re-push has a RESULT and refreshing would throw it
  // away — the read that follows a save is what clears the reports.
  const replay = (destination: Destination) => {
    startOperation(destination.id);

    void (async () => {
      try {
        const report = await rePush(destination.id);

        setReports((current) => ({ ...current, [destination.id]: report }));
        setErrors((current) => cleared(current, destination.id));
      } catch (cause) {
        setErrors((current) => ({ ...current, [destination.id]: messageOf(cause) }));
      } finally {
        finishOperation(destination.id);
      }
    })();
  };

  /*
   * **A test does not refresh the screen, and that is the point.**
   *
   * It records nothing — not health, not a delivery-failure entry, not a
   * counter (ADR 0008) — so there is nothing new to read, and re-reading would
   * clear the one thing the merchant pressed the button for. It is the same
   * shape as `replay()` above for the same reason.
   */
  const probe = (destination: Destination, ask: (id: string) => Promise<TestReport>) => {
    startOperation(destination.id);

    void (async () => {
      try {
        const report = await ask(destination.id);

        setTests((current) => ({ ...current, [destination.id]: report }));
        setErrors((current) => cleared(current, destination.id));
      } catch (cause) {
        setErrors((current) => ({ ...current, [destination.id]: messageOf(cause) }));
      } finally {
        finishOperation(destination.id);
      }
    })();
  };

  if (payload.status === 'failed') {
    return (
      <Region label={__('Destinations', 'wconvert')}>
        <RegionErrorState
          message={payload.message}
          hint={__('Use Refresh to try again.', 'wconvert')}
        />
        <RegionFooter><Button variant="outline" disabled={refreshing} onClick={() => void refresh()}>{__('Refresh', 'wconvert')}</Button></RegionFooter>
      </Region>
    );
  }

  const data = payload.status === 'ready' ? payload.data : null;

  return (
    <div className="flex flex-col gap-5">
      <PageAction>
        <Button variant="outline" disabled={refreshing || dirty || busyIds.size > 0} onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" />{refreshing ? __('Refreshing…', 'wconvert') : __('Refresh', 'wconvert')}
        </Button>
        {mode === 'settings' && <Button disabled={data === null} onClick={(event) => {
          addTrigger.current = event.currentTarget;
          setShowTypes(true);
        }}>
          <Plus aria-hidden="true" />{__('Add a destination', 'wconvert')}
        </Button>}
      </PageAction>
      {mode === 'settings' ? <p className="m-0 text-note text-muted-foreground">{__('Choose where each Campaign sends its leads in the Campaign editor.', 'wconvert')} <a className="underline underline-offset-2" href={sendingIssuesHref()}>{__('Check sending issues', 'wconvert')}</a></p>
        : <p className="m-0 text-note text-muted-foreground">{__('Known destination problems and recent rejected pushes. This is not a delivery status for every submission.', 'wconvert')}</p>}
      {/*
        **One read draws every region below**, so a refresh that fails is the
        screen's failure rather than any one route's. It was a `RegionError`
        inside a `Region` holding nothing else — a card whose only content was
        a band with a bottom border, drawing a rule above nothing.
      */}
      {fetchError !== null && <PageError message={fetchError} />}
      {mode === 'settings' && data !== null && <>
        <Region>
          <RegionHeader title={__('Connected accounts', 'wconvert')} description={__('Accounts hold credentials. Destinations choose where submissions go.', 'wconvert')} />
          <RegionBody>
            {data.connections.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No remote accounts are configured. Local services such as MailPoet use this WordPress site and do not need a separate account connection.', 'wconvert')}</p>
              : <ul className="m-0 list-none divide-y divide-border p-0">{data.connections.map((connection) => <li key={connection.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div><strong className="block">{connection.label}</strong><span className="mt-1 block text-note text-muted-foreground">{data.types.find((type) => type.id === connection.type)?.label ?? connection.type} · {__('Credentials stored; connection not verified by this view.', 'wconvert')}</span></div>
                <div className="flex flex-col gap-1 text-note">{data.destinations.filter((destination) => destination.connection === connection.id).map((destination) => <a key={destination.id} className="text-primary underline" href={destinationHref(destination.id)}>{destination.label}</a>)}</div>
              </li>)}</ul>}
          </RegionBody>
        </Region>
        <div><h2 className="mb-1 mt-2 text-heading font-semibold">{__('Destinations', 'wconvert')}</h2><p className="m-0 text-note text-muted-foreground">{__('Reusable places to send submissions. Choose them inside each campaign.', 'wconvert')}</p></div>
      </>}
      {data !== null && destinationId !== undefined && !data.destinations.some((destination) => destination.id === destinationId) && (
        <Region><RegionHeader title={__('This destination is no longer available', 'wconvert')}
          description={__('It may have been removed. Other configured destinations are listed below.', 'wconvert')} />
          <RegionFooter><Button asChild variant="outline"><a href={destinationHref()}>{__('Show all destinations', 'wconvert')}</a></Button></RegionFooter>
        </Region>
      )}

      {/*
        **A settings card's shape, and it used to be a table's.** What is
        coming here is a stack of `Configured` cards — a name, an account
        picker, a run of fields — and this drew a three-column table, which
        this region does not contain in any state.
      */}
      {data === null ? (
        <RegionSkeleton label={__('Destinations', 'wconvert')} lines={3} />
      ) : (
        <>
          {data.destinations.length === 0 ? (
            <Region label={__('Destinations', 'wconvert')}>
              {/*
                The page's Add action opens setup. This sentence explains
                what is still true with no external destination configured:
                captures remain saved locally.
              */}
              <EmptyState icon={Plug} title={__('Leads are saved in WConvert only', 'wconvert')}>
                {__(
                  'Every capture is written to the lead log first and always. Add a destination to send it on as well.',
                  'wconvert',
                )}
              </EmptyState>
            </Region>
          ) : (
            data.destinations.filter((destination) => mode === 'settings' || destination.health.consecutive_failures > 0 || destination.health.skipped_captures > 0 || destination.availability !== 'ready' || data.failures.some((failure) => failure.destination === destination.id)).map((destination) => (
              <Configured
                key={destination.id}
                destination={destination}
                mode={mode}
                onDraftState={reportDraft}
                focusRequested={destinationId === destination.id}
                type={data.types.find((type) => type.id === destination.type)}
                connections={data.connections.filter(
                  (connection) => connection.type === destination.type,
                )}
                report={reports[destination.id] ?? null}
                test={tests[destination.id] ?? null}
                error={errors[destination.id] ?? null}
                busy={busyIds.has(destination.id)}
                onSave={save}
                onRemove={(trigger) => {
                  returnFocus.current = trigger;
                  setConfirming(destination);
                }}
                onRePush={(target) => {
                  returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  setReplaying(target);
                }}
                onTestConnection={(target) => probe(target, testConnection)}
                onTestSend={(target, trigger, settingsDirty) => {
                  returnFocus.current = trigger;
                  setSending({ destination: target, settingsDirty });
                }}
              />
            ))
          )}

          {mode === 'issues' && data.destinations.length > 0 && data.failures.length === 0 && data.destinations.every((destination) => destination.health.consecutive_failures === 0 && destination.health.skipped_captures === 0 && destination.availability === 'ready') && <Region><EmptyState icon={CircleCheck} title={__('No known sending issues', 'wconvert')}>{__('No current destination outages or recent rejected pushes are recorded. This does not confirm delivery for every submission.', 'wconvert')}</EmptyState></Region>}
          {mode === 'issues' && <Failures failures={data.failures} destinations={data.destinations} />}
        </>
      )}

      {/*
        One dialog holds both steps. Choosing a service never creates a route;
        only the completed form does, and failed saves preserve that draft.
      */}
      <AddDestinationDialog
        type={adding}
        choosing={showTypes}
        connections={data?.connections ?? []}
        busy={adding !== null && busyIds.has(adding.id)}
        error={adding === null ? null : (errors[adding.id] ?? null)}
        returnFocusTo={addTrigger}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null);
            setShowTypes(false);
          }
        }}
        onConfirm={(draft) => {
          if (adding !== null) {
            add(adding, draft);
          }
        }}
      >
        <Types types={data?.types ?? []} errors={errors} busyIds={busyIds} onAdd={(type) => {
          setAdding(type);
          setShowTypes(false);
        }} />
      </AddDestinationDialog>

      {sending !== null && <SendTestDialog destination={sending.destination}
        type={data?.types.find((type) => type.id === sending.destination.type)}
        initialEmail={data?.test_sample?.email ?? null} settingsDirty={sending.settingsDirty}
        returnFocusTo={returnFocus} onClose={() => setSending(null)}
        onSent={(report) => {
          setTests((current) => ({ ...current, [sending.destination.id]: report }));
        }} />}

      <ConfirmDialog
        open={replaying !== null}
        onOpenChange={(open) => { if (!open) setReplaying(null); }}
        title={__('Re-push stored submissions?', 'wconvert')}
        description={replaying === null ? '' : sprintf(__('This queues retained submissions for “%1$s” from Campaigns whose published configuration uses it, since %2$s. With no previous success, all retained matching submissions are included. It is not limited to the visible failures or search results, and can send an email again.', 'wconvert'), replaying.label, replaying.health.last_success_at ?? __('the beginning', 'wconvert'))}
        confirmLabel={__('Queue re-push', 'wconvert')}
        returnFocusTo={returnFocus}
        onConfirm={() => { if (replaying !== null) replay(replaying); setReplaying(null); }}
      />
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
  mode,
  onDraftState,
  focusRequested,
  type,
  connections,
  report,
  test,
  error,
  busy,
  onSave,
  onRemove,
  onRePush,
  onTestConnection,
  onTestSend,
}: {
  destination: Destination;
  mode: 'settings' | 'issues';
  onDraftState: (id: string, state: EditingState) => void;
  focusRequested: boolean;
  /**
   * The TYPE this route runs over, or undefined where this build no longer
   * ships it.
   *
   * **It used to be two derived props and it is the whole type now**, because
   * the card kept needing a third thing off it and answering by hand: the
   * header said *"A Pro feature"* in a literal string while five other sites
   * called `tierProductName()`, and *"What it needs is missing"* without ever
   * naming the plugin — while the settings list twenty lines away names it
   * correctly from `requires_label` on the same payload.
   */
  type: DestinationType | undefined;
  /** The Connections of this Destination's type, masked, for the account picker. */
  connections: readonly Connection[];
  report: RePushReport | null;
  /** What the last *Test* against THIS Destination answered. */
  test: TestReport | null;
  /** What the last save, remove or re-push against THIS Destination failed with. */
  error: string | null;
  busy: boolean;
  onSave: (
    destination: Destination,
    edit: { label: string; connection: string | null; settings: Record<string, unknown> },
  ) => void;
  onRemove: (trigger: HTMLElement | null) => void;
  onRePush: (destination: Destination) => void;
  onTestConnection: (destination: Destination) => void;
  onTestSend: (destination: Destination, trigger: HTMLElement, settingsDirty: boolean) => void;
}) {
  // Seeded once from what is stored. Keyed by field rather than held as one
  // string, because a type declares as many fields as it likes — the WSMS push
  // has one and the lead magnet email has three.
  // Every field its TYPE declares, in the order PHP returned them — copy
  // included — and an empty set where this build no longer ships the type.
  const schema = type?.settings_schema ?? {};
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(schema, destination.settings));
  /**
   * **The name is the merchant's, and it is editable here.**
   *
   * Two Destinations of one type over one Connection differ only in what they
   * point at, so the name is the only thing that tells them apart on the tab
   * where an Optin is bound. Until #89 nothing on this screen could send one:
   * *Add* posted the TYPE's label and Save posted whatever was already stored.
   *
   * Renaming needs no storage work and breaks no binding — an Optin holds
   * ULIDs ({@see OptinBinding}) and `Destination::$label` has always
   * round-tripped through `toArray()`.
   */
  const [label, setLabel] = useState(destination.label);
  const [connection, setConnection] = useState(destination.connection);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusRequested) return;
    setSettingsOpen(true);
    const heading = region.current?.querySelector<HTMLElement>('h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    region.current?.scrollIntoView?.({ block: 'start' });
  }, [focusRequested]);
  const TypeIcon = iconFor(type?.icon ?? 'plug');
  const failing = destination.health.consecutive_failures > 0;
  /*
   * Whether the two *Test* buttons can do anything. The region above already
   * says WHY when they cannot — a "Paused" badge and a sentence — so offering
   * a button that answers with that same sentence a round trip later is the
   * shape ADR 0042 rule 3 refuses.
   */
  const runnable = destination.availability === 'ready';
  const fields = Object.entries(schema);
  const originalDraft = toDraft(schema, destination.settings);
  const settingsDirty = label !== destination.label || connection !== destination.connection
    || Object.entries(draft).some(([key, value]) => value !== originalDraft[key]);
  useEffect(() => {
    onDraftState(destination.id, { dirty: settingsDirty, busy });
    return () => onDraftState(destination.id, { dirty: false, busy: false });
  }, [destination.id, settingsDirty, busy, onDraftState]);
  const lands = targetSaid(destination.target);
  const pushed = destination.health.last_success_at;
  /*
   * Whether the health body has anything in it at all. With the badge now
   * carrying "Not used yet" alone, a Destination nobody has pushed to — of a
   * type that selects nothing, so there is no target line either — would
   * otherwise draw an empty padded block under its own header.
   */
  const reporting =
    failing ||
    pushed !== null ||
    destination.health.skipped_captures > 0 ||
    report !== null ||
    test !== null;

  return (
    <div ref={region} data-destination-id={destination.id}><Region>
      {/*
        **The failure sits in the region that failed**, above the health it
        contradicts and under the label saying which Destination this is. A
        merchant whose Save just errored reads it beside the Save button
        (ADR 0039).
      */}
      {error !== null && <RegionError message={error} />}

      <RegionHeader
        icon={<TypeIcon />}
        title={destination.label}
        /*
          **`locked` and `unavailable` are two sentences, not one.** They were
          two here already — and the `locked` one named the product with a
          literal "Pro" while five other sites call `tierProductName()`, and
          the `unavailable` one named no plugin at all while the settings list
          on the same screen names it correctly from the same `requires_label`.
          Collapsing them is how a paying customer is shown an advertisement
          and a merchant is offered a licence we do not sell (ADR 0026).
        */
        description={
          destination.availability === 'locked'
            ? sprintf(
                /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
                __('A %s feature this install does not have, so captures are not being sent.', 'wconvert'),
                tierProductName(type?.tier),
              )
            : destination.availability === 'unavailable'
              ? sprintf(
                  /* translators: %s: the plugin or platform it needs, e.g. “WP SMS”. */
                  __('Needs %s on this site, so captures are not being sent.', 'wconvert'),
                  type?.requires_label ?? __('something this site does not have', 'wconvert'),
                )
              : lands ?? type?.label
        }
        /*
          **Amber is the site holding this back, and a price is not that**
          (ADR 0037). One badge for both absences said *paused* about an
          install that has simply not bought the tier — which is the same
          collapse as the sentence above, in colour.
        */
        trailing={
          failing ? (
            <Badge variant="destructive">{__('Failing', 'wconvert')}</Badge>
          ) : destination.availability === 'locked' ? (
            <Badge variant="secondary">
              <Lock aria-hidden="true" />
              {tierName(type?.tier)}
            </Badge>
          ) : destination.availability === 'unavailable' ? (
            <Badge variant="warning">{__('Paused', 'wconvert')}</Badge>
          ) : destination.health.last_success_at === null ? (
            <Badge variant="secondary">{__('Not used yet', 'wconvert')}</Badge>
          ) : (
            <Badge variant="success">{__('Success recorded', 'wconvert')}</Badge>
          )
        }
      />
      {reporting && (
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
            /*
              **Only where there IS a last success.** The badge above already
              says *"Not used yet"*, and a sentence under it saying "Nothing has
              been pushed here yet" is the same fact twice — the density rule
              ADR 0039 draws, and the second half of it: a screen that repeats
              itself teaches the merchant to stop reading it.
            */
            pushed !== null && (
              <p className="m-0 flex items-center gap-2 text-muted-foreground">
                <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                {sprintf(
                  /* translators: %s: a date and time. */
                  __('Last successful push: %s', 'wconvert'),
                  pushed,
                )}
              </p>
            )
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
              <AlertDescription>
                <p id={`wconvert-recovery-${destination.id}`}>{__('Re-push replays stored leads from Campaigns whose published configuration uses this destination, since its last success. It can send an email again.', 'wconvert')}</p>
                {!runnable && <p>{__('Restore the required plugin or plan before re-pushing.', 'wconvert')}</p>}
                <div className="mt-3"><Button variant="outline" size="sm" disabled={busy || !runnable}
                  aria-describedby={`wconvert-recovery-${destination.id}`} onClick={() => onRePush(destination)}>
                  <RotateCcw aria-hidden="true" />{__('Re-push leads since the last success', 'wconvert')}
                </Button></div>
              </AlertDescription>
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
          {/*
            **What the last test answered, under the buttons that asked.**

            Three renderings for three outcomes, because a Destination whose type
            this install cannot run has NOT failed — drawing that in red tells a
            merchant with no WP SMS that their WP SMS Destination is broken when
            the plugin is simply not installed (ADR 0026). The message is the
            provider's own words wherever it supplied any; React escapes on the
            way to the DOM, which is why nothing escapes it before here.
          */}
          {test !== null && (
            <Alert className={TEST_RENDERING[test.outcome].className}>
              {(() => {
                const Icon = TEST_RENDERING[test.outcome].icon;

                return <Icon />;
              })()}
              <AlertTitle className="line-clamp-none">{test.message}</AlertTitle>
            </Alert>
          )}
        </RegionBody>
      )}

      {/*
        **The fields are the schema, drawn in the order PHP returned them.**
        Both the copy and the CONTROL come from the type's `settingsSchema()`,
        which is what replaces WSMS's five `Supports*` capability interfaces: a
        Destination's fields are a schema rather than a capability, so there is
        one method and no matrix (#4). Before #31 this screen hard-coded the
        one field WSMS declares and read `type` nowhere, which meant the second
        type to declare a field would have rendered none of them.

        **The body itself is always drawn**, and the schema gate now sits on
        the fields alone. It used to gate the whole thing — a type with no
        schema got no form and no Save, because there was nothing to save. That
        stopped being true when the NAME became something a merchant chooses: a
        webhook declaring no settings is still a route that has to be
        renameable, and so is a Destination whose type this install cannot see
        and whose schema therefore arrives empty.
      */}
      <div hidden={mode !== 'settings' || !settingsOpen} className="wconvert-route-settings" id={`wconvert-settings-${destination.id}`}>
      <RegionBody className="flex flex-col gap-5 p-5">
        <div id={`wconvert-shared-${destination.id}`}>
          <DestinationUsageNotice usage={destination.usage} />
        </div>
        {settingsProblems(type?.requirements, fromDraft(schema, draft), schema).map((problem) =>
          <p key={problem} className="m-0 text-note text-warning">{problem}</p>)}
        <div className="flex max-w-xl flex-col gap-1.5">
          <Label htmlFor={`wconvert-${destination.id}-label`}>{__('Name', 'wconvert')}</Label>
          <Input
            id={`wconvert-${destination.id}-label`}
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Description>
            {__('Yours to choose. It is what you will pick from on a campaign.', 'wconvert')}
          </Description>
        </div>

        {/*
          **The account, where the type has one.** Nothing on this screen has
          ever set it: `connection` was read off the stored Destination and
          posted straight back, so a merchant with two accounts of one provider
          could not say which one a route ran over. Latent while every free
          type authenticates against nothing, and live with the first ESP (#35).
        */}
        {type?.needs_connection === true && (
          <div className="max-w-xl">
            <ConnectionPicker
              id={`wconvert-${destination.id}-connection`}
              connections={connections}
              value={connection}
              onChange={setConnection}
            />
          </div>
        )}

        {fields.map(([key, field]) => (
          <div key={key} className="flex max-w-xl flex-col gap-1.5">
            {/*
              A field drawn as a GROUP of controls is labelled by association
              rather than by `for`: `<label for>` naming a `div[role=group]`
              is inert, so the group points back at this element's id instead
              and the same words do the same job either way.
            */}
            <Label
              id={`wconvert-${destination.id}-${key}-label`}
              htmlFor={isGroup(field) ? undefined : `wconvert-${destination.id}-${key}`}
            >
              {field.label}{type?.requirements?.settings[key] ? __(' (required to send)', 'wconvert') : ''}
            </Label>
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={busy}
            aria-describedby={`wconvert-shared-${destination.id}`}
            onClick={() =>
              onSave(destination, {
                label,
                connection,
                settings: { ...destination.settings, ...fromDraft(schema, draft) },
              })
            }
          >
            {__('Save', 'wconvert')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => {
            setDraft(toDraft(schema, destination.settings));
            setLabel(destination.label);
            setConnection(destination.connection);
            setSettingsOpen(false);
            settingsTrigger.current?.focus();
          }}>{__('Cancel', 'wconvert')}</Button>
        </div>
      </RegionBody>

      </div>
      {/*
        **Re-push repairs and Remove destroys, and they are not the same
        weight.** Recovery stays visible for a failing route; otherwise it is
        available with Settings. Remove remains a quiet destructive control
        behind Settings and a confirm (ADR 0068).
      */}
      <RegionFooter className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'settings' ? <Button ref={settingsTrigger} variant="outline" size="sm" aria-expanded={settingsOpen} aria-controls={`wconvert-settings-${destination.id}`} onClick={() => setSettingsOpen(!settingsOpen)}>
            {__('Settings', 'wconvert')}<ChevronDown aria-hidden="true" className={settingsOpen ? 'rotate-180' : ''} />
          </Button> : <Button asChild variant="outline" size="sm"><a href={destinationHref(destination.id)}>{__('Fix sending setup', 'wconvert')}</a></Button>}
          {/*
            **Two verbs, and the order is the order a merchant needs them in.**

            *Test connection* answers whether the credentials are good, which is
            the question on a key just pasted. *Send a test* answers whether a
            push lands, which is the question when the connection is fine and
            the lead is not arriving. It really sends — the lead-magnet email
            delivers and a real subscriber appears — and it writes no lead,
            queues nothing and moves no counter (ADR 0008, ADR 0031).

            **Neither is offered where it would be refused** (ADR 0042). A type
            with no credentials has nothing to connect to, so there is no button
            rather than one whose only answer is "nothing to check" — which is
            every free type. And a Destination this install cannot run answers
            both with the sentence the region above is ALREADY showing, so
            pressing either is a round trip to read what is on screen. The
            server still guards both: what a screen offers and what a route
            allows are different jobs.
          */}
          {type?.needs_connection === true && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !runnable}
              onClick={() => onTestConnection(destination)}
            >
              <Plug aria-hidden="true" />
              {__('Test connection', 'wconvert')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !runnable}
            onClick={(event) => onTestSend(destination, event.currentTarget, settingsDirty)}
          >
            <Zap aria-hidden="true" />
            {__('Send a test', 'wconvert')}
          </Button>
          {(mode === 'issues' || settingsOpen || failing) && destination.health.skipped_captures === 0 && <Button variant="outline" size="sm" disabled={busy || !runnable} onClick={() => onRePush(destination)}>
            <RotateCcw aria-hidden="true" />
            {__('Re-push leads since the last success', 'wconvert')}
          </Button>}
        </div>
        {mode === 'settings' && settingsOpen && <Button
          ref={removeTrigger}
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(removeTrigger.current)}
        >
          <Trash2 aria-hidden="true" />
          {__('Remove', 'wconvert')}
        </Button>}
      </RegionFooter>
    </Region></div>
  );
}

/**
 * The types this install can reach.
 *
 * `unavailable` is explained and never sold: a merchant with no WP SMS is not
 * missing something we can sell them, and rendering that as an upsell is what
 * ADR 0026 exists to stop.
 *
 * The first step of the Add dialog keeps available services and their
 * requirements together, without making the merchant hunt below saved routes.
 */
function Types({
  types,
  errors,
  busyIds,
  onAdd,
}: {
  types: DestinationType[];
  /**
   * Every keyed failure on the screen. This region reads only the entries
   * keyed by a TYPE it draws — a Destination's id is a ULID and a type's is a
   * slug, so the two halves of the map cannot be mistaken for each other.
   */
  errors: Record<string, string>;
  /** The one Destination or type with a request in flight, if any. */
  busyIds: ReadonlySet<string>;
  onAdd: (type: DestinationType) => void;
}) {
  return (
    <Region>
      {types.map((type) =>
        errors[type.id] === undefined ? null : (
          <RegionError key={type.id} message={errors[type.id]} />
        ),
      )}

      {types.length === 0 ? (
        /*
          **{@see EmptyState} rather than a muted paragraph**, which is the
          treatment every other nothing-here on this screen already gets. No
          action, and that is the honest answer: a site with no Destination
          types has nothing to add and nowhere on this screen to go — what
          would fix it is installing a plugin, which is not a door this admin
          owns.
        */
        <EmptyState icon={Plug} title={__('No destination types here', 'wconvert')}>
          {__(
            'Nothing on this site offers somewhere to send a lead on to. Leads are still captured and exported.',
            'wconvert',
          )}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {types.map((type) => {
            const rendering = renderingFor(type.availability, 'settings_list');
            const TypeIcon = iconFor(type.icon);

            return (
              <li
                key={type.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <TypeIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />
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
                  /*
                    **A second one of the same type is the point, not a
                    mistake.** This was disabled once one Destination of the
                    type existed, which forbade the exact move the model
                    requires: a Destination is a named ROUTE — type,
                    credentials and target together — so *"newsletter signups
                    go to the Newsletter list, product announcements go to
                    Product updates"* is two MailPoet Destinations bound to
                    different Optins (CONTEXT.md, Destination). The PHP always
                    assumed it: `DestinationController::targetOf()` says in its
                    own words that two Mailchimp audiences are two Destinations
                    over one Connection.

                    What is left is `busyIds`, which is about this row having a
                    request in flight and nothing to do with how many exist.
                  */
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyIds.has(type.id)}
                    onClick={() => onAdd(type)}
                  >
                    {sprintf(/* translators: %s: service name, e.g. MailPoet. */ __('Set up %s', 'wconvert'), type.label)}
                  </Button>
                ) : rendering === 'upsell' ? (
                  <span className="text-muted-foreground">
                    {sprintf(
                      /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
                      __('Included with %s.', 'wconvert'),
                      tierProductName(type.tier),
                    )}
                  </span>
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
 * How each of the three test outcomes is drawn.
 *
 * **One map rather than two cascades**, because the palette and the icon were
 * the same three-way decision written twice and the pair that drifts is a
 * green tick over a red box. The decision itself is the one worth reading:
 * `skipped` is NEUTRAL, because a Destination whose type this install cannot
 * run has not failed — rendering it in red tells a merchant with no WP SMS
 * that their WP SMS Destination is broken when the plugin is simply not
 * installed (ADR 0026).
 */
const TEST_RENDERING: Record<TestReport['outcome'], { className: string; icon: LucideIcon }> = {
  success: { className: 'border-success/30 bg-success/5 text-success', icon: CircleCheck },
  skipped: { className: 'border-border bg-surface text-muted-foreground', icon: Info },
  failed: { className: 'border-destructive/30 bg-destructive/5 text-destructive', icon: CircleAlert },
};

/**
 * The terminal-failure ring.
 *
 * These are the Leads that will never land, and **health cannot see them** —
 * a malformed address is not an outage, so it leaves `consecutive_failures` at
 * zero. Without this list there would be nothing anywhere naming them
 * (ADR 0008).
 */
function Failures({ failures, destinations }: { failures: DestinationsPayload['failures']; destinations: readonly Destination[] }) {
  if (failures.length === 0) {
    return null;
  }

  return (
    <Region>
      <RegionHeader
        title={__('Leads that could not be delivered', 'wconvert')}
        description={__(
          'Individual rejected pushes, separate from destination outages. The latest 200 are kept; this is not a delivery history for every lead.',
          'wconvert',
        )}
      />
      <DataTable>
        <DataTableHead>
          <DataTableColumn>{__('When', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Destination', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Lead', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Why', 'wconvert')}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {failures.map((failure) => {
            const destination = destinations.find((route) => route.id === failure.destination);
            return <DataTableRow key={`${failure.destination}-${failure.lead}-${failure.at}`}>
              <DataTableCell label={__('When', 'wconvert')}>{failure.at}</DataTableCell>
              <DataTableCell label={__('Destination', 'wconvert')}>
                {destination ? <a className="font-medium underline underline-offset-2" href={destinationHref(destination.id)}>{destination.label}</a>
                  : <span>{__('Removed destination', 'wconvert')}<Code className="mt-1 block text-muted-foreground">{failure.destination}</Code></span>}
              </DataTableCell>
              <DataTableCell label={__('Lead', 'wconvert')}>
                <a className="font-medium underline underline-offset-2" href={leadsHref({ leadId: failure.lead })}
                  aria-label={sprintf(__('View capture %s', 'wconvert'), failure.lead)}>{__('View capture', 'wconvert')}</a>
                <Code className="mt-1 block text-muted-foreground">{failure.lead}</Code>
              </DataTableCell>
              <DataTableCell label={__('Why', 'wconvert')}>
                {failure.error}
              </DataTableCell>
            </DataTableRow>;
          })}
        </DataTableBody>
      </DataTable>
    </Region>
  );
}
