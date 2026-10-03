import { renderingFor } from '../goals/availability';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { LayoutTemplate, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PickerPagination } from '../discovery/PickerPagination';
import { ComparisonTray } from '../discovery/ComparisonTray';
import { PickerSearch } from '../discovery/PickerSearch';
import { OptionStrip } from '../shell/OptionStrip';
import { PickerSettings } from '../discovery/PickerSettings';
import { EmptyState } from '../shell/EmptyState';
import { Gallery, type Fit } from './Gallery';
import { DesignComparison } from './DesignComparison';
import { TemplateDesignDetail, type PrepareDesign } from './TemplateDesignDetail';
import { facetOptions, narrow, toggled, type Chosen } from './facets';
import { displayTypeOptions } from '../displayTypes';
import { nameOf, type TemplateIndex } from '../templates/api';
import type { Template } from '@renderer/types';
import { usePicker } from '../discovery/usePicker';
import { designKey } from '../discovery/model';
import { fitsOutcome } from '../goals/outcome';

/** Reviewed starting points; extension designs retain their index order after these. */
const RECOMMENDED: Readonly<Record<string, readonly string[]>> = {
  popup: ['fieldwork', 'sunday-marginalia', 'useful-guide', 'launch-checklist', 'punched-ticket', 'summer-archive'],
  inline: ['callback-notes', 'inline-rule', 'inline-choice', 'inline-split'],
  floating_bar: ['bar-code', 'bar-email-capture', 'bar-countdown', 'bar-announcement'],
  slide_in: ['slide-in-code', 'slide-in-photo', 'slide-in-benefits', 'slide-in-nudge'],
};

export interface TemplatePickerProps {
  readonly index: TemplateIndex;
  readonly trees: ReadonlyMap<string, Template>;
  readonly displayType: string;
  readonly currentDisplayType?: string;
  readonly onFormatChange?: (format: string) => void;
  readonly chosen: string | undefined;
  readonly hasCurrentDesign?: boolean;
  readonly contentLock?: boolean;
  readonly fit: Fit;
  readonly goalLabel?: string;
  readonly busy: boolean;
  readonly active?: boolean;
  readonly initialInspectedId?: string;
  readonly onChoose: (id: string, prepared?: Template) => void;
  readonly onPrepare?: PrepareDesign;
  readonly onNear: (id: string) => void;
  readonly failed?: ReadonlySet<string>;
  readonly onRetry?: (id: string) => void;
}

