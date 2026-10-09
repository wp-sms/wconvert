import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { missingSettings } from './requirements';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  History,
  Info,
  MoreHorizontal,
  Pencil,
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
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogClose,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { AddDestinationDialog } from './AddDestinationDialog';
import { AccountEditor } from './AccountEditor';
import { DestinationSettingsForm } from './DestinationSettingsForm';
import { SendTestDialog } from './SendTestDialog';
import { connectionMissing, destinationStatus, sendRefusal, setupProblems, TestReportAlert } from './status';
import { destinationHref, hashFor, leadsHref, sendingIssuesHref } from '../nav';
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
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { formatCount, formatWhen } from '../lib/format';
import {
  deleteDestination,
  readDestinations,
  readRecentAttempts,
  rePush,
  saveDestination,
  testConnection,
  type Connection,
  type Destination,
  type DestinationType,
  type DestinationUsage,
  type DestinationsPayload,
  type RePushReport,
  type RecentAttempt,
  type TestReport,
} from './api';
import { hasSendingIssue, issueCount } from './issueCount';
import { readLog, type Lead } from '../leads/api';
import { LeadDetail } from '../leads/LeadDetail';
import { campaignName, listOptins } from '../optins/api';
import { RowsSkeleton } from '../shell/RowsSkeleton';

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
 * DESTINATIONS FIRST, HEALTH ON THE CARD, SETUP IN A DIALOG (ADR 0039).
 * ============================================================================
 * Nobody opens this page wanting a fifth Destination; they open it because
 * something did not arrive. So the routes come first — with *Add a
 * destination* on their own heading, not in a page header four other groups
 * share — and the accounts they run over come after them.
 *
 * Each route is a compact card: what it is and who uses it, its status badge,
 * and only the health that matters now. Its settings and its recent sends used
 * to fold open under every card, so a screen of four routes was eight
 * disclosures deep; they are dialogs now — **Edit** on the card, Recent sends
 * behind ⋯ — the same card grammar as the campaign editor's
 * `DestinationCard` (ADR 0131).
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
   * One `error` meant a failed action on the third Destination reported at the
   * top of the page, four regions away from the button that caused it, and
   * the merchant had to guess which row it was about — the placement failure
   * ADR 0039 names. The key is the Destination, or the TYPE for an Add, which
   * is the one action that has no Destination yet. A failed SAVE is not here:
   * it is the Edit dialog's, beside its Save.
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
  const [sending, setSending] = useState<Destination | null>(null);
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
  /** The account Add starts on — the one just connected from Accounts. */
  const [presetConnection, setPresetConnection] = useState<string | null>(null);
  /**
   * The route Add just created, so its card takes focus once the read that
   * draws it lands — the same door a deep link uses. The dialog used to close
   * into nothing, with the new card somewhere down the list.
   */
  const [created, setCreated] = useState<string | null>(null);
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
  // a successful action on one Destination says nothing about the one that
  // failed two regions up.
  const cleared = (current: Record<string, string>, id: string): Record<string, string> =>
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));

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

  const openAdd = (trigger: HTMLElement | null) => {
    addTrigger.current = trigger;
    setPresetConnection(null);
    setShowTypes(true);
  };
  const closeAdd = () => {
    setAdding(null);
    setShowTypes(false);
    setPresetConnection(null);
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
      const known = new Set((payload.status === 'ready' ? payload.data.destinations : []).map((destination) => destination.id));
      const result = await saveDestination({
        type: type.id,
        label: draft.label,
        connection: draft.connection,
        settings: draft.settings,
      });
      // The save answers with every route; the new one is the id that was not
      // there before. Focus goes to its card, not back to Add.
      const fresh = result?.destinations?.find((destination) => !known.has(destination.id));
      if (fresh !== undefined) {
        addTrigger.current = null;
        setCreated(fresh.id);
      }

      closeAdd();
    });

  const remove = (destination: Destination) =>
    void run(destination.id, 'removing', () => deleteDestination(destination.id));

  /**
   * Save from the Edit dialog. **What it failed with is returned, not keyed
   * here**: the dialog is open over the card, so the sentence belongs beside
   * the dialog's Save — and a card that kept saying "not saved" after the
   * dialog was dismissed would be about a draft that no longer exists.
   */
  const save = async (
    destination: Destination,
    edit: { label: string; connection: string | null; settings: Record<string, unknown> },
  ): Promise<string | null> => {
    startOperation(destination.id, 'saving');
    try {
      await saveDestination({
        id: destination.id,
        type: destination.type,
        label: edit.label,
        connection: edit.connection,
        settings: edit.settings,
      });
      await refresh();
      return null;
    } catch (cause) {
      return messageOf(cause);
    } finally {
      finishOperation(destination.id);
    }
  };

  /** An account connected from inside Add or Edit: on screen at once, then re-read. */
  const connectionSaved = (account: Connection) => {
    setPayload((current) => current.status === 'ready'
      ? ready({ ...current.data, connections: [...current.data.connections.filter((existing) => existing.id !== account.id), account] }) : current);
    void refresh();
  };

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
  const issues = data === null ? 0 : issueCount(data);

  return (
    <div className="flex flex-col gap-5">
      {/*
        **Refresh is the Sending issues view's, not Settings'.** Every action
        here re-reads on its own and the data loads on open, so on Settings the
        button had no purpose — in a page header four other groups share. A
        first load is not a refresh, so it never reads "Refreshing…".
      */}
      {mode === 'issues' && <PageAction>
        <Button variant="outline" disabled={refreshing || dirty || busyIds.size > 0} onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" />{refreshing && data !== null ? __('Refreshing…', 'wconvert') : __('Refresh', 'wconvert')}
        </Button>
      </PageAction>}
      {/* A verdict first, then the evidence: how many, and since when (ADR 0132). */}
      {mode === 'issues' && data !== null && <IssuesVerdict data={data} />}
      {/*
        **One read draws every region below**, so a refresh that fails is the
        screen's failure rather than any one route's.
      */}
      {fetchError !== null && <PageError message={fetchError} onRetry={() => void refresh()} />}
      {mode === 'settings' && <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="m-0 text-heading font-semibold">{__('Destinations', 'wconvert')}</h2>
          <Description className="mt-1">
            {__('Reusable places to send submissions. Each campaign picks its own in the Destinations tab.', 'wconvert')}
            {/* Only when there is something to check — a permanent link is one the merchant learns to skip. */}
            {issues > 0 && <>{' '}<a className="inline-flex items-center gap-1 font-medium underline underline-offset-2" href={sendingIssuesHref()}>
              {sprintf(/* translators: %s: number of destinations with a sending issue. */ _n('%s sending issue', '%s sending issues', issues, 'wconvert'), formatCount(issues))}
              <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </a></>}
          </Description>
        </div>
        {/* The region's own action. An empty list carries it instead (§20). */}
        {data !== null && data.destinations.length > 0 && <Button onClick={(event) => openAdd(event.currentTarget)}>
          <Plus aria-hidden="true" />{__('Add a destination', 'wconvert')}
        </Button>}
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
                What is still true with nothing configured — the local mode's
                own name — and the one way forward, here rather than in a
                band the merchant has already read past (ADR 0039).
              */}
              <EmptyState icon={Plug} title={__('Leads are kept in WConvert only', 'wconvert')}
                action={mode === 'settings' ? <Button onClick={(event) => openAdd(event.currentTarget)}>
                  <Plus aria-hidden="true" />{__('Add a destination', 'wconvert')}
                </Button> : undefined}>
                {__('Add a destination to also send them to an email list or another service.', 'wconvert')}
              </EmptyState>
            </Region>
          ) : (
            data.destinations.filter((destination) => mode === 'settings' || hasSendingIssue(destination, data)).map((destination) => {
              const type = data.types.find((candidate) => candidate.id === destination.type);
              return (
                <Configured
                  key={destination.id}
                  destination={destination}
                  mode={mode}
                  onDraftState={reportDraft}
                  focusRequested={destinationId === destination.id || created === destination.id}
                  type={type}
                  connections={data.connections.filter(
                    (connection) => connection.type === destination.type,
                  )}
                  report={reports[destination.id] ?? null}
                  notSent={data.failures.filter((failure) => failure.destination === destination.id).length}
                  test={tests[destination.id] ?? null}
                  error={errors[destination.id] ?? null}
                  busy={busyIds.get(destination.id) ?? null}
                  onSave={(edit) => save(destination, edit)}
                  onConnectionSaved={connectionSaved}
                  onRemove={(trigger) => {
                    returnFocus.current = trigger;
                    setConfirming(destination);
                  }}
                  onRePush={(trigger) => {
                    returnFocus.current = trigger;
                    setReplaying(destination);
                  }}
                  onTestConnection={() => probe(destination)}
                  onTestSend={(trigger) => {
                    returnFocus.current = trigger;
                    setSending(destination);
                  }}
                />
              );
            })
          )}

          {mode === 'issues' && data.destinations.length > 0 && data.failures.length === 0 && data.destinations.every((destination) => !hasSendingIssue(destination, data)) && <Region><EmptyState icon={CircleCheck} title={__('No known sending issues', 'wconvert')}>{__('No destination is failing, and nothing was rejected recently.', 'wconvert')}</EmptyState></Region>}
          {mode === 'issues' && <Failures failures={data.failures} destinations={data.destinations} />}
        </>
      )}

      {mode === 'settings' && accounts && (
        <AccountEditor types={data.types} connections={data.connections}
          usage={Object.fromEntries(data.connections.map((account) => [account.id, data.destinations.filter((destination) => destination.connection === account.id).map((destination) => destination.label)]))}
          onChange={refresh}
          onAddDestination={(type, account, trigger) => {
            addTrigger.current = trigger;
            setPresetConnection(account.id);
            setShowTypes(true);
            setAdding(type);
          }} />
      )}

      {/*
        One dialog holds both steps. Choosing a service never creates a route;
        only the completed form does, and failed saves preserve that draft.
      */}
      <AddDestinationDialog
        type={adding}
        connection={presetConnection}
        choosing={showTypes}
        types={data?.types ?? []}
        connections={data?.connections ?? []}
        busy={adding !== null && busyIds.has(adding.id)}
        error={adding === null ? null : (errors[adding.id] ?? null)}
        returnFocusTo={addTrigger}
        onOpenChange={(open) => { if (!open) closeAdd(); }}
        onChoose={setAdding}
        onBack={() => { setAdding(null); setPresetConnection(null); }}
        onConfirm={(draft) => {
          if (adding !== null) {
            add(adding, draft);
          }
        }}
        onConnectionSaved={connectionSaved}
      />

      {sending !== null && <SendTestDialog destination={sending}
        type={data?.types.find((type) => type.id === sending.type)}
        initialEmail={data?.test_sample?.email ?? null} settingsDirty={false}
        returnFocusTo={returnFocus} onClose={() => setSending(null)}
        onSent={(report) => {
          setTests((current) => ({ ...current, [sending.id]: report }));
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
 * Who uses this route, from its saved bindings: "Used by 2 campaigns (1
 * live)", or "Not in a campaign yet". Null where the server could not say,
 * because a guess here is exactly what the merchant would act on.
 */
function usageSaid(usage: readonly DestinationUsage[] | null | undefined): string | null {
  if (usage == null) return null;
  if (usage.length === 0) return __('Not in a campaign yet', 'wconvert');
  const live = usage.filter((optin) => optin.live).length;
  return live === 0
    ? sprintf(/* translators: %s: number of campaigns. */ _n('Used by %s campaign', 'Used by %s campaigns', usage.length, 'wconvert'), formatCount(usage.length))
    : sprintf(
      /* translators: 1: number of campaigns, 2: how many of them are live. */
      _n('Used by %1$s campaign (%2$s live)', 'Used by %1$s campaigns (%2$s live)', usage.length, 'wconvert'),
      formatCount(usage.length),
      formatCount(live),
    );
}

/**
 * The type a route's form runs on where this build no longer ships its own:
 * no fields and no account, so it can still be renamed — a route is the
 * merchant's either way.
 */
const unshippedType = (destination: Destination): DestinationType => ({
  id: destination.type,
  label: __('Destination', 'wconvert'),
  icon: 'plug',
  tier: 'free',
  requires: null,
  requires_label: null,
  availability: destination.availability,
  needs_connection: false,
  settings_schema: {},
});

/**
 * One configured Destination: whether it is working, who uses it, and what to
 * do about it.
 *
 * **The card reads like the campaign editor's.** The status badge, Edit and ⋯
 * sit on the title line, with what it is and who uses it under the name. Under
 * them, only health that matters now: at most one issue sentence from
 * {@see destinationStatus} — the same words the editor shows, never a local
 * copy — carrying the action that fixes it, then the last send, skipped
 * submissions and any report. Tests, Send again, Recent sends and Remove are in
 * ⋯ with icons, and a refused one stays in the menu with its reason rather
 * than going grey (§14).
 */
function Configured({
  destination,
  mode,
  onDraftState,
  focusRequested,
  type,
  connections,
  report,
  notSent = 0,
  test,
  error,
  busy,
  onSave,
  onConnectionSaved,
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
  /** How many of the kept failures are this route's. */
  notSent?: number;
  /** What the last *Test* against THIS Destination answered. */
  test: TestReport | null;
  /** What the last remove, test or send-again against THIS Destination failed with. */
  error: string | null;
  /** What is in flight for THIS Destination, or null. */
  busy: Busy | null;
  /** Null when the save worked, else what it failed with. */
  onSave: (edit: { label: string; connection: string | null; settings: Record<string, unknown> }) => Promise<string | null>;
  onConnectionSaved: (connection: Connection) => void;
  onRemove: (trigger: HTMLElement | null) => void;
  onRePush: (trigger: HTMLElement | null) => void;
  onTestConnection: () => void;
  onTestSend: (trigger: HTMLElement | null) => void;
}) {
  const id = useId();
  const menu = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLDivElement>(null);
  /** Where the dialog that is open returns focus: Edit, Finish setup or ⋯. */
  const dialogTrigger = useRef<HTMLElement | null>(null);
  /** The Edit dialog, and the field it opens on — set by Finish setup. */
  const [editing, setEditing] = useState<{ focusField?: string } | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  useEffect(() => {
    if (!focusRequested) return;
    const heading = region.current?.querySelector<HTMLElement>('h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    region.current?.scrollIntoView?.({ block: 'start' });
  }, [focusRequested]);
  const problems = setupProblems(destination, type, connections);
  const status = destinationStatus(destination, type, problems);
  const running = destination.availability === 'ready';
  useEffect(() => {
    onDraftState(destination.id, { dirty: editing !== null && editDirty, busy: busy !== null });
    return () => onDraftState(destination.id, { dirty: false, busy: false });
  }, [destination.id, editing, editDirty, busy, onDraftState]);
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

  const edit = (trigger: HTMLElement | null, focusField?: string) => {
    dialogTrigger.current = trigger;
    setEditing({ focusField });
  };

  /** Opens Edit at the field that is missing — where "Finish setup" was pressed. */
  const finishSetup = (trigger: HTMLElement) => edit(trigger,
    connectionMissing(destination, type, connections) ? 'connection'
      : missingSettings(destination.requirements ?? type?.requirements, destination.settings)[0]);

  /*
   * **What it is and who uses it, never what it is called twice.** The type
   * label repeated a name that was already the type's ("Lead magnet email /
   * Lead magnet email"), so it is said only where it adds something. Usage is
   * what the old subtitle left out: whether anything feeds this route at all.
   */
  const usage = usageSaid(destination.usage);
  const subtitle = [
    type !== undefined && type.label.trim().toLocaleLowerCase() !== destination.label.trim().toLocaleLowerCase() ? type.label : null,
    destination.target === '' ? __('Not pointed at anything', 'wconvert') : destination.target,
    usage,
    mode === 'issues' && notSent > 0 ? sprintf(
      /* translators: %s: how many submissions this destination rejected recently. */
      _n('%s not sent', '%s not sent', notSent, 'wconvert'), formatCount(notSent)) : null,
  ].filter((part): part is string => part !== null && part !== '');
  const unused = Array.isArray(destination.usage) && destination.usage.length === 0;

  /*
   * The issue sentence, once, with the door that fixes it. Red is an outage
   * and amber the site holding this route back — both boxed, because both
   * stop sends that are being attempted. Grey is a tier this install has not
   * got: a price is not a fault (ADR 0037).
   *
   * **"Needs setup" is one line, not a box.** The amber badge already IS that
   * status (§8: status true of a row is a badge); a box under it said the same
   * thing again. What is left to say is the reason and the fix.
   */
  const issue = status.issue === null ? null : status.state === 'needs_setup' ? (
    <p className="m-0 text-muted-foreground [overflow-wrap:anywhere]">
      {status.issue}
      {mode === 'settings' && <>{' '}<Button variant="link" className="h-auto p-0 align-baseline" disabled={busy !== null}
        onClick={(event) => finishSetup(event.currentTarget)}>{__('Finish setup', 'wconvert')}</Button></>}
    </p>
  ) : (
    <Alert role="status" className={status.state === 'failing' ? 'border-destructive/30 bg-destructive-surface text-destructive'
      : status.state === 'paused' ? 'border-warning/30 bg-warning-surface text-warning'
      : 'border-border bg-surface text-muted-foreground'}>
      {status.state === 'failing' ? <CircleAlert /> : status.state === 'paused' ? <TriangleAlert /> : <Info />}
      <AlertTitle className="line-clamp-none [overflow-wrap:anywhere]">{status.issue}</AlertTitle>
      {status.state === 'failing' && destination.health.skipped_captures === 0 && <AlertDescription>
        <Button variant="outline" className="mt-2" onClick={(event) => onRePush(event.currentTarget)}>
          <RotateCcw aria-hidden="true" />{__('Send again', 'wconvert')}
        </Button>
      </AlertDescription>}
    </Alert>
  );

  const busySaid = busy === null ? undefined : BUSY_SAID[busy]?.();
  const health = error !== null || busySaid !== undefined || issue !== null || (status.issue === null && sent !== null)
    || destination.health.skipped_captures > 0 || report !== null || test !== null;
  const footer = mode === 'issues';

  return (
    <div ref={region} data-destination-id={destination.id}><Region>
      {/*
        **Drawn here rather than by `RegionHeader`**, whose description is a
        string: this one carries a link. Same slot, spacing and type roles —
        and no bottom rule when nothing follows, or a card with nothing wrong
        draws two lines at its foot.
      */}
      <div data-slot="region-header" className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-2.5${health || footer ? ' border-b border-border' : ''}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="wconvert-region-icon" aria-hidden="true"><ProviderMark type={type} /></span>
          <div className="min-w-0">
            <h2 id={`${id}-name`} className="m-0 text-heading font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere]">
              <bdi>{destination.label}</bdi>
            </h2>
            {(subtitle.length > 0 || (unused && mode === 'settings')) && <Description className="mt-1 [overflow-wrap:anywhere]">
              {subtitle.join(' · ')}
              {/* A new route's next step: it sends nothing until a campaign picks it. */}
              {unused && mode === 'settings' && <>{subtitle.length > 0 ? ' · ' : ''}<a className="underline underline-offset-2" href={hashFor('optins')}>{__('Go to campaigns', 'wconvert')}</a></>}
            </Description>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.badge}
          {mode === 'settings' && <Button variant="outline" disabled={busy !== null} aria-describedby={`${id}-name`}
            onClick={(event) => edit(event.currentTarget)}>
            <Pencil aria-hidden="true" />{__('Edit', 'wconvert')}
          </Button>}
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
                refusal={testRefusal} reasonId={`${id}-test`} onSelect={() => onTestSend(menu.current)} />
              <RefusableItem icon={<RotateCcw aria-hidden="true" />} label={__('Send stored submissions again', 'wconvert')}
                refusal={replayRefusal} reasonId={`${id}-replay`} onSelect={() => onRePush(menu.current)} />
              <DropdownMenuItem onSelect={() => { dialogTrigger.current = menu.current; setRecentOpen(true); }}>
                <History aria-hidden="true" />{__('Recent sends', 'wconvert')}
              </DropdownMenuItem>
              {mode === 'settings' && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(menu.current)}>
                  <Trash2 aria-hidden="true" />{__('Remove', 'wconvert')}
                </DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {health && (
        <RegionBody className="flex flex-col gap-3">
          {/*
            **The failure sits in the card that failed**, above the health it
            contradicts and under the name saying which Destination this is.
          */}
          {error !== null && <RegionError message={error} />}
          {busySaid !== undefined && <p role="status" className="m-0 text-note text-muted-foreground">{busySaid}</p>}
          {issue}
          {/*
            **Only where there IS a last success.** The badge already says
            *"No sends yet"*, and a sentence repeating it teaches the merchant
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

      {footer && <RegionFooter>
        <Button asChild variant="outline"><a href={destinationHref(destination.id)}>{__('Fix sending setup', 'wconvert')}</a></Button>
      </RegionFooter>}

      {editing !== null && <EditDestinationDialog destination={destination} type={type ?? unshippedType(destination)} known={type !== undefined}
        badge={status.badge} connections={connections} focusField={editing.focusField} saving={busy === 'saving'}
        returnFocusTo={dialogTrigger} onDirtyChange={setEditDirty} onSave={onSave} onConnectionSaved={onConnectionSaved}
        onClose={() => { setEditing(null); setEditDirty(false); }} />}
      {recentOpen && <RecentSendsDialog destination={destination} returnFocusTo={dialogTrigger} onClose={() => setRecentOpen(false)} />}
    </Region></div>
  );
}

/**
 * **A route's settings, in the one modal layout** (ADR 0131): the name in the
 * header with its badge, the type as the meta line, and the same form Add and
 * the campaign editor draw — usage notice, name, account, choices, fields —
 * with Cancel at the start and Save at the end.
 *
 * **It stays open after a save**, saying "Saved just now" beside Save, as the
 * folded form did: a merchant fixing one field often has a second to fix, and
 * closing on them would make them find the card and reopen it. The form is
 * re-seeded from the saved route (a new key), so the next Escape asks about
 * the NEXT edit rather than one already saved.
 */
function EditDestinationDialog({
  destination, type, known, badge, connections, focusField, saving, returnFocusTo, onDirtyChange, onSave, onConnectionSaved, onClose,
}: {
  destination: Destination;
  type: DestinationType;
  /** False where `type` is the stand-in for one this build no longer ships. */
  known: boolean;
  badge: ReactNode;
  connections: readonly Connection[];
  focusField?: string;
  saving: boolean;
  returnFocusTo: RefObject<HTMLElement | null>;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (edit: { label: string; connection: string | null; settings: Record<string, unknown> }) => Promise<string | null>;
  onConnectionSaved: (connection: Connection) => void;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const saved = useSaveStatus();
  const { clear } = saved;
  useEffect(() => { if (dirty) clear(); }, [dirty, clear]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const close = () => { if (!saving) onClose(); };

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) close(); }}>
      <AdminDialogContent size="md" dirty={dirty && !saving} showCloseButton={!saving}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <AdminDialogHeader title={<bdi>{destination.label}</bdi>} badge={badge} meta={known ? type.label : undefined} />
        <DestinationSettingsForm key={version} type={type} destination={destination}
          connections={connections} focusField={version === 0 ? focusField : undefined}
          busy={saving} error={error} onDirtyChange={setDirty} onConnectionSaved={onConnectionSaved}
          onCancel={close}
          back={<Button type="button" variant="outline" disabled={saving} onClick={close}>
            {/* Not "Close", which is the ✕'s name: two buttons, one word. */}
            {saved.saved ? __('Done', 'wconvert') : __('Cancel', 'wconvert')}
          </Button>}
          note={<SaveStatus saved={saved.saved} />}
          onConfirm={(draft) => {
            setError(null);
            void onSave(draft).then((failure) => {
              if (failure !== null) { setError(failure); return; }
              saved.markSaved();
              setVersion((current) => current + 1);
            });
          }} />
      </AdminDialogContent>
    </AdminDialog>
  );
}

/**
 * The last few attempts against one route, each with the submission it was
 * for — **the existing attempt ring, not per-lead state** (ADR 0008). Read
 * only when asked: it is a per-route request nobody needs on page load.
 */
function RecentSendsDialog({ destination, returnFocusTo, onClose }: {
  destination: Destination;
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [recent, setRecent] = useState<Loadable<readonly RecentAttempt[]>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    readRecentAttempts(destination.id)
      .then((result) => { if (active) setRecent(ready(result.attempts)); })
      .catch((cause: unknown) => { if (active) setRecent(failed(cause)); });
    return () => { active = false; };
  }, [destination.id, attempt]);

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AdminDialogContent size="sm"
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <AdminDialogHeader title={<bdi>{destination.label}</bdi>} meta={__('Recent sends, newest first', 'wconvert')} />
        <AdminDialogBody>
          {recent.status === 'loading'
            ? <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading recent sends…', 'wconvert')}</p>
            : recent.status === 'failed'
              ? <PageError message={recent.message} onRetry={() => { setRecent(LOADING); setAttempt((current) => current + 1); }} />
              : recent.data.length === 0
                ? <p className="m-0 text-note text-muted-foreground">{__('No recent sends on record.', 'wconvert')}</p>
                : <ul className="m-0 list-none divide-y divide-border p-0">{recent.data.map((each) => (
                  <li key={each.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-note">
                    <span>
                      <span className="font-medium">{(OUTCOMES[each.outcome] ?? OUTCOMES.unknown)()}</span>
                      <span className="text-muted-foreground">{' · '}{formatWhen(each.at, 'list')}</span>
                    </span>
                    {/* The submission it was for, in Leads — never its ID (ADR 0131). */}
                    {each.lead !== '' && <a className="underline underline-offset-2" href={leadsHref({ leadId: each.lead })}>{__('View submission', 'wconvert')}</a>}
                  </li>
                ))}</ul>}
        </AdminDialogBody>
        <AdminDialogFooter>
          <AdminDialogClose asChild><Button type="button" variant="outline">{__('Done', 'wconvert')}</Button></AdminDialogClose>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
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
  // The submission opens over the list, so the merchant keeps their place in it.
  const [opened, setOpened] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
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
                <button type="button" className="font-medium text-action underline underline-offset-2" aria-haspopup="dialog"
                  onClick={(event) => { opener.current = event.currentTarget; setOpened(failure.lead); }}>{__('View submission', 'wconvert')}</button>
              </DataTableCell>
              <DataTableCell label={__('Why', 'wconvert')}>
                <span className="[overflow-wrap:anywhere]">{failure.error}</span>
              </DataTableCell>
            </DataTableRow>;
          })}
        </DataTableBody>
      </DataTable>
      <SubmissionDialog leadId={opened} onClose={() => setOpened(null)} returnFocus={opener} />
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

/** "2 destinations need attention · 14 not sent since Oct 7" — or nothing, where the empty state says it. */
function IssuesVerdict({ data }: { data: DestinationsPayload }) {
  const failing = data.destinations.filter((destination) => hasSendingIssue(destination, data)).length;
  const oldest = data.failures.reduce<string | null>((first, failure) => first === null || failure.at < first ? failure.at : first, null);
  if (failing === 0 && data.failures.length === 0) return null;
  return <p className="m-0 font-medium" role="status">
    {[
      failing > 0 ? sprintf(
        /* translators: %s: how many destinations have a known problem. */
        _n('%s destination needs attention', '%s destinations need attention', failing, 'wconvert'), formatCount(failing)) : null,
      data.failures.length > 0 && oldest !== null ? sprintf(
        /* translators: 1: how many submissions were rejected, 2: when the oldest was, e.g. "Oct 7". */
        _n('%1$s submission not sent since %2$s', '%1$s submissions not sent since %2$s', data.failures.length, 'wconvert'),
        formatCount(data.failures.length), formatWhen(oldest, 'list')) : null,
    ].filter(Boolean).join(' · ')}
  </p>;
}

/** One submission, read by its ID and drawn as the Leads detail draws it. */
function SubmissionDialog({ leadId, onClose, returnFocus }: { leadId: string | null; onClose: () => void; returnFocus: RefObject<HTMLButtonElement | null> }) {
  const [state, setState] = useState<Loadable<{ lead: Lead | null; names: Map<string, string> }>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (leadId === null) return;
    let active = true;
    setState(LOADING);
    void Promise.all([readLog({ leadId }), listOptins()])
      .then(([log, optins]) => {
        if (active) setState(ready({ lead: log.leads[0] ?? null, names: new Map(optins.flatMap((optin) => [optin, ...optin.arms]).map((optin) => [optin.id, campaignName(optin)])) }));
      })
      .catch((cause: unknown) => { if (active) setState(failed(cause)); });
    return () => { active = false; };
  }, [leadId, attempt]);
  return (
    <AdminDialog open={leadId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AdminDialogContent size="md" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}>
        {state.status === 'ready' && state.data.lead !== null
          ? <LeadDetail lead={state.data.lead} campaign={state.data.names.get(state.data.lead.optin_id) ?? null}
              returnTo={sendingIssuesHref()} closes onBack={onClose} />
          : <>
            <AdminDialogHeader title={__('Submission', 'wconvert')} />
            <AdminDialogBody>
              {state.status === 'loading' ? <RowsSkeleton rows={4} />
                : state.status === 'failed' ? <RegionErrorState message={state.message} onRetry={() => setAttempt((value) => value + 1)} />
                  : <p className="m-0">{__('This submission is no longer kept.', 'wconvert')}</p>}
            </AdminDialogBody>
            <AdminDialogFooter back={<AdminDialogClose asChild><Button variant="outline">{__('Close', 'wconvert')}</Button></AdminDialogClose>} />
          </>}
      </AdminDialogContent>
    </AdminDialog>
  );
}
