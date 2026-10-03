import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Check, LayoutTemplate, Sparkles, Star, X } from 'lucide-react';
import { CompareSelection } from '../discovery/CompareSelection';
import { ComparisonTray } from '../discovery/ComparisonTray';
import { PickerPagination } from '../discovery/PickerPagination';
import { PickerSearch } from '../discovery/PickerSearch';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { PickerDialogContent, PickerDialogHeader, PickerDialogBody, PickerDialogFooter } from '../discovery/PickerDialog';
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
import { StartingPointFacts, startingPointDisplayType } from './StartingPointFacts';
import { usePicker } from '../discovery/usePicker';
import { useSetupPreviews } from '../discovery/useSetupPreviews';
import { designKey, groupSetups, matchingCollections, preferredStage } from '../discovery/model';
import { CollectionShelf } from '../discovery/CollectionShelf';
import { PickerSettings } from '../discovery/PickerSettings';
import { SetupPreview } from '../discovery/SetupPreview';
import { SetupComparison } from '../discovery/SetupComparison';
import type { Collection } from '../discovery/api';
import { displayTypeLabel, displayTypeOptions } from '../displayTypes';
import { isShown, tierProductName } from './availability';
import { OptionStrip } from '../shell/OptionStrip';
import { matchesSearch } from '../discovery/search';

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
  const detailGroup = useRef<string | null>(null);
  const modalOrigin = useRef<HTMLElement | null>(null);
  const modalTitle = useRef<HTMLHeadingElement | null>(null);
  const modalContent = useRef<HTMLDivElement | null>(null);
  const collectionScroll = useRef(0);
  const [collectionId, setCollectionId] = useState('all');
  const [formatId, setFormatId] = useState('all');
  const [businessId, setBusinessId] = useState('all');
  const [query, setQuery] = useState('');
  const picker = usePicker();
  const [savedOnly, setSavedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [settings, setSettings] = useState(false);
  const [allCollections, setAllCollections] = useState(false);
  const [editorialCollection, setEditorialCollection] = useState<Collection | null>(null);
  const [stage, setStage] = useState('any');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [helper, setHelper] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [page, setPage] = useState(0);
  const libraryPosition = useRef<{ scroll: number; trigger: HTMLElement | null; page: number; allCollections: boolean }>({ scroll: 0, trigger: null, page: 0, allCollections: false });

  const [useCases, setUseCases] = useState<Record<string, string>>({});
  const packTrigger = useRef<HTMLButtonElement>(null);
  const collectionPicker = useRef<HTMLSelectElement>(null);
  const choseCollection = useRef(false);
  const [goal, setGoal] = useState<GoalEntry | null>(null);
  const [playbooks, setPlaybooks] = useState<Loadable<PlaybookEntry[]>>(LOADING);
  const previewEntries = playbooks.status === 'ready' ? playbooks.data : [];
  const previews = useSetupPreviews(goal?.id ?? '', previewEntries);
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
    setQuery(''); setCompareIds([]); setComparing(false); setSort('recommended'); setSavedOnly(false); setAvailableOnly(false); setEditorialCollection(null); setAllCollections(false); setPage(0);
    setPlaybooks(LOADING);
    setError(null);
    setCreateUnconfirmed(false);
  };

  const start = async (playbookId?: string) => {
    // The ref closes the same-tick double-click gap before React disables UI.
    if (goal === null || busy.current) return;
    const choice = previewEntries.find(entry => entry.id === playbookId);
    if (choice?.availability && choice.availability !== 'ready') return;
    busy.current = true;
    const request = ++operation.current;
    setStarting(playbookId ?? 'scratch');
    setError(null);
    setCreateUnconfirmed(false);
    let creating = false;
    try {
      const selected = previewEntries.find(entry => entry.id === playbookId);
      const prepared = selected && previews.previews.get(selected.id);
      const draft = selected?.revision ? await prefill(goal.id, playbookId, selected.revision, prepared?.prepared_revision) : await prefill(goal.id, playbookId);
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

  const selectedOccasion = picker.data?.occasions.items.find(item => item.id === occasion);
  // A setup this install could only buy is not a setup on a free install
  // (ADR 0116); a paid one still sees the next rung's, explained.
  const allEntries = playbooks.status === 'ready' ? playbooks.data.filter((entry) => isShown(entry.availability ?? 'ready')) : [];
  const collections = new Map(allEntries.flatMap((entry) => entry.collection ? [[entry.collection.id, entry.collection.name] as const] : []));
  const businesses = new Map(allEntries.flatMap((entry) => (entry.business_types ?? []).map(({ id, label }) => [id, label] as const)));
  const availableFormats = new Set(allEntries.map(startingPointDisplayType));
  const formatOptions = displayTypeOptions().filter(({ value }) => availableFormats.has(value));
  const search = query.trim().toLocaleLowerCase();
  const matchingCollection = allEntries.filter((entry) =>
    (collectionId === 'all' || (collectionId === 'bundled' ? !entry.collection : entry.collection?.id === collectionId))
    && (businessId === 'all' || !entry.business_types?.length || entry.business_types.some(({ id }) => id === businessId))
    && (!savedOnly || picker.data?.preferences.saved.includes(designKey(entry)))
    && (!availableOnly || !entry.availability || entry.availability === 'ready')
    && matchesSearch(search, [entry.name, entry.notes, entry.recommendation, entry.collection?.name, ...(entry.business_types ?? []).map(({ label }) => label), displayTypeLabel(startingPointDisplayType(entry))]));
  const filtered = matchingCollection.filter((entry) => formatId === 'all' || startingPointDisplayType(entry) === formatId);
  const collectionEligible = filtered.filter(entry => !entry.availability || entry.availability === 'ready');
  const effectiveStage = editorialCollection && stage !== 'any' && !editorialCollection.items.some(item => item.stage === stage && collectionEligible.some(entry => entry.id === item.setup_id))
    ? preferredStage(editorialCollection, picker.data?.today ?? '', collectionEligible, selectedOccasion) : stage;
  const collectionItems = editorialCollection?.items.filter(item => effectiveStage === 'any' || item.stage === effectiveStage);
  const entries = collectionItems ? collectionEligible.filter(entry => collectionItems.some(item => item.setup_id === entry.id)) : filtered;
  const relevant = picker.data ? matchingCollections(picker.data, filtered, false) : [];
  const featured = picker.data ? matchingCollections(picker.data, filtered, true) : [];
  const openCollection = (collection: Collection) => {
    libraryPosition.current = { scroll: window.scrollY, trigger: document.activeElement as HTMLElement | null, page, allCollections };
    modalOrigin.current = document.activeElement as HTMLElement | null;
    setEditorialCollection(collection); setAllCollections(false); setPage(0);
    setStage(preferredStage(collection, picker.data?.today ?? '', collectionEligible, selectedOccasion));
  };
  const backToLibrary = () => {
    setEditorialCollection(null); setAllCollections(libraryPosition.current.allCollections); setPage(libraryPosition.current.page); setSettings(false);
    requestAnimationFrame(() => { window.scrollTo(0, libraryPosition.current.scroll); libraryPosition.current.trigger?.focus({ preventScroll: true }); });
  };

  const clearFilters = () => { setCollectionId('all'); setFormatId('all'); setBusinessId('all'); setQuery(''); setSavedOnly(false); setAvailableOnly(false); setPage(0); };
  const activeFilters = [
    ...(availableOnly ? [{ id: 'availability', label: __('Available on this site', 'wconvert'), remove: () => setAvailableOnly(false) }] : []),
    ...(savedOnly ? [{ id: 'saved', label: __('Saved designs', 'wconvert'), remove: () => setSavedOnly(false) }] : []),
    ...(query ? [{ id: 'query', label: query, remove: () => setQuery('') }] : []),
    ...(businessId !== 'all' ? [{ id: 'business', label: businesses.get(businessId) ?? __('Selected business', 'wconvert'), remove: () => setBusinessId('all') }] : []),
    ...(formatId !== 'all' ? [{ id: 'format', label: displayTypeLabel(formatId), remove: () => setFormatId('all') }] : []),
    ...(collectionId !== 'all' ? [{ id: 'collection', label: collectionId === 'bundled'
      ? __('Included with WConvert', 'wconvert') : collections.get(collectionId) ?? __('Selected pack', 'wconvert'), remove: () => setCollectionId('all') }] : []),
  ];
  const groups = groupSetups(entries);
  const designCount = new Set(entries.map(designKey)).size;
  const pageCount = Math.max(1, Math.ceil(groups.size / 24));
  const shownPage = Math.min(page, pageCount - 1);
  const sortedGroups = [...groups];
  if (sort === 'name') sortedGroups.sort((a, b) => a[1][0].name.localeCompare(b[1][0].name));
  const pagedGroups = sortedGroups.slice(shownPage * 24, (shownPage + 1) * 24);
  const inspectedPreview = inspected && previews.previews.get(inspected.id);
  const inspectedEntry = inspected && (inspectedPreview?.revision === inspected.revision ? inspectedPreview ?? inspected : inspected);
  const inspectedChoices = inspected ? (comparing ? allEntries : entries).filter(entry => designKey(entry) === designKey(inspected) && startingPointDisplayType(entry) === startingPointDisplayType(inspected)) : [];
  const comparisonEntries = compareIds.flatMap(id => {
    const entry = allEntries.find(value => value.id === id); const prepared = previews.previews.get(id);
    return entry ? [prepared?.revision === entry.revision ? prepared ?? entry : entry] : [];
  });
  const comparisonControls = <ComparisonTray names={comparisonEntries.map(entry=>entry.name)} disabled={starting !== null} onClear={()=>setCompareIds([])} onCompare={event => {
    if (!editorialCollection) modalOrigin.current = event.currentTarget; collectionScroll.current = modalContent.current?.scrollTop ?? 0;
    comparisonEntries.forEach(entry => previews.onNear(entry.id)); setComparing(true);
    requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); });
  }} />;
  const setupGallery = playbooks.status === 'failed' ? <>
      <RegionErrorState message={playbooks.message} hint={__('Try loading the campaign setups again, or start with a blank draft.', 'wconvert')} />
      <RegionBody><Button variant="outline" onClick={() => setPlaybooksRetry((value) => value + 1)}>{__('Retry loading campaign setups', 'wconvert')}</Button></RegionBody>
    </> : playbooks.status === 'loading' ? <RegionBody><GallerySkeleton cards={2} /></RegionBody>
      : allEntries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups available', 'wconvert')}>
        {__('You can create a blank draft for this goal and choose a design in the editor.', 'wconvert')}
      </EmptyState> : entries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups match', 'wconvert')}
        action={<Button variant="outline" disabled={starting !== null} onClick={clearFilters}>{__('Show all campaign setups', 'wconvert')}</Button>}>
        {savedOnly ? __('No saved designs match this goal and your filters. Saved designs are shared with the editor’s design picker; manage unavailable designs in My occasions & preferences.', 'wconvert') : __('Try another search, business, format or collection.', 'wconvert')}
      </EmptyState> : <RegionBody className={editorialCollection ? 'px-0' : undefined}>
        {vocabulary.status === 'failed' && <div className="mb-4 flex flex-wrap items-center gap-2 text-note">
          <span>{__('Setup details could not be loaded. You can still choose a campaign setup and review its rules in the editor.', 'wconvert')}</span>
          <Button variant="outline" onClick={() => setRulesRetry((value) => value + 1)}>{__('Retry setup details', 'wconvert')}</Button>
        </div>}
        <ul className="wconvert-gallery">{pagedGroups.map(([designId, variants]) => {
          const selected = variants.find((entry) => entry.id === useCases[designId]) ?? variants[0];
          const prepared = previews.previews.get(selected.id);
          const playbook = prepared?.revision === selected.revision ? prepared ?? selected : selected;
          return <TemplateCard
          key={designId} id={playbook.id} name={playbook.name} template={playbook.template}
          displayType={startingPointDisplayType(playbook)}
          onNear={previews.onNear} loadError={previews.failed.has(playbook.id)} onRetry={() => previews.retry(playbook.id)}
          reason={playbook.availability === 'locked' ? sprintf(__('Available with %s', 'wconvert'), tierProductName(undefined)) : playbook.availability === 'unavailable' ? __('This setup needs a design that is not installed.', 'wconvert') : undefined}
          absent={playbook.template === undefined && (!playbook.revision || (playbook.availability !== undefined && playbook.availability !== 'ready')) ? <p>{__('This design is not available on this site.', 'wconvert')}</p> : undefined}
          selected={compareIds.some(id => variants.some(entry => entry.id === id))}
          saveAction={<Button variant="ghost" size="icon" className="wconvert-picker__save" disabled={picker.saving || !picker.data} aria-pressed={picker.data?.preferences.saved.includes(designKey(playbook)) ?? false} aria-label={sprintf(__('Save design: %s', 'wconvert'), playbook.name)} onClick={() => picker.toggleSaved(designKey(playbook))}><Star size={17} fill={picker.data?.preferences.saved.includes(designKey(playbook)) ? 'currentColor' : 'none'} /></Button>}
          marks={<><Badge variant="outline">{displayTypeLabel(startingPointDisplayType(playbook))}</Badge>
            {variants.length > 1 && <span>{sprintf(_n('%s use case', '%s use cases', variants.length, 'wconvert'), String(variants.length))}</span>}
            {playbook.template && <span>{sprintf(_n('%s screen', '%s screens', playbook.template.tree.steps.length, 'wconvert'), String(playbook.template.tree.steps.length))}</span>}
          </>}
          notes={playbook.recommendation || playbook.business_types?.map(item => item.label).join(' · ') || undefined}
          selection={<CompareSelection name={playbook.name} checked={compareIds.some(id => variants.some(entry => entry.id === id))}
            disabled={starting !== null || (compareIds.length >= 2 && !compareIds.some(id => variants.some(entry => entry.id === id)))} onChange={() => {
              setCompareIds(current => current.some(id => variants.some(entry => entry.id === id)) ? current.filter(id => !variants.some(entry => entry.id === id)) : [...current, playbook.id]);
            }} />}
          action={(describedBy) => <Button ref={node => { if (detailGroup.current === designId) detailTrigger.current = node; }} variant="outline" aria-describedby={describedBy} disabled={starting !== null}
                aria-label={sprintf(__('Setup details for %s', 'wconvert'), playbook.name)}
                onClick={(event) => { detailGroup.current = designId; detailTrigger.current = event.currentTarget; if (!editorialCollection) modalOrigin.current = event.currentTarget; collectionScroll.current = modalContent.current?.scrollTop ?? 0; previews.onNear(playbook.id); setInspected(playbook); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); }); }}>
                {__('Preview & details', 'wconvert')}
              </Button>} />; })}</ul>
        {!editorialCollection && <PickerPagination page={shownPage} pages={pageCount} disabled={starting !== null} onChange={setPage} />}
      </RegionBody>;
  const collectionDetails = editorialCollection ? <section className="wconvert-collection-detail">
      {selectedOccasion && <p className="text-note">{sprintf(__('Ideas for %1$s · %2$s – %3$s. Set campaign dates separately in the editor.', 'wconvert'), selectedOccasion.name, selectedOccasion.start, selectedOccasion.end)}</p>}
      {editorialCollection.event && !selectedOccasion && <div className="wconvert-collection-detail__event"><p>{sprintf(__('Event starts %s', 'wconvert'), editorialCollection.event.start)}</p><Button variant="ghost" disabled={picker.saving} onClick={() => { if (picker.data && editorialCollection.event) void picker.preferences({ ...picker.data.preferences, events: [...picker.data.preferences.events, editorialCollection.event.family] }); backToLibrary(); }}>{__('I don’t run this event', 'wconvert')}</Button></div>}
      {editorialCollection.items.some(item => item.stage !== 'any') && <OptionStrip label={__('Campaign stage', 'wconvert')} value={effectiveStage}
        options={[
          ['any', __('All stages', 'wconvert')], ['before', __('Before', 'wconvert')], ['during', __('During', 'wconvert')], ['after', __('After', 'wconvert')],
        ].map(([id, label]) => ({ value: id, label,
          count: collectionEligible.filter(entry => editorialCollection.items.some(item => item.setup_id === entry.id && (id === 'any' || item.stage === id))).length,
          disabled: id !== 'any' && !editorialCollection.items.some(item => item.stage === id && collectionEligible.some(entry => entry.id === item.setup_id)),
        }))} onChange={id => { setStage(id); setPage(0); }} />}
      {effectiveStage !== stage && <p role="status" className="text-note">{__('Your filters have no setups in the previous stage. Showing a matching stage instead.', 'wconvert')}</p>}
      {picker.data && editorialCollection.event && picker.data.today >= editorialCollection.event.end_exclusive && <p className="text-note">{__('This event has ended. These setups remain reusable; review new campaign dates and offer terms in the editor.', 'wconvert')}</p>}
    </section> : null;
  if (settings) return <Region className="wconvert-creation">
    <PickerSettings picker={picker} onBack={backToLibrary} onPlan={id => { setOccasion(id); setSettings(false); setAllCollections(false); setEditorialCollection(null); setPage(0); }} />
  </Region>;
  return <Region className="wconvert-creation">
    <Step at={2} />
    <RegionHeader title={__('Choose a campaign setup', 'wconvert')}
      description={sprintf(__('For “%s”. Customize it next.', 'wconvert'), goal.label)} />
    {picker.error && <div className="wconvert-picker__notice" role="alert">{picker.error} <Button variant="link" onClick={() => { void picker.reload(); }}>{__('Reload preferences', 'wconvert')}</Button></div>}
    <div className="wconvert-picker__controls wconvert-toolbar">
      <div className="wconvert-picker__search-row">
        <PickerSearch label={__('Search campaign setups', 'wconvert')} value={query} disabled={starting !== null} onChange={value => {setQuery(value);setPage(0);}} />
        <Button variant="outline" disabled={starting !== null || !picker.data} aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setPage(0); }}>{sprintf(__('Saved %s', 'wconvert'), String(picker.data?.preferences.saved.length ?? 0))}</Button>
        <Button variant="outline" disabled={starting !== null} onClick={() => { libraryPosition.current = { scroll: window.scrollY, trigger: document.activeElement as HTMLElement | null, page, allCollections }; setSettings(true); void picker.reload(); }}>{__('My occasions & preferences', 'wconvert')}</Button>
      </div>
      <div className="wconvert-picker__search-row wconvert-picker__secondary">
        {businesses.size > 0 && <label className="flex items-center gap-2 text-note">{__('Business', 'wconvert')}
          <select className="wconvert-picker__select" value={businessId} disabled={starting !== null} onChange={(event) => { setBusinessId(event.target.value); setPage(0); }}>
            <option value="all">{__('All businesses', 'wconvert')}</option>
            {[...businesses].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>}
        <label className="flex items-center gap-2 text-note">{__('Source', 'wconvert')}
          <select className="wconvert-picker__select" ref={collectionPicker} value={collectionId} disabled={starting !== null} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="all">{__('All campaign setups', 'wconvert')}</option>
            <option value="bundled">{__('Included with WConvert', 'wconvert')}</option>
            {[...collections].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {collectionId !== 'all' && collectionId !== 'bundled' && !collections.has(collectionId) && <option value={collectionId}>{__('Selected pack', 'wconvert')}</option>}
          </select>
        </label>
        {allEntries.some(entry => entry.availability && entry.availability !== 'ready') && <Button variant="outline" disabled={starting !== null} aria-pressed={availableOnly} onClick={() => { setAvailableOnly(!availableOnly); setPage(0); }}>{__('Available on this site', 'wconvert')}</Button>}
        <Button variant="ghost" disabled={starting !== null} onClick={() => setAllCollections(value => !value)}>{allCollections ? __('Show library', 'wconvert') : __('Browse collections', 'wconvert')}</Button>
        <Button variant="ghost" disabled={starting !== null} aria-expanded={helper} onClick={() => setHelper(!helper)}>{__('Help me choose', 'wconvert')}</Button>
        <Button ref={packTrigger} variant="outline" disabled={starting !== null} onClick={() => { choseCollection.current = false; setPacksOpen(true); }}>
          <LayoutTemplate size={16} aria-hidden="true" />{__('Browse template packs', 'wconvert')}
        </Button>
      </div>
      <div className="wconvert-picker__facet" role="group" aria-label={__('Format', 'wconvert')}>
        <span>{__('Format', 'wconvert')}</span>
        <OptionStrip label={__('Choose format', 'wconvert')} value={formatId} disabled={starting !== null}
          options={[{ value: 'all', label: __('All formats', 'wconvert') }, ...formatOptions,
            ...(formatId !== 'all' && !availableFormats.has(formatId) ? [{ value: formatId, label: displayTypeLabel(formatId) }] : [])]
            .map(({value, label}) => { const count = value === 'all' ? matchingCollection.length : matchingCollection.filter(entry => startingPointDisplayType(entry) === value).length;
              return { value, label, count, disabled: count === 0 && formatId !== value }; })}
          onChange={value => { setFormatId(value); setPage(0); }} />
      </div>
      <div className="wconvert-picker__results">
        <label className="flex items-center gap-2 text-note">{__('Sort', 'wconvert')}<select className="wconvert-picker__select" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="recommended">{__('Recommended', 'wconvert')}</option><option value="name">{__('Name A–Z', 'wconvert')}</option></select></label>
        <span role="status">{playbooks.status === 'ready' ? sprintf(
          /* translators: 1: matching setups, 2: setups for the selected goal. */
          __('%1$s of %2$s campaign setups', 'wconvert'), String(entries.length), String(allEntries.length)) + ' · ' + sprintf(_n('%s design', '%s designs', designCount, 'wconvert'), String(designCount))
          : playbooks.status === 'loading' ? __('Loading campaign setups…', 'wconvert') : __('Campaign setups could not be loaded.', 'wconvert')}</span>
        {activeFilters.length > 0 && <div className="wconvert-picker__active">
          {activeFilters.map(({ id, label, remove }) => <button key={id} type="button" className="wconvert-picker__active-filter"
            disabled={starting !== null} aria-label={sprintf(__('Remove filter: %s', 'wconvert'), label)} onClick={remove}>
            {label}<X size={12} aria-hidden="true" />
          </button>)}
          <Button variant="link" disabled={starting !== null} onClick={clearFilters}>{__('Clear filters', 'wconvert')}</Button>
        </div>}
      </div>
    </div>
    {helper && <section className="wconvert-picker__notice" aria-label={__('Help choosing a setup', 'wconvert')}>
      {businesses.size > 0 && <><strong>{__('Who do you serve?', 'wconvert')}</strong><p>{__('For example, a shop welcoming new shoppers or a service business collecting enquiries. Choose a business to narrow the examples.', 'wconvert')}</p><OptionStrip label={__('Business examples', 'wconvert')} value={businessId} options={[[ 'all', __('Any business', 'wconvert') ], ...businesses].map(([value,label]) => ({value,label}))} onChange={value => { setBusinessId(value); setPage(0); }} /></>}
      <strong>{__('Where will this help your visitor?', 'wconvert')}</strong>
      <p>{__('Choose a starting format below. This filters the library; it does not create a campaign. You can clear the choice any time.', 'wconvert')}</p>
      <div className="flex flex-wrap gap-2">{[
        ['popup', __('A focused invitation', 'wconvert')], ['inline', __('Within useful page content', 'wconvert')],
        ['floating_bar', __('A short announcement', 'wconvert')], ['slide_in', __('A small corner prompt', 'wconvert')],
      ].filter(([format]) => availableFormats.has(format)).map(([format, label]) => <Button key={format} variant="outline" disabled={starting !== null} onClick={() => { setFormatId(format); setPage(0); setHelper(false); }}>{label}</Button>)}</div>
      <p>{sprintf(__('Your goal stays “%s”. Use “Choose a different goal” below if visitors should do something else.', 'wconvert'), goal.label)}</p>
    </section>}
    {selectedOccasion && <section aria-label={__('Occasion planning ideas', 'wconvert')}>
      <div className="wconvert-picker__notice"><strong>{selectedOccasion.name}</strong><p>{selectedOccasion.start} – {selectedOccasion.end} · {picker.data?.timezone}</p>
        <p>{__('Choose a planning guide that fits your occasion. Explore its Before, During and After ideas for your selected goal. Campaign dates are set separately in the editor.', 'wconvert')}</p>
        <Button variant="outline" onClick={() => setOccasion(null)}>{__('Back to full library', 'wconvert')}</Button></div>
      <CollectionShelf matches={relevant.filter(match => !match.collection.event)} all disabled={starting !== null} onOpen={openCollection} onAll={() => {}} onHide={() => {}} />
      {relevant.every(match => !!match.collection.event) && <EmptyState icon={Sparkles} title={__('No reviewed occasion ideas match yet', 'wconvert')} action={<Button variant="outline" onClick={() => setOccasion(null)}>{__('Browse all setups', 'wconvert')}</Button>}>
        {__('Try clearing your filters or explore the full library. We only suggest setups already reviewed for this goal.', 'wconvert')}
      </EmptyState>}
    </section>}
    {!selectedOccasion && !editorialCollection && (picker.data && (allCollections || (!query.trim() && !savedOnly && picker.data.preferences.show_featured !== false))) && <CollectionShelf matches={allCollections ? relevant : featured} all={allCollections} disabled={starting !== null || picker.saving} onOpen={openCollection} onAll={() => setAllCollections(true)} onHide={id => { if (picker.data) void picker.preferences({ ...picker.data.preferences, hidden: [...picker.data.preferences.hidden, id] }); }} />}
    {!selectedOccasion && !allCollections && !editorialCollection && !query.trim() && !savedOnly && featured.length > 0 && picker.data?.preferences.show_featured !== false && <Button className="mx-6" variant="ghost" disabled={picker.saving} onClick={() => { if (picker.data) void picker.preferences({ ...picker.data.preferences, show_featured: false }); }}>{__('Hide featured collections', 'wconvert')}</Button>}
    <Dialog open={packsOpen} onOpenChange={setPacksOpen}>
      <PickerDialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        (choseCollection.current ? collectionPicker.current : packTrigger.current)?.focus();
      }}>
        <PickerDialogHeader><DialogTitle>{__('Template packs', 'wconvert')}</DialogTitle>
          <DialogDescription>{__('Preview a pack, add it to your library, then choose a setup for your goal.', 'wconvert')}</DialogDescription>
        </PickerDialogHeader>
        <TemplatePacks displayType="" goal={goal.id}
          onInstalled={async () => { setPlaybooksRetry((value) => value + 1); }}
          onChooseStartingPoints={(id) => { choseCollection.current = true; setCollectionId(id); setFormatId('all'); setBusinessId('all'); setQuery(''); setPacksOpen(false); }} />
      </PickerDialogContent>
    </Dialog>
    {!inspected && error !== null && <><RegionError message={error} /><Button variant="outline" disabled={starting !== null} onClick={() => { previews.reset(); setPlaybooksRetry(value => value + 1); setError(null); }}>{__('Reload campaign setups', 'wconvert')}</Button></>}
    {!inspected && createUnconfirmed && <RegionBody><p className="m-0 text-note">{__('Draft creation could not be confirmed. Check your Campaigns before trying again to avoid creating a second draft.', 'wconvert')}{onCheckOptins && <Button variant="link" onClick={onCheckOptins}>{__('Check Campaigns', 'wconvert')}</Button>}</p></RegionBody>}
    {starting !== null && <RegionBody><p role="status" className="m-0 text-note">{__('Creating your draft and opening the editor…', 'wconvert')}</p></RegionBody>}
    {!selectedOccasion && !editorialCollection && !allCollections && <>{setupGallery}{comparisonControls}</>}
    {allCollections && !editorialCollection && relevant.length === 0 && <EmptyState icon={Sparkles} title={__('No collections match', 'wconvert')} action={<Button variant="outline" onClick={clearFilters}>{__('Clear filters', 'wconvert')}</Button>}>{__('Try another business, search or format, or return to the full library.', 'wconvert')}</EmptyState>}
    <Dialog open={inspected !== null || editorialCollection !== null || comparing} onOpenChange={(open) => { if (!open) { setInspected(null); setComparing(false); if (editorialCollection) backToLibrary(); } }}>
      <PickerDialogContent className="wconvert-setup-detail" onOpenAutoFocus={event => { event.preventDefault(); modalTitle.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={(event) => {
        event.preventDefault(); (modalOrigin.current?.isConnected ? modalOrigin.current : collectionPicker.current)?.focus({ preventScroll: true });
      }}>
        <PickerDialogHeader>
          <DialogTitle ref={modalTitle} tabIndex={-1}>{inspected?.name ?? (comparing ? __('Compare two designs', 'wconvert') : editorialCollection?.name)}</DialogTitle>
          <DialogDescription>{inspected ? __('Review every screen and the setup before creating a draft.', 'wconvert') : comparing ? __('Compare sample designs, then review one setup. Nothing is applied here.', 'wconvert') : editorialCollection?.description}</DialogDescription>
        </PickerDialogHeader>
        <PickerDialogBody ref={modalContent}>
          {!inspected && !comparing && editorialCollection && <>
            <div className="wconvert-collection-detail__controls">{collectionDetails}
            <div className="wconvert-picker__controls wconvert-toolbar"><div className="wconvert-picker__search-row"><PickerSearch label={__('Search collection setups','wconvert')} value={query} placeholder={__('Search this collection','wconvert')} onChange={value=>{setQuery(value);setPage(0);}} /></div>
              {(new Set(matchingCollection.filter(entry => editorialCollection.items.some(item => item.setup_id === entry.id)).map(startingPointDisplayType)).size > 1 || formatId !== 'all') && <OptionStrip label={__('Collection format', 'wconvert')} value={formatId}
                options={[{value:'all',label:__('All formats','wconvert')}, ...formatOptions].filter(({value}) => value === 'all' || value === formatId || matchingCollection.some(entry => editorialCollection.items.some(item => item.setup_id === entry.id) && startingPointDisplayType(entry) === value))}
                onChange={value => { setFormatId(value); setPage(0); }} />}
            </div></div>
            <p role="status" className="text-note">{sprintf(_n('%s matching setup', '%s matching setups', entries.length, 'wconvert'), String(entries.length)) + ' · ' + sprintf(_n('%s design', '%s designs', designCount, 'wconvert'), String(designCount))}</p>
            {setupGallery}
          </>}
          {!inspected && comparing && <SetupComparison entries={comparisonEntries} failed={previews.failed} onRetry={previews.retry} onInspect={entry => { setInspected(entry); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); }); }} />}
          {inspected && <div className="wconvert-setup-inspector">
            <div>
              {inspectedEntry && <SetupPreview key={`${designKey(inspected)}:${startingPointDisplayType(inspected)}`} entry={inspectedEntry} failed={previews.failed.has(inspected.id)} onRetry={() => previews.retry(inspected.id)} />}
            </div>
            <aside className="wconvert-setup-inspector__facts" aria-label={__('Campaign setup details', 'wconvert')}>
              <Badge variant="outline">{displayTypeLabel(startingPointDisplayType(inspected))}</Badge>
              {inspectedChoices.length > 1 && <section className="wconvert-setup-inspector__cases">
                <h3>{__('Choose a use case', 'wconvert')}</h3>
                <p className="text-note text-muted-foreground">{__('These setups share a layout. Choose the wording and suggested settings you need.', 'wconvert')}</p>
                <OptionStrip label={__('Use case', 'wconvert')} value={inspected.id} disabled={starting !== null}
                  options={inspectedChoices.map(entry => ({ value: entry.id, label: entry.name }))}
                  onChange={id => { const next = inspectedChoices.find(entry => entry.id === id); if (next) { setUseCases(value => ({ ...value, [`${designKey(next)}:${startingPointDisplayType(next)}`]: next.id })); previews.onNear(next.id); setInspected(next); } }} />
              </section>}
              {inspected.requirements && inspected.requirements.length > 0 && <section><h3>{__('Have ready', 'wconvert')}</h3><ul className="list-disc ps-5 text-note">{inspected.requirements.map(item => <li key={item}>{item}</li>)}</ul></section>}
              <StartingPointFacts compact playbook={inspectedEntry ?? inspected} goal={goal} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null} />
              {inspected.notes && !(inspectedEntry?.template && inspectedEntry.template.tree.steps.length > 1) && <p className="m-0 text-note text-muted-foreground">{inspected.notes}</p>}
              {inspected.availability && inspected.availability !== 'ready' && <p id="setup-refusal">{inspected.availability === 'locked' ? sprintf(__('Available with %s', 'wconvert'), tierProductName(undefined)) : __('This setup needs a design that is not installed.', 'wconvert')}</p>}
            </aside>
          </div>}
        </PickerDialogBody>
        {!inspected && !comparing && editorialCollection && entries.length > 0 && <PickerPagination page={shownPage} pages={pageCount} disabled={starting !== null} onChange={setPage} />}
        {!inspected && !comparing && comparisonControls}
        <PickerDialogFooter>
          {inspected && error && <div className="wconvert-picker__footer-error" role="alert">
            <p>{createUnconfirmed ? __('Draft creation could not be confirmed. Check your Campaigns before trying again to avoid creating a second draft.', 'wconvert') : error}</p>
            {createUnconfirmed ? onCheckOptins ? <Button variant="outline" onClick={onCheckOptins}>{__('Check Campaigns', 'wconvert')}</Button> : <Button variant="outline" asChild><a href="#optins">{__('Check Campaigns', 'wconvert')}</a></Button>
              : <Button variant="outline" disabled={starting !== null} onClick={() => { setInspected(null); previews.reset(); setPlaybooksRetry(value => value + 1); setError(null); }}>{__('Reload campaign setups', 'wconvert')}</Button>}
          </div>}
          <Button className="wconvert-picker__back" variant="outline" disabled={starting !== null} onClick={() => {
            if (inspected) { setInspected(null); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = collectionScroll.current; (detailTrigger.current?.isConnected ? detailTrigger.current : modalTitle.current)?.focus({ preventScroll: true }); }); }
            else if (comparing) { setComparing(false); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = collectionScroll.current; modalTitle.current?.focus({ preventScroll: true }); }); }
            else backToLibrary();
          }}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{inspected ? (comparing ? __('Back to comparison', 'wconvert') : editorialCollection ? __('Back to collection', 'wconvert') : __('Back to setups', 'wconvert')) : comparing ? (editorialCollection ? __('Back to collection', 'wconvert') : __('Back to library', 'wconvert')) : libraryPosition.current.allCollections ? __('All collections', 'wconvert') : __('Back to library', 'wconvert')}</Button>
          {inspected ? <>
            <span className="text-note text-muted-foreground">{__('Creates an unpublished draft.', 'wconvert')}</span>
            <Button aria-describedby={inspected.availability && inspected.availability !== 'ready' ? 'setup-refusal' : undefined} aria-disabled={createUnconfirmed || (inspected.availability !== undefined && inspected.availability !== 'ready')} disabled={starting !== null || (inspected.availability === 'ready' && inspected.revision !== undefined && !inspectedEntry?.template)} onClick={() => { if (!createUnconfirmed) void start(inspected.id); }}>{starting === inspected.id ? __('Creating draft…', 'wconvert') : __('Use this setup', 'wconvert')}</Button>
          </> : <span className="text-note text-muted-foreground">{__('Preview a setup to review its screens and requirements.', 'wconvert')}</span>}
        </PickerDialogFooter>
      </PickerDialogContent>
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
