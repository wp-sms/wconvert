import { useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { StatusBadge } from '../optins/StatusBadge';
import { statusOf, type OptinState } from '../optins/api';
import type { Loadable } from '../shell/loadable';
import { destinationsSaid } from './destinations';
import { problemsIn, type Problem } from './structure/problems';
import { summarise } from './rules/summaries';
import type { Path } from './panel';
import type { RuleVocabulary } from './api';
import type { DisplayRulesValue } from './rules/summaries';
import type { Destination } from '../destinations/api';
import { goalSaid } from '../goals/said';
import type { GoalEntry } from '../goals/api';
import type { Template } from '@renderer/types';

/**
 * What this [[Optin]] is for, what it measures, and whether it is live —
 * **one control in the page-header band, and everything else behind it.**
 *
 * ============================================================================
 * THE EDITOR COULD NOT ANSWER ANY OF THE THREE.
 * ============================================================================
 * The [[Goal]] and the [[Playbook]] are chosen in a three-step creation wizard
 * that cannot be re-entered, and publishing lives on the Optin list. So a
 * merchant editing a campaign — the screen they spend real time in — could see
 * its design, its words, its rules and its Destinations, and nowhere at all
 * what it exists to produce, what number it will be judged on, or whether the
 * site was serving it.
 *
 * **The Goal itself has since moved out in front of this button**, as one
 * muted line in the band beside a *Change goal* control (ADR 0059). That is
 * not a contradiction of the argument below: the Goal was the one fact in here
 * a merchant needed on arrival EVERY time, because it was the thing five of
 * seven greyed-out design cards kept referring to without naming. The
 * remaining eight facts still answer questions a merchant asks occasionally,
 * and this button is still what they cost. The Goal stays in the header here
 * too, because it is what everything in this dialog is a property OF.
 *
 * ============================================================================
 * IT COST TOO MUCH ROOM TWICE BEFORE IT COST NONE.
 * ============================================================================
 * This shipped as a permanent card above the tab strip — ~190px across both
 * builder columns — and then as a disclosure whose collapsed row kept the state
 * and the Goal in one line at 46px. Both were rejected for the same reason, and
 * the reason is sound: **it answers a question a merchant asks on arrival, not
 * on every keystroke**, and the editor's own floor is 782px (ADR 0038). A
 * screen that spends permanent room on an occasional question has spent it
 * badly, which is ADR 0042's argument about subtitles read from the other end.
 *
 * So it costs a button. The dialog is the whole summary at a comfortable
 * measure, and the tab strip is back where it was.
 *
 * ============================================================================
 * THE ONE THING THAT MUST NOT WAIT FOR A CLICK IS ON THE BUTTON.
 * ============================================================================
 * A design that cannot convert, a field the form will never read, a colour a
 * visitor cannot see: those are not a question a merchant thought to ask, and
 * ADR 0042 rule 3 asks that a problem be marked **before** the click, with the
 * reason. So the trigger reads *"2 things to fix"* in amber when there are
 * any, and *"Summary"* when there are none — the noun when there is no news,
 * and the news when there is.
 *
 * **Its placement is ADR 0039's scope test.** It acts on nothing and reports on
 * the whole Optin, which is exactly the scope `Save changes` and the history
 * controls have, so it sits with them rather than inside any one tab. It stands
 * at `--control-height-sm` for the reason Undo and Redo do: it qualifies the
 * draft rather than committing it.
 */

export interface ReadinessDialogProps {
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
   * Whether this Optin's [[Goal]]'s product is a captured contact.
   *
   * ==========================================================================
   * IT WAS THE CONVERTING ACT, AND IT WAS THE ONE PROP THAT COULD BE UNKNOWN.
   * ==========================================================================
   * The act came from the Goal registry, a round trip behind the Optin, so it
   * was nullable and null SUPPRESSED the whole problem list — because two of
   * the four problems were about the act, and reading a click-metered Optin as
   * submit-metered raised a false alarm on a design that was correct.
   *
   * Neither half survives. The act is read off the design (ADR 0059), so the
   * problems that were about it are gone and `problemsIn` derives what it
   * needs from the template itself. What a Goal declares is `grows_a_list`,
   * which is not derivable from a design — and `false` while the registry is
   * still answering is the safe direction: it withholds one note for a moment
   * rather than raising one.
   */
  readonly growsAList: boolean;
  readonly destinations: readonly Destination[] | null;
  /** Open the block a problem is about, on the tab that edits it. */
  readonly onGoTo: (path: Path) => void;
  /** Open the schedule, on the tab that edits THAT — the countdown's fix. */
  readonly onGoToSchedule: () => void;
}

export function ReadinessDialog({
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
  growsAList,
  destinations,
  onGoTo,
  onGoToSchedule,
}: ReadinessDialogProps) {
  const [open, setOpen] = useState(false);
  const status = statusOf(optin);
  const where = destinationsSaid(bound, destinations);
  const summaries = summarise(rules, vocabulary, overlay);

  const problems: Problem[] = [
    // The schedule comes from the same `config` the four sections read, so the
    // countdown check asks the merchant's own end date rather than the payload's
    // resolved instant — which does not exist until the Optin is published.
    ...(template === undefined ? [] : problemsIn(template, growsAList, rules.schedule.ends_at)),
    ...where.problems.map((said) => ({ said, path: null })),
  ];

  return (
    <>
      {/*
        ==================================================================
        THE NOUN WHEN THERE IS NO NEWS, AND THE NEWS WHEN THERE IS.
        ==================================================================
        A merchant did not think to ask whether their design can convert, so a
        problem is marked before the click and with its count (ADR 0042 rule 3);
        everything else in here answers a question they DID ask, and a button
        called *Summary* is the honest label for that.

        **The icon appears exactly when it means something.** It carried a
        clipboard in the quiet state — decoration standing in for a word that
        was already there, on a band whose other controls are either icon-ONLY
        (Undo, Redo) or text-only (`Save changes`). The warning triangle is not
        decoration: it is the register the amber is in, and it is the only
        thing on this band a merchant has to notice without reading.
      */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={problems.length > 0 ? 'wconvert-readiness__trigger--bad' : undefined}
        onClick={() => setOpen(true)}
      >
        {problems.length > 0 ? (
          <>
            <TriangleAlert aria-hidden="true" />
            {sprintf(
              /* translators: %d: how many things are wrong with this Optin. */
              _n('%d thing to fix', '%d things to fix', problems.length, 'wconvert'),
              problems.length,
            )}
          </>
        ) : (
          __('Summary', 'wconvert')
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/*
          **Wide enough for two columns of sentences.** Every value in here is a
          clause rather than a figure — *"Every time, until they close it or
          sign up"* — and at `sm:max-w-lg` a two-up grid is two 190px columns of
          wrapped text. `2xl` gives each value ~300px, which is one line for
          most of them.
        */}
        <DialogContent className="wconvert-readiness sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{__('Summary', 'wconvert')}</DialogTitle>

            {/*
              ============================================================
              THE GOAL IS THE SUBJECT OF THIS DIALOG, NOT A ROW IN IT.
              ============================================================
              It was two rows — *Goal* and *Counts* — in a list of eight, at the
              same weight as *How often*. But every other fact in here is a
              property of an Optin serving that Goal, and the state is a fact
              about the whole thing rather than about any one of them. Both
              belong in the header, which is what a dialog header is FOR.

              That also takes the list from eight rows to six, which is what
              makes the two-column grid below read as three tidy rows rather
              than as a wall.
            */}
            <DialogDescription asChild>
              <div className="wconvert-readiness__subject">
                <StatusBadge status={status} />
                <span className="wconvert-readiness__for">{goalSaid(goal, goalId)}</span>
              </div>
            </DialogDescription>

            {/*
              **The state AND its cause, never the state alone** — the rule the
              Optin list already follows (ADR 0027). A [[Suspended]] Optin is
              one the merchant did not stop, so a bare badge is a merchant with
              nowhere to ask why their popup went dark. The sentence is PHP's,
              already translated, and says both halves.
            */}
            {optin.suspended !== null && (
              <p className="wconvert-readiness__cause text-note">{optin.suspended}</p>
            )}
          </DialogHeader>

          {/*
            ==============================================================
            THE LABEL SITS OVER THE VALUE, AND THE VALUE IS WHAT IS READ.
            ==============================================================
            This was eight rows of `LABEL⇥value` down a fixed 6.5rem column —
            eight small-caps eyebrows stacked at the leading edge, competing
            with the sentences that are the point of the dialog. {@see Stat}
            settles the arrangement for a fact and its name: the value leads and
            the name sits with it in the `micro` register, quiet enough to skip
            once you know where you are.

            Two columns, because these are short clauses and six of them in one
            column is a scroll for no reason.

            **The four rule facts come first and fill whole rows**, which is
            what keeps the grid stable: an Optin that started from no
            [[Playbook]] drops a row from the END rather than shifting the run
            of four across columns — the scattering a flowing grid does when
            something in the middle disappears.
          */}
          <dl className="wconvert-readiness__facts">
            {summaries.map((summary) => (
              <Fact key={summary.id} label={summary.eyebrow} attention={summary.attention}>
                {summary.text}
              </Fact>
            ))}

            {/*
              **Provenance, and read-only on purpose.** A `playbook_id` records
              which [[Playbook]] prefilled this Optin and the two never speak
              again — improving a Playbook never rewrites a running Optin — so
              there is nothing here to edit and everything to say. It was
              invisible: chosen in a wizard that cannot be re-entered, stored,
              and never shown again.

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
              drawn. A copy here would be the same instruction on the surface
              that cannot act on it.
            */}
            <Fact label={__('Leads go to', 'wconvert')}>{where.said}</Fact>
          </dl>

          {problems.length > 0 && (
            <div className="wconvert-readiness__foot">
              <Problems
                problems={problems}
                onGoTo={(path) => {
                  /*
                    **The dialog closes on the way.** Following a problem selects
                    a block on the Content tab and puts focus on its row, and a
                    modal left open over it would be an instruction the merchant
                    cannot act on and a focus ring nobody can see.
                  */
                  setOpen(false);
                  onGoTo(path);
                }}
                onGoToSchedule={() => {
                  setOpen(false);
                  onGoToSchedule();
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The subject sentence is {@see goalSaid}'s now, in `goals/said.ts`.
 *
 * It was `subject()`, right here, and it had one reader. The builder's
 * page-header band is the second (ADR 0059) — the line that puts a [[Goal]] on
 * screen rather than one click deep behind this button — and two spellings of
 * *"Goal · counts Word"* would be two chances for one Optin to be described
 * differently on one screen.
 */

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
  onGoToSchedule,
}: {
  readonly problems: readonly Problem[];
  readonly onGoTo: (path: Path) => void;
  /** The other destination a problem can name: the schedule, on the Rules tab. */
  readonly onGoToSchedule: () => void;
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
            {/*
              Two destinations and a third case that is neither: a block on the
              Content tab, the schedule on the Rules tab, and a problem with no
              door — `whatCannotConvert`'s, whose answer is the gallery.
            */}
            {problem.go === 'schedule' ? (
              <button type="button" className="wconvert-readiness__go" onClick={onGoToSchedule}>
                {problem.said}
              </button>
            ) : problem.path === null ? (
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
