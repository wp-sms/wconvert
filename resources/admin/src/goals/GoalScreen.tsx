import { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ChoiceCard, ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionHeader } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { createOptin } from '../optins/api';
import { renderingFor } from './availability';
import { listGoals, listPlaybooks, prefill, type Draft, type GoalEntry, type PlaybookEntry } from './api';

/**
 * The goal-first creation flow: pick a [[Goal]], pick a [[Playbook]] under it,
 * land in an editor holding a prefilled [[Optin]].
 *
 * **The Goal is chosen before anything else**, and "start from scratch" skips
 * the Playbook, never the Goal. [[Display Type]] is not asked at all — it is
 * prefilled by the chosen Playbook, and is an override and a filter in the
 * builder rather than the first question (CONTEXT.md, Display Type).
 *
 * **Nothing is created until the last step.** Prefill is a read; a merchant
 * who walks the whole flow and closes the tab has written nothing. The step
 * that does create one hands the merchant straight to the builder.
 *
 * ============================================================================
 * THREE STEPS, AND THE SCREEN SAYS WHICH ONE (ADR 0039).
 * ============================================================================
 * This was a bulleted list of Goals with a button loose under each bullet, and
 * nothing anywhere saying it was a flow at all — a merchant two clicks in had
 * no way to tell how far through they were or how to get back one step rather
 * than all the way out. Each step is a region that names itself and counts
 * itself, and the way back one step sits with the step it returns to.
 *
 * **Loading is a state here, and it was the worst instance of not being one.**
 * Step 2 initialised from an empty array, so between choosing a Goal and its
 * Playbooks arriving it said *"No ready-to-run starts for this Goal yet"* —
 * a false statement about the merchant's Goal, at the exact moment they are
 * deciding whether this product has anything for them. `Loadable<T>` makes
 * that unwritable.
 *
 * **And the error clears.** There was no `setError(null)` anywhere in this
 * file: a failure from step 1 stayed on screen through step 2 and into the
 * builder hand-off.
 */
