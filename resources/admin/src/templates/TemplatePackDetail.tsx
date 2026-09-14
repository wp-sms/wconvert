import { useEffect, useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight, Check, Download, Monitor, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Preview } from '../builder/Preview';
import { A_DESIGNS_OWN_WIDTH } from '@renderer/css';
import type { TemplateEntry } from './api';
import type { PackPreview } from './catalog';

const formatName = (type: string) => ({
  popup: __('Popup', 'wconvert'), inline: __('Inline', 'wconvert'),
  floating_bar: __('Floating bar', 'wconvert'), slide_in: __('Slide-in', 'wconvert'),
})[type] ?? type;

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
  const [design, setDesign] = useState(() => Math.max(0, pack.templates.findIndex((entry) => entry.display_type === displayType)));
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const designSelect = useId();
  useEffect(() => { heading.current?.focus(); }, []);
  const template = pack.templates[design];
  const installed = installedVersion === pack.version;
  const compatible = template.display_type === displayType;
  const count = pack.templates.length;
  const creating = onChooseStartingPoints !== undefined;
  const starts = pack.starting_points ?? [];
  const relevantStarts = starts.filter((entry) => entry.goal === goal);
  const matching = pack.templates.filter((entry) => entry.display_type === displayType).length;
  const groups = [
    { title: creating ? __('Included designs', 'wconvert') : sprintf(__('For your %s draft', 'wconvert'), formatName(displayType)), matches: true },
    { title: __('Other formats', 'wconvert'), matches: false },
  ].map((group) => ({ ...group, entries: pack.templates.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (creating || entry.display_type === displayType) === group.matches) }));

  return <section className="wconvert-pack-detail" aria-label={pack.name} aria-busy={busy}>
    <header className="wconvert-pack-detail__header">
      <div className="wconvert-pack-detail__back"><Button variant="ghost" size="sm" disabled={busy} onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('All packs', 'wconvert')}</Button></div>
      <div className="wconvert-pack-detail__identity">
        <h2 ref={heading} tabIndex={-1}>{pack.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{sprintf(_n('%d design', '%d designs', count, 'wconvert'), count)}</span>
          <span aria-hidden="true">·</span><span>{sprintf(__('Version %s', 'wconvert'), pack.version)}</span>
          <Badge role="status" variant={installed ? 'success' : 'outline'}>{installed ? __('Installed', 'wconvert') : installedVersion ? __('Update preview', 'wconvert') : __('Not installed', 'wconvert')}</Badge>
        </div>
      </div>
    </header>
    <div className="wconvert-pack-detail__body">
      <aside className="wconvert-pack-detail__designs" aria-label={__('Designs in this pack', 'wconvert')}>
        {groups.map((group) => {
          if (group.entries.length === 0) return null;
          return <div key={group.title} className="wconvert-pack-detail__group">
            <h3>{group.title}</h3>
            {group.entries.map(({ entry, index }) => <button type="button" key={entry.id} className="wconvert-pack-design"
              aria-pressed={design === index} disabled={busy} onClick={() => { setDesign(index); setStep(0); }}>
              <span className="wconvert-pack-design__name">{entry.name}{design === index && <Check size={15} aria-hidden="true" />}</span>
              <span className="wconvert-pack-design__meta">{formatName(entry.display_type)}<span aria-hidden="true"> · </span>
                {entry.tree.steps.length > 1 ? __('Form + success', 'wconvert') : __('Single screen', 'wconvert')}</span>
            </button>)}
          </div>;
        })}
      </aside>
      <div className="wconvert-pack-detail__main">
        <div className="wconvert-pack-detail__mobile-select">
          <label htmlFor={designSelect}>{__('Design in this pack', 'wconvert')}</label>
          <select id={designSelect} value={design} disabled={busy} onChange={(event) => { setDesign(Number(event.target.value)); setStep(0); }}>
            {groups.map((group) => {
              return group.entries.length > 0 && <optgroup key={group.title} label={group.title}>
                {group.entries.map(({ entry, index }) => <option key={entry.id} value={index}>{entry.name} · {formatName(entry.display_type)}</option>)}
              </optgroup>;
            })}
          </select>
        </div>
        <div className="wconvert-pack-detail__toolbar">
          <div className="wconvert-pack-detail__preview-heading">
            <h3>{template.name}</h3><Badge variant="outline">{__('Sample content', 'wconvert')}</Badge>
          </div>
          <div className="wconvert-pack-detail__controls">
            <div className="wconvert-segmented flex" role="group" aria-label={__('Preview width', 'wconvert')}>
              <Button variant="ghost" size="sm" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor aria-hidden="true" />{__('Desktop', 'wconvert')}</Button>
              <Button variant="ghost" size="sm" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone aria-hidden="true" />{__('Mobile · 320px', 'wconvert')}</Button>
            </div>
            {template.tree.steps.length > 1 && <div className="wconvert-segmented flex" role="group" aria-label={__('Preview screen', 'wconvert')}>
              {template.tree.steps.map((_, index) => <Button key={index} variant="ghost" size="sm" aria-pressed={step === index} onClick={() => setStep(index)}>
                {index === 0 ? __('Form', 'wconvert') : __('Success', 'wconvert')}
              </Button>)}
            </div>}
          </div>
        </div>
        <PackPreviewStage key={template.id} template={template} step={step} mobile={mobile} />
      </div>
    </div>
    <footer className="wconvert-pack-detail__footer">
      {error && <div role="alert" className="wconvert-pack-error">{error}</div>}
      {starts.length > 0 && <details className="wconvert-pack-detail__starts">
        <summary>{sprintf(_n('%d campaign starting point included', '%d campaign starting points included', starts.length, 'wconvert'), starts.length)}</summary>
        <ul>{starts.map((entry) => <li key={entry.id}><strong>{entry.name}</strong><span> · {entry.goal_label}</span></li>)}</ul>
        <p>{__('Includes wording and suggested display settings. Choose a starting point when creating a new Optin.', 'wconvert')}</p>
      </details>}
      {installed && creating ? <div className="wconvert-pack-detail__next">
        <p className="text-sm text-muted-foreground">{relevantStarts.length > 0
          ? __('Choose a starting point next to review its wording and suggested settings.', 'wconvert')
          : __('This pack has no starting points for your selected goal. Its designs remain available in the editor.', 'wconvert')}</p>
        {relevantStarts.length > 0 && <Button disabled={busy} onClick={() => onChooseStartingPoints(pack.id)}>{__('Choose a starting point', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>}
      </div> : <div className="wconvert-pack-detail__next">
        <div>
          {!(installed && compatible) && <p className="font-medium">{installed ? __('This design uses a different format', 'wconvert') : installedVersion ? __('Update this collection', 'wconvert') : __('Add this collection to your library', 'wconvert')}</p>}
          <p className="text-sm text-muted-foreground">{installed ? compatible
            ? __('Next, choose your content and review the design before applying.', 'wconvert')
            : sprintf(__('Open a draft in %1$s format to use this design. Your current draft is %2$s.', 'wconvert'), formatName(template.display_type), formatName(displayType))
            : !creating && matching === 0 ? sprintf(__('This pack has no %s designs. Install it to use in other draft formats.', 'wconvert'), formatName(displayType))
              : sprintf(_n('Adds %d design. Existing drafts stay unchanged.', 'Adds all %d designs. Existing drafts stay unchanged.', count, 'wconvert'), count)}</p>
        </div>
        {installed ? compatible && <Button disabled={busy} onClick={() => onContinue(template.id)}>
          {busy ? __('Preparing…', 'wconvert') : __('Continue with this design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
        </Button> : <Button disabled={busy} onClick={onInstall}><Download aria-hidden="true" />{installing ? __('Installing…', 'wconvert') : installedVersion ? __('Install update', 'wconvert') : __('Install pack', 'wconvert')}</Button>}
      </div>}
      {!installed && <p className="wconvert-pack-detail__connection">{__('Installation downloads this pack from your catalog service.', 'wconvert')}</p>}
      {installedVersion && !installed && <p className="wconvert-pack-detail__connection">{sprintf(__('Version %s is installed. Existing drafts keep their original design.', 'wconvert'), installedVersion)}</p>}
    </footer>
  </section>;
}

/** Keep the requested composition at its own width, then fit it visually. */
function PackPreviewStage({ template, step, mobile }: { template: TemplateEntry; step: number; mobile: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, available: 0 });
  const width = mobile ? '320px' : template.tokens.width?.includes('%') ? '64rem' : template.tokens.width ?? A_DESIGNS_OWN_WIDTH;
  useEffect(() => {
    const area = stage.current;
    const page = paper.current;
    if (!area || !page) return;
    const measure = () => {
      const styles = getComputedStyle(area);
      const available = area.clientWidth - parseFloat(styles.paddingInlineStart || '0') - parseFloat(styles.paddingInlineEnd || '0');
      const next = { width: page.offsetWidth, height: page.offsetHeight, available: Math.max(1, available) };
      setSize((current) => current.width === next.width && current.height === next.height && current.available === next.available ? current : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(area); observer.observe(page);
    return () => observer.disconnect();
  }, [width, step, template]);
  const scale = size.width > 0 ? Math.min(1, size.available / size.width) : 1;
  return <div ref={stage} className="wconvert-pack-stage" aria-label={__('Design preview', 'wconvert')}>
    <div className="wconvert-pack-stage__measure" style={{ width: size.width ? size.width * scale : width, height: size.height ? size.height * scale : undefined }}>
      <div ref={paper} className="wconvert-pack-stage__paper" inert aria-hidden="true" style={{ width, transform: `scale(${scale})` }}>
        <Preview template={template} step={step} />
      </div>
    </div>
  </div>;
}
