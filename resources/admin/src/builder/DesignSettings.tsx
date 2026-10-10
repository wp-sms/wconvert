import { ReopenSettings } from '../reopenControls';
import type { Ref } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { InfoTip } from '../shell/InfoTip';
import { displayTypeDescription, displayTypeLabel } from '../displayTypes';
import { useDirection } from '../hooks/useDirection';
import { Themes, Tokens } from './Tokens';
import { physicalPlacementLabel, PlacementControl } from './PlacementControl';
import type { TemplateLabels } from '../templates/api';
import type { Template, Tokens as TokenBag } from '@renderer/types';

export function DesignSettings({
  template,
  labels,
  name,
  design,
  openToken,
  onOpenToken,
  onChange,
  onError,
  onBrowse,
  browseRef,
  mobile,
  displayType = 'popup',
  placement,
  teaser,
  onTeaserChange = () => undefined,
  onPlacementChange = () => undefined,
  pageSummary,
  onEditPlacement,
}: {
  template: Template;
  labels: TemplateLabels;
  name: string;
  design: TokenBag;
  openToken: string | null;
  onOpenToken: (name: string | null) => void;
  /** `coalesce` is {@see Tokens}'s: which token a burst of changes belongs to. */
  onChange: (template: Template, coalesce?: string) => void;
  onError: (error: unknown) => void;
  onBrowse: () => void;
  browseRef?: Ref<HTMLButtonElement>;
  mobile?: boolean;
  displayType?: string;
  placement?: unknown;
  teaser?: unknown;
  onTeaserChange?: (value: unknown) => void;
  onPlacementChange?: (placement: string | null) => void;
  /** Inline and content-lock formats: where on the page it sits, said here and set in Display rules. */
  pageSummary?: string;
  onEditPlacement?: () => void;
}) {
  const direction = useDirection();
  const position = physicalPlacementLabel(displayType, placement, direction);

  return (
    <div className="wconvert-design-settings">
      {/*
        The Look panel (ADR 0134): ready-made looks, the design's own colors and
        fonts, then where it sits and its reopen button, then the way to a
        different design. Everything here applies to every screen.
      */}
      <div className="wconvert-look-head">
        <h3>{__('Look', 'wconvert')}</h3>
        <div className="wconvert-editor-help"><span>{__('Applies to all screens', 'wconvert')}</span><InfoTip label={__('How theme styles apply', 'wconvert')}>{__('Elements with their own styles keep those overrides. Reset an element’s styles to use the theme again.', 'wconvert')}</InfoTip></div>
      </div>
      <Themes template={template} onChange={onChange} />
      {mobile && (
        <p className="wconvert-scope__narrow">
          {__('The look affects all sizes. Select an element for mobile overrides.', 'wconvert')}
        </p>
      )}
      <Tokens
        template={template}
        labels={labels}
        design={design}
        openToken={openToken}
        onOpenToken={onOpenToken}
        onChange={onChange}
        onError={onError}
      />
      <section className="wconvert-look-section" aria-label={__('Format and position', 'wconvert')}>
        <h4>{__('Format and position', 'wconvert')}</h4>
        <p className="wconvert-look-fact"><strong>{displayTypeLabel(displayType)}</strong> · {displayTypeDescription(displayType)}{position ? ` · ${position}` : ''}</p>
        <PlacementControl displayType={displayType} value={placement} onChange={onPlacementChange} />
        {pageSummary !== undefined && <p className="wconvert-look-fact">
          {sprintf(/* translators: %s: where an inline campaign sits, e.g. “After paragraph 3”. */ __('Where on the page: %s', 'wconvert'), pageSummary)}
          {onEditPlacement && <> · <button type="button" className="wconvert-look-link" onClick={onEditPlacement}>{__('Edit in Display rules', 'wconvert')}</button></>}
        </p>}
      </section>
      {['popup', 'slide_in'].includes(displayType) && <ReopenSettings value={teaser} template={template} onChange={onTeaserChange} />}
      <section className="wconvert-look-section" aria-label={__('Design', 'wconvert')}>
        <p className="wconvert-look-fact">{sprintf(/* translators: %s: design name. */ __('Design: %s', 'wconvert'), name)}</p>
        <Button ref={browseRef} variant="outline" onClick={onBrowse}>
          <LayoutTemplate aria-hidden="true" />
          {__('Browse designs and formats', 'wconvert')}
        </Button>
      </section>
    </div>
  );
}
