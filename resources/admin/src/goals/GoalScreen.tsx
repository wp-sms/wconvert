import { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
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
 * who walks the whole flow and closes the tab has written nothing.
 */
export function GoalScreen() {
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [goal, setGoal] = useState<GoalEntry | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  useEffect(() => {
    listGoals().then(setGoals).catch(report);
  }, [report]);

  const choose = (chosen: GoalEntry) => {
    setGoal(chosen);
    setDraft(null);
    setPlaybooks([]);
    listPlaybooks(chosen.id).then(setPlaybooks).catch(report);
  };

  const start = (playbookId?: string) => {
    if (goal === null) {
      return;
    }

    prefill(goal.id, playbookId).then(setDraft).catch(report);
  };

  const save = () => {
    if (draft === null) {
      return;
    }

    setBusy(true);

    createOptin(draft.name, draft.goal, draft.config)
      .then(() => {
        setDraft(null);
        setGoal(null);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  return (
    <section className="wconvert-goal-screen">
      <h2>{__('Create an Optin', 'wconvert')}</h2>

      {error !== null && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      {goal === null && <GoalPicker goals={goals} onChoose={choose} />}

      {goal !== null && draft === null && (
        <PlaybookGallery goal={goal} playbooks={playbooks} onStart={start} onBack={() => setGoal(null)} />
      )}

      {draft !== null && <DraftPreview draft={draft} busy={busy} onSave={save} onBack={() => setDraft(null)} />}
    </section>
  );
}

/**
 * The goal screen — **the front door of the creation flow**, which is what
 * decides how it renders an absence.
 *
 * An `unavailable` Goal is **absent**: not greyed out, not explained. A
 * `locked` one is an upsell card, because Pro is buyable from us. And where
 * both apply the server has already resolved it to `unavailable`, so this
 * screen hides it — a merchant with no store is never sold Pro for a feature
 * Pro would not give them either (ADR 0026).
 */
function GoalPicker({ goals, onChoose }: { goals: GoalEntry[]; onChoose: (goal: GoalEntry) => void }) {
  const shown = goals.filter((goal) => renderingFor(goal.availability, 'creation_flow') !== 'hide');

  return (
    <>
      <p>{__('What do you want this Optin to do?', 'wconvert')}</p>
      <ul className="wconvert-goals">
        {shown.map((goal) => {
          const rendering = renderingFor(goal.availability, 'creation_flow');

          return (
            <li key={goal.id} className={`wconvert-goal wconvert-goal--${rendering}`}>
              <h3>{goal.label}</h3>
              <p>{goal.description}</p>
              {rendering === 'upsell' ? (
                // Bundled copy, never fetched (ADR 0015).
                <p className="wconvert-upsell">{__('Available with WConvert Pro.', 'wconvert')}</p>
              ) : (
                <button type="button" className="button button-primary" onClick={() => onChoose(goal)}>
                  {__('Choose', 'wconvert')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * The gallery, **filtered on Goal only** — the server did the filtering, and
 * there is no second control here to make Display Type an axis.
 *
 * "Start from scratch" sits beside the cards rather than replacing them,
 * because it skips the Playbook and not the Goal: the merchant has already
 * answered the one question that is asked before anything else.
 */
function PlaybookGallery({
  goal,
  playbooks,
  onStart,
  onBack,
}: {
  goal: GoalEntry;
  playbooks: PlaybookEntry[];
  onStart: (playbookId?: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <p>
        {/* translators: %s: the chosen Goal, e.g. "Grow my email list". */}
        {sprintf(__('Ready-to-run starts for “%s”.', 'wconvert'), goal.label)}
      </p>
      {playbooks.length === 0 && (
        <p className="wconvert-playbooks__empty">
          {__('No ready-to-run starts for this Goal yet — start from scratch below.', 'wconvert')}
        </p>
      )}
      <ul className="wconvert-playbooks">
        {playbooks.map((playbook) => (
          <li key={playbook.id} className="wconvert-playbook">
            <h3>{playbook.name}</h3>
            <p className="wconvert-playbook__notes">{playbook.notes}</p>
            <button type="button" className="button button-primary" onClick={() => onStart(playbook.id)}>
              {__('Use this Playbook', 'wconvert')}
            </button>
          </li>
        ))}
      </ul>
      <p>
        <button type="button" className="button" onClick={() => onStart()}>
          {__('Start from scratch', 'wconvert')}
        </button>{' '}
        <button type="button" className="button button-link" onClick={onBack}>
          {__('Pick a different Goal', 'wconvert')}
        </button>
      </p>
    </>
  );
}

/**
 * The prefilled Optin, before anybody saves it.
 *
 * The preview is the REAL design with the REAL words, drawn by the same
 * dependency-free renderer the loader imports (ADR 0010) — so what the
 * merchant approves here is what a visitor sees. A draft from scratch has no
 * Template yet and shows none.
 */
function DraftPreview({
  draft,
  busy,
  onSave,
  onBack,
}: {
  draft: Draft;
  busy: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const template = draft.config.template as Template | undefined;

  return (
    <>
      <h3>{draft.name}</h3>
      {template === undefined ? (
        <p>{__('An empty Optin, under the Goal you picked. Choose a Template in the builder.', 'wconvert')}</p>
      ) : (
        <PrefilledCard template={template} />
      )}
      <p>
        <button type="button" className="button button-primary" disabled={busy} onClick={onSave}>
          {__('Create this Optin', 'wconvert')}
        </button>{' '}
        <button type="button" className="button button-link" disabled={busy} onClick={onBack}>
          {__('Choose something else', 'wconvert')}
        </button>
      </p>
    </>
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
