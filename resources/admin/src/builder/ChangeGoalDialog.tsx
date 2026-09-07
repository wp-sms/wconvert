import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { EmptyState } from '../shell/EmptyState';
import { GoalCard, offerableGoals } from '../goals/GoalCard';
import type { GoalEntry } from '../goals/api';
import type { Loadable } from '../shell/loadable';

/**
 * Changing an [[Optin]]'s [[Goal]] — **the control ADR 0042 rule 4 had to
 * delete a sentence for want of.**
 *
 * ============================================================================
 * IT WAS THE OTHER HALF OF THE WALL.
 * ============================================================================
 * A Goal is chosen in a three-step creation wizard that cannot be re-entered,
 * and nothing in the builder changed one. So a merchant on the wrong Goal
 * could neither use the design they wanted — five of seven popup designs were
 * greyed out — nor correct the Goal, and the server's refusal had the words
 * *"or change the Goal"* deliberately taken out of it because they named a
 * door that did not exist.
 *
 * ADR 0059 deleted the greying. This is the door.
 *
 * ============================================================================
 * UNDER C IT IS PURELY EDITORIAL, AND THAT IS WHY IT IS CHEAP TO OFFER.
 * ============================================================================
 * A Goal declares no converting act any more, so changing one cannot make the
 * design wrong. What it changes is the CARD an Optin's numbers are read on and
 * the word above them — nothing about what the site serves, and nothing about
 * the document the merchant is editing.
 *
 * **A dialog rather than a control in the band**, on ADR 0042 rule 7's test: a
 * Goal is picked from a grid of cards with descriptions and tier badges, which
 * owns the screen until it is answered. It is also the arrangement the
 * creation flow already has, and {@see GoalCard} is literally the same card —
 * a second rendering of an [[Availability]] is a second place for *"never sell
 * Pro for something Pro would not supply"* to stop agreeing (ADR 0026).
 *
 * ============================================================================
 * IT CONFIRMS, AND UNDO IS WHY.
 * ============================================================================
 * The structure editor's amendment to ADR 0039 is that undo buys a
 * destructive action its exception — a design switch is one undo entry, so it
 * states what it takes and asks nothing. **That exception does not reach
 * here.** The builder's history watches the `template`, and a Goal is not in
 * `config` at all: it is a column. There is no entry for Undo to walk back to,
 * so the confirm is the only place this is said.
 *
 * And what it takes is not small. Counters carry no `goal` — everything is
 * interpreted at read against the Goal the Optin holds NOW (ADR 0020) — so a
 * correction moves the Optin's whole history onto the new card rather than
 * splitting it at the moment of the edit. That is the behaviour the merchant
 * usually wants and never the one they expect, which is exactly the pair that
 * earns a sentence.
 */

export interface ChangeGoalDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Every Goal this install has, as `GET /goals` resolved them. */
  readonly goals: Loadable<GoalEntry[]>;
  /** The Goal this Optin holds, as its own id — which may name no entry. */
  readonly current: string;
  /**
   * Whether this Optin's design captures anything at all.
   *
   * The one refusal a Goal can still make about a design, marked before the
   * click with the tab that fixes it (ADR 0042 rule 3, ADR 0059). Read off the
   * tree the builder is already holding, so the card and the save cannot
   * disagree.
   */
  readonly captures: boolean;
  readonly onChange: (goal: string) => void;
}

export function ChangeGoalDialog({
  open,
  onOpenChange,
  goals,
  current,
  captures,
  onChange,
}: ChangeGoalDialogProps) {
  /*
   * The Goal the merchant pressed, held until they confirm. `null` is the grid
   * and a value is the confirm — two views of one dialog rather than a second
   * dialog in front of this one, which would be a modal over a modal for a
   * sentence.
   */
  const [picked, setPicked] = useState<GoalEntry | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setPicked(null);
    }

    onOpenChange(next);
  };

  /*
   * **`current` is kept even where the install can no longer serve it.** An
   * Optin holds its Goal whatever happens around it (ADR 0026), and a picker
   * that dropped the merchant's own would show them every Goal except the one
   * they are changing away from.
   */
  const shown =
    goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow', current) : [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        {picked === null ? (
          <>
            <DialogHeader>
              <DialogTitle>{__('Change this Optin’s goal', 'wconvert')}</DialogTitle>
              <DialogDescription>
                {__(
                  'The goal decides which card reports this Optin and what its headline number is called. It does not change the design.',
                  'wconvert',
                )}
              </DialogDescription>
            </DialogHeader>

            {goals.status === 'loading' ? (
              <ChoiceSkeleton />
            ) : shown.length === 0 ? (
              /*
                The same honest dead end step one has: what is missing is a
                registry entry, which arrives from a plugin and never from
                anything a merchant can press (ADR 0039).
              */
              <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}>
                {__(
                  'Goals arrive with WConvert and with the plugins that extend it.',
                  'wconvert',
                )}
              </EmptyState>
            ) : (
              <ChoiceGrid>
                {shown.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    surface="creation_flow"
                    choose={__('Use this goal', 'wconvert')}
                    current={goal.id === current}
                    refused={
                      /*
                        **The one thing left that a Goal can refuse a design
                        for**, and the door is the Design tab rather than this
                        dialog — so it says which. A Goal already in use is
                        never refused: it is `aria-current` and its action reads
                        *In use*, and a second sentence over that would be an
                        instruction about a change nobody is making.
                      */
                      goal.needs_a_capture && !captures && goal.id !== current
                        ? __(
                            'This goal counts deliveries, and this Optin’s design asks the visitor for nothing. Pick a design with a field on it first, on the Design tab.',
                            'wconvert',
                          )
                        : null
                    }
                    onChoose={setPicked}
                  />
                ))}
              </ChoiceGrid>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {sprintf(
                  /* translators: %s: the Goal being moved to, e.g. “Grow my email list”. */
                  __('Move this Optin to “%s”?', 'wconvert'),
                  picked.label,
                )}
              </DialogTitle>
              {/*
                **The whole history, and it says so.** `wconvert_stats` carries
                no `goal`: every count is read against the Goal the Optin holds
                now (ADR 0020), so this restates the past rather than starting a
                new chapter. And the builder's Undo watches the design, which a
                Goal is not part of — so *"this cannot be undone"* is a fact
                about this screen rather than a warning shape.
              */}
              <DialogDescription>
                {__(
                  'Everything this Optin has already counted is read against the goal it holds, so its whole history moves with it. This cannot be undone.',
                  'wconvert',
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setPicked(null)}>
                {__('Pick a different goal', 'wconvert')}
              </Button>
              <Button
                onClick={() => {
                  const chosen = picked.id;

                  setPicked(null);
                  onOpenChange(false);
                  onChange(chosen);
                }}
              >
                {__('Move it', 'wconvert')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
