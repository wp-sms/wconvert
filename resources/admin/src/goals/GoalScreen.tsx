import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { PinnedDesignNotice, usePinnedDesign } from '../templates/PinnedDesign';
import { LibraryConsent } from '../templates/LibraryConsent';
import { installSetup, refreshCatalog } from '../templates/catalog';
import { fitsOutcome } from './outcome';
import { Button } from '../components/ui/button';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { createOptin } from '../optins/api';
import { occasionSchedule } from '../lib/occasion';
import { GoalCard, offerableGoals } from './GoalCard';
import { listGoals, prefill, readGoalGallery, type GoalEntry, type GoalGallery } from './api';
import { usePicker } from '../discovery/usePicker';
import { useSetupPreviews } from '../discovery/useSetupPreviews';
import { preferredStage } from '../discovery/model';
import { adminSettings } from '../settings';
import { filterCards, mergeSetups, shelfCollections, shelfCovers, type GalleryCard as Card, type GalleryFilters } from '../gallery/model';
import { GalleryCard, TemplateAction } from '../gallery/GalleryCard';
import { GalleryGrid, GallerySkeleton, PER_PAGE } from '../gallery/GalleryGrid';
import { GalleryToolbar, NO_CHOICES, type GalleryChoices } from '../gallery/GalleryToolbar';
import { CollectionBar, CollectionShelf, ShelfOff } from '../gallery/CollectionShelf';
import { InspectDialog } from '../gallery/InspectDialog';
import '../gallery/gallery.css';

/**
 * Goal first, then a template (ADR 0171). Browsing only reads; Use template
 * creates a draft and opens the editor — installing an online template first,
 * silently. The editor owns review and publishing. Every read belongs to the
 * current step, so an abandoned response cannot replace a later choice or
 * start a draft after this flow was closed.
 *
 * Step 2 is the one gallery: the collections shelf, one toolbar row, and a
 * grid of every template this goal can start from — this site's, the online
 * library's, and Pro's as locked hints where those are wanted.
 */
export interface GoalScreenProps {
  onCreated: (id: string) => void;
  /** The occasion a new campaign is created into: its dates prefilled (ADR 0149 §3), its seasonal collection open (ADR 0171). */
  occasion?: string;
  onBusyChange?: (busy: boolean) => void;
  onCheckOptins?: () => void;
  /** A design id from a "Use this template" link: shown first, then started from (ADR 0156). */
  design?: string;
}

