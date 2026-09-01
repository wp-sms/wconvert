import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import { Region, RegionBody } from '../shell/Region';
import { StatusBadge } from '../optins/StatusBadge';
import { statusOf, type OptinState } from '../optins/api';
import type { Loadable } from '../shell/loadable';
import { destinationsSaid } from './destinations';
import { problemsIn, type Problem } from './structure/problems';
import { summarise } from './rules/summaries';
import type { ConvertingAct } from './structure/catalogue';
import type { Path } from './panel';
import type { RuleVocabulary } from './api';
import type { DisplayRulesValue } from './rules/summaries';
import type { Destination } from '../destinations/api';
import type { GoalEntry } from '../goals/api';
import type { Template } from '@renderer/types';

/**
 * What this [[Optin]] is for, what it measures, and whether it is live —
 * **above every tab, because it is true of all four.**
 *
 * ============================================================================
 * THE EDITOR COULD NOT ANSWER ANY OF THE THREE.
 * ============================================================================
 * The [[Goal]] and the [[Playbook]] are chosen in a three-step creation wizard
 * that cannot be re-entered, and publishing lives on the Optin list. So a
 * merchant editing a campaign — the screen they spend real time in — could see
 * its design, its words, its rules and its Destinations, and nowhere at all
 * what it exists to produce, what number it will be judged on, or whether the
 * site was serving it. Those are the frame for every decision the four tabs
 * ask them to make.
 *
 * ADR 0039's placement rule settles where it goes without inventing anything:
 * **scope decides placement, and a fact identical for every tab belongs above
 * the tabs.** The page-header band is spoken for — it holds the name, the
 * commit and this Optin's numbers, which ADR 0039 caps — so this is the first
 * thing inside the tab column, over the strip rather than in any one panel.
 *
 * ============================================================================
 * IT IS ONE SHAPE, AND EVERY FACT IN IT IS THE SAME SHAPE.
 * ============================================================================
 * A definition list: what the fact is called, and the fact. That is the
 * language the Display rules panel's collapsed rows already speak — an eyebrow
 * in the `micro` register and a sentence in `body` — and the four rule
 * sentences here are literally those, built by the same `summarise()` so the
 * two screens cannot come to word one axis differently.
 *
 * **No green tick, and nothing that says the Optin is fine.** ADR 0042 rule 2
 * killed a *"This will work"* band on this very screen for informing once and
 * taxing every visit. What is permanently here is what CHANGES — the state,
 * the Goal, the rules, where the leads go — and the amber block underneath
 * appears only when something in the design or a Destination is wrong.
 *
 * ============================================================================
 * THE VERDICT MOVED HERE, AND IT IS THE SAME LIST FOR A BETTER REASON.
 * ============================================================================
 * `DesignToolbar` drew the problems as a popover on the two tabs that edit the
 * design, on the argument that their scope is the design. That is true and it
 * is the smaller scope: *"nothing on this design counts as a conversion"* is
 * the answer to **is this Optin ready**, which is this panel's question, and a
 * merchant reading it from the rules tab could not reach it at all. So the
 * problems are here, read out rather than behind a press, and each still opens
 * the block it names through {@link onGoTo}. Nothing about `problemsIn` moved.
 */

