import { ReopenSettings } from '../reopenControls';
import { useState, type Ref } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { LayoutTemplate, Palette } from 'lucide-react';
import { Button } from '../components/ui/button';
import { displayTypeDescription, displayTypeLabel } from '../displayTypes';
import { useDirection } from '../hooks/useDirection';
import { Themes, Tokens } from './Tokens';
import { physicalPlacementLabel, PlacementControl } from './PlacementControl';
import { AdvancedContext, AdvancedToggle } from './advanced';
import { DesignColors, designColorsOf } from './ColorField';
import { FactList, FactRow, PanelHeader, PanelSection } from './PanelSection';
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
  // The Look's one Advanced switch, at the panel's foot (ADR 0135, 0136).
  const [advanced, setAdvanced] = useState(false);

  const colors = designColorsOf(template.tokens);

  return (
    <AdvancedContext.Provider value={advanced}>
    <DesignColors.Provider value={colors}>
    <div className="wconvert-design-settings">
      {/*
        The Look panel (ADR 0134, 0136): ready-made looks, the design's own
        colors and fonts, then where it sits and its reopen button, then the
        way to a different design, then Advanced at the foot. "Applies to all
        screens" is the InfoTip's, not a line of its own.
      */}
      <PanelHeader icon={<Palette />} title={<h3>{__('Look', 'wconvert')}</h3>}
        tip={{ label: __('How the look applies', 'wconvert'), content: __('Applies to all screens. Elements with their own styles keep them; reset an element to follow the look again.', 'wconvert') }} />
      <Themes template={template} onChange={onChange} />
      <Tokens
        template={template}
        labels={labels}
        design={design}
        openToken={openToken}
        onOpenToken={onOpenToken}
        onChange={onChange}
        onError={onError}
      />
      <PanelSection title={__('Format and position', 'wconvert')}>
        <FactList>
          <FactRow label={__('Format', 'wconvert')}>
            {sprintf(/* translators: 1: a format, e.g. “Popup”. 2: what it does, e.g. “Centered over the page”. */ __('%1$s · %2$s', 'wconvert'), displayTypeLabel(displayType), displayTypeDescription(displayType))}
            {position ? ` · ${position}` : ''}
          </FactRow>
          {pageSummary !== undefined && <FactRow label={__('On the page', 'wconvert')} action={__('Display rules', 'wconvert')} onAction={onEditPlacement}>
            {pageSummary}
          </FactRow>}
        </FactList>
        <PlacementControl displayType={displayType} value={placement} onChange={onPlacementChange} />
      </PanelSection>
      {['popup', 'slide_in'].includes(displayType) && <ReopenSettings value={teaser} template={template} onChange={onTeaserChange} />}
      <PanelSection title={__('Design', 'wconvert')}>
        <FactList><FactRow label={__('Design', 'wconvert')}>{name}</FactRow></FactList>
        <Button ref={browseRef} variant="outline" size="sm" className="justify-self-start" onClick={onBrowse}>
          <LayoutTemplate aria-hidden="true" />
          {__('Browse designs and formats', 'wconvert')}
        </Button>
      </PanelSection>
      <div className="wconvert-panel-foot">
        <span className="wconvert-panel-foot__spacer" />
        <AdvancedToggle advanced={advanced} onToggle={() => { onOpenToken(null); setAdvanced(value => !value); }} />
      </div>
    </div>
    </DesignColors.Provider>
    </AdvancedContext.Provider>
  );
}