/** Browse by what the design does, inspect it, then apply it to the draft. */
export function TemplatePicker({
  index, trees, displayType, currentDisplayType, onFormatChange, chosen, fit, goalLabel, busy, onChoose, onPrepare, onNear, failed, onRetry, active = true, initialInspectedId, hasCurrentDesign = true, contentLock = false,
}: TemplatePickerProps) {
  const [chosenFacets, setChosenFacets] = useState<Chosen>({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { setInspectedId(initialInspectedId ?? null); }, [initialInspectedId, displayType]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [goalFitOnly, setGoalFitOnly] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(initialInspectedId ?? null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const filterId = useId();
  const picker = usePicker();
  const [compared,setCompared] = useState<string[]>([]); const [comparing,setComparing] = useState(false); const fromComparison = useRef(false);
  const [settings, setSettings] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useMemo(() => new Set(picker.data?.preferences.saved ?? []), [picker.data?.preferences.saved]);

  const forType = useMemo(
    () => {
      const recommended = RECOMMENDED[displayType] ?? [];
      const rank = (id: string) => {
        const position = recommended.indexOf(id);
        return position < 0 ? recommended.length : position;
      };
      // Hidden members leave the counts and facets too, not only the cards
      // (ADR 0116).
      return index.templates.filter((entry) => entry.display_type === displayType && renderingFor(entry.availability, 'settings_list') !== 'hide')
        .sort((a, b) => rank(a.id) - rank(b.id));
    },
    [index.templates, displayType],
  );
  const available = useMemo(
    () => forType.filter((entry) => (!availableOnly || entry.availability === 'ready')
      && (!goalFitOnly || !fit.outcome || fitsOutcome(fit.outcome, entry.facets))
      && (!savedOnly || saved.has(designKey(entry)))),
    [forType, availableOnly, goalFitOnly, fit.outcome, savedOnly, saved],
  );
  const shown = useMemo(
    () => { const entries = narrow(available, displayType, chosenFacets, query, index.labels); return sort === 'name' ? entries.sort((a,b)=>a.name.localeCompare(b.name)) : entries; },
    [available, displayType, chosenFacets, query, index.labels, sort],
  );
  const pages = Math.max(1, Math.ceil(shown.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const visible = shown.slice(currentPage * 24, (currentPage + 1) * 24);
  const inspected = forType.find((entry) => entry.id === inspectedId);
  const comparedEntries = forType.filter(entry=>compared.includes(entry.id) && entry.availability === 'ready');
  const hasLocked = forType.some((entry) => entry.availability !== 'ready');
  const hasFilters = query !== '' || savedOnly || availableOnly || Object.values(chosenFacets).some((v) => v.length > 0);
  const secondaryFacets = Object.entries(index.facets).filter(([key]) =>
    !['captures', 'has_image', 'act'].includes(key),
  );
  const selectedAct = chosenFacets.act?.[0] ?? '';

  const clear = () => {
    setPage(0);
    setChosenFacets({});
    setQuery('');
    setAvailableOnly(false);
    setGoalFitOnly(false); setSavedOnly(false);
  };
  const toggle = (facet: string, value: string) =>
    setChosenFacets((current) => toggled(current, facet, value));
  const options = (facet: string, values: readonly string[]) =>
    facetOptions(available, facet, values, chosenFacets, query, index.labels);

  if (forType.length === 0) {
    return (
      <EmptyState icon={LayoutTemplate} title={__('No designs for this display type', 'wconvert')}>
        {__('Close the library to return to your draft. Designs for this format arrive with WConvert and its extensions.', 'wconvert')}
      </EmptyState>
    );
  }

  return (
    <div className="wconvert-design-browser">
      {settings && <PickerSettings context="replacement" picker={picker} onBack={() => { setSettings(false); requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); }} />}
      {/* Keep this view mounted so Back restores the filters and the scroll position. */}
      <div className="wconvert-design-browser__browse" hidden={inspected !== undefined || comparing || settings}>
        <div className="wconvert-picker__controls wconvert-toolbar">
          <div className="wconvert-picker__search-row">
            <PickerSearch label={__('Search designs','wconvert')} value={query} disabled={busy} onChange={value=>{setQuery(value);setPage(0);}} placeholder={__('Search a need, e.g. a guide or quote…','wconvert')} />
            {onFormatChange && <label className="wconvert-picker__format text-note">{__('Format','wconvert')}<select className="wconvert-picker__select" value={displayType} onChange={event=>{setPage(0);setCompared([]);setComparing(false);onFormatChange(event.target.value);}}>{displayTypeOptions(displayType).map(({value,label})=><option key={value} value={value}>{label}</option>)}</select></label>}
            {fit.outcome && <select className="wconvert-picker__select" aria-label={__('Design fit', 'wconvert')}
              value={goalFitOnly ? 'goal' : 'all'} onChange={(event) => setGoalFitOnly(event.target.value === 'goal')}>
              <option value="goal">{goalLabel
                ? sprintf(/* translators: %s: campaign goal. */ __('For “%s”', 'wconvert'), goalLabel)
                : __('For this goal', 'wconvert')}</option>
              <option value="all">{__('All designs', 'wconvert')}</option>
            </select>}
            <Button variant="outline" aria-pressed={savedOnly} disabled={!picker.data} onClick={() => setSavedOnly(!savedOnly)}>{sprintf(__('Saved %s', 'wconvert'), String(saved.size))}</Button>
            <Button variant="outline" disabled={busy || !picker.data} onClick={()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSettings(true);}}>{__('My preferences','wconvert')}</Button>
            <Button variant="outline" className="wconvert-picker__more"
              aria-expanded={moreOpen} aria-controls={filterId} onClick={() => setMoreOpen(!moreOpen)}>
              <SlidersHorizontal size={15} aria-hidden="true" />
              {__('Filters', 'wconvert')}
            </Button>
          </div>
          <div id={filterId} className="wconvert-picker__extra" hidden={!moreOpen}>
            <OptionStrip label={__('What visitors do','wconvert')} value={selectedAct} onChange={value=>setChosenFacets(current=>({...current,act:value===''?[]:[value]}))}
              options={[{value:'',label:__('All designs','wconvert')},{value:'submit',label:__('Fill in a form','wconvert')},{value:'click',label:__('Follow a link','wconvert')}].filter(({value})=>value==='' || forType.some(entry=>entry.facets.act===value))} />
            <div className="wconvert-picker__filter-row">
              <FacetStrip facet="captures" title={__('Must include', 'wconvert')}
                options={options('captures', index.facets.captures ?? [])}
                labels={index.labels} chosen={chosenFacets.captures ?? []}
                onToggle={(value) => toggle('captures', value)} />
              {options('has_image', ['true']).map(({ count }) => (
                <Button key="picture" variant="outline" className="wconvert-picker__filter"
                  aria-pressed={chosenFacets.has_image?.includes('true') === true}
                  disabled={count === 0 && !chosenFacets.has_image?.includes('true')}
                  onClick={() => toggle('has_image', 'true')}>
                  {__('With a picture', 'wconvert')}
                  <span aria-hidden="true" className="wconvert-picker__option-count">{count}</span>
                </Button>
              ))}
            </div>
            {secondaryFacets.map(([facet, values]) => (
              <FacetStrip key={facet} facet={facet}
                title={facet === 'shape' ? __('Layout', 'wconvert') : nameOf(index.labels.facets, facet)}
                options={options(facet, values)} labels={index.labels} chosen={chosenFacets[facet] ?? []}
                onToggle={(value) => toggle(facet, value)} />
            ))}
            {hasLocked && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={availableOnly}
                  onChange={(event) => setAvailableOnly(event.target.checked)} />
                {__('Available on this site', 'wconvert')}
              </label>
            )}
          </div>
          <div className="wconvert-picker__results">
            <label className="flex items-center gap-2 text-note">{__('Sort','wconvert')}<select className="wconvert-picker__select" value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="recommended">{__('Recommended','wconvert')}</option><option value="name">{__('Name A–Z','wconvert')}</option></select></label>
            <span role="status" aria-live="polite" aria-atomic="true">
              {sprintf(
                /* translators: 1: matching designs, 2: total designs for the display type. */
                __('%1$s of %2$s designs', 'wconvert'), String(shown.length), String(forType.length),
              )}
            </span>
            {hasFilters ? (
              <div className="wconvert-picker__active">
                {Object.entries(chosenFacets).flatMap(([facet, values]) => values.map((value) => {
                  const label = facet === 'act'
                    ? (value === 'submit' ? __('Fill in a form', 'wconvert') : __('Follow a link', 'wconvert'))
                    : nameOf(index.labels.facetValues, `${facet}.${value}`);
                  return (
                    <button key={`${facet}.${value}`} type="button" className="wconvert-picker__active-filter"
                      aria-label={sprintf(/* translators: %s: active filter name. */ __('Remove filter: %s', 'wconvert'), label)}
                      onClick={() => toggle(facet, value)}>
                      {label}<X size={12} aria-hidden="true" />
                    </button>
                  );
                }))}
                {availableOnly && <button type="button" className="wconvert-picker__active-filter"
                  onClick={() => setAvailableOnly(false)}>
                  {__('Available on this site', 'wconvert')}<X size={12} aria-hidden="true" />
                </button>}
                <Button variant="link" onClick={clear}>{__('Clear filters', 'wconvert')}</Button>
              </div>
            ) : null}
          </div>
        </div>
        {picker.error && <p role="alert" className="wconvert-picker__notice">{picker.error} <Button variant="link" onClick={() => { void picker.reload(); }}>{__('Reload preferences', 'wconvert')}</Button></p>}
        <div className="wconvert-picker__body">
          {shown.length === 0 ? (
            <EmptyState icon={LayoutTemplate} title={__('No designs match', 'wconvert')}
              action={<Button variant="outline" onClick={clear}>{__('Show all designs', 'wconvert')}</Button>}>
              {__('Try fewer fields, another search, or clear your filters.', 'wconvert')}
            </EmptyState>
          ) : (
            <Gallery compared={comparedEntries.map(entry=>entry.id)} onCompare={id=>{const ids=comparedEntries.map(entry=>entry.id);if(ids.includes(id))setCompared(ids.filter(value=>value!==id));else if(ids.length<2){setCompared([...ids,id]);onNear(id);}}} entries={visible} trees={trees} labels={index.labels} chosen={chosen} fit={fit}
              saved={saved} saving={picker.saving || !picker.data} onSave={entry => picker.toggleSaved(designKey(entry))}
              busy={busy} onChoose={onChoose} onNear={onNear} failed={failed} onRetry={onRetry}
              onPreview={(id) => {
                returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                onNear(id);
                fromComparison.current=false; setInspectedId(id);
              }} />
          )}

        </div>
        <ComparisonTray names={comparedEntries.map(entry=>entry.name)} disabled={busy} onClear={()=>setCompared([])} onCompare={()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setComparing(true);}} />
        {shown.length > 0 && <PickerPagination page={currentPage} pages={pages} disabled={busy} onChange={setPage} />}
      </div>
      {!settings && comparing && inspected === undefined && <DesignComparison entries={comparedEntries} trees={trees} failed={failed} onRetry={onRetry} onBack={()=>{setComparing(false);requestAnimationFrame(()=>returnFocus.current?.focus({preventScroll:true}));}} onInspect={id=>{fromComparison.current=true;onNear(id);setInspectedId(id);}} />}
      {!settings && inspected !== undefined && (
        <TemplateDesignDetail key={inspected.id} entry={inspected} template={trees.get(inspected.id)}
          currentDisplayType={currentDisplayType} hasCurrentDesign={hasCurrentDesign} contentLock={contentLock}
          labels={index.labels} current={inspected.id === chosen} active={active} fit={fit} goalLabel={goalLabel} busy={busy}
          loadError={failed?.has(inspected.id)} onRetry={onRetry ? () => onRetry(inspected.id) : undefined}
          backLabel={fromComparison.current ? __('Back to comparison', 'wconvert') : undefined}
          onChoose={onChoose} onPrepare={onPrepare} onBack={() => {
            setInspectedId(null);
            if(fromComparison.current) { setComparing(true); return; }
            requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
          }} />
      )}
    </div>
  );
}

function FacetStrip({ facet, title, options, labels, chosen, onToggle }: {
  facet: string;
  title: string;
  options: readonly { value: string; count: number }[];
  labels: TemplateIndex['labels'];
  chosen: readonly string[];
  onToggle: (value: string) => void;
}) {
  const labelId = useId();
  if (options.length === 0) return null;
  return (
    <div className="wconvert-picker__facet" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{title}</span>
      {options.map(({ value, count }) => (
        <Button key={value} type="button" variant="outline" className="wconvert-picker__filter"
          aria-pressed={chosen.includes(value)} disabled={count === 0 && !chosen.includes(value)}
          onClick={() => onToggle(value)}>
          {nameOf(labels.facetValues, `${facet}.${value}`)}
          <span aria-hidden="true" className="wconvert-picker__option-count">{count}</span>
        </Button>
      ))}
    </div>
  );
}

/** Fetch only nearby trees, in batches within the server's 24-design limit. */
export function useTemplateTrees(
  fetchTrees: (ids: readonly string[]) => Promise<{ templates: (Template & { id: string })[] }>,
) {
  const [trees, setTrees] = useState<ReadonlyMap<string, Template>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const asked = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const want = useCallback((id: string) => {
    if (asked.current.has(id) || pending.current.has(id)) return;
    pending.current.add(id);
    if (pending.current.size > 1) return;

    void Promise.resolve().then(() => {
      if (!alive.current) return;
      const all = [...pending.current];
      pending.current.clear();
      for (const each of all) asked.current.add(each);

      for (let offset = 0; offset < all.length; offset += 24) {
        const batch = all.slice(offset, offset + 24);
        void fetchTrees(batch).then(({ templates }) => {
          if (!alive.current) return;
          const returned = new Set(templates.map((design) => design.id));
          setTrees((current) => {
            const next = new Map(current);
            for (const design of templates) next.set(design.id, { tree: design.tree, tokens: design.tokens });
            return next;
          });
          setFailed((current) => {
            const next = new Set(current);
            for (const each of batch) {
              if (returned.has(each)) next.delete(each);
              else next.add(each);
            }
            return next;
          });
        }).catch(() => {
          if (alive.current) setFailed((current) => new Set([...current, ...batch]));
        });
      }
    });
  }, [fetchTrees]);

  const retry = useCallback((id: string) => {
    asked.current.delete(id);
    setFailed((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    want(id);
  }, [want]);

  return { trees, failed, want, retry };
}
