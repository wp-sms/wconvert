import { useId, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { DesignStage } from '../stage/DesignStage';
import type { Template, ResultVariant } from '@renderer/types';

/**
 * A design at its inspect size: the stage (ADR 0170), fitted whole or at its
 * actual size. At actual size a design bigger than the frame scrolls inside it,
 * and says so.
 */
export function PreviewFrame({ template, displayType, mobile, step, result, interactive = false, fitHeight = false, children }: {
  template?: Template; displayType: string; mobile: boolean; step: number;
  result?: ResultVariant; interactive?: boolean; fitHeight?: boolean; children?: ReactNode;
}) {
  const hintId = useId();
  const [overflows, setOverflows] = useState(false);
  const scrolls = template !== undefined && overflows;

  return <><div className="wconvert-preview-frame" data-device={mobile ? 'mobile' : 'desktop'} data-fit={fitHeight ? 'whole' : 'width'}>
    {template ? <DesignStage size="inspect" displayType={displayType} device={mobile ? 'mobile' : 'desktop'} zoom={fitHeight ? 'fit' : 'actual'}
      step={step} result={result} interactive={interactive} source={{ live: { template } }}
      region={{ label: __('Scrollable design preview', 'wconvert'), describedBy: hintId }} onOverflow={setOverflows} /> : children}
  </div>{scrolls && <p id={hintId} className="wconvert-preview-frame__hint">{__('Scroll inside the preview to see the rest, or choose Fit whole design.', 'wconvert')}</p>}</>;
}
