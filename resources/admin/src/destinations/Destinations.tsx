import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { DestinationUsageNotice } from './DestinationUsageNotice';
import { missingSettings, settingsProblems } from './requirements';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Info,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { ProviderMark } from './ProviderMark';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AddDestinationDialog } from './AddDestinationDialog';
import { AccountEditor } from './AccountEditor';
import { SendTestDialog } from './SendTestDialog';
import { connectionMissing, destinationStatus, sendRefusal, setupProblems, TestReportAlert } from './status';
import { destinationHref, leadsHref, sendingIssuesHref } from '../nav';
import { useSettingsEditing, type SettingsEditing } from '../settings-page/useSettingsEditing';
import type { EditingState } from '../hooks/useAdminNavigation';
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
import { Disclosure } from '../shell/Disclosure';
import { EmptyState } from '../shell/EmptyState';
import { Field } from '../shell/Field';
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
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { formatCount, formatWhen } from '../lib/format';
import {
  deleteDestination,
  readDestinations,
  readSelectedSchema,
  readRecentAttempts,
  rePush,
  saveDestination,
  testConnection,
  type Connection,
  type Destination,
  type DestinationType,
  type DestinationsPayload,
  type RePushReport,
  type RecentAttempt,
  type TestReport,
} from './api';
import {
  ConnectionPicker,
  SettingsControl,
  fromDraft,
  isGroup,
  settingLabel,
  targetSaid,
  toDraft,
} from './settings';
import { issueCount } from './issueCount';

