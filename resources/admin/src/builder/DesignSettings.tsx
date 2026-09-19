import type { Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Themes, Tokens } from './Tokens';
import { Preview } from './Preview';
import { PlacementControl } from './PlacementControl';
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
  onPlacementChange?: (placement: string | null) => void;
}) {
  return (
    <div className="wconvert-design-settings">
      <div className="wconvert-design-card">
        <div className="wconvert-design-card__image" aria-hidden="true">
          <Preview template={template} />
        </div>
        <div>
          <strong>{name}</strong>
          <span>{__('Applies to both screens', 'wconvert')}</span>
        </div>
      </div>
      <Button ref={browseRef} variant="outline" onClick={onBrowse}>
        <LayoutTemplate aria-hidden="true" />
        {__('Change design or format', 'wconvert')}
      </Button>
      <PlacementControl displayType={displayType} value={placement} onChange={onPlacementChange} />
      {mobile && (
        <p className="wconvert-scope__narrow">
          {__(
            'Design settings apply to all sizes. Select an element to adjust its mobile appearance.',
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
