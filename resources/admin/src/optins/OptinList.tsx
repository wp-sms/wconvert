import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CornerDownRight, Megaphone, MoreHorizontal, Plus, Split, Stethoscope, Trash2, Trophy } from 'lucide-react';
import { listGoals } from '../goals/api';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { renderingFor, tierProductName } from '../goals/availability';
import { adminSettings } from '../settings';
import {
  DataTable,
  DataTableActions,
  DataTableActionsColumn,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { InspectDialog } from './InspectDialog';
import { StatusBadge } from './StatusBadge';
import { Description } from '../shell/Description';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionError, RegionErrorState } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { numbersByOptin, readDashboard, type OptinNumbers } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
import {
  createVariant,
  declareWinner,
  deleteOptin,
  canUnpublish,
  listOptins,
  publishOptin,
  statusOf,
  unpublishOptin,
  type OptinSummary,
} from './api';

/**
 * The Optin list: what exists, and what is on the site.
 *
 * **It does not create one.** Creation is the goal-first flow beside it: a
 * [[Goal]] is chosen before anything else is configured, and it is a registry
 * member subject to [[Availability]] rather than a string somebody types
 * (ADR 0026). The free-text field this list used to carry was a placeholder
 * for exactly that flow, and a second door into creation that skipped the
 * registry is precisely the drift the registry exists to stop. `onCreate` opens
 * that same flow and is optional, because a list rendered without one is a list
 * with no door rather than a list with a broken button.
 *
 * Targeting and the rest of an Optin's configuration belong to the builder,
 * which each row opens. Publishing stays HERE rather than moving in there
 * with them: `config` is the working draft and `published_config` is what the
 * site is serving, and the two are separate columns so that editing an Optin
 * is not publishing as you type. A publish button inside the editor would be
 * the same conflation wearing a different hat.
 *
 * **One region, no toolbar** (ADR 0039). There are no filters — see above — and
 * no count, because a count is stated where the set can be large enough to need
 * one and an install has tens of Optins. The screen's one action, *Create an
 * Optin*, is page-scoped and lives in the page header, which is where
 * {@see App} puts it.
 *
 * ============================================================================
 * IMPRESSIONS AND CONVERSION RATE, BUT DELIBERATELY NOT "CONVERSIONS".
 * ============================================================================
 * *Which of these is working?* is asked here — this is the list of what exists
 * — and it was answerable only two screens away. So the two numbers that mean
 * the same thing under every [[Goal]] join the row.
 *
 * **There is no Conversions column, and that is not an omission.** `headline`
 * is the Goal's own metric: on a lead-magnet Goal it counts DELIVERIES, and two
 * of the five convert on a click. One heading over a mixed list would therefore
 * be a wrong number under most of the rows — which is the same reason the
 * analytics screen has no leaderboard and names its headline from the server.
 * `impressions` and `conversion_rate` carry no such ambiguity.
 *
 * **The read is the dashboard's**, flattened to a map by Optin id, so there is
 * no second endpoint computing the same figures a second way (ADR 0034).
 *
 * **Its failure is swallowed**, exactly as the Goal registry's below is.
 * Numbers are a nicety on this screen; they must not cost the merchant the
 * publish and delete buttons, and `refresh()` reports the failure that would.
 */
