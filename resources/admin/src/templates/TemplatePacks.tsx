import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Preview } from '../builder/Preview';
import { messageOf } from '../shell/loadable';
import { catalogStatus, refreshCatalog, previewPack, installPack, type CatalogPack, type CatalogStatus, type PackPreview } from './catalog';

export function TemplatePacks({ displayType, onInstalled, onInspect }: {
  displayType: string;
  onInstalled: () => Promise<void>;
  onInspect: (id: string) => void;
}) {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<CatalogPack | null>(null);
  const [preview, setPreview] = useState<PackPreview | null>(null);
  const [design, setDesign] = useState(0);
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState(false);
  const alive = useRef(false);
  const pending = useRef(true);
  const loadSequence = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    alive.current = true;
    const sequence = ++loadSequence.current;
    pending.current = true;
    setBusy(true);
    const current = () => alive.current && sequence === loadSequence.current;
    void catalogStatus().then((result) => { if (current()) setStatus(result); })
      .catch((cause: unknown) => { if (current()) setError(messageOf(cause)); })
      .finally(() => { if (current()) { pending.current = false; setBusy(false); } });
    return () => { alive.current = false; loadSequence.current += 1; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [preview?.id]);

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try { await action(); } catch (cause) { if (alive.current) setError(messageOf(cause)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const inspect = (pack: CatalogPack) => { void run(async () => {
    const result = await previewPack(pack.id, pack.state === 'installed');
    if (!alive.current) return;
    setSelected(pack); setPreview(result); setDesign(0); setStep(0);
  }); };
  const install = () => { if (preview !== null) void run(async () => {
    const result = await installPack(preview.id, preview.digest);
    if (!alive.current) return;
    // Installation succeeded even if refreshing the picker fails. Keep that
    // fact visible so Retry cannot accidentally imply a second installation.
    setStatus(result);
    setSelected(result.packs.find((pack) => pack.id === preview.id) ?? null);
    await onInstalled();
  }); };
  const template = preview?.templates[design];
  const current = selected && status?.packs.find((pack) => pack.id === selected.id);
  const previewIsInstalled = current?.installed_version === preview?.version;

  return <section className="p-5 sm:p-7" aria-label={__('Template packs', 'wconvert')}>
    {error && <div role="alert" className="mb-4 rounded-md border border-destructive p-3 text-sm">{error}</div>}
    {busy && <p role="status">{__('Loading template pack…', 'wconvert')}</p>}
    {preview && template ? <>
      <Button variant="ghost" disabled={busy} onClick={() => { setPreview(null); setSelected(null); }}>{__('Back to packs', 'wconvert')}</Button>
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{preview.name}</h2>
      <p className="text-sm text-muted-foreground">{__('Sample content. Installing adds designs to your library; it does not change or publish your draft.', 'wconvert')}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={__('Designs in this pack', 'wconvert')}>
        {preview.templates.map((entry, index) => <Button key={entry.id} variant={design === index ? "secondary" : "outline"} aria-pressed={design === index}
          onClick={() => { setDesign(index); setStep(0); }}>{entry.name}</Button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? __('Show desktop preview', 'wconvert') : __('Show 320px preview', 'wconvert')}</Button>
        {template.tree.steps.map((_, index) => <Button key={index} variant={step === index ? "secondary" : "outline"} aria-pressed={step === index} onClick={() => setStep(index)}>
          {index === 0 ? __('First screen', 'wconvert') : __('Success screen', 'wconvert')}
        </Button>)}
      </div>
      <div className="mb-5 flex min-w-0 justify-center overflow-auto rounded-lg bg-muted p-3">
        <div style={{ width: mobile ? 320 : 768, maxWidth: '100%' }}><Preview template={template} step={step} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {previewIsInstalled ? <>
          <span role="status">{__('Installed on this site', 'wconvert')}</span>
          {template.display_type === displayType ? <Button disabled={busy} onClick={() => { void run(async () => {
            await onInstalled();
            if (alive.current) onInspect(template.id);
          }); }}>{__('Preview and use this design', 'wconvert')}</Button> :
            <p className="text-sm">{sprintf(__('This design is for %s. Open a draft in that format to use it.', 'wconvert'), template.display_type === 'inline' ? __('Inline', 'wconvert') : __('Popup', 'wconvert'))}</p>}
        </> : <Button disabled={busy} onClick={install}>{current?.state === 'update' ? __('Install update', 'wconvert') : __('Install pack', 'wconvert')}</Button>}
        <span className="text-sm text-muted-foreground">{sprintf(__('Version %s', 'wconvert'), preview.version)}</span>
      </div>
    </> : <>
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{__('Add a template pack', 'wconvert')}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{__('Preview a collection, install it on this site, then use its designs in the editor. Existing campaigns keep their own design and content.', 'wconvert')}</p>
      {status === null ? <Button disabled={busy} variant="outline" onClick={() => { void run(async () => {
        const result = await catalogStatus(); if (alive.current) setStatus(result);
      }); }}>{error ? __('Retry loading packs', 'wconvert') : __('Loading packs…', 'wconvert')}</Button> : <>
        {status.configured ? <div className="mb-5 rounded-md border p-4">
          <p className="mt-0 text-sm">{__('Checking the catalog, previewing a new pack or installing a pack contacts the configured template service. No campaigns, leads or licence details are sent. Installed previews work offline.', 'wconvert')}</p>
          <p className="break-all text-xs text-muted-foreground">{status.source}</p>
          <Button disabled={busy} variant="outline" onClick={() => { void run(async () => {
            const result = await refreshCatalog(); if (alive.current) setStatus(result);
          }); }}>{status.checked_at ? __('Refresh catalog', 'wconvert') : __('Check catalog', 'wconvert')}</Button>
          {status.checked_at && <p className="mb-0 text-xs text-muted-foreground">{sprintf(__('Last checked: %s', 'wconvert'), new Date(status.checked_at).toLocaleString())}</p>}
        </div> : <p className="text-sm">{__('A template catalog has not been configured on this site yet. Your bundled and installed designs remain available.', 'wconvert')}</p>}
        {status.packs.length === 0 && status.checked_at && <p>{__('No packs are listed yet. Try refreshing later.', 'wconvert')}</p>}
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">{status.packs.map((pack) => <li key={pack.id} className="rounded-lg border p-5">
          <h3 className="mt-0 text-base font-semibold">{pack.name}</h3>
          <p className="text-sm text-muted-foreground">{pack.description}</p>
          <p className="text-sm">{pack.state === 'update' ? sprintf(__('Update available: %s', 'wconvert'), pack.version) : pack.state === 'installed' ? sprintf(__('Installed version %s', 'wconvert'), pack.installed_version ?? pack.version) : sprintf(__('Version %s', 'wconvert'), pack.version)}</p>
          <Button variant="outline" disabled={busy} onClick={() => inspect(pack)}>{pack.state === 'installed' ? __('Preview installed pack', 'wconvert') : __('Preview pack', 'wconvert')}</Button>
          {pack.state === 'update' && <Button variant="ghost" disabled={busy} onClick={() => inspect({ ...pack, state: 'installed' })}>{__('Preview installed version', 'wconvert')}</Button>}
        </li>)}</ul>
      </>}
    </>}
  </section>;
}
