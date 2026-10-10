import { contentLockDesignCompatible } from '../inlinePlacement';
import { useEffect, useId, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ClipboardList, MousePointerClick, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { displayTypeLabel } from '../displayTypes';
import { PickerDialogBody } from '../discovery/PickerDialog';
import { AdminDialogFooter } from '../components/ui/admin-dialog';
import { CheckRow } from '../shell/CheckRow';
import { TryAgain } from '../shell/Region';
import { PreviewControls, usePreviewView } from '../discovery/PreviewControls';
import { FactList, type Fact } from '../shell/FactList';
import { PreviewFrame } from '../discovery/PreviewFrame';
import { actChangeOf, refusalFor, type Fit } from './Gallery';
import { dropsFieldMappings } from './destinations';
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
  readonly backLabel?: string;
  readonly loadError?: boolean;
  readonly onRetry?: () => void;
  /**
   * The draft's `integration_mappings`. Applying a design keeps only the
   * mappings it can still feed, so the replacement sentence says so when this
   * one would remove some.
   */
  readonly fieldMappings?: unknown;
}

/** The fields a design collects, in the merchant's words. */
export function fieldNamesOf(entry: TemplateIndexEntry, labels: TemplateLabelsWithFacets): string[] {
  return entry.facets.captures.map((field) =>
    labels.fields?.[field] ?? labels.facetValues[`captures.${field}`] ?? field,
  );
}

/** The dialog's meta line while a design is inspected: *"Popup · Collects Email address"*. */
export function designMeta(entry: TemplateIndexEntry, labels: TemplateLabelsWithFacets): string {
  const names = fieldNamesOf(entry, labels);
  const does = names.length > 0
    ? sprintf(/* translators: %s: the fields a design collects, e.g. “Email address, Name”. */ __('Collects %s', 'wconvert'), names.join(', '))
    : entry.facets.act === 'click' ? __('Follows a link', 'wconvert') : null;
  return [displayTypeLabel(entry.display_type), does].filter(Boolean).join(' · ');
}

/**
 * Inspect the exact normalized candidate before replacing the working draft.
 *
 * The dialog's header names the design (ADR 0137), so this draws no title of
 * its own: the preview on the start side with the setup preview's controls,
 * the content choice and the facts beside it, and what applying does as the
 * footer's note.
 */