/**
 * **Where a merchant finds out whether sending is working.**
 *
 * That is the screen's whole reason to exist. A merchant whose integration
 * broke three days ago has no other way to notice: the [[Lead]]s are in the
 * log, the [[Optin]] is still converting, and nothing else anywhere says the
 * sends stopped.
 *
 * **What it shows is per-[[Destination]] health and a bounded ring of terminal
 * failures — never a per-Lead delivery column.** There is no such column and
 * there is not going to be one: `push()` is idempotent, so per-Lead delivery
 * state buys efficiency rather than correctness, and health plus a send-again
 * action answers the actual support case (ADR 0008).
 *
 * The two failure displays are not redundant. `consecutive_failures` counts
 * OUTAGES; a Lead rejected for its own sake — a malformed address — leaves it
 * at zero and lands in the ring instead. Showing only one of them would hide
 * exactly one of the two things that go wrong.
 *
 * ============================================================================
 * HEALTH FIRST, SETUP UNDER IT (ADR 0039).
 * ============================================================================
 * Nobody opens this page wanting a fifth Destination; they open it because
 * something did not arrive. So a configured Destination is a region of its own
 * — one concern, its own edge — whose status badge and one issue sentence lead,
 * with its settings folded under them and every other action behind ⋯, the
 * same card grammar as the campaign editor's `DestinationCard` (ADR 0131).
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
   * **Per row, not per screen, and saying WHAT is in flight.** One boolean
   * was handed to every Configured region, so saving one Destination disabled
   * every control on the screen for the length of that one request. Same
   * shape, and the same reason, as {@see OptinList}. The kind is what lets the
   * card say "Testing the connection…" rather than just going grey.
   */
  const [busyIds, setBusyIds] = useState<ReadonlyMap<string, Busy>>(() => new Map());
  const startOperation = (id: string, kind: Busy) => setBusyIds((held) => new Map([...held, [id, kind]]));
  const finishOperation = (id: string) => setBusyIds((held) => new Map([...held].filter(([pending]) => pending !== id)));
  /*
   * Keyed by Destination, not screen-wide. A send-again report is a fact
   * about ONE Destination, and the shipped version rendered it after every row
   * and never cleared it — so a merchant who replayed one integration read the
   * result under all of them, for the rest of the session (ADR 0039).
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
   * The type being added, which is also whether the Add dialog is past its
   * first step.
   *
   * **Adding is a step now rather than a click.** A [[Destination]] is a named
   * route, and the three things that make one — the name, the account and what
   * inside it the route points at — are asked before it exists (#89). Held
   * here because the dialog needs the payload's `connections`, and because the
   * failure it may produce is already keyed here by the type's id.
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
       * how many submissions were queued a moment ago, and after this read the
       * health sitting beside it has moved on while the sentence has not.
       * `setReports` only ever ADDS, so without this the merchant who sent
       * again once read that count under the same Destination for the rest of
       * the session — including after later refreshes made it wrong.
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

  /** Whether the action worked, so a Save can say "Saved just now" beside itself. */
  const run = async (id: string, kind: Busy, action: () => Promise<unknown>): Promise<boolean> => {
    startOperation(id, kind);

    try {
      await action();
      setErrors((current) => cleared(current, id));
      await refresh();
      return true;
    } catch (cause) {
      setErrors((current) => ({ ...current, [id]: messageOf(cause) }));
      return false;
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
    void run(type.id, 'adding', async () => {
      await saveDestination({
        type: type.id,
        label: draft.label,
        connection: draft.connection,
        settings: draft.settings,
      });

      setAdding(null);
      setShowTypes(false);
    });

  const remove = (destination: Destination) =>
    void run(destination.id, 'removing', () => deleteDestination(destination.id));

  const save = (
    destination: Destination,
    edit: { label: string; connection: string | null; settings: Record<string, unknown> },
  ) =>
    run(destination.id, 'saving', () =>
      saveDestination({
        id: destination.id,
        type: destination.type,
        label: edit.label,
        connection: edit.connection,
        settings: edit.settings,
      }),
    );

  // Not `run()`, because sending again has a RESULT and refreshing would
  // throw it away — the read that follows a save is what clears the reports.
  const replay = (destination: Destination) => {
    startOperation(destination.id, 'replaying');

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
  const probe = (destination: Destination) => {
    startOperation(destination.id, 'testing');

    void (async () => {
      try {
        const report = await testConnection(destination.id);

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
        <RegionErrorState message={payload.message} onRetry={() => void refresh()} />
      </Region>
    );
  }

  const data = payload.status === 'ready' ? payload.data : null;
  // A site whose every type runs without an account has nothing to connect,
  // so the region is not drawn at all rather than drawn empty.
  const accounts = data !== null
    && (data.connections.length > 0 || data.types.some((type) => type.needs_connection && type.availability === 'ready'));

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
      {mode === 'issues' && <p className="m-0 text-note text-muted-foreground">
        {__('Destinations with a problem, and submissions rejected recently. Not a record of every send.', 'wconvert')}
      </p>}
      {/*
        **One read draws every region below**, so a refresh that fails is the
        screen's failure rather than any one route's.
      */}
      {fetchError !== null && <PageError message={fetchError} onRetry={() => void refresh()} />}
      {mode === 'settings' && accounts && (
        <Region>
          <RegionHeader title={__('Connected accounts', 'wconvert')} description={__('Accounts hold credentials. Destinations choose where submissions go.', 'wconvert')} />
          <RegionBody className="flex flex-col gap-3">
            <AccountEditor types={data.types} connections={data.connections} usage={Object.fromEntries(data.connections.map((account) => [account.id, data.destinations.filter((destination) => destination.connection === account.id).map((destination) => destination.label)]))} onChange={refresh} />
          </RegionBody>
        </Region>
      )}
      {mode === 'settings' && data !== null && <div>
        <h2 className="m-0 text-heading font-semibold">{__('Destinations', 'wconvert')}</h2>
        <Description className="mt-1">
          {__('Reusable places to send submissions. Each campaign picks its own in the Destinations tab.', 'wconvert')}{' '}
          <a className="underline underline-offset-2" href={sendingIssuesHref()}>{__('Check sending issues', 'wconvert')}</a>
        </Description>
      </div>}
      {data !== null && destinationId !== undefined && !data.destinations.some((destination) => destination.id === destinationId) && (
        <Region><RegionHeader title={__('This destination is no longer available', 'wconvert')}
          description={__('It may have been removed. Other destinations are listed below.', 'wconvert')} />
          <RegionFooter><Button asChild variant="outline"><a href={destinationHref()}>{__('Show all destinations', 'wconvert')}</a></Button></RegionFooter>
        </Region>
      )}

      {/*
        **A settings card's shape, and it used to be a table's.** What is
        coming here is a stack of `Configured` cards, and this drew a
        three-column table, which this region does not contain in any state.
      */}
      {data === null ? (
        <RegionSkeleton label={__('Destinations', 'wconvert')} lines={3} />
      ) : (
        <>
          {data.destinations.length === 0 ? (
            <Region label={__('Destinations', 'wconvert')}>
              {/*
                The page's Add action opens setup. This says what is still
                true with nothing configured — the local mode's own name.
              */}
              <EmptyState icon={Plug} title={__('Leads are kept in WConvert only', 'wconvert')}>
                {__('Add a destination to also send them to an email list or another service.', 'wconvert')}
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
                busy={busyIds.get(destination.id) ?? null}
                onSave={save}
                onRemove={(trigger) => {
                  returnFocus.current = trigger;
                  setConfirming(destination);
                }}
                onRePush={(trigger) => {
                  returnFocus.current = trigger;
                  setReplaying(destination);
                }}
                onTestConnection={() => probe(destination)}
                onTestSend={(trigger, settingsDirty) => {
                  returnFocus.current = trigger;
                  setSending({ destination, settingsDirty });
                }}
              />
            ))
          )}

          {mode === 'issues' && data.destinations.length > 0 && data.failures.length === 0 && data.destinations.every((destination) => destination.health.consecutive_failures === 0 && destination.health.skipped_captures === 0 && destination.availability === 'ready') && <Region><EmptyState icon={CircleCheck} title={__('No known sending issues', 'wconvert')}>{__('No destination is failing, and nothing was rejected recently.', 'wconvert')}</EmptyState></Region>}
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
        types={data?.types ?? []}
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
        onChoose={setAdding}
        onBack={() => setAdding(null)}
        onConfirm={(draft) => {
          if (adding !== null) {
            add(adding, draft);
          }
        }}
        onConnectionSaved={(account) => {
          setPayload((current) => current.status === 'ready'
            ? ready({ ...current.data, connections: [...current.data.connections.filter((existing) => existing.id !== account.id), account] }) : current);
          void refresh();
        }}
      />

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
        title={__('Send stored submissions again?', 'wconvert')}
        description={replaying === null ? '' : replaying.health.last_success_at
          ? sprintf(
              /* translators: 1: a destination's name. 2: a date and time. */
              __('Submissions for “%1$s” since its last success on %2$s are queued again, from campaigns whose published version uses it. Some may arrive twice, including emails.', 'wconvert'),
              replaying.label,
              formatWhen(replaying.health.last_success_at, 'detail'),
            )
          : sprintf(
              /* translators: %s: a destination's name. */
              __('Every stored submission for “%s” is queued again, from campaigns whose published version uses it. Some may arrive twice, including emails.', 'wconvert'),
              replaying.label,
            )}
        confirmLabel={__('Send again', 'wconvert')}
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
        variant="destructive"
        title={__('Remove this destination?', 'wconvert')}
        description={
          confirming === null
            ? ''
            : sprintf(
                /* translators: %s: the name of a Destination. */
                __('Campaigns stop sending to “%s”. Leads already in WConvert stay, and so does anything it already received.', 'wconvert'),
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

/** What one Destination has in flight — the card says which, not just "busy". */
type Busy = 'adding' | 'saving' | 'removing' | 'testing' | 'replaying';

const BUSY_SAID: Partial<Record<Busy, () => string>> = {
  removing: () => __('Removing…', 'wconvert'),
  testing: () => __('Testing the connection…', 'wconvert'),
  replaying: () => __('Queuing submissions to send again…', 'wconvert'),
};

const OUTCOMES: Record<RecentAttempt['outcome'], () => string> = {
  accepted: () => __('Accepted', 'wconvert'),
  retry_scheduled: () => __('Will retry', 'wconvert'),
  needs_attention: () => __('Needs attention', 'wconvert'),
  skipped: () => __('Skipped', 'wconvert'),
  queued: () => __('Queued', 'wconvert'),
  running: () => __('Sending', 'wconvert'),
  unknown: () => __('Unknown', 'wconvert'),
};

/**
 * One configured Destination: whether it is working, what it is set to, and
 * what to do about it.
 *
 * **The card reads like the campaign editor's.** The status badge and ⋯ sit
 * on the title line; under them, at most one issue sentence from
 * {@see destinationStatus} — the same words the editor shows, never a local
 * copy — carrying the action that fixes it. Tests, Send again and Remove are
 * in ⋯ with icons, and a refused one stays in the menu with its reason rather
 * than going grey (§14). Settings fold under the card with the one
 * collapsible (§21).
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
   * ships it. The whole type rather than derived props, because the card keeps
   * needing another thing off it — the tier for `tierProductName()`, the
   * plugin's `requires_label` — and answering by hand is how a literal "Pro"
   * and an unnamed plugin crept in before.
   */
  type: DestinationType | undefined;
  /** The Connections of this Destination's type, masked, for the account picker. */
  connections: readonly Connection[];
  report: RePushReport | null;
  /** What the last *Test* against THIS Destination answered. */
  test: TestReport | null;
  /** What the last save, remove or send-again against THIS Destination failed with. */
  error: string | null;
  /** What is in flight for THIS Destination, or null. */
  busy: Busy | null;
  onSave: (
    destination: Destination,
    edit: { label: string; connection: string | null; settings: Record<string, unknown> },
  ) => Promise<boolean>;
  onRemove: (trigger: HTMLElement | null) => void;
  onRePush: (trigger: HTMLElement | null) => void;
  onTestConnection: () => void;
  onTestSend: (trigger: HTMLElement | null, settingsDirty: boolean) => void;
}) {
  const id = useId();
  // Every field its TYPE declares, in the order PHP returned them — copy
  // included — and an empty set where this build no longer ships the type.
  const [schema, setSchema] = useState(type?.settings_schema ?? {});
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [refreshSchema, setRefreshSchema] = useState(0);
  // Seeded once from what is stored. Keyed by field rather than held as one
  // string, because a type declares as many fields as it likes — the WSMS
  // send has one and the lead magnet email has three.
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(schema, destination.settings));
  /**
   * **The name is the merchant's, and it is editable here.**
   *
   * Two Destinations of one type over one Connection differ only in what they
   * point at, so the name is the only thing that tells them apart on the tab
   * where an Optin is bound. Renaming needs no storage work and breaks no
   * binding — an Optin holds ULIDs ({@see OptinBinding}).
   */
  const [label, setLabel] = useState(destination.label);
  const [connection, setConnection] = useState(destination.connection);
  const saved = useSaveStatus();
  useEffect(() => {
    if (type?.needs_connection !== true || connection === null) {
      setSchema(type?.settings_schema ?? {});
      return;
    }
    let active = true;
    setLoadingSchema(true);
    setMetadataError(null);
    void readSelectedSchema(type.id, connection, refreshSchema > 0).then((result) => {
      if (!active) return;
      setSchema(result.settings_schema);
      setDraft(toDraft(result.settings_schema, destination.settings));
    }).catch(() => {
      if (active) setMetadataError(__('Could not load this account’s choices. Check the account and try again.', 'wconvert'));
    }).finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, [type?.id, type?.needs_connection, type?.settings_schema, connection, destination.settings, refreshSchema]);
  const menu = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<Loadable<readonly RecentAttempt[]> | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const settingsSummary = () => region.current?.querySelector<HTMLElement>('.wconvert-route-settings > summary') ?? null;
  useEffect(() => {
    if (!focusRequested) return;
    setSettingsOpen(true);
    const heading = region.current?.querySelector<HTMLElement>('h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    region.current?.scrollIntoView?.({ block: 'start' });
  }, [focusRequested]);
  const problems = setupProblems(destination, type, connections);
  const status = destinationStatus(destination, type, problems);
  const running = destination.availability === 'ready';
  const fields = Object.entries(schema);
  const originalDraft = toDraft(schema, destination.settings);
  const settingsDirty = label !== destination.label || connection !== destination.connection
    || Object.entries(draft).some(([key, value]) => value !== originalDraft[key]);
  useEffect(() => {
    onDraftState(destination.id, { dirty: settingsDirty, busy: busy !== null });
    return () => onDraftState(destination.id, { dirty: false, busy: false });
  }, [destination.id, settingsDirty, busy, onDraftState]);
  const lands = targetSaid(destination.target);
  const sent = destination.health.last_success_at;

  /*
   * **Refusals, said before the click** (ADR 0042, §14). A test of a route
   * this install cannot run answers with the sentence the card already shows,
   * so the item says why instead of costing a round trip to read it.
   */
  const testRefusal = sendRefusal(destination, problems);
  const connectionRefusal = !running ? __('Not running on this site.', 'wconvert')
    : connectionMissing(destination, type, connections) ? __('Choose an account first.', 'wconvert') : null;
  const replayRefusal = running ? null : __('Not running on this site.', 'wconvert');

  const loadRecent = async () => {
    setRecent(LOADING);
    try {
      const result = await readRecentAttempts(destination.id);
      setRecent(ready(result.attempts));
    } catch (cause) {
      setRecent(failed(cause));
    }
  };

  /** Opens the settings at the field that is missing — where "Finish setup" was pressed. */
  const finishSetup = () => {
    setSettingsOpen(true);
    const key = connectionMissing(destination, type, connections) ? 'connection'
      : missingSettings(destination.requirements ?? type?.requirements, destination.settings)[0];
    requestAnimationFrame(() => {
      const field = key === undefined ? null : document.getElementById(`${id}-${key}`);
      const control = field?.matches('input, select, textarea') ? field
        : field?.querySelector<HTMLElement>('input, select, textarea')
          ?? region.current?.querySelector<HTMLElement>('.wconvert-route-settings input');
      control?.focus();
    });
  };

  const edited = () => saved.clear();

  /*
   * The issue sentence, once, with the door that fixes it. Amber is the site
   * holding this route back and grey is a tier this install has not got —
   * a price is not a fault (ADR 0037).
   */
  const issue = status.issue === null ? null : (
    <Alert role="status" className={status.state === 'failing' ? 'border-destructive/30 bg-destructive-surface text-destructive'
      : status.state === 'paused' || status.state === 'needs_setup' ? 'border-warning/30 bg-warning-surface text-warning'
      : 'border-border bg-surface text-muted-foreground'}>
      {status.state === 'failing' ? <CircleAlert /> : status.state === 'paused' || status.state === 'needs_setup' ? <TriangleAlert /> : <Info />}
      <AlertTitle className="line-clamp-none [overflow-wrap:anywhere]">{status.issue}</AlertTitle>
      {status.state === 'failing' && destination.health.skipped_captures === 0 && <AlertDescription>
        <Button variant="outline" className="mt-2" onClick={(event) => onRePush(event.currentTarget)}>
          <RotateCcw aria-hidden="true" />{__('Send again', 'wconvert')}
        </Button>
      </AlertDescription>}
      {status.state === 'needs_setup' && mode === 'settings' && <AlertDescription>
        <Button variant="outline" className="mt-2" onClick={finishSetup}>{__('Finish setup', 'wconvert')}</Button>
      </AlertDescription>}
    </Alert>
  );

  const busySaid = busy === null ? undefined : BUSY_SAID[busy]?.();
  const health = busySaid !== undefined || issue !== null || (status.issue === null && sent !== null)
    || destination.health.skipped_captures > 0 || report !== null || test !== null;

  return (
    <div ref={region} data-destination-id={destination.id}><Region>
      {/*
        **The failure sits in the region that failed**, above the health it
        contradicts and under the label saying which Destination this is.
      */}
      {error !== null && <RegionError message={error} />}

      <RegionHeader
        icon={<ProviderMark type={type} />}
        title={destination.label}
        // Where it lands, or the service where it selects nothing. Why it
        // cannot send is the issue sentence below, never repeated here.
        description={lands ?? type?.label}
        trailing={<div className="flex items-center gap-2">
          {status.badge}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button ref={menu} variant="ghost" size="icon" disabled={busy !== null}
                aria-label={sprintf(/* translators: %s: a destination's name. */ __('Actions for %s', 'wconvert'), destination.label)}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5}>
              {/*
                **Two verbs, in the order a merchant needs them.** *Test
                connection* answers whether the credentials are good; *Send a
                test* whether a send lands. It really sends — and writes no
                lead, queues nothing and moves no counter (ADR 0008, ADR
                0031). A type with no credentials has nothing to connect to,
                so there is no item rather than one whose only answer is
                "nothing to check".

                **`aria-disabled`, not `disabled`**: Radix skips a disabled
                item in keyboard navigation, which hides the reason with it.
              */}
              {type?.needs_connection === true && (
                <RefusableItem icon={<Plug aria-hidden="true" />} label={__('Test connection', 'wconvert')}
                  refusal={connectionRefusal} reasonId={`${id}-connection`} onSelect={onTestConnection} />
              )}
              <RefusableItem icon={<Send aria-hidden="true" />} label={__('Send a test', 'wconvert')}
                refusal={testRefusal} reasonId={`${id}-test`} onSelect={() => onTestSend(menu.current, settingsDirty)} />
              <RefusableItem icon={<RotateCcw aria-hidden="true" />} label={__('Send stored submissions again', 'wconvert')}
                refusal={replayRefusal} reasonId={`${id}-replay`} onSelect={() => onRePush(menu.current)} />
              {mode === 'settings' && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(menu.current)}>
                  <Trash2 aria-hidden="true" />{__('Remove', 'wconvert')}
                </DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>}
      />
      {health && (
        <RegionBody className="flex flex-col gap-3">
          {busySaid !== undefined && <p role="status" className="m-0 text-note text-muted-foreground">{busySaid}</p>}
          {issue}
          {/*
            **Only where there IS a last success.** The badge already says
            *"Not used yet"*, and a sentence repeating it teaches the merchant
            to stop reading (ADR 0039).
          */}
          {status.issue === null && sent !== null && (
            <p className="m-0 flex items-center gap-2 text-muted-foreground">
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
              {sprintf(/* translators: %s: a date and time. */ __('Last sent %s', 'wconvert'), formatWhen(sent, 'list'))}
            </p>
          )}

          {destination.health.skipped_captures > 0 && (
            <Alert role="status" className="border-warning/30 bg-warning-surface text-warning">
              <TriangleAlert />
              <AlertTitle className="line-clamp-none">
                {sprintf(
                  /* translators: 1: number of submissions, 2: a date and time. */
                  _n(
                    '%1$s submission wasn’t sent, most recently %2$s.',
                    '%1$s submissions weren’t sent, most recently %2$s.',
                    destination.health.skipped_captures,
                    'wconvert',
                  ),
                  formatCount(destination.health.skipped_captures),
                  formatWhen(destination.health.last_skipped_at, 'list'),
                )}
              </AlertTitle>
              <AlertDescription>
                <p id={`${id}-recovery`}>{__('Once this destination can send, send them again. Submissions since its last success are queued; some may arrive twice, including emails.', 'wconvert')}</p>
                <div className="mt-2 flex flex-col items-start gap-1">
                  <Button variant="outline" aria-disabled={replayRefusal === null ? undefined : true}
                    aria-describedby={replayRefusal === null ? `${id}-recovery` : `${id}-recovery ${id}-recovery-refused`}
                    disabled={busy !== null}
                    onClick={(event) => { if (replayRefusal === null) onRePush(event.currentTarget); }}>
                    <RotateCcw aria-hidden="true" />{__('Send again', 'wconvert')}
                  </Button>
                  {replayRefusal !== null && <p id={`${id}-recovery-refused`} className="m-0 text-note">{replayRefusal}</p>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/*
            **The report is this Destination's and it is rendered here**, under
            the card that produced it, rather than once at the bottom of a
            screen holding four of them.
          */}
          {report !== null && (
            <Alert role="status" className={report.capped
              ? 'border-warning/30 bg-warning-surface text-warning'
              : 'border-success/30 bg-success-surface text-success'}>
              <RotateCcw />
              <AlertTitle className="line-clamp-none">
                {sprintf(
                  /* translators: %s: number of submissions. */
                  _n('%s submission queued to send again.', '%s submissions queued to send again.', report.jobs, 'wconvert'),
                  formatCount(report.jobs),
                )}
              </AlertTitle>
              <AlertDescription>
                <p>{__('Each is sent with its original details. No new leads are created.', 'wconvert')}</p>
                {report.capped && <p>{__('That is the limit for one run. Send again once these have gone through.', 'wconvert')}</p>}
                {(report.needs_review ?? 0) > 0 && <p>{sprintf(
                  /* translators: %s: number of submissions. */
                  _n(
                    '%s older submission was left out because this destination’s account, list or settings have changed since.',
                    '%s older submissions were left out because this destination’s account, list or settings have changed since.',
                    report.needs_review ?? 0,
                    'wconvert',
                  ),
                  formatCount(report.needs_review ?? 0),
                )}</p>}
              </AlertDescription>
            </Alert>
          )}
          {test !== null && <TestReportAlert report={test} />}
        </RegionBody>
      )}

      <div className="border-t border-border px-4">
        <Disclosure variant="inline" title={__('Recent sends', 'wconvert')} open={recentOpen}
          bodyClassName="pb-3"
          onToggle={(open) => {
            setRecentOpen(open);
            if (open && (recent === null || recent.status === 'failed')) void loadRecent();
          }}>
          {recent === null || recent.status === 'loading'
            ? <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading recent sends…', 'wconvert')}</p>
            : recent.status === 'failed'
              ? <PageError message={recent.message} onRetry={() => void loadRecent()} />
              : recent.data.length === 0
                ? <p className="m-0 text-note text-muted-foreground">{__('No recent sends on record.', 'wconvert')}</p>
                : <ul className="m-0 list-none divide-y divide-border p-0">{recent.data.map((attempt) => (
                  <li key={attempt.id} className="flex flex-wrap justify-between gap-x-4 py-2 text-note">
                    <span className="font-medium">{(OUTCOMES[attempt.outcome] ?? OUTCOMES.unknown)()}</span>
                    <span className="text-muted-foreground">{formatWhen(attempt.at, 'list')}</span>
                  </li>
                ))}</ul>}
        </Disclosure>
      </div>

      {/*
        **The fields are the schema, drawn in the order PHP returned them.**
        Both the copy and the CONTROL come from the type's `settingsSchema()`,
        which is what replaces WSMS's five `Supports*` capability interfaces: a
        Destination's fields are a schema rather than a capability (#4).

        **The body is always drawn**, and the schema gate sits on the fields
        alone: a webhook declaring no settings is still a route that has to be
        renameable, and so is a Destination whose type this install cannot see.
      */}
      {mode === 'settings' && <div className="border-t border-border px-4">
        <Disclosure variant="inline" className="wconvert-route-settings" title={__('Settings', 'wconvert')}
          open={settingsOpen} onToggle={setSettingsOpen} bodyClassName="pb-4">
          <div className="flex max-w-xl flex-col gap-5">
            <div id={`${id}-shared`}>
              <DestinationUsageNotice usage={destination.usage} />
            </div>
            <Field label={__('Name', 'wconvert')} htmlFor={`${id}-label`} hintId={`${id}-label-hint`}
              hint={__('What you’ll pick in a campaign’s Destinations tab.', 'wconvert')}>
              <Input
                id={`${id}-label`}
                type="text"
                value={label}
                aria-describedby={`${id}-label-hint`}
                onChange={(event) => { setLabel(event.target.value); edited(); }}
              />
            </Field>

            {/*
              **The account, where the type has one** — so a merchant with two
              accounts of one provider can say which one a route runs over.
            */}
            {type?.needs_connection === true && (
              <div className="flex flex-col items-start gap-1.5">
                <div className="w-full">
                  <ConnectionPicker
                    id={`${id}-connection`}
                    connections={connections}
                    value={connection}
                    onChange={(value) => { setConnection(value); edited(); }}
                  />
                </div>
                {connection !== null && <Button type="button" variant="link" className="h-auto p-0" disabled={loadingSchema}
                  onClick={() => setRefreshSchema((old) => old + 1)}>
                  {loadingSchema ? __('Refreshing choices…', 'wconvert') : __('Refresh choices', 'wconvert')}
                </Button>}
              </div>
            )}

            {loadingSchema && <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading this account’s choices…', 'wconvert')}</p>}
            {metadataError && <PageError message={metadataError} onRetry={() => setRefreshSchema((old) => old + 1)} />}

            {fields.map(([key, field]) => (
              <div key={key} className="flex min-w-0 flex-col gap-1.5">
                {/*
                  A field drawn as a GROUP of controls is labelled by association
                  rather than by `for`: `<label for>` naming a `div[role=group]`
                  is inert, so the group points back at this element's id.
                */}
                <Label
                  id={`${id}-${key}-label`}
                  htmlFor={isGroup(field) ? undefined : `${id}-${key}`}
                >
                  {settingLabel(field.label, type?.requirements?.settings[key] !== undefined)}
                </Label>
                <SettingsControl
                  id={`${id}-${key}`}
                  field={field}
                  value={draft[key] ?? ''}
                  onChange={(value) => { setDraft({ ...draft, [key]: value }); edited(); }}
                />
                {field.description !== undefined && (
                  <Description>{field.description}</Description>
                )}
              </div>
            ))}

            {/*
              What the unsaved draft still lacks. Only once edited: until then
              the card's issue sentence above already says it.
            */}
            {settingsDirty && (() => {
              const draftProblems = settingsProblems(type?.requirements, fromDraft(schema, draft), schema);
              return draftProblems.length > 0 && <ul className="m-0 flex list-none flex-col gap-1 p-0 text-note text-warning">
                {draftProblems.map((problem) => <li key={problem}>{problem}</li>)}
              </ul>;
            })()}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={busy === 'saving'} onClick={() => {
                setDraft(toDraft(schema, destination.settings));
                setLabel(destination.label);
                setConnection(destination.connection);
                setSettingsOpen(false);
                settingsSummary()?.focus();
              }}>{__('Cancel', 'wconvert')}</Button>
              <Button
                disabled={busy !== null || loadingSchema || metadataError !== null || (type?.needs_connection === true && connection === null)}
                aria-describedby={`${id}-shared`}
                onClick={() => {
                  void onSave(destination, {
                    label,
                    connection,
                    settings: { ...destination.settings, ...fromDraft(schema, draft) },
                  }).then((worked) => { if (worked) saved.markSaved(); });
                }}
              >
                {busy === 'saving' ? __('Saving…', 'wconvert') : __('Save', 'wconvert')}
              </Button>
              <SaveStatus saved={saved.saved} />
            </div>
          </div>
        </Disclosure>
      </div>}

      {mode === 'issues' && <RegionFooter>
        <Button asChild variant="outline"><a href={destinationHref(destination.id)}>{__('Fix sending setup', 'wconvert')}</a></Button>
      </RegionFooter>}
    </Region></div>
  );
}

/**
 * A ⋯ item that may be refused. Refused, it stays reachable and says why
 * under its label (`aria-disabled` + `aria-describedby`), because a disabled
 * Radix item is skipped by the keyboard and takes its reason with it (§14).
 */
function RefusableItem({ icon, label, refusal, reasonId, onSelect }: {
  icon: ReactNode;
  label: string;
  refusal: string | null;
  reasonId: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem aria-disabled={refusal === null ? undefined : true} aria-describedby={refusal === null ? undefined : reasonId}
      className={refusal === null ? undefined : 'text-muted-foreground'}
      onSelect={(event) => { if (refusal !== null) { event.preventDefault(); return; } onSelect(); }}>
      {icon}
      <span className="flex flex-col">
        {label}
        {refusal !== null && <span id={reasonId} className="text-note">{refusal}</span>}
      </span>
    </DropdownMenuItem>
  );
}

const FAILURES_PER_PAGE = 25;

/**
 * The terminal-failure ring.
 *
 * These are the submissions that will never land, and **health cannot see
 * them** — a malformed address is not an outage, so it leaves
 * `consecutive_failures` at zero. Without this list there would be nothing
 * anywhere naming them (ADR 0008). The ring keeps 200, so it pages rather
 * than drawing all of them at once, and the pager sits outside the table.
 */
function Failures({ failures, destinations }: { failures: DestinationsPayload['failures']; destinations: readonly Destination[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(failures.length / FAILURES_PER_PAGE));
  const current = Math.min(page, pages - 1);

  if (failures.length === 0) {
    return null;
  }

  const shown = failures.slice(current * FAILURES_PER_PAGE, (current + 1) * FAILURES_PER_PAGE);

  return (
    <Region>
      <RegionHeader
        title={__('Submissions that weren’t sent', 'wconvert')}
        description={__('Each was rejected on its own, apart from any outage. The latest 200 are kept.', 'wconvert')}
      />
      <DataTable>
        <DataTableHead>
          <DataTableColumn>{__('When', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Destination', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Submission', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Why', 'wconvert')}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {shown.map((failure) => {
            const destination = destinations.find((route) => route.id === failure.destination);
            return <DataTableRow key={`${failure.destination}-${failure.lead}-${failure.at}`}>
              <DataTableCell label={__('When', 'wconvert')}>{formatWhen(failure.at, 'list')}</DataTableCell>
              <DataTableCell label={__('Destination', 'wconvert')}>
                {/* A route removed since keeps its row, named for what it is — never its ID. */}
                {destination ? <a className="font-medium underline underline-offset-2" href={destinationHref(destination.id)}><bdi>{destination.label}</bdi></a>
                  : <span className="text-muted-foreground">{__('Removed destination', 'wconvert')}</span>}
              </DataTableCell>
              <DataTableCell label={__('Submission', 'wconvert')}>
                <a className="font-medium underline underline-offset-2" href={leadsHref({ leadId: failure.lead })}>{__('View submission', 'wconvert')}</a>
              </DataTableCell>
              <DataTableCell label={__('Why', 'wconvert')}>
                <span className="[overflow-wrap:anywhere]">{failure.error}</span>
              </DataTableCell>
            </DataTableRow>;
          })}
        </DataTableBody>
      </DataTable>
      {pages > 1 && <RegionFooter>
        <nav className="flex flex-wrap items-center gap-2" aria-label={__('Pages of unsent submissions', 'wconvert')}>
          <Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Previous', 'wconvert')}
          </Button>
          <span aria-live="polite" aria-atomic="true">
            {sprintf(/* translators: 1: this page's number, 2: how many pages. */ __('Page %1$s of %2$s', 'wconvert'), formatCount(current + 1), formatCount(pages))}
          </span>
          <Button variant="outline" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
            {__('Next', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
          </Button>
        </nav>
      </RegionFooter>}
    </Region>
  );
}
