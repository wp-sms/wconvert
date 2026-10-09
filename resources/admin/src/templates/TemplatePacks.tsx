import { isFreeInstall, tierName } from '../goals/availability';
import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowRight, ExternalLink, Layers, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { AdminDialogFooter } from '../components/ui/admin-dialog';
import { messageOf } from '../shell/loadable';
import { Disclosure } from '../shell/Disclosure';
import { RegionErrorState } from '../shell/Region';
import { PickerDialogBody } from '../discovery/PickerDialog';
import { PickerSearch } from '../discovery/PickerSearch';
import { OptionStrip } from '../shell/OptionStrip';
import { matchesSearch } from '../discovery/search';
import { formatCount, formatWhen } from '../lib/format';
import { TemplatePackDetail } from './TemplatePackDetail';
import { catalogStatus, refreshCatalog, previewPack, installPack, type CatalogPack, type CatalogStatus, type PackPreview } from './catalog';

type Work = 'loading' | 'checking' | 'previewing' | 'installing' | 'opening';

/**
 * The pack list, as the body and footer of whichever dialog holds it. It has
 * no header of its own: the dialog's title already says "Template packs", and
 * a second heading under it was the double header ADR 0131 removed.
 */
export function TemplatePacks({ displayType, onInstalled, onInspect, goal, onChooseStartingPoints }: {
  displayType: string;
  onInstalled: () => Promise<void>;
  onInspect?: (id: string) => void;
  goal?: string;
  onChooseStartingPoints?: (packId: string) => void;
}) {
  const [query,setQuery] = useState(''); const [source,setSource] = useState('all');
  const [sort,setSort] = useState('recommended');
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState<Work | null>('loading');
  const [preview, setPreview] = useState<PackPreview | null>(null);
  const alive = useRef(false);
  const pending = useRef(true);
  const loadSequence = useRef(0);
  const busy = work !== null;
  const list = useRef<HTMLDivElement>(null);
  const listPosition = useRef(0);
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (preview || !returnFocus.current || !list.current) return;
    list.current.scrollTop = listPosition.current;
    const button = Array.from(list.current.querySelectorAll<HTMLButtonElement>('[data-pack-id]'))
      .find((entry) => entry.dataset.packId === returnFocus.current);
    button?.focus({ preventScroll: true });
    returnFocus.current = null;
  }, [preview]);

  useEffect(() => {
    alive.current = true;
    const sequence = ++loadSequence.current;
    pending.current = true;
    setWork('loading');
    const current = () => alive.current && sequence === loadSequence.current;
    void catalogStatus().then((result) => { if (current()) setStatus(result); })
      .catch((cause: unknown) => { if (current()) setError(messageOf(cause)); })
      .finally(() => { if (current()) { pending.current = false; setWork(null); } });
    return () => { alive.current = false; loadSequence.current += 1; };
  }, []);

  const run = async (kind: Work, action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setWork(kind);
    setError(null);
    try { await action(); } catch (cause) { if (alive.current) setError(messageOf(cause)); }
    finally { pending.current = false; if (alive.current) setWork(null); }
  };
  const inspect = (pack: CatalogPack, local: boolean) => { void run('previewing', async () => {
    listPosition.current = list.current?.scrollTop ?? 0;
    const result = await previewPack(pack.id, local);
    if (alive.current) setPreview(result);
  }); };
  const install = () => { if (preview !== null) void run('installing', async () => {
    const result = await installPack(preview.id, preview.digest);
    if (!alive.current) return;
    // Keep the successful install even if reloading the editor's index fails.
    setStatus(result);
    await onInstalled();
  }); };
  if (preview) {
    const current = status?.packs.find((pack) => pack.id === preview.id);
    return <TemplatePackDetail key={`${preview.id}:${preview.version}`} pack={preview} displayType={displayType}
      goal={goal} onChooseStartingPoints={onChooseStartingPoints}
      installedVersion={current?.installed_version ?? null} busy={busy} installing={work === 'installing'} error={error}
      onBack={() => { returnFocus.current = preview.id; setPreview(null); setError(null); }} onInstall={install}
      onContinue={(id) => { void run('opening', async () => {
        await onInstalled();
        if (alive.current) onInspect?.(id);
      }); }} />;
  }
  // A free install cannot install a premium pack, so it is not shown one
  // (ADR 0116) — filtered here so the counts and empty states agree.
  const listed = (status?.packs ?? []).filter((pack) => !isFreeInstall() || pack.access !== 'premium');
  const shown = listed.filter(pack=>matchesSearch(query,[pack.name,pack.description]) && (source==='all' || (source==='installed' ? pack.installed_version !== null : pack.installed_version === null)));
  if (sort==='name') shown.sort((a,b)=>a.name.localeCompare(b.name));
  const installed = shown.filter(pack=>pack.installed_version !== null);
  const available = shown.filter(pack=>pack.installed_version === null);
  const loadAgain = () => { void run('loading', async () => {
    const result = await catalogStatus(); if (alive.current) setStatus(result);
  }); };

  return <div className="wconvert-packs">
    <PickerDialogBody ref={list} role="region" aria-label={__('Template packs', 'wconvert')} aria-busy={busy}>
      {/* The libraries' two rows (ADR 0132): search and sort; then availability and the count. */}
      {status && listed.length > 0 && <div className="wconvert-picker__controls wconvert-toolbar">
        <div className="wconvert-picker__search-row">
          <PickerSearch label={__('Search template packs','wconvert')} value={query} onChange={setQuery} disabled={busy} />
          <select className="wconvert-picker__select" aria-label={__('Sort template packs','wconvert')} value={sort} onChange={event=>setSort(event.target.value)}>
            <option value="recommended">{__('Recommended first','wconvert')}</option><option value="name">{__('Name A–Z','wconvert')}</option>
          </select>
        </div>
        <div className="wconvert-picker__facet">
          <OptionStrip label={__('Pack availability','wconvert')} value={source} disabled={busy} onChange={setSource} options={[{value:'all',label:__('All packs','wconvert')},{value:'installed',label:__('Installed','wconvert')},{value:'available',label:__('Available to install','wconvert')}]} />
          <span className="wconvert-picker__count" role="status">{sprintf(_n('%s pack','%s packs',shown.length,'wconvert'),formatCount(shown.length))}</span>
        </div>
      </div>}
      {work === 'previewing' && <p role="status" className="m-0 text-note">{__('Opening pack…', 'wconvert')}</p>}
      {status === null ? busy ? <PacksSkeleton />
        : <RegionErrorState message={error ?? __('Packs could not be loaded.', 'wconvert')} onRetry={loadAgain} /> : <>
        {installed.length > 0 && <PackGroup title={__('Installed', 'wconvert')}
          packs={installed} busy={busy} onInspect={inspect} />}
        {available.length > 0 && <PackGroup title={__('Available to install', 'wconvert')}
          packs={available} busy={busy} onInspect={inspect} />}
        {listed.length > 0 && shown.length === 0 && <div className="wconvert-packs__empty"><h3>{__('No packs match','wconvert')}</h3><p>{__('Try a shorter search or another availability filter.','wconvert')}</p><Button variant="outline" onClick={()=>{setQuery('');setSource('all');}}>{__('Show all packs','wconvert')}</Button></div>}
        {listed.length === 0 && <div className="wconvert-packs__empty">
          <Layers size={28} aria-hidden="true" />
          <h3>{status.checked_at ? __('No packs are listed yet', 'wconvert') : __('No packs yet', 'wconvert')}</h3>
          <p>{status.configured ? status.checked_at ? __('Check again later for new packs.', 'wconvert')
            : __('Check for packs to see what your catalog offers.', 'wconvert')
            : __('No catalog is connected to this site.', 'wconvert')}</p>
        </div>}
        {status.configured ? <Disclosure variant="inline" className="wconvert-packs__connection" title={__('Catalog connection', 'wconvert')}>
          <p className="m-0 break-all"><bdi>{status.source}</bdi></p>
          <p className="m-0">{__('Checking, previewing and installing contact this service. No campaigns, leads or license details are sent. Installed packs work offline.', 'wconvert')}</p>
        </Disclosure> : installed.length > 0 && <p className="wconvert-packs__connection">{__('No catalog is connected. Installed packs still work.', 'wconvert')}</p>}
      </>}
    </PickerDialogBody>
    {status !== null && <AdminDialogFooter error={error}
      note={status.checked_at ? sprintf(/* translators: %s: when the catalog was last checked, e.g. “Oct 9, 2026, 2:22 PM”. */ __('Last checked %s', 'wconvert'), formatWhen(status.checked_at, 'detail')) : undefined}>
      {status.configured && <Button variant="outline" disabled={busy} onClick={() => { void run('checking', async () => {
        const result = await refreshCatalog(); if (alive.current) setStatus(result);
      }); }}><RefreshCw aria-hidden="true" />
        {work === 'checking' ? __('Checking…', 'wconvert') : __('Check for packs', 'wconvert')}</Button>}
    </AdminDialogFooter>}
  </div>;
}

