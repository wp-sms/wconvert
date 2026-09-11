import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { GallerySkeleton } from '../builder/Gallery';
import { TemplateCard } from '../builder/TemplateCard';
import { getRules, type RuleVocabulary } from '../builder/api';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { createOptin } from '../optins/api';
import { GoalCard, offerableGoals } from './GoalCard';
import { listGoals, listPlaybooks, prefill, type GoalEntry, type PlaybookEntry } from './api';
import { StartingPointFacts } from './StartingPointFacts';
import { useBuilderViewport } from '../hooks/useBuilderViewport';

/**
 * Goal first, then a starting point. Browsing only reads; Customize explicitly
 * creates a draft and opens the editor. The editor owns review and publishing.
 * Every read belongs to the current step, so an abandoned response cannot
 * replace a later choice or start a draft after this flow was closed.
 */
export interface GoalScreenProps {
  onCreated: (id: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onCheckOptins?: () => void;
}

export function GoalScreen({ onCreated, onBusyChange, onCheckOptins }: GoalScreenProps) {
  const editorFits = useBuilderViewport();
  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);
  const [goal, setGoal] = useState<GoalEntry | null>(null);
  const [playbooks, setPlaybooks] = useState<Loadable<PlaybookEntry[]>>(LOADING);
  const [vocabulary, setVocabulary] = useState<Loadable<RuleVocabulary>>(LOADING);
  const [goalsRetry, setGoalsRetry] = useState(0);
  const [playbooksRetry, setPlaybooksRetry] = useState(0);
  const [rulesRetry, setRulesRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createUnconfirmed, setCreateUnconfirmed] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const active = useRef(false);
  const operation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; operation.current += 1; };
  }, []);
  useEffect(() => {
    onBusyChange?.(starting !== null);
    return () => onBusyChange?.(false);
  }, [onBusyChange, starting]);
  useEffect(() => {
    if (starting === null) return;
    // WordPress sidebar links and reloads leave the React navigation guard.
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [starting]);

  useEffect(() => {
    let current = true;
    setGoals(LOADING);
    void listGoals().then((entries) => { if (current) setGoals(ready(entries)); })
      .catch((cause: unknown) => { if (current) setGoals(failed(cause)); });
    return () => { current = false; };
  }, [goalsRetry]);

  useEffect(() => {
    if (goal === null) return;
    let current = true;
    setPlaybooks(LOADING);
    void listPlaybooks(goal.id).then((entries) => { if (current) setPlaybooks(ready(entries)); })
      .catch((cause: unknown) => { if (current) setPlaybooks(failed(cause)); });
    return () => { current = false; };
  }, [goal, playbooksRetry]);

  useEffect(() => {
    let current = true;
    setVocabulary(LOADING);
    void getRules().then((rules) => { if (current) setVocabulary(ready(rules)); })
      .catch((cause: unknown) => { if (current) setVocabulary(failed(cause)); });
    return () => { current = false; };
  }, [rulesRetry]);

  const choose = (chosen: GoalEntry) => {
    if (busy.current) return;
    operation.current += 1;
    setGoal(chosen);
    setPlaybooks(LOADING);
    setError(null);
    setCreateUnconfirmed(false);
  };

  const start = async (playbookId?: string) => {
    // The ref closes the same-tick double-click gap before React disables UI.
    if (goal === null || busy.current) return;
    busy.current = true;
    const request = ++operation.current;
    setStarting(playbookId ?? 'scratch');
    setError(null);
    setCreateUnconfirmed(false);
    let creating = false;
    try {
      const draft = await prefill(goal.id, playbookId);
      if (!active.current || request !== operation.current) return;
      creating = true;
      const optin = await createOptin(draft.name, draft.goal, draft.config);
      if (active.current && request === operation.current) onCreated(optin.id);
    } catch (cause) {
      if (active.current && request === operation.current) {
        setError(messageOf(cause));
        // A transport failure can arrive after POST committed. Never silently
        // repeat creation or tell the merchant that nothing was saved.
        setCreateUnconfirmed(creating);
      }
    } finally {
      if (request === operation.current) {
        busy.current = false;
        if (active.current) setStarting(null);
      }
    }
  };

  if (goal === null) {
    const shown = goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow') : [];
    return <Region>
      <RegionHeader title={__('What do you want to achieve?', 'wconvert')}
        description={__('Choose a goal, then a starting point. You can customize the design and decide when to publish in the editor.', 'wconvert')}
        trailing={<Step at={1} />} />
      {goals.status === 'failed' ? <>
        <RegionErrorState message={goals.message} hint={__('Try loading the goals again below.', 'wconvert')} />
        <RegionFooter><Button variant="outline" onClick={() => setGoalsRetry((value) => value + 1)}>{__('Retry loading goals', 'wconvert')}</Button></RegionFooter>
      </> : <RegionBody>{goals.status === 'loading' ? <ChoiceSkeleton /> : shown.length === 0 ?
        <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}>
          {__('There are no available goals on this site. Goals are provided by WConvert and the plugins that extend it.', 'wconvert')}
        </EmptyState> : <ChoiceGrid>{shown.map((entry) => <GoalCard key={entry.id} goal={entry}
          surface="creation_flow" choose={__('Choose', 'wconvert')} onChoose={choose} />)}</ChoiceGrid>}
      </RegionBody>}
    </Region>;
  }

  const entries = playbooks.status === 'ready' ? playbooks.data : [];
  const singleStartingPoint = entries.length === 1;
  return <Region>
    <RegionHeader title={__('Choose a starting point', 'wconvert')}
      description={sprintf(__('For “%s”. Choose the offer and setup that fit, then make it yours in the editor.', 'wconvert'), goal.label)}
      trailing={<Step at={2} />} />
    {!editorFits && <RegionBody><p className="m-0 text-note text-muted-foreground">
      {__('You can save a draft here. Open it on a wider screen to customize the design and publish.', 'wconvert')}
    </p></RegionBody>}
    {error !== null && <RegionError message={error} />}
    {createUnconfirmed && <RegionBody><p className="m-0 text-note">
      {__('Draft creation could not be confirmed. Check your Optins before trying again to avoid creating a second draft.', 'wconvert')}
      {onCheckOptins && <Button variant="link" size="sm" onClick={onCheckOptins}>{__('Check Optins', 'wconvert')}</Button>}
    </p></RegionBody>}
    {starting !== null && <RegionBody><p role="status" className="m-0 text-note">{__('Creating your draft and opening the editor…', 'wconvert')}</p></RegionBody>}
    {playbooks.status === 'failed' ? <>
      <RegionErrorState message={playbooks.message} hint={__('Try loading the starting points again, or start with a blank draft.', 'wconvert')} />
      <RegionBody><Button variant="outline" onClick={() => setPlaybooksRetry((value) => value + 1)}>{__('Retry loading starting points', 'wconvert')}</Button></RegionBody>
    </> : playbooks.status === 'loading' ? <RegionBody><GallerySkeleton cards={2} /></RegionBody>
      : entries.length === 0 ? <EmptyState icon={Sparkles} title={__('No starting points available', 'wconvert')}>
        {__('You can create a blank draft for this goal and choose a design in the editor.', 'wconvert')}
      </EmptyState> : <RegionBody>
        {vocabulary.status === 'failed' && <div className="mb-4 flex flex-wrap items-center gap-2 text-note">
          <span>{__('Setup details could not be loaded. You can still choose a starting point and review its rules in the editor.', 'wconvert')}</span>
          <Button variant="outline" size="sm" onClick={() => setRulesRetry((value) => value + 1)}>{__('Retry setup details', 'wconvert')}</Button>
        </div>}
        <ul className={`wconvert-gallery${singleStartingPoint ? ' wconvert-gallery--single-start' : ''}`}>{entries.map((playbook) => <TemplateCard
          key={playbook.id} id={playbook.id} name={playbook.name} template={playbook.template}
          featured={singleStartingPoint}
          absent={playbook.template === undefined ? <p>{__('This design is not available on this site. Choose a design after opening the draft.', 'wconvert')}</p> : undefined}
          action={(describedBy) => <div className="flex w-full flex-col items-start gap-3">
            <StartingPointFacts playbook={playbook} goal={goal} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null} />
            {playbook.notes && <details className="text-note text-muted-foreground"><summary>{__('About this starting point', 'wconvert')}</summary><p className="mb-0">{playbook.notes}</p></details>}
            <div className="flex flex-col items-start gap-1">
              <Button aria-describedby={`${describedBy} ${playbook.id}-draft-note`} disabled={starting !== null}
                className={singleStartingPoint ? 'h-auto min-h-9 max-w-full whitespace-normal text-start' : undefined}
                onClick={() => { void start(playbook.id); }}>{starting === playbook.id ? __('Creating draft…', 'wconvert') : __('Customize this starting point', 'wconvert')}</Button>
              <span id={`${playbook.id}-draft-note`} className="text-note text-muted-foreground">{__('Creates a draft. You publish when it is ready.', 'wconvert')}</span>
            </div>
          </div>} />)}</ul>
      </RegionBody>}
    <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" disabled={starting !== null} onClick={() => {
        if (busy.current) return;
        operation.current += 1; setGoal(null); setError(null); setCreateUnconfirmed(false);
      }}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Choose a different goal', 'wconvert')}</Button>
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" disabled={starting !== null} onClick={() => { void start(); }}>{starting === 'scratch' ? __('Creating draft…', 'wconvert') : __('Start with a blank draft', 'wconvert')}</Button>
        <span className="text-note text-muted-foreground">{__('Keep this goal and choose a design in the editor.', 'wconvert')}</span>
      </div>
    </RegionFooter>
  </Region>;
}

function Step({ at }: { at: 1 | 2 }) {
  return <span className="shrink-0 text-note text-muted-foreground">{sprintf(__('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}</span>;
}
