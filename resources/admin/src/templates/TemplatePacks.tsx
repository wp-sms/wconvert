import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowRight, Check, Layers, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { messageOf } from '../shell/loadable';
import { TemplatePackDetail } from './TemplatePackDetail';
import { catalogStatus, refreshCatalog, previewPack, installPack, type CatalogPack, type CatalogStatus, type PackPreview } from './catalog';

type Work = 'loading' | 'checking' | 'previewing' | 'installing' | 'opening';

export function TemplatePacks({ displayType, onInstalled, onInspect }: {
  displayType: string;
  onInstalled: () => Promise<void>;
  onInspect: (id: string) => void;
}) {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState<Work | null>('loading');
  const [preview, setPreview] = useState<PackPreview | null>(null);
  const alive = useRef(false);
  const pending = useRef(true);
  const loadSequence = useRef(0);
  const busy = work !== null;
  const list = useRef<HTMLElement>(null);
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
      installedVersion={current?.installed_version ?? null} busy={busy} installing={work === 'installing'} error={error}
      onBack={() => { returnFocus.current = preview.id; setPreview(null); setError(null); }} onInstall={install}
      onContinue={(id) => { void run('opening', async () => {
        await onInstalled();
        if (alive.current) onInspect(id);
      }); }} />;
  }
  const installed = status?.packs.filter((pack) => pack.installed_version !== null) ?? [];
  const available = status?.packs.filter((pack) => pack.installed_version === null) ?? [];

  return <section ref={list} className="wconvert-packs" aria-label={__('Template packs', 'wconvert')} aria-busy={busy}>
    <header className="wconvert-packs__header">
      <div><h2>{__('Template packs', 'wconvert')}</h2>
        <p>{__('Install a collection once, then choose a design for your draft.', 'wconvert')}</p></div>
      {status?.configured && <Button variant="outline" disabled={busy} onClick={() => { void run('checking', async () => {
        const result = await refreshCatalog(); if (alive.current) setStatus(result);
      }); }}><RefreshCw aria-hidden="true" className={work === 'checking' ? 'animate-spin motion-reduce:animate-none' : ''} />
        {work === 'checking' ? __('Checking…', 'wconvert') : __('Check for packs', 'wconvert')}</Button>}
    </header>
    {error && <div role="alert" className="wconvert-pack-error">{error}</div>}
    {work === 'previewing' && <p role="status" className="text-sm">{__('Opening pack…', 'wconvert')}</p>}
    {status === null ? busy ? <div role="status" className="wconvert-packs__loading">
      <p>{__('Loading your packs…', 'wconvert')}</p><Skeleton className="h-32 w-full" />
    </div> : <Button variant="outline" onClick={() => { void run('loading', async () => {
      const result = await catalogStatus(); if (alive.current) setStatus(result);
    }); }}>{__('Retry loading packs', 'wconvert')}</Button> : <>
      {installed.length > 0 && <PackGroup title={__('Ready to use', 'wconvert')} description={__('Installed on this site. Explore the designs and choose one for your draft.', 'wconvert')}
        packs={installed} busy={busy} onInspect={inspect} />}
      {available.length > 0 && <PackGroup title={__('Available to install', 'wconvert')} description={__('Preview the designs before adding a collection to your library.', 'wconvert')}
        packs={available} busy={busy} onInspect={inspect} />}
      {status.packs.length === 0 && <div className="wconvert-packs__empty">
        <Layers size={28} aria-hidden="true" />
        <h3>{status.checked_at ? __('No packs are listed yet', 'wconvert') : __('Your next collection starts here', 'wconvert')}</h3>
        <p>{status.configured ? status.checked_at ? __('Check again later for new collections.', 'wconvert')
          : __('Check for packs to see collections from your catalog. Your existing designs are available in Your designs.', 'wconvert')
          : __('A catalog has not been connected yet. Your existing library is available in Your designs.', 'wconvert')}</p>
      </div>}
      {status.configured ? <div className="wconvert-packs__connection">
        <p>{__('Installed packs work offline. Checking for packs and previewing new versions contacts your catalog service.', 'wconvert')}</p>
        <details><summary>{__('Catalog connection', 'wconvert')}</summary>
          <p className="break-all">{status.source}</p>
          <p>{__('Checking, downloading previews and installing contacts this service. No campaigns, leads or licence details are sent.', 'wconvert')}</p>
          {status.checked_at && <p>{sprintf(__('Last checked: %s', 'wconvert'), new Date(status.checked_at).toLocaleString())}</p>}
        </details>
      </div> : installed.length > 0 && <p className="wconvert-packs__connection">{__('No catalog is connected. Your installed packs are still ready to use.', 'wconvert')}</p>}
    </>}
  </section>;
}

function PackGroup({ title, description, packs, busy, onInspect }: {
  title: string; description: string; packs: CatalogPack[]; busy: boolean;
  onInspect: (pack: CatalogPack, local: boolean) => void;
}) {
  return <section className="wconvert-packs__group" aria-label={title}>
    <div className="wconvert-packs__group-heading"><h3>{title}</h3><span>{sprintf(_n('%d pack', '%d packs', packs.length, 'wconvert'), packs.length)}</span></div>
    <p className="wconvert-packs__group-description">{description}</p>
    <ul className="wconvert-packs__grid">{packs.map((pack) => {
      const installed = pack.installed_version !== null;
      return <li key={pack.id} className="wconvert-pack-card">
        <div className="wconvert-pack-card__heading"><Layers size={20} aria-hidden="true" /><h4>{pack.name}</h4>
          {pack.state === 'update' && <Badge variant="warning">{__('Update available', 'wconvert')}</Badge>}</div>
        <p className="wconvert-pack-card__description">{pack.description}</p>
        <div className="wconvert-pack-card__footer"><span className="wconvert-pack-card__version">{installed && <Check size={14} aria-hidden="true" />}
          {sprintf(__('Version %s', 'wconvert'), pack.installed_version ?? pack.version)}</span>
          <Button data-pack-id={pack.id} variant="outline" disabled={busy} aria-label={sprintf(installed ? __('Explore designs in %s', 'wconvert') : __('Preview %s', 'wconvert'), pack.name)}
            onClick={() => onInspect(pack, installed)}>{installed ? __('Explore designs', 'wconvert') : __('Preview pack', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>
        </div>
        {pack.state === 'update' && <div className="wconvert-pack-card__update"><span>{sprintf(__('Version %s is available', 'wconvert'), pack.version)}</span>
          <Button variant="ghost" size="sm" disabled={busy} aria-label={sprintf(__('Preview update for %s', 'wconvert'), pack.name)} onClick={() => onInspect(pack, false)}>{__('Preview update', 'wconvert')}</Button></div>}
      </li>;
    })}</ul>
  </section>;
}
