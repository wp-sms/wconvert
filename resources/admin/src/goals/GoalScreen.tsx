import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, CalendarDays, Check, LayoutTemplate, Library, MoreHorizontal, Sparkles, Star, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { CompareSelection } from '../discovery/CompareSelection';
import { ComparisonTray } from '../discovery/ComparisonTray';
import { MoreFilters, SavedLabel } from '../discovery/MoreFilters';
import { PickerPagination } from '../discovery/PickerPagination';
import { PickerSearch } from '../discovery/PickerSearch';
import { Dialog, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { PickerDialogContent, PickerDialogHeader, PickerDialogBody } from '../discovery/PickerDialog';
import { TemplatePacks } from '../templates/TemplatePacks';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { CheckRow } from '../shell/CheckRow';
import { GallerySkeleton } from '../builder/Gallery';
import { TemplateCard } from '../builder/TemplateCard';
import { getRules, type RuleVocabulary } from '../builder/api';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { createOptin } from '../optins/api';
import { formatCount, formatDay, formatRange } from '../lib/format';
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
import { renderingFor, tierProductName } from './availability';
import { catalogConfigured } from '../settings';
import { OptionStrip } from '../shell/OptionStrip';
import { matchesSearch } from '../discovery/search';

/**
 * Goal first, then a starting point. Browsing only reads; Use this setup explicitly
 * creates a draft and opens the editor. The editor owns review and publishing.
 * Every read belongs to the current step, so an abandoned response cannot
 * replace a later choice or start a draft after this flow was closed.
 *
 * The library's first row is search and the three places to browse
 * (collections, packs, preferences); format is the second. Every other filter
 * sits under one "More filters", the same control the design library uses
 * (ADR 0131), so step two reads as a choice rather than a control panel.
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const browseTrigger = useRef<HTMLButtonElement>(null);
  const [allCollections, setAllCollections] = useState(false);
  const [editorialCollection, setEditorialCollection] = useState<Collection | null>(null);
  const [stage, setStage] = useState('any');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [sort, setSort] = useState('recommended');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [page, setPage] = useState(0);
  const libraryPosition = useRef<{ scroll: number; trigger: HTMLElement | null; page: number; allCollections: boolean }>({ scroll: 0, trigger: null, page: 0, allCollections: false });

  const [useCases, setUseCases] = useState<Record<string, string>>({});
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
  // A setup that changed or left the library since it was previewed can only be reloaded, never retried.
  const [staleSetup, setStaleSetup] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const lastStart = useRef<string | undefined>(undefined);
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
    lastStart.current = playbookId;
    const request = ++operation.current;
    setStarting(playbookId ?? 'scratch');
    setError(null);
    setCreateUnconfirmed(false);
    setStaleSetup(false);
    let creating = false;
    try {
      const selected = previewEntries.find(entry => entry.id === playbookId);
      const prepared = selected && previews.previews.get(selected.id);
      const prefilled = selected?.revision ? await prefill(goal.id, playbookId, selected.revision, prepared?.prepared_revision) : await prefill(goal.id, playbookId);
      // Leads stay in WConvert until a service is connected (ADR 0133), so
      // the prefill needs no capture mode written into it.
      const draft = prefilled;
      if (!active.current || request !== operation.current) return;
      creating = true;
      const optin = await createOptin(draft.name, draft.goal, draft.config);
      if (active.current && request === operation.current) onCreated(optin.id);
    } catch (cause) {
      if (active.current && request === operation.current) {
        setError(messageOf(cause));
        const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
        setStaleSetup(['wconvert_setup_unavailable', 'wconvert_setup_changed', 'wconvert_prepared_setup_changed'].includes(code));
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
      <RegionHeader title={__('What do you want to achieve?', 'wconvert')} />
      {goals.status === 'failed' ? <RegionErrorState message={goals.message} onRetry={() => setGoalsRetry((value) => value + 1)} />
        : <RegionBody className="wconvert-creation__goals">{goals.status === 'loading' ? <ChoiceSkeleton /> : shown.length === 0 ?
        <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}
          action={onCheckOptins && <Button variant="outline" onClick={onCheckOptins}>{__('Back to Campaigns', 'wconvert')}</Button>}>
          {__('Goals come from WConvert and the plugins that extend it.', 'wconvert')}
        </EmptyState> : <ChoiceGrid>{shown.map((entry) => <GoalCard key={entry.id} goal={entry}
          surface="creation_flow" choose={__('Choose', 'wconvert')} onChoose={choose} />)}</ChoiceGrid>}
      </RegionBody>}
    </Region>;
  }

  const selectedOccasion = picker.data?.occasions.items.find(item => item.id === occasion);
  // A setup this install could only buy is not a setup on a free install
  // (ADR 0116); a paid one still sees the next rung's, explained.
  // Nor is one whose design is missing: creation hides what it cannot start (ADR 0026).
  const allEntries = playbooks.status === 'ready' ? playbooks.data.filter((entry) => renderingFor(entry.availability ?? 'ready', 'creation_flow') !== 'hide') : [];
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
    setEditorialCollection(null); setAllCollections(libraryPosition.current.allCollections); setPage(libraryPosition.current.page);
    requestAnimationFrame(() => { window.scrollTo(0, libraryPosition.current.scroll); libraryPosition.current.trigger?.focus({ preventScroll: true }); });
  };
  const changeGoal = () => {
    if (busy.current) return;
    operation.current += 1; setGoal(null); setError(null); setCreateUnconfirmed(false);
  };
  const reloadSetups = () => { previews.reset(); setPlaybooksRetry(value => value + 1); setError(null); };

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
  // What "More filters" holds, so its closed row can say how many are on.
  const hiddenFilters = Number(businessId !== 'all') + Number(collectionId !== 'all') + Number(savedOnly) + Number(availableOnly);
  const groups = groupSetups(entries);
  const sortedGroups = [...groups];
  if (sort === 'name') sortedGroups.sort((a, b) => a[1][0].name.localeCompare(b[1][0].name));
  /*
   * **One setup to start from** (ADR 0112, amended). Before a merchant has
   * narrowed anything, the first recommended setup this site can use is drawn
   * on its own with a direct Use; the gallery under it is everything else.
   */
  // A handful of setups is already a short choice; a recommendation earns its place past three.
  const startGroup = sortedGroups.length > 3 && !editorialCollection && !allCollections && !selectedOccasion && sort === 'recommended' && activeFilters.length === 0
    ? sortedGroups.find(([, variants]) => (variants[0].availability ?? 'ready') === 'ready') : undefined;
  const galleryGroups = startGroup ? sortedGroups.filter((group) => group !== startGroup) : sortedGroups;
  const pageCount = Math.max(1, Math.ceil(galleryGroups.length / 24));
  const shownPage = Math.min(page, pageCount - 1);
  const pagedGroups = galleryGroups.slice(shownPage * 24, (shownPage + 1) * 24);
  const inspectedPreview = inspected && previews.previews.get(inspected.id);
  const inspectedEntry = inspected && (inspectedPreview?.revision === inspected.revision ? inspectedPreview ?? inspected : inspected);
  const inspectedChoices = inspected ? (comparing ? allEntries : entries).filter(entry => designKey(entry) === designKey(inspected) && startingPointDisplayType(entry) === startingPointDisplayType(inspected)) : [];
  const inspectedRefusal = inspected?.availability && inspected.availability !== 'ready'
    ? inspected.availability === 'locked' ? sprintf(__('Available with %s.', 'wconvert'), tierProductName(undefined)) : __('This setup needs a design that is not installed.', 'wconvert')
    : null;
  const comparisonEntries = compareIds.flatMap(id => {
    const entry = allEntries.find(value => value.id === id); const prepared = previews.previews.get(id);
    return entry ? [prepared?.revision === entry.revision ? prepared ?? entry : entry] : [];
  });
  const unconfirmed = __('Draft creation could not be confirmed. Check your campaigns before trying again, so you don’t create a second draft.', 'wconvert');
  const checkCampaigns = onCheckOptins
    ? <Button variant="outline" onClick={onCheckOptins}>{__('Check campaigns', 'wconvert')}</Button>
    : <Button variant="outline" asChild><a href="#optins">{__('Check campaigns', 'wconvert')}</a></Button>;
  const comparisonControls = <ComparisonTray names={comparisonEntries.map(entry=>entry.name)} disabled={starting !== null} onClear={()=>setCompareIds([])} onCompare={event => {
    if (!editorialCollection) modalOrigin.current = event.currentTarget; collectionScroll.current = modalContent.current?.scrollTop ?? 0;
    comparisonEntries.forEach(entry => previews.onNear(entry.id)); setComparing(true);
    requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); });
  }} />;
  const startCard = startGroup ? card(startGroup[0], startGroup[1], true) : null;
  const setupGallery = playbooks.status === 'failed' ? <RegionErrorState message={playbooks.message} onRetry={() => setPlaybooksRetry((value) => value + 1)} />
    : playbooks.status === 'loading' ? <RegionBody><GallerySkeleton cards={2} /></RegionBody>
      : allEntries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups available', 'wconvert')}
        action={<Button disabled={starting !== null} onClick={() => { void start(); }}>{__('Choose a design myself', 'wconvert')}</Button>}>
        {__('Start a draft for this goal and choose its design in the editor.', 'wconvert')}
      </EmptyState> : entries.length === 0 ? <EmptyState icon={Sparkles} title={__('No campaign setups match', 'wconvert')}
        action={<Button variant="outline" disabled={starting !== null} onClick={clearFilters}>{__('Show all campaign setups', 'wconvert')}</Button>}>
        {savedOnly ? __('No saved designs match this goal and your filters.', 'wconvert') : __('Try another search, business, format or collection.', 'wconvert')}
      </EmptyState> : <RegionBody className={editorialCollection ? 'px-0' : undefined}>
        {startCard && shownPage === 0 && <section className="wconvert-start-here" aria-labelledby="wconvert-start-here-title">
          <h3 id="wconvert-start-here-title" className="wconvert-start-here__title">{__('Start here', 'wconvert')}</h3>
          <ul className="wconvert-gallery wconvert-start-here__card">{startCard}</ul>
          <h3 className="wconvert-start-here__title">{__('Or choose another setup', 'wconvert')}</h3>
        </section>}
        <ul className="wconvert-gallery">{pagedGroups.map(([designId, variants]) => card(designId, variants))}</ul>
        {!editorialCollection && <PickerPagination label={__('Setup pages', 'wconvert')} page={shownPage} pages={pageCount} disabled={starting !== null} onChange={setPage} />}
      </RegionBody>;
  function card(designId: string, variants: PlaybookEntry[], featured = false) {
          const selected = variants.find((entry) => entry.id === useCases[designId]) ?? variants[0];
          const prepared = previews.previews.get(selected.id);
          const playbook = prepared?.revision === selected.revision ? prepared ?? selected : selected;
          const openDetails = (event: MouseEvent<HTMLButtonElement>) => { detailGroup.current = designId; detailTrigger.current = event.currentTarget; if (!editorialCollection) modalOrigin.current = event.currentTarget; collectionScroll.current = modalContent.current?.scrollTop ?? 0; previews.onNear(playbook.id); setInspected(playbook); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); }); };
          return <TemplateCard
          key={designId} id={playbook.id} name={playbook.name} template={playbook.template}
          displayType={startingPointDisplayType(playbook)}
          onNear={previews.onNear} loadError={previews.failed.has(playbook.id)} onRetry={() => previews.retry(playbook.id)}
          reason={playbook.availability === 'locked' ? sprintf(__('Available with %s.', 'wconvert'), tierProductName(undefined)) : playbook.availability === 'unavailable' ? __('This setup needs a design that is not installed.', 'wconvert') : undefined}
          absent={playbook.template === undefined && (!playbook.revision || (playbook.availability !== undefined && playbook.availability !== 'ready')) ? <p>{__('This design is not available on this site.', 'wconvert')}</p> : undefined}
          selected={compareIds.some(id => variants.some(entry => entry.id === id))}
          saveAction={<Button variant="ghost" size="icon" className="wconvert-picker__save" disabled={picker.saving || !picker.data} aria-pressed={picker.data?.preferences.saved.includes(designKey(playbook)) ?? false} aria-label={sprintf(__('Save design: %s', 'wconvert'), playbook.name)} onClick={() => picker.toggleSaved(designKey(playbook))}><Star size={17} aria-hidden="true" fill={picker.data?.preferences.saved.includes(designKey(playbook)) ? 'currentColor' : 'none'} /></Button>}
          marks={<><Badge variant="outline">{displayTypeLabel(startingPointDisplayType(playbook))}</Badge>
            {variants.length > 1 && <span>{sprintf(_n('%s use case', '%s use cases', variants.length, 'wconvert'), formatCount(variants.length))}</span>}
            {playbook.template && playbook.template.tree.steps.length > 1 && <span>{sprintf(_n('%s screen', '%s screens', playbook.template.tree.steps.length, 'wconvert'), formatCount(playbook.template.tree.steps.length))}</span>}
          </>}
          notes={playbook.recommendation || playbook.business_types?.map(item => item.label).join(' · ') || undefined}
          selection={featured ? undefined : <CompareSelection name={playbook.name} checked={compareIds.some(id => variants.some(entry => entry.id === id))}
            disabled={starting !== null} full={compareIds.length >= 2 && !compareIds.some(id => variants.some(entry => entry.id === id))} onChange={() => {
              setCompareIds(current => current.some(id => variants.some(entry => entry.id === id)) ? current.filter(id => !variants.some(entry => entry.id === id)) : [...current, playbook.id]);
            }} />}
          action={(describedBy) => featured ? <>
              <Button aria-describedby={describedBy} disabled={starting !== null || (playbook.revision !== undefined && !playbook.template)} onClick={() => { void start(playbook.id); }}>
                {starting === playbook.id ? __('Creating draft…', 'wconvert') : __('Use this setup', 'wconvert')}
              </Button>
              <Button ref={node => { if (detailGroup.current === designId) detailTrigger.current = node; }} variant="outline" aria-describedby={describedBy} disabled={starting !== null}
                aria-label={sprintf(__('Preview %s first', 'wconvert'), playbook.name)} onClick={openDetails}>
                {__('Preview first', 'wconvert')}
              </Button>
            </> : <Button ref={node => { if (detailGroup.current === designId) detailTrigger.current = node; }} variant="outline" aria-describedby={describedBy} disabled={starting !== null}
                aria-label={sprintf(__('Setup details for %s', 'wconvert'), playbook.name)} onClick={openDetails}>
                {__('Preview & details', 'wconvert')}
              </Button>} />;
  }
  const collectionDetails = editorialCollection ? <section className="wconvert-collection-detail">
      {selectedOccasion && <p className="text-note">{sprintf(
        /* translators: 1: an occasion's name, 2: its dates, e.g. “Nov 27 – Dec 1, 2026”. */
        __('Ideas for %1$s, %2$s.', 'wconvert'), selectedOccasion.name, formatRange(selectedOccasion.start, selectedOccasion.end))}</p>}
      {editorialCollection.event && !selectedOccasion && <div className="wconvert-collection-detail__event"><p>{sprintf(/* translators: %s: a date, e.g. “Nov 27, 2026”. */ __('Event starts %s', 'wconvert'), formatDay(editorialCollection.event.start))}</p><Button variant="ghost" disabled={picker.saving} onClick={() => { if (picker.data && editorialCollection.event) void picker.preferences({ ...picker.data.preferences, events: [...picker.data.preferences.events, editorialCollection.event.family] }); backToLibrary(); }}>{__('I don’t run this event', 'wconvert')}</Button></div>}
      {editorialCollection.items.some(item => item.stage !== 'any') && <OptionStrip label={__('Campaign stage', 'wconvert')} value={effectiveStage}
        options={[
          ['any', __('All stages', 'wconvert')], ['before', __('Before', 'wconvert')], ['during', __('During', 'wconvert')], ['after', __('After', 'wconvert')],
        ].map(([id, label]) => ({ value: id, label,
          count: collectionEligible.filter(entry => editorialCollection.items.some(item => item.setup_id === entry.id && (id === 'any' || item.stage === id))).length,
          disabled: id !== 'any' && !editorialCollection.items.some(item => item.stage === id && collectionEligible.some(entry => entry.id === item.setup_id)),
        }))} onChange={id => { setStage(id); setPage(0); }} />}
      {effectiveStage !== stage && <p role="status" className="text-note">{__('Your filters have no setups in the previous stage. Showing a matching stage instead.', 'wconvert')}</p>}
      {picker.data && editorialCollection.event && picker.data.today >= editorialCollection.event.end_exclusive && <p className="text-note">{__('This event has ended. Its setups still work; update dates and offer terms in the editor.', 'wconvert')}</p>}
    </section> : null;
  const showFeatured = !selectedOccasion && !allCollections && !editorialCollection && !query.trim() && !savedOnly && picker.data?.preferences.show_featured !== false;
  return <Region className="wconvert-creation">
    <Step at={2} />
    <RegionHeader title={__('Choose a campaign setup', 'wconvert')}
      description={sprintf(/* translators: %s: the goal chosen in step one. */ __('For “%s”.', 'wconvert'), goal.label)}
      trailing={<Button variant="outline" disabled={starting !== null} onClick={changeGoal}>
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Change goal', 'wconvert')}
      </Button>} />
    {picker.error && !settings && <RegionError message={picker.error} onRetry={() => { void picker.reload(); }} />}
    {vocabulary.status === 'failed' && <RegionError message={__('Setup details could not be loaded. You can still choose a setup and review its rules in the editor.', 'wconvert')} onRetry={() => setRulesRetry((value) => value + 1)} />}
    {/*
      Two rows, then the cards (ADR 0131, GUIDELINES §9): what to look for,
      how to order it and where else to browse; then format, the rarer filters
      and how many match. Everything else is one ⋯ away.
    */}
    <div className="wconvert-picker__controls wconvert-toolbar">
      <div className="wconvert-picker__search-row">
        <PickerSearch label={__('Search campaign setups', 'wconvert')} value={query} disabled={starting !== null} onChange={value => {setQuery(value);setPage(0);}} />
        <select className="wconvert-picker__select" aria-label={__('Sort campaign setups', 'wconvert')} value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}>
          <option value="recommended">{__('Recommended first', 'wconvert')}</option>
          <option value="name">{__('Name A–Z', 'wconvert')}</option>
        </select>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button ref={browseTrigger} variant="outline" size="icon" disabled={starting !== null} aria-label={__('More ways to browse', 'wconvert')}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={5}>
            <DropdownMenuItem onSelect={() => setAllCollections(value => !value)}>
              <Library aria-hidden="true" />{allCollections ? __('Show all setups', 'wconvert') : __('Browse collections', 'wconvert')}
            </DropdownMenuItem>
            {catalogConfigured() && <DropdownMenuItem onSelect={() => { choseCollection.current = false; setPacksOpen(true); }}>
              <LayoutTemplate aria-hidden="true" />{__('Template packs', 'wconvert')}
            </DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => { setSettings(true); void picker.reload(); }}>
              <CalendarDays aria-hidden="true" />{__('Occasions & preferences', 'wconvert')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="wconvert-picker__facet">
        <OptionStrip label={__('Format', 'wconvert')} value={formatId} disabled={starting !== null}
          options={[{ value: 'all', label: __('All formats', 'wconvert') }, ...formatOptions,
            ...(formatId !== 'all' && !availableFormats.has(formatId) ? [{ value: formatId, label: displayTypeLabel(formatId) }] : [])]
            .map(({value, label}) => { const count = value === 'all' ? matchingCollection.length : matchingCollection.filter(entry => startingPointDisplayType(entry) === value).length;
              return { value, label, count, disabled: count === 0 && formatId !== value }; })}
          onChange={value => { setFormatId(value); setPage(0); }} />
        <span role="status" className="wconvert-picker__count">{playbooks.status === 'ready'
          ? entries.length === allEntries.length
            ? sprintf(_n('%s setup', '%s setups', allEntries.length, 'wconvert'), formatCount(allEntries.length))
            /* translators: 1: matching setups, 2: setups for the selected goal. */
            : sprintf(__('%1$s of %2$s setups', 'wconvert'), formatCount(entries.length), formatCount(allEntries.length))
          : playbooks.status === 'loading' ? __('Loading campaign setups…', 'wconvert') : __('Campaign setups could not be loaded.', 'wconvert')}</span>
        <MoreFilters active={hiddenFilters} open={filtersOpen} onToggle={setFiltersOpen}>
          {/* Labels above their controls in one aligned grid, the way a form reads (GUIDELINES §7, Field). */}
          <div className="wconvert-filter-grid">
            {businesses.size > 0 && <label className="wconvert-filter-field">
              <span>{__('Business', 'wconvert')}</span>
              <select className="wconvert-picker__select" value={businessId} disabled={starting !== null} onChange={(event) => { setBusinessId(event.target.value); setPage(0); }}>
                <option value="all">{__('All businesses', 'wconvert')}</option>
                {[...businesses].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>}
            <label className="wconvert-filter-field">
              <span>{__('Source', 'wconvert')}</span>
              <select className="wconvert-picker__select" ref={collectionPicker} value={collectionId} disabled={starting !== null} onChange={(event) => setCollectionId(event.target.value)}>
                <option value="all">{__('All campaign setups', 'wconvert')}</option>
                <option value="bundled">{__('Included with WConvert', 'wconvert')}</option>
                {[...collections].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                {collectionId !== 'all' && collectionId !== 'bundled' && !collections.has(collectionId) && <option value={collectionId}>{__('Selected pack', 'wconvert')}</option>}
              </select>
            </label>
            <fieldset className="wconvert-filter-field">
              <legend>{__('Show', 'wconvert')}</legend>
              <CheckRow label={<SavedLabel count={picker.data?.preferences.saved.length ?? 0} />} checked={savedOnly} disabled={starting !== null || !picker.data}
                onChange={(event) => { setSavedOnly(event.target.checked); setPage(0); }} />
              {allEntries.some(entry => entry.availability && entry.availability !== 'ready') && <CheckRow label={__('Available on this site', 'wconvert')} checked={availableOnly} disabled={starting !== null}
                onChange={(event) => { setAvailableOnly(event.target.checked); setPage(0); }} />}
            </fieldset>
          </div>
        </MoreFilters>
      </div>
      {activeFilters.length > 0 && <div className="wconvert-picker__active">
        {activeFilters.map(({ id, label, remove }) => <button key={id} type="button" className="wconvert-picker__active-filter"
          disabled={starting !== null} aria-label={sprintf(__('Remove filter: %s', 'wconvert'), label)} onClick={remove}>
          <bdi>{label}</bdi><X size={12} aria-hidden="true" />
        </button>)}
        <Button variant="link" disabled={starting !== null} onClick={clearFilters}>{__('Clear filters', 'wconvert')}</Button>
      </div>}
    </div>
    {selectedOccasion && <section aria-label={__('Occasion planning ideas', 'wconvert')}>
      <div className="wconvert-picker__notice"><strong><bdi>{selectedOccasion.name}</bdi></strong><p>{formatRange(selectedOccasion.start, selectedOccasion.end)}</p>
        <p>{__('Explore before, during and after ideas for your goal. Campaign dates are set in the editor.', 'wconvert')}</p>
        <Button variant="outline" onClick={() => setOccasion(null)}>{__('Back to full library', 'wconvert')}</Button></div>
      <CollectionShelf matches={relevant.filter(match => !match.collection.event)} all disabled={starting !== null} onOpen={openCollection} onAll={() => {}} onHide={() => {}} />
      {relevant.every(match => !!match.collection.event) && <EmptyState icon={Sparkles} title={__('No reviewed occasion ideas match yet', 'wconvert')} action={<Button variant="outline" onClick={() => setOccasion(null)}>{__('Browse all setups', 'wconvert')}</Button>}>
        {__('Clear your filters or browse the full library.', 'wconvert')}
      </EmptyState>}
    </section>}
    <Dialog open={packsOpen} onOpenChange={setPacksOpen}>
      <PickerDialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        (choseCollection.current ? collectionPicker.current : browseTrigger.current)?.focus();
      }}>
        <AdminDialogHeader title={__('Template packs', 'wconvert')} meta={__('Packs add designs and campaign setups to your library.', 'wconvert')} />
        <TemplatePacks displayType="" goal={goal.id}
          onInstalled={async () => { setPlaybooksRetry((value) => value + 1); }}
          onChooseStartingPoints={(id) => { choseCollection.current = true; setFiltersOpen(true); setCollectionId(id); setFormatId('all'); setBusinessId('all'); setQuery(''); setPacksOpen(false); }} />
      </PickerDialogContent>
    </Dialog>
    <Dialog open={settings} onOpenChange={setSettings}>
      <AdminDialogContent size="md" onCloseAutoFocus={(event) => { event.preventDefault(); browseTrigger.current?.focus(); }}>
        <PickerSettings picker={picker} onBack={() => setSettings(false)}
          onPlan={id => { setOccasion(id); setSettings(false); setAllCollections(false); setEditorialCollection(null); setPage(0); }} />
      </AdminDialogContent>
    </Dialog>
    {!inspected && error !== null && (createUnconfirmed
      ? <RegionError message={unconfirmed} action={checkCampaigns} />
      : <RegionError message={error} onRetry={() => { void start(lastStart.current); }} />)}
    {starting !== null && <RegionBody><p role="status" className="m-0 text-note">{__('Creating your draft and opening the editor…', 'wconvert')}</p></RegionBody>}
    {!selectedOccasion && !editorialCollection && !allCollections && <>{setupGallery}{comparisonControls}</>}
    {/* Collections are a second way in, so the featured shelf follows the setups rather than preceding them. */}
    {!selectedOccasion && !editorialCollection && picker.data && (allCollections || showFeatured) && <CollectionShelf matches={allCollections ? relevant : featured} all={allCollections} disabled={starting !== null || picker.saving} onOpen={openCollection} onAll={() => setAllCollections(true)}
      onHide={id => { if (picker.data) void picker.preferences({ ...picker.data.preferences, hidden: [...picker.data.preferences.hidden, id] }); }}
      onHideAll={allCollections ? undefined : () => { if (picker.data) void picker.preferences({ ...picker.data.preferences, show_featured: false }); }} />}
    {allCollections && !editorialCollection && relevant.length === 0 && <EmptyState icon={Sparkles} title={__('No collections match', 'wconvert')} action={<Button variant="outline" onClick={clearFilters}>{__('Clear filters', 'wconvert')}</Button>}>{__('Try another business, search or format, or return to the full library.', 'wconvert')}</EmptyState>}
    <Dialog open={inspected !== null || editorialCollection !== null || comparing} onOpenChange={(open) => { if (!open) { setInspected(null); setComparing(false); if (editorialCollection) backToLibrary(); } }}>
      <PickerDialogContent className="wconvert-setup-detail" onOpenAutoFocus={event => { event.preventDefault(); modalTitle.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={(event) => {
        event.preventDefault(); (modalOrigin.current?.isConnected ? modalOrigin.current : collectionPicker.current)?.focus({ preventScroll: true });
      }}>
        {/* The title is the subject: a setup, a collection, or the comparison itself (ADR 0131). */}
        <PickerDialogHeader>
          <DialogTitle ref={modalTitle} tabIndex={-1}>{inspected?.name ?? (comparing ? __('Compare setups', 'wconvert') : editorialCollection?.name)}</DialogTitle>
          {(inspected || (!comparing && editorialCollection?.description)) && <DialogDescription>{inspected
            ? sprintf(/* translators: 1: a format, e.g. “Popup”. 2: the chosen goal. */ __('%1$s · for “%2$s”', 'wconvert'), displayTypeLabel(startingPointDisplayType(inspected)), goal.label)
            : editorialCollection?.description}</DialogDescription>}
        </PickerDialogHeader>
        <PickerDialogBody ref={modalContent}>
          {!inspected && !comparing && editorialCollection && <>
            <div className="wconvert-collection-detail__controls">{collectionDetails}
            <div className="wconvert-picker__controls wconvert-toolbar"><div className="wconvert-picker__search-row"><PickerSearch label={__('Search collection setups','wconvert')} value={query} placeholder={__('Search this collection','wconvert')} onChange={value=>{setQuery(value);setPage(0);}} /></div>
              {(new Set(matchingCollection.filter(entry => editorialCollection.items.some(item => item.setup_id === entry.id)).map(startingPointDisplayType)).size > 1 || formatId !== 'all') && <OptionStrip label={__('Collection format', 'wconvert')} value={formatId}
                options={[{value:'all',label:__('All formats','wconvert')}, ...formatOptions].filter(({value}) => value === 'all' || value === formatId || matchingCollection.some(entry => editorialCollection.items.some(item => item.setup_id === entry.id) && startingPointDisplayType(entry) === value))}
                onChange={value => { setFormatId(value); setPage(0); }} />}
            </div></div>
            <p role="status" className="text-note">{sprintf(_n('%s matching setup', '%s matching setups', entries.length, 'wconvert'), formatCount(entries.length))}</p>
            {setupGallery}
          </>}
          {!inspected && comparing && <SetupComparison entries={comparisonEntries} busy={starting !== null} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null}
            onUse={entry => { if ((entry.availability ?? 'ready') === 'ready') void start(entry.id); }} failed={previews.failed} onRetry={previews.retry} onInspect={entry => { setInspected(entry); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = 0; modalTitle.current?.focus({ preventScroll: true }); }); }} />}
          {inspected && <div className="wconvert-setup-inspector">
            <div>
              {inspectedEntry && <SetupPreview key={`${designKey(inspected)}:${startingPointDisplayType(inspected)}`} entry={inspectedEntry} failed={previews.failed.has(inspected.id)} onRetry={() => previews.retry(inspected.id)} />}
            </div>
            <aside className="wconvert-setup-inspector__facts" aria-label={__('Campaign setup details', 'wconvert')}>
              {inspectedChoices.length > 1 && <section className="wconvert-setup-inspector__cases">
                <h3>{__('Choose a use case', 'wconvert')}</h3>
                <OptionStrip label={__('Use case', 'wconvert')} value={inspected.id} disabled={starting !== null}
                  options={inspectedChoices.map(entry => ({ value: entry.id, label: entry.name }))}
                  onChange={id => { const next = inspectedChoices.find(entry => entry.id === id); if (next) { setUseCases(value => ({ ...value, [`${designKey(next)}:${startingPointDisplayType(next)}`]: next.id })); previews.onNear(next.id); setInspected(next); } }} />
              </section>}
              {/* The gist only: the rest of an authored note repeats what You’ll need lists. */}
              {inspected.notes && <p className="m-0 text-note text-muted-foreground">{gistOf(inspected.notes)}</p>}
              <StartingPointFacts playbook={inspectedEntry ?? inspected} goal={goal} vocabulary={vocabulary.status === 'ready' ? vocabulary.data : null} />
            </aside>
          </div>}
        </PickerDialogBody>
        {!inspected && !comparing && editorialCollection && entries.length > 0 && <PickerPagination label={__('Setup pages', 'wconvert')} page={shownPage} pages={pageCount} disabled={starting !== null} onChange={setPage} />}
        {!inspected && !comparing && comparisonControls}
        <AdminDialogFooter
          back={<Button className="wconvert-picker__back" variant="outline" disabled={starting !== null} onClick={() => {
            if (inspected) { setInspected(null); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = collectionScroll.current; (detailTrigger.current?.isConnected ? detailTrigger.current : modalTitle.current)?.focus({ preventScroll: true }); }); }
            else if (comparing) { setComparing(false); requestAnimationFrame(() => { if (modalContent.current) modalContent.current.scrollTop = collectionScroll.current; modalTitle.current?.focus({ preventScroll: true }); }); }
            else backToLibrary();
          }}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{inspected ? (comparing ? __('Back to comparison', 'wconvert') : editorialCollection ? __('Back to collection', 'wconvert') : __('Back to setups', 'wconvert')) : comparing ? (editorialCollection ? __('Back to collection', 'wconvert') : __('Back to library', 'wconvert')) : libraryPosition.current.allCollections ? __('All collections', 'wconvert') : __('Back to library', 'wconvert')}</Button>}
          /* The refusal is the note beside the button it refuses, so it is read with it. */
          note={inspected ? inspectedRefusal ? <span id="setup-refusal">{inspectedRefusal}</span> : __('Creates an unpublished draft.', 'wconvert') : undefined}
          error={inspected && error ? createUnconfirmed ? unconfirmed : error : undefined}>
          {inspected && error && (createUnconfirmed ? checkCampaigns
            : staleSetup ? <Button variant="outline" disabled={starting !== null} onClick={() => { setInspected(null); reloadSetups(); }}>{__('Reload setups', 'wconvert')}</Button>
              : null)}
          {inspected && !staleSetup && <Button aria-describedby={inspectedRefusal ? 'setup-refusal' : undefined} aria-disabled={createUnconfirmed || inspectedRefusal !== null} disabled={starting !== null || (inspected.availability === 'ready' && inspected.revision !== undefined && !inspectedEntry?.template)} onClick={() => { if (!createUnconfirmed) void start(inspected.id); }}>{starting === inspected.id ? __('Creating draft…', 'wconvert') : error && !createUnconfirmed ? __('Try again', 'wconvert') : __('Use this setup', 'wconvert')}</Button>}
        </AdminDialogFooter>
      </PickerDialogContent>
    </Dialog>
    {allEntries.length > 0 && <RegionFooter className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-note text-muted-foreground">{__('None of these fit?', 'wconvert')}</span>
      <Button variant="outline" disabled={starting !== null} onClick={() => { void start(); }}>{starting === 'scratch' ? __('Creating draft…', 'wconvert') : __('Choose a design myself', 'wconvert')}</Button>
    </RegionFooter>}
  </Region>;
}

function Step({ at }: { at: 1 | 2 }) {
  return <nav className="wconvert-creation__steps" aria-label={sprintf(__('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}>
    <span className="sr-only">{sprintf(__('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}</span>
    <ol>
      {[__('Choose a goal', 'wconvert'), __('Choose a campaign setup', 'wconvert')].map((label, index) => <li key={label} aria-current={at === index + 1 ? 'step' : undefined}>
        <span className="wconvert-creation__step-number" aria-hidden="true">{index + 1 < at ? <Check size={14} /> : index + 1}</span>{label}
      </li>)}
    </ol>
  </nav>;
}

/** An authored note's first sentence, or all of it when it has only one. */
export function gistOf(notes: string): string {
  const end = notes.search(/[.!?。！？](\s|$)/);
  return end === -1 ? notes : notes.slice(0, end + 1);
}
