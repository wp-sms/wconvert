import { useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CircleHelp, MousePointer2, X } from 'lucide-react';
import { OptionStrip } from '../shell/OptionStrip';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { DesignStage } from '../stage/DesignStage';
import { resolvedPlacement } from './PlacementControl';
import { resolvedToken } from './panel';
import type { SlotKey } from './slots';
import type { Template } from '@renderer/types';

export type PreviewWidth = 'own' | 'narrow';
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
  tools,
  view,
  hint,
  onStage,
}: {
  template: Template;
  step: number;
  width: PreviewWidth;
  selected: SlotKey | null;
  onSelect: (key: SlotKey) => void;
  displayType: string;
  placement?: unknown;
  screen?: { label: string; content: ReactNode; controls?: ReactNode; inFlow?: boolean };
  /** Desktop/Mobile, in the middle of the bar: one bar for the canvas (ADR 0134). */
  tools?: ReactNode;
  /** Full screen, grouped with the zoom at the end: both change how the canvas is viewed, not what is on it. */
  view?: ReactNode;
  /** "Click anything on the popup to edit it": what the bar says while the design is the thing on screen. */
  hint?: string;
  /** A click on the empty stage around the design: the Edit tab opens the Look. */
  onStage?: () => void;
}) {
  const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
  const [scale, setScale] = useState(1);
  const [message, setMessage] = useState('');
  const shown = Math.min(step, Math.max(template.tree.steps.length - 1, 0));
  return (
    <section className="wconvert-canvas" data-width={width} aria-label={__('Design canvas', 'wconvert')}>
      <div className="wconvert-canvas__bar">
        {screen?.label ? <span>{screen.label}</span> : hint ? <span className="wconvert-canvas__hint-line"><MousePointer2 aria-hidden="true" />{hint}</span> : <span>{template.tree.steps[shown]?.name}</span>}
        {tools}
        <div className="wconvert-canvas__view">
          {view}
          <label>
            <span className="sr-only">{__('Canvas zoom', 'wconvert')}</span>
            <select value={zoom} onChange={(event) => setZoom(event.target.value === 'actual' ? 'actual' : 'fit')}>
              <option value="fit">
                {__('Fit', 'wconvert')} · {Math.round(scale * 100)}%
              </option>
              <option value="actual">100%</option>
            </select>
          </label>
        </div>
      </div>
      {screen?.controls}
      {/* The canvas is the stage at its canvas size, capped at 1× (ADR 0170). */}
      <div className="wconvert-canvas__stage">
        <DesignStage
          size="canvas"
          displayType={displayType}
          device={width === 'narrow' ? 'mobile' : 'desktop'}
          zoom={zoom}
          step={shown}
          placement={resolvedPlacement(displayType, placement)}
          source={{ live: { template } }}
          selected={selected}
          onSelect={onSelect}
          inFlow={screen?.inFlow}
          onScale={setScale}
          onStage={onStage}
          chrome={displayType !== 'inline' && (
            <button
              type="button"
              className="wconvert-canvas__close"
              // Drawn in the design's own close colours and shape (ADR 0159),
              // so a change in the Look's Close button section shows here.
              style={closeLook(template.tokens)}
              aria-label={__('Close preview', 'wconvert')}
              onClick={() => setMessage(__('Visitors can always close this campaign.', 'wconvert'))}
            >
              <X aria-hidden="true" />
            </button>
          )}
        >
          {screen?.content}
        </DesignStage>
      </div>
      <div className="wconvert-canvas__hint" role="status">
        {message || (screen ? __('Preview mode', 'wconvert') : hint ? null : (
          <>
            <MousePointer2 aria-hidden="true" />
            {__('Click an element to edit it', 'wconvert')}
          </>
        ))}
      </div>
    </section>
  );
}

/** The design's own close colours and shape, resolved as the renderer draws them. */
function closeLook(tokens: Template['tokens']) {
  const look = (part: string) => resolvedToken(tokens, `close-${part}`);

  return { color: look('fg'), background: look('bg'), border: `1px solid ${look('border')}`, borderRadius: look('radius'), boxShadow: 'none' };
}
