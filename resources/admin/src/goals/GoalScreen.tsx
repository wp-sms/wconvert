import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Check, LayoutTemplate, Search, Sparkles, X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { TemplatePacks } from '../templates/TemplatePacks';
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
import { StartingPointFacts, StartingPointSummary, startingPointDisplayType } from './StartingPointFacts';
import { displayTypeLabel, displayTypeOptions } from '../displayTypes';

/**
 * Goal first, then a starting point. Browsing only reads; Use this setup explicitly
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
  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);
  const [packsOpen, setPacksOpen] = useState(false);
  const [inspected, setInspected] = useState<PlaybookEntry | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const [collectionId, setCollectionId] = useState('all');
  const [formatId, setFormatId] = useState('all');
  const [businessId, setBusinessId] = useState('all');
  const [query, setQuery] = useState('');
  const [useCases, setUseCases] = useState<Record<string, string>>({});
  const packTrigger = useRef<HTMLButtonElement>(null);
  const collectionPicker = useRef<HTMLSelectElement>(null);
  const choseCollection = useRef(false);
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
    setCollectionId('all');
    setFormatId('all');
    setBusinessId('all');
    setQuery('');
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
    return <Region className="wconvert-creation wconvert-creation--goals">
      <Step at={1} />
      <RegionHeader title={__('What do you want to achieve?', 'wconvert')}
        description={__('Start with a goal. We’ll help you find a campaign setup to match.', 'wconvert')} />
      {goals.status === 'failed' ? <>
        <RegionErrorState message={goals.message} hint={__('Try loading the goals again below.', 'wconvert')} />
        <RegionFooter><Button variant="outline" onClick={() => setGoalsRetry((value) => value + 1)}>{__('Retry loading goals', 'wconvert')}</Button></RegionFooter>
      </> : <RegionBody className="wconvert-creation__goals">{goals.status === 'loading' ? <ChoiceSkeleton /> : shown.length === 0 ?
        <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}>
          {__('There are no available goals on this site. Goals are provided by WConvert and the plugins that extend it.', 'wconvert')}
        </EmptyState> : <ChoiceGrid>{shown.map((entry) => <GoalCard key={entry.id} goal={entry}
          surface="creation_flow" choose={__('Choose', 'wconvert')} onChoose={choose} />)}</ChoiceGrid>}
      </RegionBody>}
      <RegionFooter className="wconvert-creation__reassurance"><Check size={15} aria-hidden="true" />
        {__('Make it yours in the editor. Nothing goes live until you publish.', 'wconvert')}
      </RegionFooter>
    </Region>;
  }

  const allEntries = playbooks.status === 'ready' ? playbooks.data : [];
  const collections = new Map(allEntries.flatMap((entry) => entry.collection ? [[entry.collection.id, entry.collection.name] as const] : []));
  const businesses = new Map(allEntries.flatMap((entry) => (entry.business_types ?? []).map(({ id, label }) => [id, label] as const)));
  const availableFormats = new Set(allEntries.map(startingPointDisplayType));
  const formatOptions = displayTypeOptions().filter(({ value }) => availableFormats.has(value));
  const search = query.trim().toLocaleLowerCase();
  const matchingCollection = allEntries.filter((entry) =>
    (collectionId === 'all' || (collectionId === 'bundled' ? !entry.collection : entry.collection?.id === collectionId))
    && (businessId === 'all' || entry.business_types?.some(({ id }) => id === businessId))
    && (!search || [entry.name, entry.notes, entry.recommendation, entry.collection?.name, ...(entry.business_types ?? []).map(({ label }) => label), displayTypeLabel(startingPointDisplayType(entry))]
      .some((text) => text?.toLocaleLowerCase().includes(search))));
  const entries = matchingCollection.filter((entry) => formatId === 'all' || startingPointDisplayType(entry) === formatId);
  const clearFilters = () => { setCollectionId('all'); setFormatId('all'); setBusinessId('all'); setQuery(''); };
  const activeFilters = [
    ...(query ? [{ id: 'query', label: query, remove: () => setQuery('') }] : []),
    ...(businessId !== 'all' ? [{ id: 'business', label: businesses.get(businessId) ?? __('Selected business', 'wconvert'), remove: () => setBusinessId('all') }] : []),
    ...(formatId !== 'all' ? [{ id: 'format', label: displayTypeLabel(formatId), remove: () => setFormatId('all') }] : []),
    ...(collectionId !== 'all' ? [{ id: 'collection', label: collectionId === 'bundled'
      ? __('Included with WConvert', 'wconvert') : collections.get(collectionId) ?? __('Selected pack', 'wconvert'), remove: () => setCollectionId('all') }] : []),
  ];
  // Group only after filtering; each choice keeps its own prepared preview and settings.
  // Entries without a design ID remain independent.
  const groups = new Map<string, PlaybookEntry[]>();
  for (const entry of entries) {
    const key = `${startingPointDisplayType(entry)}:${entry.template_id || entry.id}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  const designCount = new Set(entries.map((entry) => entry.template_id || entry.id)).size;
  const singleStartingPoint = groups.size === 1;
  return <Region className="wconvert-creation">
    <Step at={2} />
    <RegionHeader title={__('Choose a campaign setup', 'wconvert')}
      description={sprintf(__('For “%s”. Customize it next.', 'wconvert'), goal.label)} />
    <div className="wconvert-picker__controls">
      <div className="wconvert-picker__search-row">
        <label className="wconvert-picker__search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{__('Search campaign setups', 'wconvert')}</span>
          <Input type="search" className="ps-9" value={query} disabled={starting !== null}
            placeholder={__('Search campaign setups', 'wconvert')} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {businesses.size > 0 && <label className="flex items-center gap-2 text-note">{__('Business', 'wconvert')}
          <select className="wconvert-picker__select" value={businessId} disabled={starting !== null} onChange={(event) => setBusinessId(event.target.value)}>
            <option value="all">{__('All businesses', 'wconvert')}</option>
            {[...businesses].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>}
        <label className="flex items-center gap-2 text-note">{__('Collection', 'wconvert')}
          <select className="wconvert-picker__select" ref={collectionPicker} value={collectionId} disabled={starting !== null} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="all">{__('All campaign setups', 'wconvert')}</option>
            <option value="bundled">{__('Included with WConvert', 'wconvert')}</option>
            {[...collections].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {collectionId !== 'all' && collectionId !== 'bundled' && !collections.has(collectionId) && <option value={collectionId}>{__('Selected pack', 'wconvert')}</option>}
          </select>
        </label>
        <Button ref={packTrigger} variant="outline" disabled={starting !== null} onClick={() => { choseCollection.current = false; setPacksOpen(true); }}>
          <LayoutTemplate size={16} aria-hidden="true" />{__('Browse template packs', 'wconvert')}
        </Button>
      </div>
      <div className="wconvert-picker__facet" role="group" aria-label={__('Format', 'wconvert')}>
        <span>{__('Format', 'wconvert')}</span>
        {[{ value: 'all', label: __('All formats', 'wconvert') }, ...formatOptions,
          ...(formatId !== 'all' && !availableFormats.has(formatId) ? [{ value: formatId, label: displayTypeLabel(formatId) }] : [])]
          .map(({ value, label }) => {
            const count = value === 'all' ? matchingCollection.length : matchingCollection.filter((entry) => startingPointDisplayType(entry) === value).length;
            return <Button key={value} variant="outline" size="sm" className="wconvert-picker__filter"
              aria-pressed={formatId === value} disabled={starting !== null || (count === 0 && formatId !== value)}
              onClick={() => setFormatId(value)}>{label}<span aria-hidden="true" className="wconvert-picker__option-count">{count}</span></Button>;
          })}
      </div>
      <div className="wconvert-picker__results">
        <span role="status">{playbooks.status === 'ready' ? sprintf(
          /* translators: 1: matching setups, 2: setups for the selected goal. */
          __('%1$s of %2$s campaign setups', 'wconvert'), String(entries.length), String(allEntries.length)) + ' · ' + sprintf(_n('%s design', '%s designs', designCount, 'wconvert'), String(designCount))
          : playbooks.status === 'loading' ? __('Loading campaign setups…', 'wconvert') : __('Campaign setups could not be loaded.', 'wconvert')}</span>
        {activeFilters.length > 0 && <div className="wconvert-picker__active">
          {activeFilters.map(({ id, label, remove }) => <button key={id} type="button" className="wconvert-picker__active-filter"
            disabled={starting !== null} aria-label={sprintf(__('Remove filter: %s', 'wconvert'), label)} onClick={remove}>
            {label}<X size={12} aria-hidden="true" />
          </button>)}
          <Button variant="link" size="sm" disabled={starting !== null} onClick={clearFilters}>{__('Clear filters', 'wconvert')}</Button>
        </div>}
      </div>
    </div>
    <Dialog open={packsOpen} onOpenChange={setPacksOpen}>
      <DialogContent className="wconvert-picker gap-0 overflow-hidden p-0 sm:max-w-[80rem]" onCloseAutoFocus={(event) => {
        event.preventDefault();
        (choseCollection.current ? collectionPicker.current : packTrigger.current)?.focus();
      }}>
        <DialogHeader className="wconvert-picker__header"><DialogTitle>{__('Template packs', 'wconvert')}</DialogTitle>
          <DialogDescription className="sr-only">{__('Install collections of designs and campaign setups.', 'wconvert')}</DialogDescription>
        </DialogHeader>
        <TemplatePacks displayType="" goal={goal.id}
          onInstalled={async () => { setPlaybooksRetry((value) => value + 1); }}
          onChooseStartingPoints={(id) => { choseCollection.current = true; setCollectionId(id); setFormatId('all'); setBusinessId('all'); setQuery(''); setPacksOpen(false); }} />
      </DialogContent>
    </Dialog>
    {error !== null && <RegionError message={error} />}
    {createUnconfirmed && <RegionBody><p className="m-0 text-note">
      {__('Draft creation could not be confirmed. Check your Campaigns before trying again to avoid creating a second draft.', 'wconvert')}
      {onCheckOptins && <Button variant="link" size="sm" onClick={onCheckOptins}>{__('Check Campaigns', 'wconvert')}</Button>}
    </p></RegionBody>}
    {starting !== null && <RegionBody><p role="status" className="m-0 text-note">{__('Creating your draft and opening the editor…', 'wconvert')}</p></RegionBody>}
    {playbooks.status === 'failed' ? <>
      <RegionErrorState message={playbooks.message} hint={__('Try loading the campaign setups again, or start with a blank draft.', 'wconvert')} />
      <RegionBody><Button variant="outline" onClick={() => setPlaybooksRetry((value) => value + 1)}>{__('Retry loading campaign setups', 'wconvert')}</Button></RegionBody>
    </> : playbooks.status === 'loading' ? <RegionBody><GallerySkeleton cards={2} /></RegionBody>
      : allEntries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups available', 'wconvert')}>
        {__('You can create a blank draft for this goal and choose a design in the editor.', 'wconvert')}
      </EmptyState> : entries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups match', 'wconvert')}
        action={<Button variant="outline" disabled={starting !== null} onClick={clearFilters}>{__('Show all campaign setups', 'wconvert')}</Button>}>
        {__('Try another search, business, format or collection.', 'wconvert')}
      </EmptyState> : <RegionBody>
        {vocabulary.status === 'failed' && <div className="mb-4 flex flex-wrap items-center gap-2 text-note">
          <span>{__('Setup details could not be loaded. You can still choose a campaign setup and review its rules in the editor.', 'wconvert')}</span>
          <Button variant="outline" size="sm" onClick={() => setRulesRetry((value) => value + 1)}>{__('Retry setup details', 'wconvert')}</Button>
        </div>}
        <ul className={`wconvert-gallery${singleStartingPoint ? ' wconvert-gallery--single-start' : ''}`}>{[...groups].map(([designId, variants]) => {
          const playbook = variants.find((entry) => entry.id === useCases[designId]) ?? variants[0];
          return <TemplateCard
          key={designId} id={playbook.id} name={playbook.name} template={playbook.template}
          displayType={startingPointDisplayType(playbook)}
          featured={singleStartingPoint}
          absent={playbook.template === undefined ? <p>{__('This design is not available on this site. Choose a design after opening the draft.', 'wconvert')}</p> : undefined}
          action={(describedBy) => <div className="flex w-full flex-col items-start gap-2">
            {variants.length > 1 && <label className="flex w-full flex-col gap-1 text-note">
              {sprintf(__('Use case · %s setups share this design', 'wconvert'), String(variants.length))}
              <select className="wconvert-picker__select max-w-full" value={playbook.id} disabled={starting !== null}
                aria-label={sprintf(__('Use case for %s', 'wconvert'), variants[0].name)}
                onChange={(event) => { const id = event.target.value; setUseCases((current) => ({ ...current, [designId]: id })); }}>
                {variants.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{displayTypeLabel(startingPointDisplayType(playbook))}</Badge>
              {playbook.business_types?.map(({ id, label }) => <Badge key={id} variant="outline">{label}</Badge>)}
              {playbook.collection && <Badge variant="outline">{playbook.collection.name}</Badge>}
            </div>
            {playbook.recommendation ? <p className="m-0 text-note font-medium text-foreground">{playbook.recommendation}</p> : null}
            <StartingPointSummary playbook={playbook} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null} />
            <div className="flex flex-wrap items-center gap-2">
              <Button aria-describedby={describedBy} disabled={starting !== null}
                className={singleStartingPoint ? 'h-auto min-h-9 max-w-full whitespace-normal text-start' : undefined}
                onClick={() => { void start(playbook.id); }}>{starting === playbook.id ? __('Creating draft…', 'wconvert') : __('Use this setup', 'wconvert')}</Button>
              <Button variant="ghost" size="sm" disabled={starting !== null}
                aria-label={sprintf(__('Setup details for %s', 'wconvert'), playbook.name)}
                onClick={(event) => { detailTrigger.current = event.currentTarget; setInspected(playbook); }}>
                {__('Setup details', 'wconvert')}
              </Button>
            </div>
          </div>} />; })}</ul>
      </RegionBody>}
    <Dialog open={inspected !== null} onOpenChange={(open) => { if (!open) setInspected(null); }}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto" onCloseAutoFocus={(event) => {
        event.preventDefault(); detailTrigger.current?.focus();
      }}>
        {inspected && <>
          <DialogHeader>
            <DialogTitle>{inspected.name}</DialogTitle>
            <DialogDescription>{__('Review this setup. You can change it in the editor.', 'wconvert')}</DialogDescription>
          </DialogHeader>
          <StartingPointFacts playbook={inspected} goal={goal} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null} />
          {inspected.notes && !(inspected.template && inspected.template.tree.steps.length > 1) && <p className="m-0 text-note text-muted-foreground">{inspected.notes}</p>}
          <Button variant="outline" onClick={() => setInspected(null)}>{__('Back to setups', 'wconvert')}</Button>
        </>}
      </DialogContent>
    </Dialog>
    <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" disabled={starting !== null} onClick={() => {
        if (busy.current) return;
        operation.current += 1; setGoal(null); setError(null); setCreateUnconfirmed(false);
      }}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Choose a different goal', 'wconvert')}</Button>
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" disabled={starting !== null} onClick={() => { void start(); }}>{starting === 'scratch' ? __('Creating draft…', 'wconvert') : __('Start with a blank draft', 'wconvert')}</Button>
        <span className="text-note text-muted-foreground">{__('Nothing goes live until you publish.', 'wconvert')}</span>
      </div>
    </RegionFooter>
  </Region>;
}

function Step({ at }: { at: 1 | 2 }) {
  return <nav className="wconvert-creation__steps" aria-label={sprintf(__('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}>
    <span className="sr-only">{sprintf(__('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}</span>
    <ol>
      {[__('Choose a goal', 'wconvert'), __('Choose a setup', 'wconvert')].map((label, index) => <li key={label} aria-current={at === index + 1 ? 'step' : undefined}>
        <span className="wconvert-creation__step-number" aria-hidden="true">{index + 1 < at ? <Check size={14} /> : index + 1}</span>{label}
      </li>)}
    </ol>
  </nav>;
}
