import { ReopenSettings } from '../reopenControls';
import type { Ref } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { displayTypeDescription, displayTypeLabel } from '../displayTypes';
import { useDirection } from '../hooks/useDirection';
import { Themes, Tokens } from './Tokens';
import { Preview } from './Preview';
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
}: {
  template: Template;
  labels: TemplateLabels;
  name: string;
  design: TokenBag;
  openToken: string | null;
  onOpenToken: (name: string | null) => void;
  onChange: (template: Template) => void;
  onError: (error: unknown) => void;
  onBrowse: () => void;
  browseRef?: Ref<HTMLButtonElement>;
  mobile?: boolean;
  displayType?: string;
  placement?: unknown;
  teaser?: unknown;
  onTeaserChange?: (value: unknown) => void;
  onPlacementChange?: (placement: string | null) => void;
}) {
  const direction = useDirection();
  const position = physicalPlacementLabel(displayType, placement, direction);

  return (
    <div className="wconvert-design-settings">
      <div className="wconvert-design-card">
        <div className="wconvert-design-card__image" aria-hidden="true">
          <Preview template={template} />
        </div>
        <div className="wconvert-design-card__facts">
          <span className="wconvert-design-card__eyebrow">{__('How it appears', 'wconvert')}</span>
          <strong>{displayTypeLabel(displayType)}</strong>
          <span>{displayTypeDescription(displayType)}{position ? ` · ${position}` : ''}</span>
          <span>{sprintf(/* translators: %s: design name. */ __('Design: %s', 'wconvert'), name)}</span>
        </div>
      </div>
      <Button ref={browseRef} variant="outline" onClick={onBrowse}>
        <LayoutTemplate aria-hidden="true" />
        {__('Browse designs and formats', 'wconvert')}
      </Button>
      <PlacementControl displayType={displayType} value={placement} onChange={onPlacementChange} />
      {['popup', 'slide_in'].includes(displayType) && <ReopenSettings value={teaser} template={template} onChange={onTeaserChange} />}
      {mobile && (
        <p className="wconvert-scope__narrow">
          {__(
            'Design settings affect all sizes. Select an element for mobile overrides.',
            'wconvert',
          )}
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
      <details className="wconvert-style-advanced">
        <summary>{__('Ready-made palettes', 'wconvert')}</summary>
        <Themes template={template} onChange={onChange} />
      </details>
    </div>
  );
}