/** The list's own shape while the catalog answers: a status line and two pack cards. */
function PacksSkeleton() {
  return <div className="wconvert-packs__loading">
    <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading your packs…', 'wconvert')}</p>
    <ul className="wconvert-packs__grid" aria-hidden="true">{[0, 1].map(index => <li key={index} className="wconvert-pack-card">
      <Skeleton className="h-[1lh] w-40 max-w-full text-heading" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-8 w-32" />
    </li>)}</ul>
  </div>;
}

function PackGroup({ title, packs, busy, onInspect }: {
  title: string; packs: CatalogPack[]; busy: boolean;
  onInspect: (pack: CatalogPack, local: boolean) => void;
}) {
  return <section className="wconvert-packs__group" aria-label={title}>
    <div className="wconvert-packs__group-heading"><h3>{title}</h3><span>{sprintf(_n('%s pack', '%s packs', packs.length, 'wconvert'), formatCount(packs.length))}</span></div>
    <ul className="wconvert-packs__grid">{packs.map((pack) => {
      const installed = pack.installed_version !== null;
      return <li key={pack.id} className="wconvert-pack-card">
        <div className="wconvert-pack-card__heading"><Layers size={20} aria-hidden="true" /><h4><bdi>{pack.name}</bdi></h4>
          {/* A paid install already has it, so the tier is a fact here, not a lock (§14). */}
          {pack.access === 'premium' && !isFreeInstall() && <Badge variant="outline">{tierName(undefined)}</Badge>}
          {pack.state === 'update' && <Badge variant="outline">{__('Update available', 'wconvert')}</Badge>}</div>
        <p className="wconvert-pack-card__description">{pack.description}</p>
        <div className="wconvert-pack-card__footer">
          <Button data-pack-id={pack.id} variant="outline" disabled={busy} aria-label={sprintf(installed ? __('Explore designs in %s', 'wconvert') : __('Preview %s', 'wconvert'), pack.name)}
            onClick={() => onInspect(pack, installed)}>{installed ? __('Explore designs', 'wconvert') : __('Preview pack', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>
        </div>
        {pack.preview_url && <Button asChild variant="link"><a href={pack.preview_url} target="_blank" rel="noopener noreferrer">{__('View public previews', 'wconvert')}<ExternalLink aria-hidden="true" /></a></Button>}
        {pack.state === 'update' && <div className="wconvert-pack-card__update"><span>{sprintf(/* translators: %s: the new version of a pack. */ __('Version %s is available.', 'wconvert'), pack.version)}</span>
          <Button variant="ghost" disabled={busy} aria-label={sprintf(__('Preview update for %s', 'wconvert'), pack.name)} onClick={() => onInspect(pack, false)}>{__('Preview update', 'wconvert')}</Button></div>}
      </li>;
    })}</ul>
  </section>;
}
