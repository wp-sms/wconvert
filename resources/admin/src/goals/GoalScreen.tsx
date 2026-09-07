import { useCallback, useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Template } from '@renderer/types';
import { Button } from '../components/ui/button';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { GallerySkeleton } from '../builder/Gallery';
import { Preview } from '../builder/Preview';
import { TemplateCard } from '../builder/TemplateCard';
import { EmptyState } from '../shell/EmptyState';
import {
  Region,
  RegionBody,
  RegionError,
  RegionErrorState,
  RegionFooter,
  RegionHeader,
} from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { createOptin } from '../optins/api';
import { GoalCard, offerableGoals } from './GoalCard';
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
  const [starting, setStarting] = useState(false);

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

  /**
   * **Step two's own busy flag, which it did not have.**
   *
   * `prefill` is a round trip and nothing said so: *Use this Playbook* and
   * *Start from scratch* stayed live with nothing happening, so a merchant on
   * a slow connection pressed twice and started two prefills. Step three
   * already guards its create with `busy`; this is the same guard on the step
   * before it.
   *
   * A real `disabled` rather than `aria-disabled`, and that is the line the
   * admin now draws: a control refused because of what this site IS keeps
   * focus so its reason stays reachable, and a control that is merely BUSY
   * takes the pointer and the keyboard out of the way for the half-second it
   * is working.
   */
  const start = (playbookId?: string) => {
    if (goal === null) {
      return;
    }

    setStarting(true);
    setError(null);

    prefill(goal.id, playbookId)
      .then(setDraft)
      .catch(report)
      .finally(() => setStarting(false));
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
        starting={starting}
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
        />
      </Region>
    );
  }

  const shown = goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow') : [];

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
          <ChoiceSkeleton />
        ) : shown.length === 0 ? (
          /*
           * **The third state step one was missing.** Loading and failed were
           * both here; `ready` with nothing in it rendered an empty
           * `ChoiceGrid` — a blank region under a question nobody could
           * answer. ADR 0039 asks every region for all three, and this was
           * the last one on this branch still owing one. Found by #74's pass,
           * which forced the state rather than waiting for a site to reach it.
           *
           * **It carries no action, deliberately.** Every other empty state
           * here names the door that fixes it, and there is no door: what is
           * missing is a [[Goal]] registry entry, which arrives from the
           * plugin or from a third party and never from anything a merchant
           * can press. The sentence says what would fill it instead — an
           * honest dead end beats a button that pretends.
           *
           * Reachable because `shown` is filtered: [[Availability]]
           * `unavailable` HIDES rather than explains in a creation flow
           * (ADR 0026), so a site every Goal is unavailable on empties this
           * grid rather than shortening it.
           */
          <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}>
            {__(
              'Nothing on this site can be captured against a goal yet. Goals arrive with WConvert and with the plugins that extend it.',
              'wconvert',
            )}
          </EmptyState>
        ) : (
          <ChoiceGrid>
            {/*
              **The card is {@see GoalCard}'s**, and the filter above is
              {@see offerableGoals}'s. Both moved out when the builder grew a
              way to CHANGE a Goal (ADR 0059): two screens rendering an
              [[Availability]] would be two places for *"never sell Pro for
              something Pro would not give them"* to stop agreeing, which is
              the load-bearing half of `renderingFor` and not a detail.
            */}
            {shown.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                surface="creation_flow"
                choose={__('Choose', 'wconvert')}
                onChoose={onChoose}
              />
            ))}
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
 * ============================================================================
 * IT DREW A HEADING, A PARAGRAPH AND A BUTTON (#68, #79).
 * ============================================================================
 * This is where a merchant chooses between ready-to-run starts, and it showed
 * them as `ChoiceCard`s — three lines of text apiece — while step 3, one click
 * later, draws the real design. The product's whole claim is that there are no
 * thumbnails anywhere in this flow because the REAL thing is cheap to draw
 * (ADR 0010), and this was the one screen in the flow not making it.
 *
 * So each card is the design this Playbook would prefill, **with that
 * Playbook's words already in it** — which is a different object from a
 * [[Template]] and is why {@see TemplateCard} is shared and the picker's facet
 * toolbar is not. The composition is `Prefill`'s own, called on the server, so
 * what is drawn here is byte-identical to step 3 and to what creating it
 * stores.
 *
 * **No dialog, because this is not the builder.** The picker opens one to buy
 * the grid the width the builder's pinned preview leaves it (ADR 0038); this
 * step already has the full width and no pinned preview, so the grid renders
 * inline — and, unlike the builder, it has to work to 360px.
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
  starting,
  onStart,
  onBack,
}: {
  goal: GoalEntry;
  playbooks: Loadable<PlaybookEntry[]>;
  error: string | null;
  /** A prefill is in flight, so neither way forward may be pressed again. */
  starting: boolean;
  onStart: (playbookId?: string) => void;
  onBack: () => void;
}) {
  const entries = playbooks.status === 'ready' ? playbooks.data : [];

  return (
    /*
      **Capped to a reading measure, because a step is not a chooser.** Step one
      offers four Goals and wants every pixel of the measure; steps two and three
      often hold ONE card, and one card in a 1152px region is 400px of content
      beside 700px of white — which reads as a grid that failed to load rather
      than as a step with one option. `ChoiceGrid` uses `auto-fill` for exactly
      this reason one level down; this is the same argument one level up, and
      `.wconvert-gallery` — which this step draws now — uses `auto-fill` for the
      same reason again.
    */
    <Region className="max-w-3xl">
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
        /*
          **The skeleton is in the shape of what is coming**, which is now a
          grid of rendered designs rather than a grid of paragraphs — so it is
          `GallerySkeleton` and not `ChoiceSkeleton` (ADR 0039). Two, because
          most Goals have one or two Playbooks and a screen of six placeholders
          would promise a library this step does not have.
        */
        <RegionBody>
          <GallerySkeleton cards={2} />
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
          <ul className="wconvert-gallery">
            {entries.map((playbook) => (
              <TemplateCard
                key={playbook.id}
                id={playbook.id}
                name={playbook.name}
                notes={playbook.notes}
                template={playbook.template}
                action={(describedBy) => (
                  <Button
                    aria-describedby={describedBy}
                    disabled={starting}
                    onClick={() => onStart(playbook.id)}
                  >
                    {__('Use this Playbook', 'wconvert')}
                  </Button>
                )}
              />
            ))}
          </ul>
        </RegionBody>
      )}

      <StepFooter
        onBack={onBack}
        backLabel={__('Pick a different Goal', 'wconvert')}
        forward={
          <Button variant="outline" disabled={starting} onClick={() => onStart()}>
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
    <Region className="max-w-3xl">
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
    <RegionFooter className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Button variant="ghost" disabled={disabled} onClick={onBack}>
        {/*
          **Back is the other way in Persian.** A glyph that points along the
          reading direction has to turn with it, and nothing in this admin was
          mirrored at all — `rtl:-scale-x-100` is the whole of it, keyed on the
          `dir` attribute WordPress writes on `<html>`.
        */}
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        {backLabel}
      </Button>
      {forward}
    </RegionFooter>
  );
}

/**
 * The prefilled design, drawn by {@see Preview} rather than by a `mount()` of
 * its own.
 *
 * It had its own copy of the mount effect, which was three lines and looked
 * harmless — and then #77 landed: the admin has to resolve the site's privacy
 * policy at the render, because resolving it into a config the flow POSTs back
 * would freeze the href at publish (ADR 0032). A second mount is a second place
 * that has to remember, and this one did not: step 3's fine print read *"See
 * our."* while the front end read it correctly.
 *
 * One call site for the renderer in the admin is what makes that unrepeatable.
 */
function PrefilledCard({ template }: { template: Template }) {
  return <Preview template={template} />;
}
