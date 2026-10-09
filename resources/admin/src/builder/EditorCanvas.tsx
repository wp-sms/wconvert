import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CircleHelp, MousePointer2, X } from 'lucide-react';
import { OptionStrip } from '../shell/OptionStrip';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { Preview } from './Preview';
import { resolvedPlacement } from './PlacementControl';
import type { SlotKey } from './slots';
import type { Template } from '@renderer/types';
import { graphDisplayOrder } from './structure/graph';

export type PreviewWidth = 'own' | 'narrow';
export function ScreenControls({
  template,
  step,
  onChange,
  extra,
}: {
  template: Template;
  step: number;
  onChange: (step: number) => void;
  extra?: { label: string; selected: boolean; onSelect(): void };
}) {
  return (
    <div className="wconvert-screen-controls">
      <select aria-label={__('Campaign screen', 'wconvert')} value={extra?.selected ? 'reopen' : String(step)} onChange={event => event.target.value === 'reopen' ? extra?.onSelect() : onChange(Number(event.target.value))}>
        {graphDisplayOrder(template.tree).map((index, position) => <option key={template.tree.steps[index].id} value={String(index)}>
          {sprintf(__('%1$d. %2$s', 'wconvert'), position + 1, template.tree.steps[index].name)}</option>)}
        {extra && <option value="reopen">{extra.label}</option>}
      </select>
      {extra && <Button variant="ghost" size="sm" aria-pressed={extra.selected} onClick={extra.onSelect}>{extra.label}</Button>}
    </div>
  );
}
export function MobileAppearanceNote() {
  return <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={__('About mobile editing', 'wconvert')}><CircleHelp aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent className="text-note" align="end">{__('Editing mobile appearance. Text and blocks are shared across sizes.', 'wconvert')}</PopoverContent>
  </Popover>;
}

export function DeviceControls({
  width,
  onChange,
}: {
  width: PreviewWidth;
  onChange: (width: PreviewWidth) => void;
}) {
  return (
    // The same strip the template picker's preview and Preview & test use (§7).
    <div className="wconvert-device-controls"><OptionStrip label={__('Preview size', 'wconvert')} value={width === 'narrow' ? 'mobile' : 'desktop'}
      options={[{ value: 'desktop', label: __('Desktop', 'wconvert') }, { value: 'mobile', label: __('Mobile', 'wconvert') }]}
      onChange={value => onChange(value === 'mobile' ? 'narrow' : 'own')} />
      {width === 'narrow' && <MobileAppearanceNote />}</div>
  );
}

export function EditorCanvas({
  template,
  step,
  width,
  selected,
  onSelect,
  displayType,
  placement,
  screen,
}: {
  template: Template;
  step: number;
  width: PreviewWidth;
  selected: SlotKey | null;
  onSelect: (key: SlotKey) => void;
  displayType: string;
  placement?: unknown;
  screen?: { label: string; content: ReactNode; controls?: ReactNode; inFlow?: boolean };
}) {
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 500, availableWidth: 1000, availableHeight: 650 });
  const [zoom, setZoom] = useState('fit');
  const [message, setMessage] = useState('');
  const shown = Math.min(step, Math.max(template.tree.steps.length - 1, 0));
  const measure = width === 'narrow' ? '22rem' : (displayType === 'inline' ? (template.tokens.width ?? '40rem') : '48rem');
  const resolved = resolvedPlacement(displayType, placement);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const read = () => {
      const paper = page.current;
      const area = stage.current;
      if (!paper || !area) return;
      const padding = getComputedStyle(area);
      const next = {
        width: paper.offsetWidth,
        height: paper.offsetHeight,
        availableWidth: area.clientWidth - (parseFloat(padding.paddingLeft) || 0) - (parseFloat(padding.paddingRight) || 0),
        availableHeight: area.clientHeight - (parseFloat(padding.paddingTop) || 0) - (parseFloat(padding.paddingBottom) || 0),
      };
      setSize((current) =>
        Object.keys(next).every((key) => current[key as keyof typeof next] === next[key as keyof typeof next])
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(read);
    if (stage.current) observer.observe(stage.current);
    if (page.current) observer.observe(page.current);
    read();
    return () => observer.disconnect();
  }, []);
  const scale =
    zoom === 'actual'
      ? 1
      : Math.min(
          1,
          Math.max(0.1, size.availableWidth / Math.max(1, size.width)),
          Math.max(0.1, size.availableHeight / Math.max(1, size.height)),
        );
  return (
    <section className="wconvert-canvas" data-width={width} aria-label={__('Design canvas', 'wconvert')}>
      <div className="wconvert-canvas__bar">
        <span>{screen?.label ?? template.tree.steps[shown]?.name}</span>
        <label>
          <span className="sr-only">{__('Canvas zoom', 'wconvert')}</span>
          <span>{width === 'narrow' ? __('Mobile', 'wconvert') : __('Desktop', 'wconvert')}</span>
          <select value={zoom} onChange={(event) => setZoom(event.target.value)}>
            <option value="fit">
              {__('Fit', 'wconvert')} · {Math.round(scale * 100)}%
            </option>
            <option value="actual">100%</option>
          </select>
        </label>
      </div>
      {screen?.controls}
      <div className="wconvert-canvas__stage" ref={stage}>
          <div
            className="wconvert-canvas__measure"
            style={{ width: size.width * scale, height: size.height * scale }}
          >
            <div
              className="wconvert-canvas__document wconvert-site"
              ref={page}
              data-screen-flow={screen?.inFlow || undefined}
              data-display-type={screen ? 'preview' : displayType}
              data-placement={resolved ?? undefined}
              style={{ width: measure, transform: `scale(${scale})` }}
            >
              {!screen?.inFlow && <div className="wconvert-site__page" aria-hidden="true">
                <span className="wconvert-site__ghost" data-ghost="head" />
                <span className="wconvert-site__ghost" />
                <span className="wconvert-site__ghost" />
                <span className="wconvert-site__ghost" data-ghost="block" />
                <span className="wconvert-site__ghost" />
              </div>}
              {screen ? <div className="wconvert-canvas__alternate">{screen.content}</div> : <div className="wconvert-site__slot">
                <Preview
                  template={template}
                  displayType={displayType}
                  step={shown}
                  selected={selected}
                  onSelect={onSelect}
                />
                {displayType !== 'inline' && (
                  <button
                    type="button"
                    className="wconvert-canvas__close"
                    aria-label={__('Close preview', 'wconvert')}
                    onClick={() => setMessage(__('Visitors can always close this campaign.', 'wconvert'))}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>}
              {!screen?.inFlow && <div className="wconvert-site__page" aria-hidden="true">
                <span className="wconvert-site__ghost" />
                <span className="wconvert-site__ghost" data-ghost="block" />
              </div>}
            </div>
          </div>
      </div>
      <div className="wconvert-canvas__hint" role="status">
        {message ||
          (screen ? (
            __('Preview mode', 'wconvert')
          ) : (
            <>
              <MousePointer2 aria-hidden="true" />
              {__('Click an element to edit it', 'wconvert')}
            </>
          ))}
      </div>
    </section>
  );
}