export function OptinList({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void;
  onCreate?: () => void;
}) {
  const [list, setList] = useState<Loadable<OptinSummary[]>>(LOADING);
  /*
   * **Three states, not two, and the third is what stops the flash.** A plain
   * map starts empty, so every row rendered before `listGoals` resolved showed
   * the id it stores and then watched it turn into the merchant's word for it.
   * That is not a lookup failure — the route answers 200 — it is a race, and
   * the `<code>` fallback has to mean *"this build does not have that Goal"*
   * and nothing else or it means nothing.
   */
  const [labels, setLabels] = useState<Loadable<Record<string, string>>>(LOADING);
  const [numbers, setNumbers] = useState<Record<string, OptinNumbers>>({});
  const [error, setError] = useState<string | null>(null);
  /*
   * **Per row, not per screen.** One screen-wide `busy` meant a slow publish on
   * row 1 disabled the buttons on row 8 — an install with thirty Optins froze
   * whole for the length of one request against one of them (ADR 0039).
   */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OptinSummary | null>(null);
  /*
   * **Declaring a winner confirms, because it is destructive** (ADR 0039). It
   * takes every other arm off the site, and the merchant is choosing between
   * two numbers rather than pressing a button labelled Delete — so the dialog
   * is where they are told what the other arm loses, and that it keeps its
   * counts.
   *
   * Held at the screen for the reason the delete confirm is: a `DropdownMenu`
   * unmounts everything under it when an item is selected, so a dialog opened
   * from inside one is torn down before it can appear.
   */
  const [declaring, setDeclaring] = useState<{ test: OptinSummary; winner: OptinSummary } | null>(
    null,
  );
  /*
   * **The door into the eligibility inspector**, which has to ask which page
   * before it can open one. Held at the screen rather than at a row for the
   * reason the confirm is: a `DropdownMenu` unmounts everything under it when
   * an item is selected, so a dialog opened from inside one is torn down
   * before it can appear (ADR 0039).
   *
   * It is not per-row, and that is the shape of the answer rather than a
   * simplification: the panel reports EVERY Optin on the page at once, because
   * "why did nothing show" is a question about the page and not about one
   * campaign — nine of the ten reasons involve another Optin, the visitor, or
   * the request.
   */
  const [inspecting, setInspecting] = useState(false);
  /*
   * The control that opened the confirm, so closing it puts the caret back
   * ({@see ConfirmDialog}). Held here rather than in the row because the
   * dialog is here — a row hands its trigger up when it asks the question.
   */
  const returnFocus = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setList(ready(await listOptins()));
      setError(null);
    } catch (cause) {
      /*
       * A refresh that fails keeps the rows already on screen: emptying a
       * table a merchant is reading because the second fetch timed out is a
       * worse answer than stale rows under a banner saying so. Only a FIRST
       * failure has nothing to keep, and that is the arm that renders the
       * error as the region's whole content.
       */
      setList((current) => (current.status === 'ready' ? current : failed(cause)));
      setError(messageOf(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The row stores a [[Goal]]'s id and the merchant reads its label, so the
  // registry is fetched once and the rows are labelled from it. Fetched rather
  // than spelled here: the five live in one PHP enum, their labels are
  // translatable strings `wp i18n make-pot` can only see there, and naming one
  // in this bundle is what `tests/unit/Goal/GoalParityTest.php` fails on.
  //
  // Its own error is swallowed on purpose. A registry that did not load costs
  // this screen a nicer word for a Goal; it must not cost the merchant the
  // publish and delete buttons beside it, and `refresh()` reports the failure
  // that would. That deliberate degradation is also why the error above is
  // scoped to this REGION rather than to the page — a page-level banner turns
  // a screen that is working into a screen announcing it is broken.
  useEffect(() => {
    listGoals()
      .then((goals) => setLabels(ready(Object.fromEntries(goals.map((goal) => [goal.id, goal.label])))))
      // **Failure resolves to an empty registry rather than staying in flight.**
      // A cell held forever is a column that never fills; a registry that
      // answered nothing is one this build genuinely cannot name a Goal from,
      // which is exactly what the `<code>` says.
      .catch(() => setLabels(ready({})));
  }, []);

  // The dashboard's own read, over the server's default window, flattened out
  // of its per-Goal cards into one map by Optin id. The walk is
  // {@see numbersByOptin} rather than this file's own, because the builder
  // needs the same one and had a second copy of it. Swallowed on failure for
  // the reason stated above the component: a row without its numbers is a row
  // that still publishes.
  useEffect(() => {
    readDashboard(null).then((payload) => setNumbers(numbersByOptin(payload))).catch(() => undefined);
  }, []);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);

    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusyId(null);
    }
  };

  if (list.status === 'failed') {
    return (
      <Region label={__('Optins', 'wconvert')}>
        <RegionErrorState
          message={list.message}
          hint={__('Reload the page to try again.', 'wconvert')}
        />
      </Region>
    );
  }

  const rows = list.status === 'ready' ? list.data : [];

  return (
    <Region label={__('Optins', 'wconvert')}>
      {error !== null && <RegionError message={error} />}

      {list.status === 'ready' && rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={__('No Optins yet', 'wconvert')}
          action={
            onCreate === undefined ? undefined : (
              <Button onClick={onCreate}>
                <Plus aria-hidden="true" />
                {__('Create an Optin', 'wconvert')}
              </Button>
            )
          }
        >
          {__('Pick a goal and we’ll start you with a design built for it.', 'wconvert')}
        </EmptyState>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableColumn>{__('Name', 'wconvert')}</DataTableColumn>
            <DataTableColumn>{__('Goal', 'wconvert')}</DataTableColumn>
            <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Impressions', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Conversion rate', 'wconvert')}</DataTableColumn>
            <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
          </DataTableHead>

          {list.status === 'loading' ? (
            <TableSkeleton columns={6} />
          ) : (
            <DataTableBody>
              {rows.flatMap((optin) => {
                const labelFor = (row: OptinSummary) =>
                  labels.status === 'ready' ? labels.data[row.goal] ?? null : undefined;

                /*
                 * **The parent is arm A**, so a test is the row itself plus
                 * the arms nested under it (ADR 0045). `arms` is empty on
                 * every Optin running no test, which is almost all of them —
                 * so an install with no test renders exactly the table it
                 * rendered before this shipped.
                 */
                const testing = optin.arms.length > 0;

                const rowFor = (row: OptinSummary, arm: boolean) => (
                  <Row
                    key={row.id}
                    optin={row}
                    arm={arm}
                    testing={testing}
                    goal={labelFor(row)}
                    numbers={numbers[row.id]}
                    busy={busyId === row.id}
                    onEdit={() => onEdit(row.id)}
                    onPublish={() => void run(row.id, () => publishOptin(row.id))}
                    onUnpublish={() => void run(row.id, () => unpublishOptin(row.id))}
                    onDelete={(trigger) => {
                      returnFocus.current = trigger;
                      setConfirming(row);
                    }}
                    onInspect={() => setInspecting(true)}
                    onTest={() => void run(optin.id, () => createVariant(optin.id))}
                    onDeclare={(trigger) => {
                      returnFocus.current = trigger;
                      setDeclaring({ test: optin, winner: row });
                    }}
                  />
                );

                return [rowFor(optin, false), ...optin.arms.map((arm) => rowFor(arm, true))];
              })}
            </DataTableBody>
          )}
        </DataTable>
      )}

      {/*
        ======================================================================
        WHAT THE TWO NUMBERS ARE COUNTING, SAID WHERE THEY ARE REPORTED.
        ======================================================================
        **The split unit is the browser record, not the person.** WConvert
        mints no visitor identifier (ADR 0017), so which arm a browser draws is
        held on that browser's own record — one visitor on a phone and a laptop
        can meet both arms and be counted twice, and clearing storage re-draws.

        That is not a defect waiting for a fix; it is the price of ADR 0017 and
        the same limit [[Impression]] and [[Conversion]] already carry. A
        merchant reading 4.2% against 5.1% deserves to know what the
        denominator is, and the honest move is to say so on the screen that
        reports the result rather than to buy validity with a cookie.

        **Once for the screen, and only where a test is running.** It is
        identical for every test on the page, so it belongs to the group rather
        than to each row (ADR 0039, as ADR 0048 extended it) — and a merchant
        running none has nothing to read it against, so neither the line nor
        the space it sits in is drawn (ADR 0042).
      */}
      {rows.some((optin) => optin.arms.length > 0) && (
        <Description className="mt-3">
          {__(
            'A/B numbers count browsers, not people. One visitor on two devices can meet both arms, and clearing browser storage draws again.',
            'wconvert',
          )}
        </Description>
      )}

      {/*
        **Hoisted out of the row's menu, and that is not tidiness.** A
        `DropdownMenu` unmounts everything under it when an item is selected, so
        a dialog triggered from inside one is torn down before it can open. The
        menu item sets the row being confirmed; this renders the question
        (ADR 0039).
      */}
      {/*
        Hoisted out of the row's menu for the same reason the confirm is: a
        `DropdownMenu` unmounts everything under it when an item is selected
        (ADR 0039).
      */}
      <InspectDialog open={inspecting} onOpenChange={setInspecting} />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
          }
        }}
        title={__('Delete this Optin?', 'wconvert')}
        description={
          confirming === null
            ? ''
            : sprintf(
                /* translators: %s: the name of an Optin. */
                __(
                  '“%s” stops being served and leaves this list. Its leads and conversions are kept.',
                  'wconvert',
                ),
                confirming.name,
              )
        }
        confirmLabel={__('Delete Optin', 'wconvert')}
        returnFocusTo={returnFocus}
        onConfirm={() => {
          const optin = confirming;

          setConfirming(null);

          if (optin !== null) {
            void run(optin.id, () => deleteOptin(optin.id));
          }
        }}
      />

      {/*
        ======================================================================
        ENDING A TEST CONFIRMS, AND THE QUESTION SAYS WHAT THE OTHER ARM KEEPS.
        ======================================================================
        It is destructive — every other arm comes off the site — and a
        destructive action always confirms (ADR 0039). What the sentence has to
        carry is the half a merchant would otherwise assume wrongly: the arm
        that lost is **not deleted**. Its row stays and its counts stay
        readable, because a removed row makes every count naming it
        uninterpretable (ADR 0020), and "tidy up the finished test" reads as
        housekeeping right up to the moment it destroys the comparison the test
        was run to produce.
      */}
      <ConfirmDialog
        open={declaring !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeclaring(null);
          }
        }}
        title={__('Use this one?', 'wconvert')}
        description={
          declaring === null
            ? ''
            : sprintf(
                /* translators: 1: the winning Optin's name. 2: how many other arms the test has. */
                _n(
                  '“%1$s” becomes the campaign. The other %2$d arm stops being served — its leads and conversions are kept.',
                  '“%1$s” becomes the campaign. The other %2$d arms stop being served — their leads and conversions are kept.',
                  declaring.test.arms.length,
                  'wconvert',
                ),
                declaring.winner.name,
                declaring.test.arms.length,
              )
        }
        confirmLabel={__('Use this one', 'wconvert')}
        returnFocusTo={returnFocus}
        onConfirm={() => {
          const ending = declaring;

          setDeclaring(null);

          if (ending !== null) {
            void run(ending.winner.id, () => declareWinner(ending.test.id, ending.winner.id));
          }
        }}
      />
    </Region>
  );
}