export function TemplateDesignDetail({
  entry, template: sample, labels, current, currentDisplayType, fit, goalLabel, busy, onChoose, onPrepare, onBack, backLabel = __('Back to designs', 'wconvert'), loadError = false, onRetry, active = true, hasCurrentDesign = true, contentLock = false, fieldMappings,
}: TemplateDesignDetailProps) {
  const { mobile, setMobile, fitHeight, setFitHeight } = usePreviewView();
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
  const retryPreview = preparationError !== undefined ? () => setAttempt((held) => held + 1) : onRetry;
  const [step, setStep] = useState(0);
  const [resultId, setResultId] = useState('');
  const id = useId();
  const refused = refusalFor(entry, fit);
  const changed = refused === null && !current ? actChangeOf(entry, fit) : null;
  const shown = Math.min(step, Math.max(0, (template?.tree.steps.length ?? 1) - 1));
  const relativeWidth = template?.tokens.width?.includes('%') === true;
  const resultScreen = template?.tree.steps[shown];
  const result = resultScreen?.results?.find(value => value.id === resultId) ?? resultScreen?.results?.[0];
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
          __('Changes this campaign from %1$s to %2$s. Its goal stays “%3$s”. Place its block or shortcode before publishing.', 'wconvert'),
          fromFormat, toFormat, goalLabel,
        )
      : sprintf(
          /* translators: 1: current format, 2: new format, 3: campaign goal. */
          __('Changes this campaign from %1$s to %2$s. Its goal stays “%3$s”. Any saved position resets to the new format’s default; review display rules before publishing.', 'wconvert'),
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
  const losesMappings = template !== undefined && !isCurrent && dropsFieldMappings(fieldMappings, template.tree);
  const fieldNames = fieldNamesOf(entry, labels);
  const facts: Fact[] = [
    { icon: ClipboardList, label: __('Collects', 'wconvert'), text: fieldNames.length > 0 ? fieldNames.join(', ') : __('No form fields', 'wconvert') },
    { icon: MousePointerClick, label: __('Visitor action', 'wconvert'), text: entry.facets.act === 'submit' ? __('Submits a form', 'wconvert') : entry.facets.act === 'click' ? __('Follows a link', 'wconvert') : __('No conversion action', 'wconvert') },
    ...(entry.facets.asks_consent ? [{ icon: ShieldCheck, label: __('Consent', 'wconvert'), text: __('Includes a consent checkbox', 'wconvert') }] : []),
  ];
  const describedBy = [
    `${id}-replacement`,
    refused !== null ? `${id}-refusal` : null,
    changed !== null ? `${id}-change` : null,
    changesFormat ? `${id}-format` : null,
    template === undefined ? `${id}-load` : null,
    unavailable ? `${id}-unavailable` : null,
  ].filter(Boolean).join(' ');

  return (
    <section className="wconvert-design-detail" aria-label={entry.name}>
      <PickerDialogBody className="wconvert-design-detail__document">
        <div className="wconvert-design-detail__layout">
          <div className="wconvert-design-detail__preview">
            <div className="wconvert-design-detail__controls wconvert-toolbar">
              <PreviewControls fitHeight={fitHeight} onFitHeight={setFitHeight} mobile={mobile} onMobile={setMobile}
                template={template} step={shown} onStep={value => { setStep(value); setResultId(''); }} />
              {resultScreen?.results && resultScreen.results.length > 0 && <label className="text-note">{__('Result to inspect','wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event => setResultId(event.target.value)}>{resultScreen.results.map((value, index) => <option key={value.id} value={value.id}>{value.heading || sprintf(/* translators: %d: the result's position. */ __('Result %d', 'wconvert'), index + 1)}</option>)}</select></label>}
            </div>
            <PreviewFrame template={template} displayType={entry.display_type} mobile={mobile} step={shown} result={result} fitHeight={fitHeight}>
              {loadError || preparationError !== undefined ? (
                <div className="wconvert-design-detail__error">
                  <p id={`${id}-load`} role="alert">{preparationError ?? __('This design preview could not be loaded.', 'wconvert')}</p>
                  {retryPreview && <TryAgain onClick={retryPreview} />}
                </div>
              ) : (
                <div className="wconvert-design-detail__loading">
                  <p id={`${id}-load`} role="status">{__('Loading design preview…', 'wconvert')}</p>
                  <Skeleton aria-hidden="true" className="h-64 w-full" />
                </div>
              )}
            </PreviewFrame>
            {relativeWidth && !mobile && <p className="wconvert-preview-frame__hint">{__('Full-width layout in a sample desktop area', 'wconvert')}</p>}
          </div>

          <div className="wconvert-design-detail__facts">
            {prepares && (
              <fieldset className="wconvert-design-detail__content-choice" disabled={busy}>
                <legend>{__('Content', 'wconvert')}</legend>
                <CheckRow type="radio" name={`${id}-content`} value="keep" checked={mode === 'keep'} disabled={!hasCurrentDesign}
                  onChange={() => setMode('keep')} label={__('Keep my words and images', 'wconvert')}
                  hint={hasCurrentDesign ? __('Fitted into this layout; check each screen.', 'wconvert') : __('This draft has no content yet.', 'wconvert')} />
                <CheckRow type="radio" name={`${id}-content`} value="sample" checked={mode === 'sample'}
                  onChange={() => setMode('sample')} label={__('Use the design’s sample content', 'wconvert')}
                  hint={__('Review its offers and links before publishing.', 'wconvert')} />
              </fieldset>
            )}
            <FactList facts={facts} />
            {mode === 'keep' && candidate?.value?.transfer !== undefined && (candidate.value.transfer.unplaced > 0 || candidate.value.transfer.unverified > 0) && (
              <div role="status" className="rounded-md border border-warning p-3 text-note">
                {candidate.value.transfer.unplaced > 0 && <p className="m-0">{sprintf(_n('%d picture has no clear matching place in this design and will not carry over. Check the preview before applying.', '%d pictures have no clear matching place in this design and will not carry over. Check the preview before applying.', candidate.value.transfer.unplaced, 'wconvert'), candidate.value.transfer.unplaced)}</p>}
                {candidate.value.transfer.unverified > 0 && <p className="m-0">{__('The original design is unavailable, so we cannot identify your picture changes. Re-add your pictures after applying, or keep your current design.', 'wconvert')}</p>}
              </div>
            )}
            <div className="wconvert-design-detail__actions">
              {incompatibleLock && <CheckRow className="text-note" checked={disableLock} onChange={event => setDisableLock(event.target.checked)} label={__('Turn off Content lock to use this design. The selected WordPress content will remain readable.', 'wconvert')} />}
              {/* A format change is information, not the site holding something back (§14). */}
              {formatNotice && <p id={`${id}-format`} className="text-note text-muted-foreground">{formatNotice}</p>}
              {refused !== null && <p id={`${id}-refusal`} className="text-note text-warning">{refused}</p>}
              {changed !== null && <p id={`${id}-change`} className="text-note text-warning">{changed}</p>}
              {unavailable && <p id={`${id}-unavailable`} className="text-note text-muted-foreground">{__('This design is not installed here.', 'wconvert')}</p>}
            </div>
          </div>
        </div>
      </PickerDialogBody>
      {/* What applying does is the note beside the button that does it. */}
      <AdminDialogFooter note={<span id={`${id}-replacement`}>
        {isCurrent ? __('This is the draft’s current design.', 'wconvert') : __('Replaces this draft’s design. You can undo.', 'wconvert')}
        {losesMappings && <> {__('Field mappings for missing fields are removed.', 'wconvert')}</>}
      </span>} back={
        <Button className="wconvert-picker__back" variant="outline" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          {backLabel}
        </Button>}>
            <Button disabled={busy} aria-disabled={cannotApply} aria-describedby={describedBy}
              onClick={cannotApply || busy ? undefined : () => prepares ? onChoose(entry.id, { tree: template.tree, tokens: template.tokens }) : onChoose(entry.id)}>
              {busy ? __('Applying design…', 'wconvert')
                : isCurrent ? __('Current design', 'wconvert')
                : changesFormat
                  ? sprintf(/* translators: %s: new campaign format. */ __('Switch to %s', 'wconvert'), toFormat)
                  : __('Use this design', 'wconvert')}
        </Button>
      </AdminDialogFooter>
    </section>
  );
}
