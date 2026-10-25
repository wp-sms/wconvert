import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { PickerDialogBody, PickerDialogContent, PickerDialogHeader } from '../discovery/PickerDialog';
import { RegionError } from '../shell/Region';
import { LibraryConsent } from '../templates/LibraryConsent';
import { installDesign, refreshCatalog } from '../templates/catalog';
import { messageOf } from '../shell/loadable';
import { usePicker } from '../discovery/usePicker';
import { fitsOutcome } from '../goals/outcome';
import { adminSettings } from '../settings';
import { designIdOf, nameOf, type TemplateIndex, type TemplateIndexEntry } from '../templates/api';
import type { Template } from '@renderer/types';
import { TemplateDesignDetail, designMeta, type PrepareDesign } from './TemplateDesignDetail';
import { asConverted, conversionOf, conversionWords, type Fit } from '../gallery/conversion';
import { filterCards, mergeDesigns, optionCounts, type GalleryCard as Card, type GalleryFilters } from '../gallery/model';
import { GalleryCard, TemplateAction } from '../gallery/GalleryCard';
import { GalleryGrid, PER_PAGE } from '../gallery/GalleryGrid';
import { GalleryToolbar, NO_CHOICES, type ActiveFilter, type GalleryChoices } from '../gallery/GalleryToolbar';
import { InspectDialog } from '../gallery/InspectDialog';
import '../gallery/gallery.css';

export interface TemplatePickerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClosed?: () => void;
  readonly index: TemplateIndex;
  readonly trees: ReadonlyMap<string, Template>;
  /** The campaign's format: a template in another one says what changing it does. */
  readonly displayType: string;
  readonly chosen: string | undefined;
  readonly hasCurrentDesign?: boolean;
  readonly contentLock?: boolean;
  readonly fit: Fit;
  readonly goalLabel?: string;
  readonly busy: boolean;
  readonly onChoose: (id: string, prepared?: Template) => void;
  readonly onPrepare?: PrepareDesign;
  readonly onNear: (id: string) => void;
  readonly failed?: ReadonlySet<string>;
  readonly onRetry?: (id: string) => void;
  /** The draft's `integration_mappings`, so a design's detail can say a swap would remove some. */
  readonly fieldMappings?: unknown;
  /** The hosted library added or refreshed designs; reload the index (ADR 0156). */
  readonly onLibraryChanged?: () => Promise<void>;
}

/** The editor's taxonomy filters, beside the gallery's own. */
interface Extras {
  readonly industry: string;
  readonly occasion: string;
  readonly style: string;
  readonly shape: string;
  readonly picture: boolean;
}

const NO_EXTRAS: Extras = { industry: '', occasion: '', style: '', shape: '', picture: false };

/**
 * Change template (ADR 0171): the one gallery, one card per design, for this
 * campaign's goal by default or every template. A design that fits once the
 * form switch adds or removes its form carries the switch's chip (ADR 0163).
 * Using a card opens its review — keep my words or the sample's, what changes
 * — and applying there replaces the draft's design.
 */