export interface ReadinessPanelProps {
  /** Whether the site is serving this Optin, and why not where it is not. */
  readonly optin: OptinState;
  /**
   * The [[Goal]] this Optin serves, as the registry resolved it.
   *
   * ==========================================================================
   * THREE STATES, NOT TWO, AND THE THIRD IS WHAT STOPS THE FLASH.
   * ==========================================================================
   * `loading` while `GET /goals` is in flight, `ready(null)` where it answered
   * and has no such Goal, `ready(entry)` otherwise. {@see OptinList} needed the
   * same three for the same reason and this panel shipped with two: the Optin
   * lands with `getOptin` and the registry answers later, so a `null` meaning
   * both "not yet" and "no such Goal" printed the raw id on **every** load and
   * then watched it turn into a label — which teaches a merchant that the
   * `<code>` means *wait* rather than what it says.
   *
   * `failed` renders as `ready(null)` does: a registry that answered nothing is
   * one this build genuinely cannot name a Goal from, and its outage must cost
   * the panel a row rather than cost the merchant their Save button.
   */
  readonly goal: Loadable<GoalEntry | null>;
  /** The Optin's stored `goal`, which is what a missing registry entry shows. */
  readonly goalId: string;
  /**
   * What the [[Playbook]] it started from is called — three states again, and
   * for the sharper version of the same reason.
   *
   * A `playbook_id` is provenance and the entry behind it may be gone: the
   * install stopped shipping it, or the [[Goal]] was corrected afterwards so it
   * is filed under a different one. **The row is drawn from `playbookId`
   * rather than from the name**, so a Playbook this build cannot name still
   * shows its id — the same fallback the Goal row takes, and what keeps
   * *"read-only is fine; invisible is not"* true rather than true-when-the-
   * lookup-happens-to-work.
   */
  readonly playbook: Loadable<string | null>;
  /** The stored `playbook_id`, or empty where this Optin started from none. */
  readonly playbookId: string;
  /**
   * The four axes as they are stored, already read out of `config` by the
   * screen that holds it.
   *
   * **Not the `config` blob**, which this panel used to take and read for
   * itself: the builder hands the same four values to {@see DisplayRules} one
   * level down, so a blob here meant the same defensive read spelled twice —
   * *"an absent `priority` is 0"* is a decision, and two copies of it is two
   * places for it to stop agreeing.
   */
  readonly rules: DisplayRulesValue;
  readonly vocabulary: RuleVocabulary;
  /** Whether this Optin competes for the screen — see {@see DisplayRules}. */
  readonly overlay: boolean;
  /** The [[Destination]] ids this Optin pushes to, as `config` holds them. */
  readonly bound: readonly string[];
  /** The design, or undefined before one is picked. */
  readonly template: Template | undefined;
  /**
   * Which act this Optin's Goal is measured by, or null while unknown.
   *
   * **Null suppresses the problem list rather than defaulting to `submit`**,
   * because two of the four problems are ABOUT the act: a click-metered Optin
   * read as submit-metered is told its design will be refused, which is a
   * false alarm on a design that is correct.
   */
  readonly act: ConvertingAct | null;
  readonly destinations: readonly Destination[] | null;
  /** Open the block a problem is about, on the tab that edits it. */
  readonly onGoTo: (path: Path) => void;
}

