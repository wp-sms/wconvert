import { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Megaphone, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { listGoals } from '../goals/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionError, RegionErrorState } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { readDashboard } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
import {
  deleteOptin,
  canUnpublish,
  listOptins,
  publishOptin,
  statusOf,
  unpublishOptin,
  type OptinStatus,
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
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [numbers, setNumbers] = useState<Record<string, RowNumbers>>({});
  const [error, setError] = useState<string | null>(null);
  /*
   * **Per row, not per screen.** One screen-wide `busy` meant a slow publish on
   * row 1 disabled the buttons on row 8 — an install with thirty Optins froze
   * whole for the length of one request against one of them (ADR 0039).
   */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OptinSummary | null>(null);
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
      .then((goals) => setLabels(Object.fromEntries(goals.map((goal) => [goal.id, goal.label]))))
      .catch(() => undefined);
  }, []);

  // The dashboard's own read, over the server's default window, flattened out
  // of its per-Goal cards into one map by Optin id. Swallowed on failure for
  // the reason stated above the component: a row without its numbers is a row
  // that still publishes.
  useEffect(() => {
    readDashboard(null)
      .then((payload) =>
        setNumbers(
          Object.fromEntries(
            payload.goals.flatMap((card) =>
              card.optins.map((optin) => [
                optin.id,
                { impressions: optin.impressions, rate: optin.conversion_rate },
              ]),
            ),
          ),
        ),
      )
      .catch(() => undefined);
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
              {rows.map((optin) => (
                <Row
                  key={optin.id}
                  optin={optin}
                  goal={labels[optin.goal]}
                  numbers={numbers[optin.id]}
                  busy={busyId === optin.id}
                  onEdit={() => onEdit(optin.id)}
                  onPublish={() => void run(optin.id, () => publishOptin(optin.id))}
                  onUnpublish={() => void run(optin.id, () => unpublishOptin(optin.id))}
                  onDelete={(trigger) => {
                    returnFocus.current = trigger;
                    setConfirming(optin);
                  }}
                />
              ))}
            </DataTableBody>
          )}
        </DataTable>
      )}

      {/*
        **Hoisted out of the row's menu, and that is not tidiness.** A
        `DropdownMenu` unmounts everything under it when an item is selected, so
        a dialog triggered from inside one is torn down before it can open. The
        menu item sets the row being confirmed; this renders the question
        (ADR 0039).
      */}
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
  goal,
  numbers,
  busy,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  optin: OptinSummary;
  goal: string | undefined;
  numbers: RowNumbers | undefined;
  busy: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: (trigger: HTMLElement | null) => void;
}) {
  const status = statusOf(optin);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <DataTableRow>
      <DataTableCell label={__('Name', 'wconvert')}>
        {/*
          The name opens the builder, because the thing a merchant wants to do
          with a row is usually to change what it says. A `<button>` rather than
          an `<a>`: the builder has no URL of its own — it is a state this
          bundle holds — and an `href="#"` that a click handler cancels is a
          link that lies about being one.
        */}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-sm text-start font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {optin.name}
        </button>
      </DataTableCell>

      {/*
        An id with no label is an Optin holding a Goal this build does not have
        — a `<code>` rather than a blank, because the raw value is the only
        honest thing left to show and blanking it would read as an Optin with no
        Goal at all. It stays a `<code>` and never becomes a Badge: a badge in
        this table is a STATUS, and dressing an unknown id as one would say the
        Optin is in a state called `from_a_plugin_we_lack`.
      */}
      <DataTableCell label={__('Goal', 'wconvert')}>
        {goal ?? <code className="font-mono text-xs">{optin.goal}</code>}
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
        <Badge variant={BADGE[status]}>{statusLabel(status)}</Badge>
        {status === 'suspended' && optin.suspended !== null && (
          <span className="mt-1 block text-pretty text-xs text-muted-foreground">
            {optin.suspended}
          </span>
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
        {numbers === undefined ? '—' : formatCount(numbers.impressions)}
      </DataTableCell>

      <DataTableCell label={__('Conversion rate', 'wconvert')} numeric>
        {numbers === undefined ? '—' : formatRate(numbers.rate)}
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

/**
 * The two figures a row carries beside its state.
 *
 * Not `OptinReport`: that carries `headline` and `by_day` as well, and a row
 * has no honest heading for either — `headline` is the Goal's own metric and
 * this list is mixed. Narrowing here is what makes the wrong column
 * unexpressible rather than merely absent.
 */
interface RowNumbers {
  readonly impressions: number;
  readonly rate: number | null;
}

/**
 * The badge a state wears.
 *
 * Green for *published* and amber for *suspended* is ADR 0037's reserved
 * palette being spent on the meaning it was reserved for — the site is serving
 * one and holding the other back, and that is what a merchant scanning this
 * column is reading for. A draft and a deleted Optin have no such meaning and
 * are deliberately quiet.
 */
const BADGE: Record<OptinStatus, 'success' | 'warning' | 'secondary' | 'outline'> = {
  published: 'success',
  suspended: 'warning',
  draft: 'secondary',
  deleted: 'outline',
};

/**
 * A state, in the merchant's language.
 *
 * **The screen used to render the raw token** — `published`, `draft`,
 * `deleted` — which are values this bundle computes, not words anybody wrote,
 * and therefore untranslated in every locale (ADR 0039). A `switch` rather than
 * a map, so adding a state to `OptinStatus` is a type error here rather than a
 * blank badge on a real install.
 *
 * A function rather than a constant because `__()` must not run at module
 * scope: the catalogue is not loaded when the bundle is evaluated, so a
 * top-level call would freeze the English string into every locale.
 */
function statusLabel(status: OptinStatus): string {
  switch (status) {
    case 'published':
      return __('Published', 'wconvert');
    case 'suspended':
      return __('Suspended', 'wconvert');
    case 'draft':
      return __('Draft', 'wconvert');
    case 'deleted':
      return __('Deleted', 'wconvert');
  }
}
