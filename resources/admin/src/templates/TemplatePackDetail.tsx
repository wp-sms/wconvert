import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { TemplateCard } from '../builder/TemplateCard';
import { PreviewControls } from '../discovery/PreviewControls';
import { PreviewFrame } from '../discovery/PreviewFrame';
import { PickerSearch } from '../discovery/PickerSearch';
import { OptionStrip } from '../shell/OptionStrip';
import { matchesSearch } from '../discovery/search';
import { displayTypeLabel } from '../displayTypes';
import type { PackPreview } from './catalog';

export function TemplatePackDetail({ pack, displayType, installedVersion, busy, installing, error, onBack, onInstall, onContinue, goal, onChooseStartingPoints }: {
  pack: PackPreview;
  goal?: string;
  onChooseStartingPoints?: (packId: string) => void;
  displayType: string;
  installedVersion: string | null;
  busy: boolean;
  installing: boolean;
  error: string | null;
  onBack: () => void;
  onInstall: () => void;
  onContinue: (id: string) => void;
}) {
  const [design, setDesign] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  const [resultId, setResultId] = useState('');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState(onChooseStartingPoints || !pack.templates.some(entry=>entry.display_type===displayType) ? 'all' : displayType);
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null); const listPosition = useRef(0);
  useEffect(() => { heading.current?.focus(); }, []);
  const template = design === null ? undefined : pack.templates[design];
  const installed = installedVersion === pack.version;
  const compatible = template?.display_type === displayType;
  const count = pack.templates.length;
  const creating = onChooseStartingPoints !== undefined;
  const starts = pack.starting_points ?? [];
  const relevantStarts = starts.filter((entry) => entry.goal === goal);
  const matching = pack.templates.filter((entry) => entry.display_type === displayType).length;
  const shown = pack.templates.map((entry,index) => ({entry,index})).filter(({entry}) => (format === 'all' || entry.display_type === format) && matchesSearch(query,[entry.name,displayTypeLabel(entry.display_type)]));
  const pages = Math.max(1, Math.ceil(shown.length / 24)); const currentPage = Math.min(page, pages - 1);
  const safeStep = Math.min(step, Math.max(0,(template?.tree.steps.length ?? 1) - 1));
  const screen = template?.tree.steps[safeStep]; const result = screen?.results?.find(item => item.id === resultId) ?? screen?.results?.[0];
  const formats = [...new Set(pack.templates.map(entry => entry.display_type))];
  const backToDesigns = () => { setDesign(null); requestAnimationFrame(() => { if (list.current) list.current.scrollTop = listPosition.current; returnFocus.current?.focus({preventScroll:true}); }); };

  return <section className="wconvert-pack-detail" aria-label={pack.name} aria-busy={busy}>
    <header className="wconvert-pack-detail__header">
      <div className="wconvert-pack-detail__back"><Button variant="ghost" disabled={busy} onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('All packs', 'wconvert')}</Button></div>
      <div className="wconvert-pack-detail__identity">
        <h2 ref={heading} tabIndex={-1}>{pack.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{sprintf(_n('%d design', '%d designs', count, 'wconvert'), count)}</span>
          <span aria-hidden="true">·</span><span>{sprintf(__('Version %s', 'wconvert'), pack.version)}</span>
          <Badge role="status" variant={installed ? 'success' : 'outline'}>{installed ? __('Installed', 'wconvert') : installedVersion ? __('Update preview', 'wconvert') : __('Not installed', 'wconvert')}</Badge>
        </div>
      </div>
    </header>
    {template ? <div className="wconvert-pack-detail__inspection">
      <div className="wconvert-pack-detail__toolbar">
        <Button variant="ghost" disabled={busy} onClick={backToDesigns}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to designs','wconvert')}</Button>
        <h3 className="m-0 text-heading font-semibold">{template.name}</h3><Badge variant="outline">{__('Sample content','wconvert')}</Badge>
        <PreviewControls mobile={mobile} onMobile={setMobile} template={template} step={safeStep} disabled={busy} onStep={value => {setStep(value);setResultId('');}} />
        {screen?.results && screen.results.length > 0 && <label className="text-note">{__('Result to inspect','wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event=>setResultId(event.target.value)}>{screen.results.map(item=><option key={item.id} value={item.id}>{item.heading || item.id}</option>)}</select></label>}
      </div>
      <PreviewFrame template={template} displayType={template.display_type} mobile={mobile} step={safeStep} result={result} />
    </div> : null}
    <div ref={list} className="wconvert-pack-detail__browse" hidden={template !== undefined}>
      <div className="wconvert-picker__controls">
        <div className="wconvert-picker__search-row"><PickerSearch label={__('Search designs in this pack','wconvert')} value={query} onChange={value=>{setQuery(value);setPage(0);}} disabled={busy} /></div>
        <OptionStrip label={__('Format','wconvert')} value={format} disabled={busy} onChange={value=>{setFormat(value);setPage(0);}}
          options={[{value:'all',label:__('All formats','wconvert')},...formats.map(value=>({value,label:displayTypeLabel(value)}))]} />
        <p role="status" className="m-0 text-note text-muted-foreground">{sprintf(_n('%d matching design','%d matching designs',shown.length,'wconvert'),shown.length)}</p>
      </div>
      {shown.length ? <ul className="wconvert-gallery">{shown.slice(currentPage*24,(currentPage+1)*24).map(({entry,index})=><TemplateCard key={entry.id} id={`pack-${entry.id}`} name={entry.name} template={entry} displayType={entry.display_type}
        marks={<Badge variant="outline">{displayTypeLabel(entry.display_type)}</Badge>}
        action={describedBy=><Button variant="outline" disabled={busy} aria-describedby={describedBy} aria-label={sprintf(__('Preview %s','wconvert'),entry.name)} onClick={()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;listPosition.current=list.current?.scrollTop??0;setDesign(index);setStep(0);setResultId('');requestAnimationFrame(()=>heading.current?.focus());}}>{__('Preview all screens','wconvert')}</Button>} />)}</ul>
        : <div className="wconvert-packs__empty"><h3>{__('No designs match','wconvert')}</h3><p>{__('Try another format or a shorter search.','wconvert')}</p><Button variant="outline" onClick={()=>{setFormat('all');setQuery('');setPage(0);}}>{__('Show all designs','wconvert')}</Button></div>}
      {pages > 1 && <nav className="wconvert-picker__pagination" aria-label={__('Design pages','wconvert')}><Button variant="outline" disabled={busy || currentPage===0} onClick={()=>setPage(currentPage-1)}>{__('Previous','wconvert')}</Button><span>{sprintf(__('Page %1$s of %2$s','wconvert'),String(currentPage+1),String(pages))}</span><Button variant="outline" disabled={busy || currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>{__('Next','wconvert')}</Button></nav>}
    </div>
    <footer className="wconvert-pack-detail__footer">
      {error && <div role="alert" className="wconvert-pack-error">{error}</div>}
      {starts.length > 0 && <details className="wconvert-pack-detail__starts">
        <summary>{sprintf(_n('%d campaign setup included', '%d campaign setups included', starts.length, 'wconvert'), starts.length)}</summary>
        <ul>{starts.map((entry) => <li key={entry.id}><strong>{entry.name}</strong><span> · {entry.goal_label}</span></li>)}</ul>
        <p>{__('Includes wording and suggested display settings. Choose a campaign setup when creating a new Campaign.', 'wconvert')}</p>
      </details>}
      {installed && creating ? <div className="wconvert-pack-detail__next">
        <p className="text-sm text-muted-foreground">{relevantStarts.length > 0
          ? __('Choose a campaign setup next to review its wording and suggested settings.', 'wconvert')
          : __('This pack has no campaign setups for your selected goal. Its designs remain available in the editor.', 'wconvert')}</p>
        {relevantStarts.length > 0 && <Button disabled={busy} onClick={() => onChooseStartingPoints(pack.id)}>{__('Choose a campaign setup', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>}
      </div> : <div className="wconvert-pack-detail__next">
        <div>
          {!(installed && compatible) && <p className="font-medium">{installed ? template ? __('This design uses a different format', 'wconvert') : __('Choose a design to inspect', 'wconvert') : installedVersion ? __('Update this pack', 'wconvert') : __('Add this pack to your library', 'wconvert')}</p>}
          <p className="text-sm text-muted-foreground">{installed ? template === undefined ? __('Preview a design to review every screen before applying it.', 'wconvert') : compatible
            ? __('Next, choose your content and review the design before applying.', 'wconvert')
            : sprintf(__('Open a draft in %1$s format to use this design. Your current draft is %2$s.', 'wconvert'), displayTypeLabel(template?.display_type ?? displayType), displayTypeLabel(displayType))
            : creating && relevantStarts.length === 0 ? __('This pack has no campaign setups for your selected goal. Install it to use its designs in the editor.', 'wconvert')
              : !creating && matching === 0 ? sprintf(__('This pack has no %s designs. Install it to use in other draft formats.', 'wconvert'), displayTypeLabel(displayType))
              : sprintf(_n('Adds %d design. Existing drafts stay unchanged.', 'Adds all %d designs. Existing drafts stay unchanged.', count, 'wconvert'), count)}</p>
        </div>
        {installed ? compatible && <Button disabled={busy} onClick={() => onContinue(template!.id)}>
          {busy ? __('Preparing…', 'wconvert') : __('Continue with this design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
        </Button> : <Button disabled={busy} onClick={onInstall}><Download aria-hidden="true" />{installing ? __('Installing…', 'wconvert') : installedVersion ? __('Install update', 'wconvert') : __('Install pack', 'wconvert')}</Button>}
      </div>}
      {!installed && <p className="wconvert-pack-detail__connection">{__('Installation downloads this pack from your catalog service.', 'wconvert')}</p>}
      {installedVersion && !installed && <p className="wconvert-pack-detail__connection">{sprintf(__('Version %s is installed. Existing drafts keep their original design.', 'wconvert'), installedVersion)}</p>}
    </footer>
  </section>;
}