export function TemplatePickerDialog({ open, onOpenChange, onClosed, onLibraryChanged, index, trees, displayType, chosen, hasCurrentDesign = true, contentLock = false, fit, goalLabel, busy: pickerBusy, onChoose, onPrepare, onNear, failed, onRetry, fieldMappings }: TemplatePickerDialogProps) {
  const catalog = index.catalog;
  const picker = usePicker();
  const [choices, setChoices] = useState<GalleryChoices>(NO_CHOICES);
  const [extras, setExtras] = useState<Extras>(NO_EXTRAS);
  const [goalOnly, setGoalOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installFailed, setInstallFailed] = useState<{ key: string; message: string } | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const busy = pickerBusy || installing !== null;
  const proHints = adminSettings()?.proHints === true;

  /*
   * Opening the gallery is the one moment the library may check for new
   * designs, and the server holds it to twice a day (ADR 0156). A failure is
   * quiet: the designs already here are the answer until the next open.
   */
  const checked = useRef(false);
  useEffect(() => {
    if (!open || checked.current || !onLibraryChanged || catalog?.enabled !== true || catalog.consent !== 'yes') return;
    checked.current = true;
    void refreshCatalog(true).then((status) => status.checked_at !== catalog.checked_at ? onLibraryChanged() : undefined).catch(() => undefined);
  }, [open, catalog, onLibraryChanged]);

  // Each opening starts from the goal's templates, unfiltered.
  useEffect(() => {
    if (open) return;
    setChoices(NO_CHOICES); setExtras(NO_EXTRAS); setGoalOnly(true); setPage(0); setInstallFailed(null);
  }, [open]);

  const entries = useMemo(() => new Map(index.templates.map(entry => [entry.id, entry])), [index.templates]);
  const fits = (entry: TemplateIndexEntry) => !fit.outcome || fitsOutcome(fit.outcome, entry.facets);
  const conversion = (card: Card) => {
    if (goalOnly) return null;
    const entry = entries.get(card.key);
    const choice = entry ? conversionOf(entry, fit, trees.get(entry.id)) : null;
    return choice === null ? null : conversionWords(choice, fit.outcome);
  };
  // The one in use first, then those that fit the goal, then the index's order.
  const cards = useMemo(() => {
    const rank = (card: Card) => card.key === chosen ? 0 : fits(entries.get(card.key)!) ? 1 : 2;
    return mergeDesigns(index.templates, { proHints })
      .filter(card => card.key === chosen || !goalOnly || fits(entries.get(card.key)!))
      .map((card, at) => [card, at] as const).sort(([a, at], [b, bt]) => rank(a) - rank(b) || at - bt).map(([card]) => card);
  }, [index.templates, proHints, chosen, goalOnly, entries]); // eslint-disable-line react-hooks/exhaustive-deps -- `fits` reads `fit`, which the parent memoises

  const saved = picker.data?.preferences.saved ?? [];
  const filters: GalleryFilters = {
    ...choices,
    saved: choices.savedOnly ? new Set(saved) : undefined,
    tags: { industry: extras.industry, occasion: extras.occasion, style: extras.style },
    shape: extras.shape || undefined,
    hasImage: extras.picture || undefined,
  };
  const shown = filterCards(cards, filters);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const shownPage = Math.min(page, pages - 1);
  const paged = shown.slice(shownPage * PER_PAGE, (shownPage + 1) * PER_PAGE);
  const change = (next: Partial<GalleryChoices>) => { setChoices(value => ({ ...value, ...next })); setPage(0); };
  const changeExtras = (next: Partial<Extras>) => { setExtras(value => ({ ...value, ...next })); setPage(0); };
  const clear = () => { setChoices(NO_CHOICES); setExtras(NO_EXTRAS); setPage(0); };

  const tagLabels = Object.fromEntries(Object.entries(catalog?.taxonomy ?? {})
    .flatMap(([group, terms]) => terms.map(({ id, label }) => [`${group}:${id}`, label] as const)));
  const tagWord = (group: string, id: string) => tagLabels[`${group}:${id}`] ?? id;
  const shapeWord = (id: string) => nameOf(index.labels.facetValues, `shape.${id}`);
  const extraSelect = (facet: 'industry' | 'occasion' | 'style' | 'shape', label: string, word: (id: string) => string) => {
    const counts = optionCounts(cards, filters, facet);
    const values = Object.keys(counts).filter(value => value !== '' && (counts[value] > 0 || extras[facet] === value)).sort();
    if (values.length === 0) return null;
    return <label key={facet}>
      <span>{label}</span>
      <select className="wconvert-picker__select" value={extras[facet]} onChange={event => changeExtras({ [facet]: event.target.value })}>
        <option value="">{__('Any', 'wconvert')}</option>
        {values.map(value => <option key={value} value={value}>{word(value)}</option>)}
      </select>
    </label>;
  };
  const extrasActive: ActiveFilter[] = [
    ...(['industry', 'occasion', 'style'] as const).flatMap(group => extras[group] ? [{ id: group, label: tagWord(group, extras[group]), remove: () => changeExtras({ [group]: '' }) }] : []),
    ...(extras.shape ? [{ id: 'shape', label: shapeWord(extras.shape), remove: () => changeExtras({ shape: '' }) }] : []),
    ...(extras.picture ? [{ id: 'picture', label: __('With a picture', 'wconvert'), remove: () => changeExtras({ picture: false }) }] : []),
  ];

  /** A design the library has: added to this site, then reviewed like any other. */
  const install = async (card: Card, sha256: string, id = designIdOf(entries.get(card.key)!)) => {
    if (!onLibraryChanged) return;
    setInstalling(card.key); setInstallFailed(null); setLibraryError(null);
    try {
      const installed = await installDesign(id, sha256);
      await onLibraryChanged();
      onNear(installed.template_id);
      setReviewing(installed.template_id);
    } catch (cause) {
      setInstallFailed({ key: card.key, message: __('Couldn’t add this template.', 'wconvert') + ' ' + messageOf(cause) });
    } finally { setInstalling(null); }
  };
  const use = (card: Card) => {
    if (card.availability === 'install' && card.sha256) { void install(card, card.sha256); return; }
    returnFocus.current = document.activeElement as HTMLElement | null;
    onNear(card.key);
    setReviewing(card.key);
  };
  const inspect = (card: Card) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    if (card.source === 'local' && card.availability === 'ready') { onNear(card.key); setReviewing(card.key); return; }
    setLooking(card.key);
  };
  const back = () => { setReviewing(null); requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); };

  const reviewed = reviewing ? entries.get(reviewing) : undefined;
  const looked = cards.find(card => card.key === looking) ?? null;
  // Opening a design moves the caret to its name, as the setup preview does.
  useEffect(() => { if (reviewing) title.current?.focus({ preventScroll: true }); }, [reviewing]);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) { setReviewing(null); setLooking(null); }
      onOpenChange(next);
    }}>
      <PickerDialogContent onCloseAutoFocus={(event) => { if (onClosed) { event.preventDefault(); onClosed(); } }}>
        <PickerDialogHeader className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 text-start">
          <div className="wconvert-picker__identity">
            <DialogTitle ref={title} tabIndex={-1}>{reviewed ? reviewed.name : __('Change template', 'wconvert')}</DialogTitle>
            {reviewed && reviewed.id === chosen && <Badge variant="secondary">{__('Current template', 'wconvert')}</Badge>}
          </div>
          <DialogDescription>{reviewed
            ? designMeta(asConverted(reviewed, fit, trees.get(reviewed.id)), index.labels)
            : __('Your words, rules and placement stay. Only the design changes.', 'wconvert')}</DialogDescription>
        </PickerDialogHeader>
        {/* The grid stays mounted under a review, so Back returns to the card and the scroll it left. */}
        {reviewed && (
          <TemplateDesignDetail key={reviewed.id} entry={reviewed} template={trees.get(reviewed.id)}
            currentDisplayType={displayType} hasCurrentDesign={hasCurrentDesign} contentLock={contentLock}
            labels={index.labels} current={reviewed.id === chosen} active={open} fit={fit} goalLabel={goalLabel} busy={busy}
            loadError={failed?.has(reviewed.id)} onRetry={onRetry ? () => onRetry(reviewed.id) : undefined}
            backLabel={__('Back to templates', 'wconvert')} fieldMappings={fieldMappings}
            onChoose={(id, prepared) => { setReviewing(null); onChoose(id, prepared); }} onPrepare={onPrepare} onBack={back} />
        )}
        <PickerDialogBody className="wconvert-gallery-scope" hidden={reviewed !== undefined}>
            <div className="grid gap-4">
              {picker.error && <RegionError message={picker.error} onRetry={() => { void picker.reload(); }} />}
              {catalog?.update_required && <p className="wconvert-picker__notice text-note">{__('Update WConvert to see new templates from the online library.', 'wconvert')}</p>}
              {libraryError && <RegionError message={libraryError} onRetry={() => setLibraryError(null)} />}
              <GalleryToolbar cards={cards} filters={filters} choices={choices} onChange={change} onClear={clear} shown={shown.length} disabled={busy}
                showPlan={proHints && cards.some(card => card.availability === 'locked')}
                scope={fit.outcome && <label className="wconvert-gallery-toolbar__field">
                  <span className="sr-only">{__('Show', 'wconvert')}</span>
                  <select className="wconvert-picker__select" value={goalOnly ? 'goal' : 'all'} onChange={event => { setGoalOnly(event.target.value === 'goal'); setPage(0); }}>
                    <option value="goal">{goalLabel ? sprintf(/* translators: %s: campaign goal. */ __('For “%s”', 'wconvert'), goalLabel) : __('For this goal', 'wconvert')}</option>
                    <option value="all">{__('All templates', 'wconvert')}</option>
                  </select>
                </label>}
                extras={<>
                  {extraSelect('industry', __('Industry', 'wconvert'), id => tagWord('industry', id))}
                  {extraSelect('occasion', __('Occasion', 'wconvert'), id => tagWord('occasion', id))}
                  {extraSelect('style', __('Style', 'wconvert'), id => tagWord('style', id))}
                  {extraSelect('shape', __('Layout', 'wconvert'), shapeWord)}
                  {(extras.picture || cards.some(card => card.facets?.has_image)) && <label className="flex items-center gap-2">
                    <input type="checkbox" checked={extras.picture} onChange={event => changeExtras({ picture: event.target.checked })} />
                    {__('With a picture', 'wconvert')}
                  </label>}
                </>}
                extrasActive={extrasActive} />
              <GalleryGrid total={cards.length} shown={shown.length} page={shownPage} pages={pages} onPage={setPage} onClear={clear} disabled={busy}
                empty={{ title: __('No templates for this goal yet', 'wconvert'), body: __('Show all templates to choose from every design.', 'wconvert'),
                  action: <Button variant="outline" onClick={() => setGoalOnly(false)}>{__('All templates', 'wconvert')}</Button> }}
                consent={onLibraryChanged && catalog?.enabled && catalog.consent === 'unanswered' && <LibraryConsent
                  title={__('See more templates from the WConvert library?', 'wconvert')} allow={__('Show online templates', 'wconvert')}
                  onAnswered={() => { void onLibraryChanged(); }} />}>
                {paged.map(card => {
                  const words = conversion(card);
                  return <GalleryCard key={card.key} card={card} template={trees.get(card.key)} onNear={onNear}
                    previewFailed={failed?.has(card.key)} onRetryPreview={onRetry ? () => onRetry(card.key) : undefined}
                    saved={saved.includes(card.designKey)} onSave={picker.data ? () => picker.toggleSaved(card.designKey) : undefined}
                    current={card.key === chosen} conversion={words} busy={installing === card.key} disabled={busy}
                    failed={installFailed?.key === card.key ? installFailed.message : null}
                    onInspect={() => inspect(card)} onUse={() => use(card)}
                    onUpdate={card.newerRevision && onLibraryChanged ? () => { void install(card, card.newerRevision!.sha256); } : undefined} />;
                })}
              </GalleryGrid>
            </div>
          </PickerDialogBody>
        <InspectDialog card={looked} onClose={() => setLooking(null)} returnFocusTo={returnFocus}
          action={looked && <TemplateAction card={looked} busy={installing === looked.key} disabled={busy}
            onUse={() => { setLooking(null); use(looked); }} />} />
      </PickerDialogContent>
    </Dialog>
  );
}
