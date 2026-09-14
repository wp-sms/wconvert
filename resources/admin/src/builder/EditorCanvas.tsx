import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Monitor, Smartphone, MousePointer2, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Preview } from './Preview';
import { stepName } from './BlockRow';
import type { SlotKey } from './slots';
import type { Template } from '@renderer/types';

export type PreviewWidth = 'own' | 'narrow';
export function ScreenControls({
  template,
  step,
  onChange,
}: {
  template: Template;
  step: number;
  onChange: (step: number) => void;
}) {
  return (
    <div className="wconvert-segmented" aria-label={__('Campaign screen', 'wconvert')}>
      {template.tree.steps.map((_, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          aria-pressed={step === index}
          onClick={() => onChange(index)}
        >
          {stepName(index + 1)}
        </Button>
      ))}
    </div>
  );
}
export function DeviceControls({
  width,
  onChange,
}: {
  width: PreviewWidth;
  onChange: (width: PreviewWidth) => void;
}) {
  return (
    <div className="wconvert-segmented" aria-label={__('Preview width', 'wconvert')}>
      <Button
        variant="ghost"
        size="icon-sm"
        title={__('Desktop preview', 'wconvert')}
        aria-label={__('Desktop preview', 'wconvert')}
        aria-pressed={width === 'own'}
        onClick={() => onChange('own')}
      >
        <Monitor aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={__('Mobile preview', 'wconvert')}
        aria-label={__('Mobile preview', 'wconvert')}
        aria-pressed={width === 'narrow'}
        onClick={() => onChange('narrow')}
      >
        <Smartphone aria-hidden="true" />
      </Button>
    </div>
  );
}

export function EditorCanvas({
  template,
  name,
  step,
  width,
  selected,
  onSelect,
  interactive = false,
  onStep,
  displayType,
}: {
  template: Template;
  name: string;
  step: number;
  width: PreviewWidth;
  selected: SlotKey | null;
  onSelect: (key: SlotKey) => void;
  interactive?: boolean;
  onStep: (step: number) => void;
  displayType: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 500, availableWidth: 1000, availableHeight: 650 });
  const [zoom, setZoom] = useState('fit');
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState('');
  const shown = Math.min(step, Math.max(template.tree.steps.length - 1, 0));
  const measure = width === 'narrow' ? '22rem' : (template.tokens.width ?? '28rem');
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const read = () => {
      const paper = page.current;
      const area = stage.current;
      if (!paper || !area) return;
      const next = {
        width: paper.offsetWidth,
        height: paper.offsetHeight,
        availableWidth: area.clientWidth,
        availableHeight: area.clientHeight,
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
  }, [dismissed]);
  useEffect(() => {
    setDismissed(false);
  }, [interactive, step]);
  useEffect(() => {
    setMessage('');
  }, [interactive]);
  const scale =
    zoom === 'actual'
      ? 1
      : Math.min(
          1,
          Math.max(0.3, (size.availableWidth - 64) / Math.max(1, size.width)),
          Math.max(0.45, (size.availableHeight - 64) / Math.max(1, size.height)),
        );
  return (
    <section className="wconvert-canvas" data-width={width} aria-label={__('Design canvas', 'wconvert')}>
      <div className="wconvert-canvas__bar">
        <span>
          {name}
          <span aria-hidden="true">›</span>
          {stepName(shown + 1)}
        </span>
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
      {interactive && (
        <p className="wconvert-preview-notice">
          {__('Try the form as a visitor. No data is sent.', 'wconvert')}
        </p>
      )}
      <div className="wconvert-canvas__stage" ref={stage}>
        {dismissed ? (
          <Button variant="outline" onClick={() => setDismissed(false)}>
            {__('Show again', 'wconvert')}
          </Button>
        ) : (
          <div
            className="wconvert-canvas__measure"
            style={{ width: size.width * scale, height: size.height * scale }}
          >
            <div
              className="wconvert-canvas__document"
              ref={page}
              style={{ width: measure, transform: `scale(${scale})` }}
            >
              <Preview
                template={template}
                step={shown}
                selected={interactive ? null : selected}
                onSelect={interactive ? undefined : onSelect}
                interactive={interactive}
                onAdvance={() => {
                  onStep(Math.min(shown + 1, template.tree.steps.length - 1));
                  setMessage(__('Preview complete. No data was sent.', 'wconvert'));
                }}
              />
              {displayType !== 'inline' && (
                <button
                  type="button"
                  className="wconvert-canvas__close"
                  aria-label={__('Close preview', 'wconvert')}
                  onClick={() =>
                    interactive
                      ? setDismissed(true)
                      : setMessage(__('Visitors can always close this Campaign.', 'wconvert'))
                  }
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="wconvert-canvas__hint" role="status">
        {message ||
          (interactive ? (
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