export function ReadinessPanel({
  optin,
  goal,
  goalId,
  playbook,
  playbookId,
  rules,
  vocabulary,
  overlay,
  bound,
  template,
  act,
  destinations,
  onGoTo,
}: ReadinessPanelProps) {
  const status = statusOf(optin);
  const where = destinationsSaid(bound, destinations);
  const summaries = summarise(rules, vocabulary, overlay);

  const problems: Problem[] = [
    ...(template === undefined || act === null ? [] : problemsIn(template, act)),
    ...where.problems.map((said) => ({ said, path: null })),
  ];

  return (
    <Region label={__('This Optin, summarised', 'wconvert')} className="wconvert-readiness">
      {/*
        ====================================================================
        COLLAPSED BY DEFAULT, AND THE COLLAPSED ROW IS NOT AN ICON.
        ====================================================================
        Open, this is ~174px of permanent panel above a tab strip on a screen
        whose own floor is 782px (ADR 0038) — and most of what it holds is the
        answer to a question a merchant asks on arrival rather than on every
        keystroke. So it opens on a press.

        **What it collapses TO is the whole design decision.** Hiding it behind
        an icon would restore the fault this panel was built for: a merchant who
        cannot see what the campaign is for or whether the site is serving it.
        The summary row keeps exactly those — the state, the [[Goal]] and what
        it counts — in one line at 44px, and expanding reveals the rules, the
        [[Destination]]s and the provenance. A quarter of the height, none of
        the answer.

        That is the same shape the four disclosures on the rules tab already
        take, from the same `Collapsible`: the collapsed row IS the sentence,
        and it carries the weight a heading would because it is what a merchant
        reads to decide whether to open anything.
      */}
      <Collapsible.Root defaultOpen={false} data-attention={problems.length > 0 || undefined}>
        <Collapsible.Trigger className="wconvert-readiness__summary">
          <StatusBadge status={status} />

          {/*
            **The one line that has to survive the collapse.** `Counts
            Submissions` is the metric — two of the five Goals convert on a
            click, so it is not the same number under every Goal and a figure
            with no word for it is the ambiguity the panel exists to remove.
          */}
          <span className="wconvert-readiness__line text-body">{headline(goal, goalId)}</span>

          {problems.length > 0 && (
            <span className="wconvert-readiness__flag text-note">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {sprintf(
                /* translators: %d: how many things are wrong with this Optin. */
                _n('%d thing to fix', '%d things to fix', problems.length, 'wconvert'),
                problems.length,
              )}
            </span>
          )}

          {/*
            Decorative: the state it depicts is on `aria-expanded`, which Radix
            puts on this same button, so announcing the chevron would say it
            twice.
          */}
          <ChevronDown aria-hidden="true" className="wconvert-readiness__chevron" />
        </Collapsible.Trigger>

        <Collapsible.Content>
      <RegionBody className="wconvert-readiness__groups">
        {/*
          ==================================================================
          TWO GROUPS, BECAUSE THE FOUR RULE SENTENCES ARE ONE ANSWER.
          ==================================================================
          Measured in a browser first as one list flowing into two columns,
          which put *Where* and *Who* in the right column and *When* and *How
          often* in the left — the four axes a merchant reads as one run,
          scattered across a grid. Where an item LANDS is not something a
          flowing grid can be asked to keep stable either: drop the Playbook
          row on an Optin that started from none and every fact after it moves.

          So the grouping is declared rather than left to the flow: what this
          Optin is, and when it shows.
        */}
        <dl className="wconvert-readiness__facts">
          {/*
            **The state AND its cause, never the state alone** — the rule the
            Optin list already follows (ADR 0027). A [[Suspended]] Optin is one
            the merchant did not stop, so a bare badge is a merchant with
            nowhere to ask why their popup went dark.
            {@see Suspension::reason()} writes both halves into one sentence,
            which is why this row needs no badge of its own: the summary above
            carries the state on every visit, and the cause is the half that
            only exists sometimes. A second badge in here was the same fact
            twice the moment the panel was opened.
          */}
          {optin.suspended !== null && (
            <Fact label={__('State', 'wconvert')} attention>
              {optin.suspended}
            </Fact>
          )}

          {/*
            **The [[Goal]] and its metric are NOT repeated here.** The summary
            row above carries both on every visit, open or closed, so a row for
            them inside is the same fact twice the moment the panel is opened —
            which is what the state badge was doing until it moved up there for
            the same reason. What is left in this group is what the one line
            cannot hold.

            An id with no registry entry behind it still reaches the merchant:
            {@see headline} falls back to it, for {@see OptinList}'s reason —
            the raw value is the only honest thing left to show, and blanking
            it would read as an Optin with no Goal at all.
          */}

          {/*
            **Provenance, and read-only on purpose.** A `playbook_id` records
            which [[Playbook]] prefilled this Optin and the two never speak
            again — improving a Playbook never rewrites a running Optin — so
            there is nothing here to edit and everything to say. It was
            invisible: chosen in a wizard that cannot be re-entered, stored, and
            never shown again.

            **The ROW follows the stored id and only the NAME waits for the
            lookup**, which is the difference between "read-only" and
            "invisible": an entry this install no longer ships, or one filed
            under a Goal that has since been corrected, still started this
            Optin.
          */}
          {playbookId !== '' && playbook.status !== 'loading' && (
            <Fact label={__('Started from', 'wconvert')}>
              {named(playbook) ?? <Unnamed id={playbookId} />}
            </Fact>
          )}

          {/*
            **The sentence, and not the [[Playbook]]'s hint beside it.** The
            hint answers *"which Destination should I bind?"*, and the control
            that binds one is on the Destinations tab — which is where it is
            drawn. A copy here would be the same instruction twice, permanently,
            on the surface that cannot act on it.
          */}
          <Fact label={__('Leads go to', 'wconvert')}>{where.said}</Fact>
        </dl>

        <dl className="wconvert-readiness__facts">
          {summaries.map((summary) => (
            <Fact key={summary.id} label={summary.eyebrow} attention={summary.attention}>
              {summary.text}
            </Fact>
          ))}
        </dl>
      </RegionBody>

      {/*
        **The block is not drawn at all while there is nothing wrong**, and the
        wrapper goes with it. Guarding only the list left a bordered 35px band
        of nothing at the foot of the panel on every sound design — measured in
        a browser, invisible to the suite, and exactly the *"This will work"*
        strip ADR 0042 rule 2 deleted from this screen wearing no words.
      */}
      {problems.length > 0 && (
        <RegionBody className="wconvert-readiness__foot">
          <Problems problems={problems} onGoTo={onGoTo} />
        </RegionBody>
      )}
        </Collapsible.Content>
      </Collapsible.Root>
    </Region>
  );
}

/**
 * The one line the collapsed row shows: what this Optin is for, and what it
 * will be judged on.
 *
 * **A sentence rather than the two `<dt>`s inside**, because a collapsed row is
 * read at a glance and a two-column grid at 44px is not a glance. The joiner is
 * the same `·` {@see howOftenSummary} already uses for the same job.
 *
 * Empty while the registry has not answered — the badge beside it is the news
 * on a first load, and a raw id flashing into a label teaches a merchant that
 * the `<code>` means *wait* (see the Goal row's own comment).
 */