export function GoalScreen({ onCreated, onBusyChange, onCheckOptins, occasion: into, design }: GoalScreenProps) {
  const [unpinned, setUnpinned] = useState(false);
  const { pinned: pinnedState, reload: reloadPinned } = usePinnedDesign(unpinned ? undefined : design);
  // The local design a new campaign starts from, once it is on this site.
  const pinned = pinnedState?.state === 'ready' ? pinnedState.entry : null;
  const [goals, setGoals] = useState<Loadable<GoalEntry[]>>(LOADING);
  const [goal, setGoal] = useState<GoalEntry | null>(null);
  const [gallery, setGallery] = useState<Loadable<GoalGallery>>(LOADING);
  const [choices, setChoices] = useState<GalleryChoices>(NO_CHOICES);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [stage, setStage] = useState('any');
  const [page, setPage] = useState(0);
  const [inspected, setInspected] = useState<string | null>(null);
  const inspectTrigger = useRef<HTMLElement | null>(null);
  const picker = usePicker();
  const setups = useMemo(() => gallery.status === 'ready' ? gallery.data.setups : [], [gallery]);
  const previews = useSetupPreviews(goal?.id ?? '', setups);
  const [goalsRetry, setGoalsRetry] = useState(0);
  const [galleryRetry, setGalleryRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createUnconfirmed, setCreateUnconfirmed] = useState(false);
  // A setup that changed or left the library since it was previewed can only be reloaded, never retried.
  const [staleSetup, setStaleSetup] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  /** The card being added from the library, and the card whose install failed. */
  const [adding, setAdding] = useState<string | null>(null);
  const [installFailed, setInstallFailed] = useState<{ key: string; message: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const lastStart = useRef<string | undefined>(undefined);
  const preselected = useRef(false);
  const active = useRef(false);
  const operation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; operation.current += 1; };
  }, []);
  useEffect(() => {
    onBusyChange?.(starting !== null || adding !== null);
    return () => onBusyChange?.(false);
  }, [onBusyChange, starting, adding]);
  useEffect(() => {
    if (starting === null && adding === null) return;
    // WordPress sidebar links and reloads leave the React navigation guard.
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [starting, adding]);

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
    setRefreshError(null);
    void readGoalGallery(goal.id).then((answer) => { if (current) setGallery(ready(answer)); })
      // A refresh that fails keeps what is on screen (GUIDELINES §13); a first read says it failed.
      .catch((cause: unknown) => {
        if (!current) return;
        setGallery((held) => held.status === 'ready' ? held : failed(cause));
        setRefreshError(messageOf(cause));
      });
    return () => { current = false; };
  }, [goal, galleryRetry]);

  /*
   * Step 2 is a moment the library may check for new templates, as the
   * editor's Change template is, and the server holds it to twice a day
   * (ADR 0171). A newer list is read once; a failure is quiet, and the list
   * already saved stays the answer. The previews already here are kept: a
   * refresh changes the online cards, and a local setup whose revision moved
   * is asked for again by `useSetupPreviews` itself.
   */
  const checked = useRef(false);
  const library = gallery.status === 'ready' ? gallery.data.library : null;
  useEffect(() => {
    if (checked.current || library === null || !library.configured || library.consent !== 'yes') return;
    checked.current = true;
    void refreshCatalog(true).then((status) => {
      if (active.current && status.checked_at !== library.checked_at) setGalleryRetry(value => value + 1);
    }).catch(() => undefined);
  }, [library]);

  const choose = (chosen: GoalEntry) => {
    if (busy.current) return;
    operation.current += 1;
    setGoal(chosen);
    setChoices(NO_CHOICES); setCollectionId(null); setStage('any'); setPage(0); setInspected(null);
    // A new goal's gallery opens at the occasion's collection again.
    preselected.current = false;
    setGallery(LOADING);
    setError(null);
    setCreateUnconfirmed(false);
    setInstallFailed(null);
  };

  const start = async (playbookId?: string) => {
    // The ref closes the same-tick double-click gap before React disables UI.
    if (goal === null || busy.current || createUnconfirmed) return;
    if (goal.availability !== 'ready') return;
    // Created into an occasion, the draft needs its dates; never create it
    // unlinked because they had not arrived yet.
    if (into && !picker.data) { setError(__('Occasions are still loading. Try again in a moment.', 'wconvert')); return; }
    const choice = setups.find(entry => entry.id === playbookId);
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
      const prepared = choice && previews.previews.get(choice.id);
      const asSetUp = choice?.revision ? await prefill(goal.id, playbookId, choice.revision, prepared?.prepared_revision) : await prefill(goal.id, playbookId);
      // Started from a linked design with no setup: the server snapshots it on create.
      const prefilled = pinned && !playbookId ? { ...asSetUp, config: { ...asSetUp.config, template_id: pinned.id } } : asSetUp;
      // Leads stay in WConvert until a service is connected (ADR 0133), so
      // the prefill needs no capture mode written into it.
      const home = into ? picker.data?.occasions.items.find(item => item.id === into) : undefined;
      const draft = home ? { ...prefilled, config: { ...prefilled.config, occasion: home.id, ...occasionSchedule(home.start, home.end) } } : prefilled;
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

  /** Using an online card installs it first, silently, then starts from what it became (ADR 0171). */
  const use = async (card: Card) => {
    if (busy.current || adding !== null || createUnconfirmed) return;
    if (card.availability === 'ready') { void start(card.key); return; }
    if (card.availability !== 'install' || card.sha256 === null) return;
    const request = ++operation.current;
    // The card says Adding… from the install until the editor opens.
    busy.current = true;
    setAdding(card.key); setInstallFailed(null); setError(null);
    try {
      const installed = await installSetup(card.key, card.sha256);
      busy.current = false;
      if (!active.current || request !== operation.current) return;
      // Just installed, so nothing was previewed that could be stale: no revision to check.
      await start(installed.playbook_id);
    } catch (cause) {
      busy.current = false;
      if (active.current && request === operation.current) {
        setInstallFailed({ key: card.key, message: __('Couldn’t add this template.', 'wconvert') + ' ' + messageOf(cause) });
      }
    } finally {
      if (active.current) setAdding(null);
    }
  };

  /** A newer revision is added, then the gallery is read again to show it. */
  const update = async (card: Card) => {
    if (!card.newerRevision || adding !== null || busy.current) return;
    setAdding(card.key); setInstallFailed(null);
    try {
      await installSetup(card.newerRevision.id, card.newerRevision.sha256);
      if (active.current) { previews.reset(); setGalleryRetry(value => value + 1); }
    } catch (cause) {
      if (active.current) setInstallFailed({ key: card.key, message: __('Couldn’t add this template.', 'wconvert') + ' ' + messageOf(cause) });
    } finally {
      if (active.current) setAdding(null);
    }
  };

  // Every template card this goal offers, before any filter.
  const proHints = adminSettings()?.proHints === true;
  const cards = useMemo(() => gallery.status === 'ready'
    // A setup whose design is missing is not a choice: creation hides what it cannot start (ADR 0026).
    ? mergeSetups(gallery.data, { proHints }).filter(card => !(card.source === 'local' && card.availability === 'unavailable'))
      .filter(card => !pinned || card.template_id === pinned.id)
    : [], [gallery, proHints, pinned]);
  const today = picker.data?.today ?? '';
  const showShelf = picker.data?.preferences.show_featured !== false;
  const shelf = useMemo(() => picker.data ? shelfCollections(picker.data.collections, cards, today, picker.data.preferences.hidden) : [],
    [picker.data, cards, today]);
  const open = shelf.find(item => item.collection.id === collectionId) ?? null;
  const trees = useMemo(() => new Map(cards.map(card => [card.key, card.source === 'local'
    ? previews.previews.get(card.key)?.template ?? setups.find(entry => entry.id === card.key)?.template : undefined])), [cards, previews.previews, setups]);
  /** One personal preference changed, the rest kept. */
  const prefer = (next: Partial<NonNullable<typeof picker.data>['preferences']>) => {
    if (picker.data) void picker.preferences({ ...picker.data.preferences, ...next });
  };
  // A template that left the gallery (a re-read, a cleared pin) is no longer being looked at.
  useEffect(() => {
    if (inspected !== null && gallery.status === 'ready' && !cards.some(card => card.key === inspected)) setInspected(null);
  }, [inspected, cards, gallery.status]);
  const home = into ? picker.data?.occasions.items.find(item => item.id === into) : undefined;

  // Created from an occasion: its seasonal collection is open, at the stage the occasion is in.
  useEffect(() => {
    if (preselected.current || !home || shelf.length === 0) return;
    preselected.current = true;
    // The seasonal collection whose event overlaps the occasion's days.
    const match = shelf.find(({ collection }) => collection.event && collection.event.start <= home.end && collection.event.end_exclusive > home.start);
    if (!match) return;
    setCollectionId(match.collection.id);
    setStage(preferredStage(match.collection, today, cards.map(card => ({ id: card.key })), home));
  }, [home, shelf, cards, today]);

  const saved = picker.data?.preferences.saved ?? [];
  const filters: GalleryFilters = {
    ...choices,
    saved: choices.savedOnly ? new Set(saved) : undefined,
    collection: open ? { members: open.members } : null,
    stage,
  };
  const shown = filterCards(cards, filters);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const shownPage = Math.min(page, pages - 1);
  const paged = shown.slice(shownPage * PER_PAGE, (shownPage + 1) * PER_PAGE);
  // The page's local cards and the shelf's covers are asked for at once, so a
  // page is one previews request (useSetupPreviews batches a tick); a stage
  // still draws only near the viewport. A re-read gallery asks again for what changed.
  const covers = !pinned && showShelf ? shelf.flatMap(({ members }) => shelfCovers(members, cards)) : [];
  const wanted = [...paged, ...covers].filter(card => card.source === 'local').map(card => card.key).join(' ');
  const { onNear } = previews;
  useEffect(() => {
    for (const key of wanted.split(' ')) if (key !== '') onNear(key);
  }, [wanted, onNear, setups]);

  if (goal === null) {
    // A linked design offers only the goals it can serve (ADR 0085).
    const shown = goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow').filter((entry) => !pinned || fitsOutcome(entry.outcome, pinned.facets)) : [];
    return <Region className="wconvert-creation wconvert-creation--goals">
      <Step at={1} />
      <RegionHeader title={__('What do you want to achieve?', 'wconvert')} />
      {pinnedState && <PinnedDesignNotice pinned={pinnedState} onReload={reloadPinned} onInstalled={reloadPinned} onClear={() => setUnpinned(true)} />}
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

  const working = starting !== null || adding !== null;
  const change = (next: Partial<GalleryChoices>) => { setChoices(value => ({ ...value, ...next })); setPage(0); };
  const clear = () => { setChoices(NO_CHOICES); setPage(0); };
  // A collection with one format needs no Format choice.
  const collectionFormats = open ? new Set(filterCards(cards, { ...filters, format: 'all' }).map(card => card.displayType)) : null;
  const asking = library?.configured === true && library.consent === 'unanswered' && open === null;
  const goalsHere = goals.status === 'ready'
    ? offerableGoals(goals.data, 'creation_flow').filter(entry => entry.availability === 'ready' && (!pinned || fitsOutcome(entry.outcome, pinned.facets)))
    : [goal];
  const inspectedCard = cards.find(card => card.key === inspected) ?? null;
  const entryOf = (card: Card) => setups.find(entry => entry.id === card.key);
  // The prepared tree once it arrives, or one the index already carried.
  const treeOf = (card: Card) => trees.get(card.key);
  const unconfirmed = __('Draft creation could not be confirmed. Check your campaigns before trying again, so you don’t create a second draft.', 'wconvert');
  const checkCampaigns = onCheckOptins
    ? <Button variant="outline" onClick={onCheckOptins}>{__('Check campaigns', 'wconvert')}</Button>
    : <Button variant="outline" asChild><a href="#optins">{__('Check campaigns', 'wconvert')}</a></Button>;
  const reload = () => { previews.reset(); setGalleryRetry(value => value + 1); setError(null); };

  return <Region className="wconvert-creation wconvert-gallery-scope">
    <div className="wconvert-gallery-head">
      <Step at={2} />
      <div className="wconvert-gallery-head__title">
        <h2>{__('Choose a template', 'wconvert')}</h2>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={working}>
              <span className="wconvert-goal-switch__key">{__('Goal:', 'wconvert')}</span> {goal.label}<ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4}>
            <DropdownMenuRadioGroup value={goal.id} onValueChange={id => { const next = goalsHere.find(entry => entry.id === id); if (next && next.id !== goal.id) choose(next); }}>
              {goalsHere.map(entry => <DropdownMenuRadioItem key={entry.id} value={entry.id} className="items-start">
                <span className="grid gap-0.5"><span className="font-semibold">{entry.label}</span>{entry.description && <span className="text-note text-muted-foreground">{entry.description}</span>}</span>
              </DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {pinned && <div className="wconvert-picker__notice" role="status">
        <strong>{sprintf(/* translators: %s: a design name. */ __('Starting from “%s”', 'wconvert'), pinned.name)}</strong>
        <p>{__('Start with this design and your own words, or pick a template below that uses it.', 'wconvert')}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={working} onClick={() => { void start(); }}>{starting === 'scratch' ? __('Starting…', 'wconvert') : __('Start with this design', 'wconvert')}</Button>
          <Button variant="outline" disabled={working} onClick={() => setUnpinned(true)}>{__('Show every template', 'wconvert')}</Button>
        </div>
      </div>}
    </div>
    {picker.error && <RegionError message={picker.error} onRetry={() => { void picker.reload(); }} />}
    {refreshError && gallery.status === 'ready' && <RegionError message={refreshError} onRetry={() => setGalleryRetry(value => value + 1)} />}
    {!inspected && error !== null && (createUnconfirmed
      ? <RegionError message={unconfirmed} action={checkCampaigns} />
      : staleSetup ? <RegionError message={error} action={<Button variant="outline" disabled={working} onClick={reload}>{__('Reload templates', 'wconvert')}</Button>} />
        : <RegionError message={error} onRetry={() => { void start(lastStart.current); }} />)}
    {starting !== null && <RegionBody><p role="status" className="m-0 text-note">{__('Creating your draft and opening the editor…', 'wconvert')}</p></RegionBody>}
    <div className="wconvert-gallery-body">
      {!pinned && picker.data && (shelf.length > 0 || picker.data.preferences.hidden.length > 0) && (showShelf
        ? <CollectionShelf shelf={shelf} cards={cards} trees={trees} today={today} active={collectionId}
          hidden={picker.data.preferences.hidden.length} disabled={working || picker.saving} onNear={previews.onNear}
          onOpen={id => { setCollectionId(id); setStage(id ? preferredStage(shelf.find(item => item.collection.id === id)!.collection, today, cards.map(card => ({ id: card.key })), home) : 'any'); setPage(0); }}
          onHide={id => { prefer({ hidden: [...picker.data!.preferences.hidden, id] }); if (id === collectionId) setCollectionId(null); }}
          onRestore={() => prefer({ hidden: [] })}
          onHideAll={() => { prefer({ show_featured: false }); setCollectionId(null); }} />
        : <ShelfOff disabled={picker.saving} onShow={() => prefer({ show_featured: true })} />)}
      {gallery.status === 'failed' ? <RegionErrorState message={gallery.message} onRetry={() => setGalleryRetry((value) => value + 1)} />
        : gallery.status === 'loading' ? <GallerySkeleton cards={3} />
          : <>
            <GalleryToolbar cards={cards} filters={filters} choices={choices} onChange={change} onClear={clear} shown={shown.length} disabled={working}
              showPlan={proHints && cards.some(card => card.availability === 'locked')}
              showFormat={!collectionFormats || collectionFormats.size > 1 || choices.format !== 'all'} />
            {open && <CollectionBar shelf={open} stage={stage} disabled={working} onStage={value => { setStage(value); setPage(0); }}
              onClose={() => { setCollectionId(null); setStage('any'); setPage(0); }} />}
            <GalleryGrid total={cards.length} shown={shown.length} page={shownPage} pages={pages} onPage={setPage} onClear={clear} disabled={working}
              empty={{ title: __('No templates for this goal yet', 'wconvert'), body: __('Start from a blank design instead.', 'wconvert'),
                action: <Button disabled={working} onClick={() => { void start(); }}>{__('Choose a design myself', 'wconvert')}</Button> }}
              consent={asking && <LibraryConsent title={__('See more templates from the WConvert library?', 'wconvert')} allow={__('Show online templates', 'wconvert')}
                onAnswered={() => setGalleryRetry(value => value + 1)} />}>
              {paged.map(card => <GalleryCard key={card.key} card={card} template={treeOf(card)} onNear={previews.onNear}
                previewFailed={previews.failed.has(card.key)} onRetryPreview={() => previews.retry(card.key)}
                saved={saved.includes(card.designKey)} onSave={picker.data ? () => picker.toggleSaved(card.designKey) : undefined}
                busy={starting === card.key || adding === card.key} disabled={working || createUnconfirmed}
                failed={installFailed?.key === card.key ? installFailed.message : null}
                onInspect={() => { inspectTrigger.current = document.activeElement as HTMLElement | null; if (card.source === 'local') previews.onNear(card.key); setInspected(card.key); }}
                onUse={() => { void use(card); }} onUpdate={card.newerRevision ? () => { void update(card); } : undefined} />)}
            </GalleryGrid>
          </>}
    </div>
    <InspectDialog card={inspectedCard} template={inspectedCard ? treeOf(inspectedCard) : undefined}
      gist={inspectedCard ? gistOf(entryOf(inspectedCard)?.notes ?? '') : undefined}
      onClose={() => setInspected(null)} returnFocusTo={inspectTrigger}
      action={inspectedCard && <>
        {error && (createUnconfirmed ? <><p role="alert" className="m-0 text-note text-destructive">{unconfirmed}</p>{checkCampaigns}</>
          : <><p role="alert" className="m-0 text-note text-destructive">{error}</p>
            {staleSetup && <Button variant="outline" disabled={working} onClick={() => { setInspected(null); reload(); }}>{__('Reload templates', 'wconvert')}</Button>}</>)}
        {installFailed?.key === inspectedCard.key && <p role="alert" className="m-0 text-note text-destructive">{installFailed.message}</p>}
        <TemplateAction card={inspectedCard} busy={starting === inspectedCard.key || adding === inspectedCard.key} disabled={working || createUnconfirmed}
          onUse={() => { void use(inspectedCard); }} onUpdate={inspectedCard.newerRevision ? () => { void update(inspectedCard); } : undefined} />
      </>} />
    {cards.length > 0 && <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
      <span className="text-note text-muted-foreground">{__('None of these fit?', 'wconvert')}</span>
      <Button variant="outline" disabled={working} onClick={() => { void start(); }}>{starting === 'scratch' ? __('Creating draft…', 'wconvert') : __('Choose a design myself', 'wconvert')}</Button>
    </RegionFooter>}
  </Region>;
}

function Step({ at }: { at: 1 | 2 }) {
  return <nav className="wconvert-creation__steps" aria-label={sprintf(/* translators: 1: the current step's number, e.g. “1”, 2: how many steps there are, e.g. “2”. */ __('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}>
    <span className="sr-only">{sprintf(/* translators: 1: the current step's number, e.g. “1”, 2: how many steps there are, e.g. “2”. */ __('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}</span>
    <ol>
      {[__('Choose a goal', 'wconvert'), __('Choose a template', 'wconvert')].map((label, index) => <li key={label} aria-current={at === index + 1 ? 'step' : undefined}>
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
