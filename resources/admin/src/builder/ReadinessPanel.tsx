import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { Description } from '../shell/Description';
import { Region, RegionBody } from '../shell/Region';
import { StatusBadge } from '../optins/StatusBadge';
import { statusOf, type OptinState } from '../optins/api';
import { destinationsSaid } from './readiness';
import { problemsIn, type Problem } from './structure/problems';
import { summarise } from './rules/summaries';
import type { ConvertingAct } from './structure/catalogue';
import type { Path } from './panel';
import type { Frequency, Rule, RuleVocabulary, Targeting } from './api';
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
   * The [[Goal]] this Optin serves, as the registry resolved it — or null
   * while `GET /goals` has not answered, and after one that failed.
   *
   * **Its absence costs the panel two rows and nothing else**, which is the
   * same deliberate degradation {@see OptinList} takes for the same read: a
   * registry outage must not cost a merchant their Save button.
   */
  readonly goal: GoalEntry | null;
  /** The Optin's stored `goal`, which is what a missing registry entry shows. */
  readonly goalId: string;
  /** What the [[Playbook]] it started from is called, where it started from one. */
  readonly playbook: string | null;
  readonly config: Record<string, unknown>;
  readonly vocabulary: RuleVocabulary;
  /** Whether this Optin competes for the screen — see {@see DisplayRules}. */
  readonly overlay: boolean;
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
  config,
  vocabulary,
  overlay,
  template,
  act,
  destinations,
  onGoTo,
}: ReadinessPanelProps) {
  const status = statusOf(optin);
  const bound = Array.isArray(config.destinations) ? (config.destinations as string[]) : [];
  const where = destinationsSaid(bound, destinations);

  const summaries = summarise(
    {
      rules: Array.isArray(config.rules) ? (config.rules as Rule[]) : [],
      targeting: (config.targeting ?? {}) as Targeting,
      frequency: (config.frequency ?? {}) as Frequency,
      priority: typeof config.priority === 'number' ? config.priority : 0,
    },
    vocabulary,
    overlay,
  );

  const problems: Problem[] = [
    ...(template === undefined || act === null ? [] : problemsIn(template, act)),
    ...where.problems.map((said) => ({ said, path: null })),
  ];

  return (
    <Region label={__('This Optin, summarised', 'wconvert')} className="wconvert-readiness">
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
          <Fact label={__('State', 'wconvert')}>
            <StatusBadge status={status} />
            {/*
              **The state AND its cause, never the state alone** — the rule the
              Optin list already follows (ADR 0027). A [[Suspended]] Optin is
              one the merchant did not stop, so a bare badge here is a merchant
              with nowhere to ask why their popup went dark. The sentence is
              PHP's, already translated.
            */}
            {optin.suspended !== null && (
              <Description as="span" className="mt-1 block">
                {optin.suspended}
              </Description>
            )}
          </Fact>

          {/*
            **Held back until the registry has answered**, exactly as the Optin
            list's Goal cell is: the rows land before `GET /goals` does, and
            showing the raw id first teaches a merchant that a `<code>` means
            "wait" rather than what it says. An id with no entry behind it is
            an Optin holding a Goal this build does not have, which is the only
            honest thing left to show.
          */}
          {goal !== null && (
            <Fact label={__('Goal', 'wconvert')}>
              {goal.label}
              {/*
                **What it will be judged on, named by the Goal itself.** Two of
                the five convert on a click, so one word for all of them would
                report zero forever under the other two and look broken while
                being right. The word travels on the registry entry; no Goal id
                is spelled in this bundle.

                Under the Goal rather than beside it, because it is a property
                OF the Goal — the same shape the suspension reason takes under
                the state, and one row rather than two.
              */}
              <Description as="span" className="mt-1 block">
                {sprintf(
                  /* translators: %s: what a Goal's headline number is called, e.g. “Submissions”. */
                  __('Counts %s.', 'wconvert'),
                  goal.headline_label,
                )}
              </Description>
            </Fact>
          )}

          {goal === null && goalId !== '' && (
            <Fact label={__('Goal', 'wconvert')}>
              <code className="font-mono text-xs">{goalId}</code>
            </Fact>
          )}

          {/*
            **Provenance, and read-only on purpose.** A `playbook_id` records
            which [[Playbook]] prefilled this Optin and the two never speak
            again — improving a Playbook never rewrites a running Optin — so
            there is nothing here to edit and everything to say. It was
            invisible: chosen in a wizard that cannot be re-entered, stored, and
            never shown again.
          */}
          {playbook !== null && <Fact label={__('Started from', 'wconvert')}>{playbook}</Fact>}

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
    </Region>
  );
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
                className="wconvert-verdict__go"
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