function headline(goal: Loadable<GoalEntry | null>, goalId: string): string {
  const entry = named(goal);

  if (entry === null) {
    return goal.status === 'loading' || goalId === '' ? '' : goalId;
  }

  return sprintf(
    /* translators: 1: a Goal, e.g. “Grow my email list”. 2: what its number is called, e.g. “Submissions”. */
    __('%1$s · counts %2$s', 'wconvert'),
    entry.label,
    entry.headline_label,
  );
}

/**
 * What a registry answered with, or null where it answered nothing.
 *
 * `failed` and `ready(null)` are one answer here and `loading` is not — a read
 * that failed is a build that cannot name the member, which is what the id
 * fallback says, while a read still in flight has said nothing yet.
 */
const named = <T,>(read: Loadable<T | null>): T | null =>
  read.status === 'ready' ? read.data : null;

/**
 * A registry member this build cannot name, shown as the id it stores.
 *
 * `<code>` rather than a blank, for {@see OptinList}'s reason: the raw value is
 * the only honest thing left to show, and blanking it would read as an Optin
 * with no Goal and no [[Playbook]] at all. It never becomes a badge — a badge
 * in this admin is a STATE, and dressing an unknown id as one would say the
 * Optin is in a state called `from_a_plugin_we_lack`.
 */
function Unnamed({ id }: { readonly id: string }) {
  return <code className="font-mono text-xs">{id}</code>;
}

/**
 * One fact, and what it is called.
 *
 * `<dt>`/`<dd>` rather than two spans, for {@see Stat}'s reason: it is what a
 * term and its value are, and it is what lets a screen reader announce *"When,
 * fires after 15 seconds"* rather than two unrelated strings. Wrapped in a
 * `<div>` inside the `<dl>`, which is exactly what that element is for and what
 * lets each pair be its own grid.
 *
 * **The SIZE is a utility here and the COLOUR is a rule in `index.css`**, and
 * the split is measured rather than stylistic — see the comment on the `<dd>`.
 */
function Fact({
  label,
  attention = false,
  children,
}: {
  readonly label: string;
  /** This answer will not do what it looks like it does — see {@see Summary}. */
  readonly attention?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="wconvert-readiness__fact" data-attention={attention || undefined}>
      <dt className="text-micro uppercase text-muted-foreground">{label}</dt>
      {/*
        **The colour is the stylesheet's and the SIZE is the utility's, and the
        split is not a style choice.** Tailwind's utilities are `!important`
        (ADR 0035), so a `text-foreground` here would beat
        `.wconvert-readiness__fact[data-attention] .wconvert-readiness__value`
        however specific that got — the amber state rendered in the default
        colour, measured in a browser, while every test passed. A `<dd>` is not
        in the `font-size: inherit` list that forces the mirror problem onto
        `<p>` and `<label>`, so the size can stay a utility and the colour can
        be a rule that a state may override.
      */}
      <dd className="wconvert-readiness__value text-body">{children}</dd>
    </div>
  );
}

/**
 * What is wrong, read out — and a way to each thing it names.
 *
 * **Amber rather than red**, which is ADR 0037's reserved palette used for the
 * meaning it was reserved for: none of these is a failure or a destruction,
 * they are things that will not do what they look like they do. That is the
 * reading the rules panel's attention state and the Optin list's *Suspended*
 * badge already carry.
 *
 * A problem that names a block is the button that opens it, exactly as the
 * verdict popover made it: a problem the merchant has to hunt for is a problem
 * they will not fix.
 */
function Problems({
  problems,
  onGoTo,
}: {
  readonly problems: readonly Problem[];
  readonly onGoTo: (path: Path) => void;
}) {
  return (
    <>
      <p className="wconvert-readiness__problems-head text-micro uppercase">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        {__('To fix', 'wconvert')}
      </p>
      <ul className="wconvert-readiness__list">
        {/*
          **Keyed by position, because two of these can be the same sentence.**
          `whatCapturesNothing` reports one field per stranded block and the
          wording does not name the block, so a design with two of them yields
          two identical strings — a duplicate React key, from the copy this was
          lifted from.
        */}
        {problems.map((problem, at) => (
          <li key={at}>
            {problem.path === null ? (
              problem.said
            ) : (
              <button
                type="button"
                className="wconvert-readiness__go"
                onClick={() => onGoTo(problem.path as Path)}
              >
                {problem.said}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