/**
 * One Optin, and everything a merchant can do to it from here.
 *
 * **Edit and Publish are visible; Delete is behind the overflow.** Not because
 * three controls do not fit — they did — but because a destructive action must
 * never sit adjacent to the safe action it could be mistaken for (ADR 0039), and
 * *Unpublish* and *Delete* were two same-sized buttons side by side, one of
 * which takes the Optin off the site and one of which removes it. The menu is
 * the distance between them, and the confirm is what is behind it.
 */
function Row({
  optin,
  arm,
  testing,
  goal,
  numbers,
  busy,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onInspect,
  onTest,
  onDeclare,
}: {
  optin: OptinSummary;
  /**
   * Is this row one of the arms nested under a test, rather than the campaign
   * they hang beneath?
   *
   * The parent IS arm A, so this is what separates *"the row the test is
   * about"* from *"the other arms of it"* — and the two draw differently in
   * exactly two places: an arm is indented and marked, and it has no Inspect
   * item of its own because that panel reports the whole page at once.
   */
  arm: boolean;
  /** Is a test running on this campaign? True on the parent AND on its arms. */
  testing: boolean;
  /**
   * The merchant's word for this row's [[Goal]] — `null` where the registry has
   * answered and has no such Goal, and `undefined` while it has not answered at
   * all. The three are different things and the cell shows three different
   * things.
   */
  goal: string | null | undefined;
  numbers: OptinNumbers | undefined;
  busy: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: (trigger: HTMLElement | null) => void;
  /** Opens the page picker. Not per-row: the panel reports every Optin at once. */
  onInspect: () => void;
  /** Start a test, or add another arm to the one running. Parent rows only. */
  onTest: () => void;
  /** End the test with this row as the winner. */
  onDeclare: (trigger: HTMLElement | null) => void;
}) {
  const status = statusOf(optin);
  const trigger = useRef<HTMLButtonElement>(null);
  /*
   * **`locked` is marked before the click, with the reason** (ADR 0042). The
   * routes genuinely do not exist on a build without the `ab-testing` module
   * (ADR 0015), so an unmarked item would be a 404 the merchant met by
   * pressing something we offered them.
   *
   * The Optins list is a settings list rather than a creation front door, so
   * `locked` EXPLAINS rather than hiding — silence on a list somebody is
   * reading is baffling (ADR 0026). It renders as a menu LABEL and never as a
   * disabled item: wp.org Guideline 9 fires on showing a real control the
   * merchant cannot use, and a label is not one.
   */
  const testable = renderingFor(adminSettings()?.variants?.availability ?? 'locked', 'settings_list');

  return (
    <DataTableRow>
      <DataTableCell label={__('Name', 'wconvert')}>
        {/*
          The name opens the builder, because the thing a merchant wants to do
          with a row is usually to change what it says. A `<button>` rather than
          an `<a>`: the builder has no URL of its own — it is a state this
          bundle holds — and an `href="#"` that a click handler cancels is a
          link that lies about being one.

          **An arm is drawn as a child of the row above it** rather than as a
          seventh campaign. That nesting is the entire UI half of ADR 0045: a
          [[Variant]] is a whole Optin with its own row and its own counters,
          and a merchant must never meet "Spring sale" and "Spring sale (B)" as
          two campaigns. The indent is a class rather than a `padding`
          utility, because the table becomes a stack of cards below 640px and
          a fixed indent there would be a card pushed off its own edge.
        */}
        <span className="wconvert-optin-row-name">
          {arm && <CornerDownRight aria-hidden="true" className="wconvert-optin-arm" />}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-sm text-start font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {optin.name}
          </button>
          {/*
            **On the campaign only**, because it is a fact about the test and
            the arms beneath it are already inside it — a badge on every row
            would say the same thing three times (ADR 0039, as ADR 0048
            extended it: a classification is a badge, not a row, and a fact
            true of the group belongs to the group).
          */}
          {testing && !arm && <Badge variant="secondary">{__('A/B test', 'wconvert')}</Badge>}
        </span>
      </DataTableCell>

      {/*
        An id with no label is an Optin holding a Goal this build does not have
        — a `<code>` rather than a blank, because the raw value is the only
        honest thing left to show and blanking it would read as an Optin with no
        Goal at all. It stays a `<code>` and never becomes a Badge: a badge in
        this table is a STATUS, and dressing an unknown id as one would say the
        Optin is in a state called `from_a_plugin_we_lack`.

        **And it is held back until the registry has answered.** The rows land
        before `listGoals` does, so showing the fallback immediately meant every
        merchant read a raw id and then watched it turn into a label — which
        teaches them that the `<code>` means "wait" rather than what it says.
        An empty cell for a few frames says nothing false.
      */}
      <DataTableCell label={__('Goal', 'wconvert')}>
        {goal === undefined ? null : (goal ?? <code className="font-mono text-xs">{optin.goal}</code>)}
      </DataTableCell>

      {/*
        **The state AND its cause, never the state alone.** [[Suspended]] is not
        a state the merchant chose, so a bare word here is a merchant with
        nowhere to ask why their popup stopped — and this is the screen they
        come to when it does (ADR 0027). The sentence is PHP's, already
        translated.

        Branched on the STATE rather than on the sentence's presence, so
        `statusOf` stays the one place a row's state is decided. Reading
        `optin.suspended` directly here would be a second way of asking, and the
        two would eventually answer differently.
      */}
      <DataTableCell label={__('Status', 'wconvert')} className="whitespace-normal">
        <StatusBadge status={status} />
        {status === 'suspended' && optin.suspended !== null && (
          /*
            **The reason comes UP a size, and it was the only 12px body text in
            the admin.** Why an Optin stopped showing is the most important
            explanatory line on this screen, and it was set smaller than every
            other sentence on it. {@see Description} is the role.
          */
          <Description as="span" className="mt-1 block">
            {optin.suspended}
          </Description>
        )}
      </DataTableCell>

      {/*
        **An em dash for an Optin the window has nothing to say about**, which
        is every draft and every published one nobody has seen yet — and it is
        also what a swallowed read leaves behind. Zero would be a claim that
        visitors saw it and did nothing, which is a different and much worse
        thing to tell a merchant about an Optin that never rendered.
      */}
      <DataTableCell label={__('Impressions', 'wconvert')} numeric>
        {numbers === undefined ? '—' : formatCount(numbers.report.impressions)}
      </DataTableCell>

      <DataTableCell label={__('Conversion rate', 'wconvert')} numeric>
        {numbers === undefined ? '—' : formatRate(numbers.report.conversion_rate)}
      </DataTableCell>

      <DataTableActions>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {__('Edit', 'wconvert')}
        </Button>

        {/*
          A suspended Optin is published — the site is holding it back, the
          merchant did not. So it keeps Unpublish rather than being offered a
          Publish it never needed, which would read as "this never went live".
        */}
        {canUnpublish(status) ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onUnpublish}>
            {__('Unpublish', 'wconvert')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={onPublish}>
            {__('Publish', 'wconvert')}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={trigger} variant="ghost" size="icon-sm" disabled={busy}>
              <MoreHorizontal aria-hidden="true" />
              {/*
                Named for the row, not just "More": a table of thirty rows
                otherwise offers thirty identically named buttons, and a
                merchant listing them by keyboard cannot tell which Optin they
                are about to act on.
              */}
              <span className="sr-only">
                {sprintf(
                  /* translators: %s: the name of an Optin. */
                  __('More actions for %s', 'wconvert'),
                  optin.name,
                )}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/*
              ============================================================
              STARTING A TEST IS THE CAMPAIGN'S ACTION, NOT AN ARM'S.
              ============================================================
              Arms are a flat set under one parent — the payload names one
              experiment — so a variant of a variant is a shape no test
              describes, and the server refuses one. It is not offered here
              either, which is the same rule read before the click.
            */}
            {!arm &&
              status !== 'deleted' &&
              (testable === 'upsell' ? (
                /*
                  Bundled copy, never fetched (ADR 0015), and the tier's own
                  name rather than the literal "Pro" — at launch every rung
                  answers "Pro" and this reads unchanged (ADR 0056).
                */
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  {sprintf(
                    /* translators: %s: the product that supplies A/B testing, e.g. “WConvert Pro”. */
                    __('A/B testing is available with %s.', 'wconvert'),
                    tierProductName(adminSettings()?.variants?.tier ?? undefined),
                  )}
                </DropdownMenuLabel>
              ) : (
                <DropdownMenuItem onSelect={onTest}>
                  <Split aria-hidden="true" />
                  {/*
                    Two labels for one action, because the sentence is
                    different once a test exists: the first press starts one
                    and the next adds an arm to it. A merchant is never asked
                    to NAME the variant either way — it takes its parent's
                    name with a letter, because nobody should be asked to name
                    a thing they think of as *the other one* (ADR 0045).
                  */}
                  {testing
                    ? __('Add another variant', 'wconvert')
                    : __('Test against a variant', 'wconvert')}
                </DropdownMenuItem>
              ))}

            {/*
              **Ending the test, offered on every arm including the parent.**
              The parent is arm A, so "keep the one I started with" has to be
              expressible — otherwise a merchant whose original design won
              could only end the test by declaring the loser.
            */}
            {testing && (
              <DropdownMenuItem onSelect={() => onDeclare(trigger.current)}>
                <Trophy aria-hidden="true" />
                {__('Use this one', 'wconvert')}
              </DropdownMenuItem>
            )}

            {(testing || (!arm && status !== 'deleted' && testable !== 'hide')) && (
              <DropdownMenuSeparator />
            )}

            {/*
              **Not on an arm**, and that is the shape of the answer rather
              than a simplification: the panel reports EVERY Optin on the page
              at once, so a copy of the door on each arm of each test would be
              three doors into one room (ADR 0048).
            */}
            {!arm && (
              <DropdownMenuItem onSelect={onInspect}>
                <Stethoscope aria-hidden="true" />
                {__('Why did nothing show?', 'wconvert')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(trigger.current)}>
              <Trash2 aria-hidden="true" />
              {__('Delete', 'wconvert')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DataTableActions>
    </DataTableRow>
  );
}
