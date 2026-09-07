import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  CircleAlert,
  CircleCheck,
  Info,
  Lock,
  Plug,
  RotateCcw,
  Target,
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
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import {
  deleteDestination,
  readDestinations,
  rePush,
  saveDestination,
  testConnection,
  testSend,
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
  /*
   * **The read's own failure, and the only screen-wide one left.** A refresh
   * that fails is a fact about the whole payload — every region on the screen
   * is now showing something that may have moved — so it belongs above all of
   * them rather than inside one. Every failure a BUTTON caused is keyed below.
   */
  const [fetchError, setFetchError] = useState<string | null>(null);
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
  const [busyId, setBusyId] = useState<string | null>(null);
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
  const returnFocus = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPayload(ready(await readDestinations()));
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
      setPayload((current) => (current.status === 'ready' ? current : failed(cause)));
      setFetchError(messageOf(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cleared on the retry that works, and only for the thing that was retried:
  // a successful save on one Destination says nothing about the one that
  // failed two regions up.
  const cleared = (current: Record<string, string>, id: string): Record<string, string> =>
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);

    try {
      await action();
      setErrors((current) => cleared(current, id));
      await refresh();
    } catch (cause) {
      setErrors((current) => ({ ...current, [id]: messageOf(cause) }));
    } finally {
      setBusyId(null);
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
    setBusyId(destination.id);

    void (async () => {
      try {
        const report = await rePush(destination.id);

        setReports((current) => ({ ...current, [destination.id]: report }));
        setErrors((current) => cleared(current, destination.id));
      } catch (cause) {
        setErrors((current) => ({ ...current, [destination.id]: messageOf(cause) }));
      } finally {
        setBusyId(null);
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
    setBusyId(destination.id);

    void (async () => {
      try {
        const report = await ask(destination.id);

        setTests((current) => ({ ...current, [destination.id]: report }));
        setErrors((current) => cleared(current, destination.id));
      } catch (cause) {
        setErrors((current) => ({ ...current, [destination.id]: messageOf(cause) }));
      } finally {
        setBusyId(null);
      }
    })();
  };

  if (payload.status === 'failed') {
    return (
      <Region label={__('Destinations', 'wconvert')}>
        <RegionErrorState
          message={payload.message}
        />
      </Region>
    );
  }

  const data = payload.status === 'ready' ? payload.data : null;

  return (
    <div className="flex flex-col gap-5">
      {/*
        **One read draws every region below**, so a refresh that fails is the
        screen's failure rather than any one route's. It was a `RegionError`
        inside a `Region` holding nothing else — a card whose only content was
        a band with a bottom border, drawing a rule above nothing.
      */}
      {fetchError !== null && <PageError message={fetchError} />}

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
                **No action, and the region below is why.** `EmptyState` says
                an empty state carries the door that fixes it, and this one's
                door is *Add a destination* — a whole region, on this screen,
                directly underneath, listing every type the site offers. A
                button here would be a second door to it, which is the shape
                ADR 0026 refuses on the Optin list for the same reason.

                The sentence does the other half of the job instead: it says
                what is still true while there is nothing here, so an empty
                Destinations screen does not read as leads going nowhere.
              */}
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
                type={data.types.find((type) => type.id === destination.type)}
                connections={data.connections.filter(
                  (connection) => connection.type === destination.type,
                )}
                report={reports[destination.id] ?? null}
                test={tests[destination.id] ?? null}
                error={errors[destination.id] ?? null}
                busy={busyId === destination.id}
                onSave={save}
                onRemove={(trigger) => {
                  returnFocus.current = trigger;
                  setConfirming(destination);
                }}
                onRePush={replay}
                onTestConnection={(target) => probe(target, testConnection)}
                onTestSend={(target) => probe(target, testSend)}
              />
            ))
          )}

          <Types
            types={data.types}
            errors={errors}
            busyId={busyId}
            onAdd={(type, trigger) => {
              returnFocus.current = trigger;
              setAdding(type);
            }}
          />

          <Failures failures={data.failures} />
        </>
      )}

      {/*
        **One dialog for the screen, not one per type row.** The state that
        says which type is being added lives above both, so the list of types
        stays a list of rows with an action each.
      */}
      <AddDestinationDialog
        type={adding}
        connections={data?.connections ?? []}
        busy={adding !== null && busyId === adding.id}
        error={adding === null ? null : (errors[adding.id] ?? null)}
        returnFocusTo={returnFocus}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null);
          }
        }}
        onConfirm={(draft) => {
          if (adding !== null) {
            add(adding, draft);
          }
        }}
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
  onTestSend: (destination: Destination) => void;
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
  const failing = destination.health.consecutive_failures > 0;
  /*
   * Whether the two *Test* buttons can do anything. The region above already
   * says WHY when they cannot — a "Paused" badge and a sentence — so offering
   * a button that answers with that same sentence a round trip later is the
   * shape ADR 0042 rule 3 refuses.
   */
  const runnable = destination.availability === 'ready';
  const fields = Object.entries(schema);
  const lands = targetSaid(destination.target);
  const pushed = destination.health.last_success_at;
  /*
   * Whether the health body has anything in it at all. With the badge now
   * carrying "Not used yet" alone, a Destination nobody has pushed to — of a
   * type that selects nothing, so there is no target line either — would
   * otherwise draw an empty padded block under its own header.
   */
  const reporting =
    lands !== null ||
    failing ||
    pushed !== null ||
    destination.health.skipped_captures > 0 ||
    report !== null ||
    test !== null;

  return (
    <Region>
      {/*
        **The failure sits in the region that failed**, above the health it
        contradicts and under the label saying which Destination this is. A
        merchant whose Save just errored reads it beside the Save button
        (ADR 0039).
      */}
      {error !== null && <RegionError message={error} />}

      <RegionHeader
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
              : undefined
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
            <Badge variant="success">{__('Delivering', 'wconvert')}</Badge>
          )
        }
      />

      {reporting && (
        <RegionBody className="flex flex-col gap-3">
          {/*
            **Where this route lands, first, because it is what makes one route
            different from another.**

            Three states and not two — {@see targetSaid} owns the wording and
            `ConfiguredTarget` owns the rule. `null` draws nothing: a lead-magnet
            email selects nothing and is perfectly configured, and a provider we
            could not reach is a question we could not ask. Saying *"not pointed
            at anything yet"* for either reports a fault against something that
            works (ADR 0042).
          */}
          {lands !== null && (
            <p className="m-0 flex items-center gap-2 text-muted-foreground">
              <Target aria-hidden="true" className="size-4 shrink-0" />
              {lands}
            </p>
          )}

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
      <RegionBody className="flex flex-col gap-4 border-t border-border">
        <div className="flex max-w-xl flex-col gap-1.5">
          <Label htmlFor={`wconvert-${destination.id}-label`}>{__('Name', 'wconvert')}</Label>
          <Input
            id={`wconvert-${destination.id}-label`}
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Description>
            {__('Yours to choose. It is what you will pick from on an optin.', 'wconvert')}
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
              {field.label}
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

        <div>
          <Button
            variant="outline"
            disabled={busy}
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
        </div>
      </RegionBody>

      {/*
        **Re-push repairs and Remove destroys, and they are not the same
        weight.** They were two `.button`s side by side; now the recovery
        action is the visible one and Remove is a quiet destructive control at
        the far edge, behind a confirm (ADR 0039).
      */}
      <RegionFooter className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => onTestSend(destination)}
          >
            <Zap aria-hidden="true" />
            {__('Send a test', 'wconvert')}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onRePush(destination)}>
            <RotateCcw aria-hidden="true" />
            {__('Re-push leads since the last success', 'wconvert')}
          </Button>
        </div>
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
      </RegionFooter>
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
  errors,
  busyId,
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
  busyId: string | null;
  /** The trigger travels so the dialog can put the caret back on it. */
  onAdd: (type: DestinationType, trigger: HTMLElement | null) => void;
}) {
  return (
    <Region>
      {types.map((type) =>
        errors[type.id] === undefined ? null : (
          <RegionError key={type.id} message={errors[type.id]} />
        ),
      )}

      <RegionHeader
        title={__('Add a destination', 'wconvert')}
        description={__('Where else a captured lead can go.', 'wconvert')}
      />

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
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5 last:border-b-0"
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

                    What is left is `busyId`, which is about this row having a
                    request in flight and nothing to do with how many exist.
                  */
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === type.id}
                    onClick={(event) => onAdd(type, event.currentTarget)}
                  >
                    {__('Add', 'wconvert')}
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
  skipped: { className: 'border-border bg-muted/40 text-muted-foreground', icon: Info },
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
                <Code className="text-muted-foreground">{failure.lead}</Code>
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
