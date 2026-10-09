import { __, sprintf } from '@wordpress/i18n';
import { ArrowRight, Download, Lock, Mail, MessageSquare, MousePointerClick, Target } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ChoiceCard } from '../shell/ChoiceGrid';
import { renderingFor, tierName, tierProductName, type Surface } from './availability';
import type { GoalEntry } from './api';

/**
 * One [[Goal]] as a card, and the filter that decides which cards a surface
 * gets.
 *
 * ============================================================================
 * TWO SCREENS CHOOSE A GOAL NOW, AND THEY MUST NOT RENDER IT DIFFERENTLY.
 * ============================================================================
 * The creation flow's step one has always done it. The builder does it too
 * since ADR 0059, because a Goal that could not be changed was the other half
 * of a wall: a merchant on the wrong Goal could neither use the design they
 * wanted nor correct the Goal, and the server refusal had the words *"or
 * change the Goal"* deleted from it precisely because no such control existed.
 *
 * The two surfaces differ in exactly one thing — what the action on an
 * offerable card SAYS — so that is the prop, and everything else is here once:
 * the [[Availability]] rendering, the tier badge, the upsell sentence, and the
 * `aria-describedby` that stops four buttons reading *"Choose"* from being
 * four buttons a screen-reader user cannot tell apart.
 *
 * ============================================================================
 * IT LIVES IN `goals/`, AND THAT IS A BUILD CONSTRAINT RATHER THAN TASTE.
 * ============================================================================
 * `tests/js/admin-split.test.ts` walks the static import graph from the
 * bundle's entry and asserts the builder and the creation flow are not in it
 * (ADR 0038, #73). Both readers of this file are on the far side of that line;
 * a copy in `shell/` — which the reading screens DO reach — would pull it and
 * everything it imports into `main.js`, and the only symptom would be a number
 * in a build log.
 */

/**
 * The Goals a surface may offer, in registry order.
 *
 * ============================================================================
 * `hide` IS THE ONLY STATE THAT DROPS A CARD, AND `keep` IS THE ONE EXCEPTION.
 * ============================================================================
 * A creation flow *hides* what a settings list would explain: a food blogger
 * with no store reading *"requires WooCommerce"* learns nothing they can act
 * on (ADR 0026). That is right for a front door and wrong for an Optin that
 * already HOLDS such a Goal — it keeps it whatever happens to the install, and
 * a picker that dropped it would show a merchant every Goal except their own
 * and leave them unable to see what they were changing away from.
 *
 * So `keep` is an id, not a boolean: the card comes back into the set at its
 * own position rather than being appended, because the order is the registry's
 * and a Goal that moved to the end would read as a different kind of thing.
 */
export function offerableGoals(
  goals: readonly GoalEntry[],
  surface: Surface,
  keep?: string,
): GoalEntry[] {
  return goals.filter(
    (goal) => goal.id === keep || renderingFor(goal.availability, surface) !== 'hide',
  );
}

export interface GoalCardProps {
  readonly goal: GoalEntry;
  readonly surface: Surface;
  /**
   * What the action reads on a Goal this surface can offer — *"Choose"* in the
   * creation flow, *"Use this goal"* where one is already held.
   */
  readonly choose: string;
  /**
   * This is the Goal the Optin already has.
   *
   * Said as `aria-current` and as a disabled action reading *"In use"*, which
   * is the arrangement the design gallery already uses for the design in use —
   * a state in the accessibility tree rather than a border colour.
   */
  readonly current?: boolean;
  /**
   * Why taking this Goal would be refused, or null.
   *
   * **Marked before the click, with the reason** (ADR 0042 rule 3). There is
   * exactly one thing that can fill this — a Goal whose number is read from
   * deliveries over a design that captures nothing — and it names the tab
   * that fixes it rather than the fact alone.
   */
  readonly refused?: string | null;
  readonly onChoose: (goal: GoalEntry) => void;
}

export function GoalCard({
  goal,
  surface,
  choose,
  current = false,
  refused = null,
  onChoose,
}: GoalCardProps) {
  const rendering = renderingFor(goal.availability, surface);
  const Icon = goal.outcome.audience_channel === 'email' ? Mail
    : goal.outcome.audience_channel === 'phone' ? MessageSquare
    : goal.outcome.destination_type !== null ? Download
    : goal.outcome.action === 'click' ? MousePointerClick : Target;

  return (
    <ChoiceCard
      id={goal.id}
      className={`wconvert-goal-card${rendering === 'upsell' ? ' wconvert-goal-card--locked' : ''}`}
      icon={<span className="wconvert-goal-card__icon" aria-hidden="true"><Icon size={24} strokeWidth={1.6} /></span>}
      title={goal.label}
      notes={goal.description}
      /*
        **The refusal is its own slot, and it used to be `notes`.** That landed
        in the ordinary description, which carries no id — so the action's
        `aria-describedby` pointed at the title and never at the reason, on the
        one screen whose docblock claims the reason is marked before the click.
        The Goal's own words stay beside it: what this Goal IS does not stop
        being true because this Optin cannot take it.
      */
      reason={refused}
      current={current}
      /*
        **Grey and a lock, never amber.** Amber is the reserved meaning that
        the SITE is holding something back — a [[Suspended]] Optin, a paused
        Destination, a rule needing a plugin — and spending it on a PRICE made
        it mean two opposite things on two screens a merchant moves between.
        `QuickPicks` follows the same rule and draws the locked
        badge this way (ADR 0037).
      */
      badge={
        rendering === 'upsell' ? (
          <Badge variant="secondary">
            <Lock aria-hidden="true" />
            {tierName(goal.tier)}
          </Badge>
        ) : undefined
      }
      action={(describedBy) =>
        rendering === 'upsell' ? (
          /*
            Bundled copy, never fetched (ADR 0015). The tier's own name rather
            than the literal "Pro", so a second rung is a `tiers.json` edit
            (ADR 0056) — at launch every rung answers "Pro" and this reads
            unchanged.
          */
          <span className="text-muted-foreground">
            {sprintf(
              /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
              __('Available with %s.', 'wconvert'),
              tierProductName(goal.tier),
            )}
          </span>
        ) : (
          /*
            **`aria-disabled`, not `disabled`**, and the reason is the reason
            itself: a real `disabled` takes the control out of the focus order,
            so the sentence saying why it cannot be pressed is a sentence a
            keyboard user cannot tab to. That is the doctrine
            {@see StructureView} states for its tree and this admin now holds
            everywhere — a control refused by what the site IS keeps focus; a
            control that is merely BUSY takes the real attribute.

            The handler declines rather than the pointer being turned off,
            because `pointer-events: none` would also stop a click from
            focusing it.
          */
          <Button
            aria-describedby={describedBy}
            // Six buttons reading "Choose" are told apart by the goal they choose.
            aria-label={current ? undefined : sprintf(
              /* translators: 1: the action, e.g. "Choose". 2: a goal's name. */
              __('%1$s: %2$s', 'wconvert'), choose, goal.label)}
            aria-disabled={current || refused !== null}
            variant={current ? 'secondary' : 'ghost'}
            className="wconvert-goal-card__action"
            onClick={current || refused !== null ? undefined : () => onChoose(goal)}
          >
            {current ? __('In use', 'wconvert') : choose}
            {!current && <ArrowRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />}
          </Button>
        )
      }
    />
  );
}
