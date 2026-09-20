import { contentLockDesignCompatible } from '../inlinePlacement';
import { useEffect, useId, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { displayTypeLabel } from '../displayTypes';
import { Preview } from './Preview';
import { A_DESIGNS_OWN_WIDTH } from '@renderer/css';
import { actChangeOf, refusalFor, type Fit } from './Gallery';
import type { PreparedTemplate, TemplateIndexEntry, TemplateLabelsWithFacets } from '../templates/api';
import type { Template } from '@renderer/types';

export type TemplateContentMode = 'keep' | 'sample';
export type PrepareDesign = (id: string, mode: TemplateContentMode, sample: Template) => Promise<PreparedTemplate>;

export interface TemplateDesignDetailProps {
  readonly entry: TemplateIndexEntry;
  readonly template?: Template;
  readonly labels: TemplateLabelsWithFacets;
  readonly current: boolean;
  readonly hasCurrentDesign?: boolean;
  readonly contentLock?: boolean;
  readonly currentDisplayType?: string;
  readonly active?: boolean;
  readonly fit: Fit;
  readonly goalLabel?: string;
  readonly busy: boolean;
  readonly onChoose: (id: string, prepared?: Template) => void;
  readonly onPrepare?: PrepareDesign;
  readonly onBack: () => void;
  readonly loadError?: boolean;
  readonly onRetry?: () => void;
}

/** Percentage widths need a stable desktop containing block before visual scaling. */
const DESKTOP_CONTENT_WIDTH = '64rem';

/** Inspect the exact normalized candidate before replacing the working draft. */
export function TemplateDesignDetail({
  entry, template: sample, labels, current, currentDisplayType, fit, goalLabel, busy, onChoose, onPrepare, onBack, loadError = false, onRetry, active = true, hasCurrentDesign = true, contentLock = false,
}: TemplateDesignDetailProps) {
  const [disableLock, setDisableLock] = useState(false);
  const [mode, setMode] = useState<TemplateContentMode>(hasCurrentDesign ? 'keep' : 'sample');
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState<{
    sample: Template;
    mode: TemplateContentMode;
    prepare: PrepareDesign;
    value?: PreparedTemplate;
    error?: string;
  } | null>(null);
  const prepares = onPrepare !== undefined && entry.availability === 'ready';
  useEffect(() => {
    if (!active || !prepares || onPrepare === undefined || sample === undefined) return;
    let alive = true;
    setPrepared(null);
    void onPrepare(entry.id, mode, sample)
      .then((value) => {
        if (alive) setPrepared({ sample, mode, prepare: onPrepare, value });
      })
      .catch((cause: unknown) => {
        if (alive) setPrepared({ sample, mode, prepare: onPrepare,
          error: cause instanceof Error ? cause.message : __('This content preview could not be prepared.', 'wconvert') });
      });
    return () => { alive = false; };
  }, [entry.id, sample, mode, onPrepare, prepares, attempt, active]);
  // A changed choice hides the previous result immediately, including the
  // render before the next request effect runs. Late responses are ignored.
  const candidate = prepared?.sample === sample && prepared?.mode === mode
    && prepared?.prepare === onPrepare ? prepared : null;
  const template = prepares ? candidate?.value : sample;
  const preparationError = candidate?.error;
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number; availableWidth: number } | null>(null);
  const id = useId();
  useEffect(() => { heading.current?.focus(); }, [entry.id]);
  const refused = refusalFor(entry, fit);
  const changed = refused === null && !current ? actChangeOf(entry, fit) : null;
  const shown = Math.min(step, Math.max(0, (template?.tree.steps.length ?? 1) - 1));
  const relativeWidth = template?.tokens.width?.includes('%') === true;
  const measure = device === 'mobile' ? '22rem' : relativeWidth
    ? DESKTOP_CONTENT_WIDTH : template?.tokens.width ?? A_DESIGNS_OWN_WIDTH;
  useEffect(() => {
    const paper = page.current;
    const area = stage.current;
    if (paper === null || area === null) return;
    const read = () => {
      // offset dimensions stay at the requested size even while transform fits
      // it visually. Reading the transformed rectangle would create a loop.
      if (paper.offsetWidth <= 0 || area.clientWidth <= 0) return;
      const style = getComputedStyle(area);
      const padding = (Number.parseFloat(style.paddingInlineStart) || 0)
        + (Number.parseFloat(style.paddingInlineEnd) || 0);
      const next = {
        width: paper.offsetWidth,
        height: paper.offsetHeight,
        availableWidth: Math.max(1, area.clientWidth - padding),
      };
      setSize((current) => current !== null && current.width === next.width
        && current.height === next.height && current.availableWidth === next.availableWidth ? current : next);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(area);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [template, measure, shown]);
  const scale = size === null ? 1 : Math.min(1, size.availableWidth / size.width);
  const unavailable = entry.availability !== 'ready';
  const isCurrent = current && !(prepares && mode === 'sample');
  const incompatibleLock = contentLock && template !== undefined && !contentLockDesignCompatible(entry.display_type, template);
  const cannotApply = incompatibleLock && !disableLock || !active || isCurrent || refused !== null || unavailable || template === undefined;
  const changesFormat = currentDisplayType !== undefined && entry.display_type !== currentDisplayType;
  const fromFormat = displayTypeLabel(currentDisplayType);
  const toFormat = displayTypeLabel(entry.display_type);
  const formatNotice = !changesFormat ? null : goalLabel
    ? entry.display_type === 'inline'
      ? sprintf(
          /* translators: 1: current format, 2: new format, 3: campaign goal. */
          __('Changes this campaign from %1$s to %2$s. Its Goal remains “%3$s”. Place its block or shortcode before publishing.', 'wconvert'),
          fromFormat, toFormat, goalLabel,
        )
      : sprintf(
          /* translators: 1: current format, 2: new format, 3: campaign goal. */
          __('Changes this campaign from %1$s to %2$s. Its Goal remains “%3$s”. Any saved position resets to the new format’s default; review display rules before publishing.', 'wconvert'),
          fromFormat, toFormat, goalLabel,
        )
    : entry.display_type === 'inline'
      ? sprintf(
          /* translators: 1: current format, 2: new format. */
          __('Changes this campaign from %1$s to %2$s. Place its block or shortcode before publishing.', 'wconvert'),
          fromFormat, toFormat,
        )
      : sprintf(
          /* translators: 1: current format, 2: new format. */
          __('Changes this campaign from %1$s to %2$s. Any saved position resets to the new format’s default; review display rules before publishing.', 'wconvert'),
          fromFormat, toFormat,
        );
  const fieldNames = entry.facets.captures.map((field) =>
    labels.fields?.[field] ?? labels.facetValues[`captures.${field}`] ?? field,
  );
  const describedBy = [
    `${id}-title`, `${id}-replacement`,
    isCurrent ? `${id}-current` : null,
    refused !== null ? `${id}-refusal` : null,
    changed !== null ? `${id}-change` : null,
    changesFormat ? `${id}-format` : null,
    template === undefined ? `${id}-load` : null,
    unavailable ? `${id}-unavailable` : null,
  ].filter(Boolean).join(' ');

  return (
    <section className="wconvert-design-detail" aria-labelledby={`${id}-title`}>
      <div className="wconvert-design-detail__header">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          {__('Back to designs', 'wconvert')}
        </Button>
        <h3 ref={heading} tabIndex={-1} id={`${id}-title`}>{entry.name}</h3>
        {current && <Badge id={`${id}-current`} variant="secondary">{__('Current design', 'wconvert')}</Badge>}
      </div>

      {prepares && (
        <fieldset className="wconvert-design-detail__content-choice" disabled={busy}>
          <legend className="text-sm font-medium">{__('Content for this design', 'wconvert')}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-2 rounded-md border p-3 text-sm">
              <input type="radio" name={`${id}-content`} value="keep" checked={mode === 'keep'} disabled={!hasCurrentDesign}
                onChange={() => setMode('keep')} className="row-span-2 mt-1" />
              <strong>{__('Keep my content', 'wconvert')}</strong>
              <span className="text-note text-muted-foreground">{hasCurrentDesign ? __('Fit your current words and images into this layout. Some content may move or have no matching place.', 'wconvert') : __('This draft has no design content yet. Start with sample content and customize it next.', 'wconvert')}</span>
            </label>
            <label className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-2 rounded-md border p-3 text-sm">
              <input type="radio" name={`${id}-content`} value="sample" checked={mode === 'sample'}
                onChange={() => setMode('sample')} className="row-span-2 mt-1" />
              <strong>{__("Use this design's sample content", 'wconvert')}</strong>
              <span className="text-note text-muted-foreground">{__('Start with its example words, images, links and form settings. Review offers and links before publishing.', 'wconvert')}</span>
            </label>
          </div>
        </fieldset>
      )}

      <div className="wconvert-design-detail__controls">
        <div role="group" aria-label={__('Preview size', 'wconvert')} className="wconvert-segmented">
          <Button variant="ghost" size="sm" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
            <Monitor aria-hidden="true" />{__('Desktop', 'wconvert')}
          </Button>
          <Button variant="ghost" size="sm" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
            <Smartphone aria-hidden="true" />{__('Mobile', 'wconvert')}
          </Button>
        </div>
        {template !== undefined && template.tree.steps.length > 1 && (
          <div role="group" aria-label={__('Preview screen', 'wconvert')} className="wconvert-segmented">
            {template.tree.steps.map((_, index) => (
              <Button key={index} variant="ghost" size="sm" aria-pressed={shown === index} onClick={() => setStep(index)}>
                {index === 0 ? entry.facets.act === 'submit' ? __('Form', 'wconvert') : __('Main screen', 'wconvert') : index === 1 ? __('Success screen', 'wconvert') : sprintf(__('Screen %d', 'wconvert'), index + 1)}
              </Button>
            ))}
          </div>
        )}
        <span className="text-note text-muted-foreground">
          <span>{prepares && mode === 'keep'
            ? __('Preview with your content', 'wconvert') : __('Preview with sample content', 'wconvert')}</span>
          {relativeWidth && device === 'desktop' && <span className="block">{__('Full-width layout in a sample desktop area', 'wconvert')}</span>}
          {scale < 1 && <span className="block" aria-label={__('Preview scale', 'wconvert')}>{sprintf(__('Fit · %d%%', 'wconvert'), Math.round(scale * 100))}</span>}
        </span>
      </div>

      <div className="wconvert-design-detail__layout">
        <div ref={stage} className="wconvert-design-detail__stage" data-device={device}>
          {template !== undefined ? (
            <div className="wconvert-design-detail__measure"
              style={{ inlineSize: size === null ? measure : size.width * scale, blockSize: size === null ? undefined : size.height * scale }}>
              <div ref={page} className="wconvert-design-detail__preview" data-step={shown} inert aria-hidden="true"
                style={{ inlineSize: measure, transform: `scale(${scale})` }}>
                <Preview template={template} step={shown} displayType={entry.display_type} />
              </div>
            </div>
          ) : loadError || preparationError !== undefined ? (
            <div className="wconvert-design-detail__error">
              <p id={`${id}-load`} role="alert">{preparationError ?? __('This design preview could not be loaded.', 'wconvert')}</p>
              {(preparationError !== undefined || onRetry !== undefined) && (
                <Button variant="outline" onClick={preparationError !== undefined ? () => setAttempt((held) => held + 1) : onRetry}>
                  {__('Retry preview', 'wconvert')}
                </Button>
              )}
            </div>
          ) : (
            <div className="wconvert-design-detail__loading">
              <p id={`${id}-load`} role="status">{__('Loading design preview…', 'wconvert')}</p>
              <Skeleton aria-hidden="true" className="h-64 w-full" />
            </div>
          )}
        </div>

        <div className="wconvert-design-detail__facts">
          <dl>
            <div><dt>{__('Collects', 'wconvert')}</dt><dd>{fieldNames.length > 0 ? fieldNames.join(', ') : __('No form fields', 'wconvert')}</dd></div>
            <div><dt>{__('Visitor action', 'wconvert')}</dt><dd>{entry.facets.act === 'submit' ? __('Submits a form', 'wconvert') : entry.facets.act === 'click' ? __('Follows a link', 'wconvert') : __('No conversion action', 'wconvert')}</dd></div>
            {entry.facets.asks_consent && <div><dt>{__('Consent', 'wconvert')}</dt><dd>{__('Includes a consent checkbox', 'wconvert')}</dd></div>}
          </dl>
          {mode === 'keep' && candidate?.value?.transfer !== undefined && (candidate.value.transfer.unplaced > 0 || candidate.value.transfer.unverified > 0) && (
            <div role="status" className="rounded-md border border-warning p-3 text-note">
              {candidate.value.transfer.unplaced > 0 && <p className="m-0">{sprintf(__('%d picture(s) have no clear matching place in this design and will not carry over. Check the preview before applying.', 'wconvert'), candidate.value.transfer.unplaced)}</p>}
              {candidate.value.transfer.unverified > 0 && <p className="m-0">{__('The original design is unavailable, so we cannot identify your picture changes. Re-add your pictures after applying, or keep your current design.', 'wconvert')}</p>}
            </div>
          )}
          <div className="wconvert-design-detail__actions">
            {incompatibleLock && <label className="flex gap-2 text-note"><input type="checkbox" checked={disableLock} onChange={event => setDisableLock(event.target.checked)} />{__('Turn off Content lock to use this design. The selected WordPress content will remain readable.', 'wconvert')}</label>}
            {formatNotice && <p id={`${id}-format`} className="text-note text-warning">{formatNotice}</p>}
            <p id={`${id}-replacement`} className="text-note text-muted-foreground">
              {prepares && mode === 'sample'
                ? __('Replaces the layout and content in your draft with the preview shown here. Undo restores your previous draft.', 'wconvert')
                : __('Replaces your draft’s layout. Some text may move, be hidden or left empty; added blocks may be removed. Check each screen afterwards. Undo restores your previous draft.', 'wconvert')}
            </p>
            {refused !== null && <p id={`${id}-refusal`} className="text-note text-warning">{refused}</p>}
            {changed !== null && <p id={`${id}-change`} className="text-note text-warning">{changed}</p>}
            {unavailable && <p id={`${id}-unavailable`} className="text-note text-muted-foreground">{__('This design is not installed here.', 'wconvert')}</p>}
            <Button disabled={busy} aria-disabled={cannotApply} aria-describedby={describedBy}
              onClick={cannotApply || busy ? undefined : () => prepares ? onChoose(entry.id, { tree: template.tree, tokens: template.tokens }) : onChoose(entry.id)}>
              {busy ? __('Applying design…', 'wconvert')
                : isCurrent ? __('Current design', 'wconvert')
                : changesFormat
                  ? sprintf(/* translators: %s: new campaign format. */ __('Switch to %s', 'wconvert'), toFormat)
                  : __('Use this design', 'wconvert')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