export function GoalScreen({ onCreated }: { onCreated: (id: string) => void }) {
  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);
  const [goal, setGoal] = useState<GoalEntry | null>(null);
  const [playbooks, setPlaybooks] = useState<Loadable<PlaybookEntry[]>>(LOADING);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const report = useCallback((cause: unknown) => setError(messageOf(cause)), []);

  useEffect(() => {
    listGoals()
      .then((entries) => setGoals(ready(entries)))
      .catch((cause: unknown) => setGoals(failed(cause)));
  }, []);

  const choose = (chosen: GoalEntry) => {
    setGoal(chosen);
    setDraft(null);
    setPlaybooks(LOADING);
    setError(null);

    listPlaybooks(chosen.id)
      .then((entries) => setPlaybooks(ready(entries)))
      .catch((cause: unknown) => setPlaybooks(failed(cause)));
  };

  const start = (playbookId?: string) => {
    if (goal === null) {
      return;
    }

    setError(null);
    prefill(goal.id, playbookId).then(setDraft).catch(report);
  };

  const save = () => {
    if (draft === null) {
      return;
    }

    setBusy(true);
    setError(null);

    createOptin(draft.name, draft.goal, draft.config)
      .then((optin) => {
        setDraft(null);
        setGoal(null);
        // Into the builder, which is where this flow has always said it ends:
        // "pick a Goal, pick a Playbook under it, land in an editor holding a
        // prefilled Optin".
        onCreated(optin.id);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  if (draft !== null) {
    return (
      <DraftPreview
        draft={draft}
        busy={busy}
        error={error}
        onSave={save}
        onBack={() => setDraft(null)}
      />
    );
  }

  if (goal !== null) {
    return (
      <PlaybookGallery
        goal={goal}
        playbooks={playbooks}
        error={error}
        onStart={start}
        onBack={() => {
          setGoal(null);
          setError(null);
        }}
      />
    );
  }

  return <GoalPicker goals={goals} error={error} onChoose={choose} />;
}

/**
 * Step one — **the front door of the creation flow**, which is what decides how
 * it renders an absence.
 *
 * An `unavailable` Goal is **absent**: not greyed out, not explained. A
 * `locked` one is an upsell card, because Pro is buyable from us. And where
 * both apply the server has already resolved it to `unavailable`, so this
 * screen hides it — a merchant with no store is never sold Pro for a feature
 * Pro would not give them either (ADR 0026).
 */
function GoalPicker({
  goals,
  error,
  onChoose,
}: {
  goals: Loadable<GoalEntry[]>;
  error: string | null;
  onChoose: (goal: GoalEntry) => void;
}) {
  if (goals.status === 'failed') {
    return (
      <Region>
        <RegionHeader title={__('Create an Optin', 'wconvert')} trailing={<Step at={1} />} />
        <RegionErrorState
          message={goals.message}
          hint={__('Reload the page to try again.', 'wconvert')}
        />
      </Region>
    );
  }

  const shown =
    goals.status === 'ready'
      ? goals.data.filter((goal) => renderingFor(goal.availability, 'creation_flow') !== 'hide')
      : [];

  return (
    <Region>
      <RegionHeader
        title={__('Create an Optin', 'wconvert')}
        description={__('What do you want this Optin to do?', 'wconvert')}
        trailing={<Step at={1} />}
      />

      {error !== null && <RegionError message={error} />}

      <RegionBody>
        {goals.status === 'loading' ? (
          <ChoiceGrid>
            {[0, 1, 2, 3].map((row) => (
              <ChoiceSkeleton key={row} />
            ))}
          </ChoiceGrid>
        ) : (
          <ChoiceGrid>
            {shown.map((goal) => {
              const rendering = renderingFor(goal.availability, 'creation_flow');

              return (
                <ChoiceCard
                  key={goal.id}
                  id={goal.id}
                  title={goal.label}
                  notes={goal.description}
                  badge={
                    rendering === 'upsell' ? (
                      <Badge variant="warning">{__('Pro', 'wconvert')}</Badge>
                    ) : undefined
                  }
                  action={(describedBy) =>
                    rendering === 'upsell' ? (
                      // Bundled copy, never fetched (ADR 0015).
                      <span className="text-muted-foreground">
                        {__('Available with WConvert Pro.', 'wconvert')}
                      </span>
                    ) : (
                      <Button aria-describedby={describedBy} onClick={() => onChoose(goal)}>
                        {__('Choose', 'wconvert')}
                      </Button>
                    )
                  }
                />
              );
            })}
          </ChoiceGrid>
        )}
      </RegionBody>
    </Region>
  );
}

/**
 * Step two — the gallery, **filtered on Goal only**. The server did the
 * filtering, and there is no second control here to make Display Type an axis.
 *
 * "Start from scratch" sits in the region's footer rather than replacing the
 * cards, because it skips the Playbook and not the Goal: the merchant has
 * already answered the one question that is asked before anything else. It is
 * the secondary way forward, so it is an outline button beside the way back —
 * never a card competing with the real Playbooks.
 */
function PlaybookGallery({
  goal,
  playbooks,
  error,
  onStart,
  onBack,
}: {
  goal: GoalEntry;
  playbooks: Loadable<PlaybookEntry[]>;
  error: string | null;
  onStart: (playbookId?: string) => void;
  onBack: () => void;
}) {
  const entries = playbooks.status === 'ready' ? playbooks.data : [];

  return (
    <Region>
      <RegionHeader
        title={sprintf(
          /* translators: %s: the chosen Goal, e.g. "Grow my email list". */
          __('Ready-to-run starts for “%s”.', 'wconvert'),
          goal.label,
        )}
        trailing={<Step at={2} />}
      />

      {error !== null && <RegionError message={error} />}

      {playbooks.status === 'failed' ? (
        <RegionErrorState message={playbooks.message} />
      ) : playbooks.status === 'loading' ? (
        <RegionBody>
          <ChoiceGrid>
            {[0, 1].map((row) => (
              <ChoiceSkeleton key={row} />
            ))}
          </ChoiceGrid>
        </RegionBody>
      ) : entries.length === 0 ? (
        <EmptyState icon={Sparkles} title={__('Nothing ready-made yet', 'wconvert')}>
          {__(
            'No ready-to-run starts for this Goal yet — start from scratch below.',
            'wconvert',
          )}
        </EmptyState>
      ) : (
        <RegionBody>
          <ChoiceGrid>
            {entries.map((playbook) => (
              <ChoiceCard
                key={playbook.id}
                id={playbook.id}
                title={playbook.name}
                notes={playbook.notes}
                action={(describedBy) => (
                  <Button aria-describedby={describedBy} onClick={() => onStart(playbook.id)}>
                    {__('Use this Playbook', 'wconvert')}
                  </Button>
                )}
              />
            ))}
          </ChoiceGrid>
        </RegionBody>
      )}

      <StepFooter
        onBack={onBack}
        backLabel={__('Pick a different Goal', 'wconvert')}
        forward={
          <Button variant="outline" onClick={() => onStart()}>
            {__('Start from scratch', 'wconvert')}
          </Button>
        }
      />
    </Region>
  );
}

/**
 * Step three — the prefilled Optin, before anybody saves it.
 *
 * The preview is the REAL design with the REAL words, drawn by the same
 * dependency-free renderer the loader imports (ADR 0010) — so what the
 * merchant approves here is what a visitor sees. A draft from scratch has no
 * Template yet and shows none.
 *
 * It sits on `--surface` inside its own inset frame, because a design rendered
 * flush against a white card reads as part of this screen rather than as a
 * picture of something a visitor will see somewhere else.
 */
function DraftPreview({
  draft,
  busy,
  error,
  onSave,
  onBack,
}: {
  draft: Draft;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const template = draft.config.template as Template | undefined;

  return (
    <Region>
      <RegionHeader
        title={draft.name}
        description={__('Nothing is saved until you create it.', 'wconvert')}
        trailing={<Step at={3} />}
      />

      {error !== null && <RegionError message={error} />}

      <RegionBody>
        {template === undefined ? (
          <p className="m-0 text-muted-foreground">
            {__(
              'An empty Optin, under the Goal you picked. Choose a Template in the builder.',
              'wconvert',
            )}
          </p>
        ) : (
          <div className="flex justify-center overflow-hidden rounded-md border border-border bg-surface p-4">
            {/*
              Centred, because this is a picture of something a visitor will
              see somewhere else. Left-aligned in a 1000px frame it read as a
              panel of this screen with grey space beside it.
            */}
            <PrefilledCard template={template} />
          </div>
        )}
      </RegionBody>

      <StepFooter
        onBack={onBack}
        backLabel={__('Choose something else', 'wconvert')}
        disabled={busy}
        forward={
          <Button disabled={busy} onClick={onSave}>
            {__('Create this Optin', 'wconvert')}
          </Button>
        }
      />
    </Region>
  );
}

/**
 * How far through the flow this is.
 *
 * Three steps is few enough that a progress bar would be heavier than the fact
 * it carries, and a merchant who has just clicked into step 2 mainly wants to
 * know there is an end. `tabular-nums` so it does not jiggle between steps.
 */
function Step({ at }: { at: 1 | 2 | 3 }) {
  return (
    <span className="shrink-0 tabular-nums text-muted-foreground">
      {sprintf(
        /* translators: 1: the current step. 2: how many steps there are. */
        __('Step %1$s of %2$s', 'wconvert'),
        String(at),
        '3',
      )}
    </span>
  );
}

/**
 * The way on and the way back, at the bottom of a step.
 *
 * **The way back is a step, not an exit.** "All Optins" above the region leaves
 * the flow entirely; this returns one question. They were the same weight and
 * two clicks apart, so a merchant who wanted to change their Goal had to guess
 * which one did it.
 */
function StepFooter({
  onBack,
  backLabel,
  forward,
  disabled = false,
}: {
  onBack: () => void;
  backLabel: string;
  forward: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3">
      <Button variant="ghost" disabled={disabled} onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        {backLabel}
      </Button>
      {forward}
    </div>
  );
}

function PrefilledCard({ template }: { template: Template }) {
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mounted = mount({ displayType: 'inline', template, anchor: anchor.current });

    mounted.show();

    return () => mounted.close();
  }, [template]);

  return <div ref={anchor} />;
}
