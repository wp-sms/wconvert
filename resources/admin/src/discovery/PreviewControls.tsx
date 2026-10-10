import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { OptionStrip } from '../shell/OptionStrip';
import type { Template } from '@renderer/types';

/**
 * Device and fit for a full inspection, with the fit following the device:
 * the whole design on desktop, the width on a phone so a tall form stays
 * readable by scrolling (ADR 0137, amending 0112). A merchant's own fit choice
 * holds until they switch device.
 */
export function usePreviewView() {
  const [mobile, setMobileState] = useState(() => window.innerWidth < 640);
  const [fitHeight, setFitHeight] = useState(() => window.innerWidth >= 640);
  const setMobile = (value: boolean) => { setMobileState(value); setFitHeight(!value); };
  return { mobile, setMobile, fitHeight, setFitHeight };
}

/** Screen names describe inventory, never promise a particular visitor path. */
export function PreviewControls({ mobile, onMobile, template, step, onStep, disabled = false, fitHeight, onFitHeight }: {
  fitHeight?: boolean; onFitHeight?: (value: boolean) => void;
  mobile: boolean; onMobile: (mobile: boolean) => void; template?: Template;
  step: number; onStep: (step: number) => void; disabled?: boolean;
}) {
  const screens = template?.tree.steps ?? [];
  const shown = String(Math.min(step, Math.max(0, screens.length - 1)));
  // The label says what pressing it does, so it is not also a pressed toggle.
  const fitLabel = fitHeight ? __('Actual width', 'wconvert') : __('Fit whole design', 'wconvert');
  const FitIcon = fitHeight ? Minimize2 : Maximize2;
  return <div className="wconvert-preview-controls wconvert-toolbar">
    <OptionStrip label={__('Preview size', 'wconvert')} value={mobile ? 'mobile' : 'desktop'} disabled={disabled}
      options={[{value:'desktop',label:__('Desktop','wconvert')},{value:'mobile',label:__('Mobile','wconvert')}]}
      onChange={value => onMobile(value === 'mobile')} />
    {screens.length > 4 ? <label className="wconvert-preview-controls__screen">{__('Screen', 'wconvert')}<select className="wconvert-picker__select" disabled={disabled} value={shown} onChange={event=>onStep(Number(event.target.value))}>{screens.map((screen,index)=><option key={index} value={index}>{screen.name || __('Screen','wconvert')}</option>)}</select></label>
      : screens.length > 1 && <div className="wconvert-preview-controls__screen">
        {/* A visible name, so the screens read as a choice of what to look at rather than as tabs. */}
        <span aria-hidden="true">{__('Screen', 'wconvert')}</span>
        <OptionStrip label={__('Preview screen', 'wconvert')} value={shown} disabled={disabled}
          options={screens.map((screen,index) => ({value:String(index),label:screen.name || (index === 0 ? __('Main screen','wconvert') : __('Screen','wconvert'))}))}
          onChange={value => onStep(Number(value))} />
      </div>}
    {onFitHeight && <Button type="button" variant="outline" size="icon-sm" className="wconvert-preview-controls__fit" disabled={disabled}
      aria-label={fitLabel} title={fitLabel} onClick={() => onFitHeight(!fitHeight)}>
      <FitIcon aria-hidden="true" />
    </Button>}
  </div>;
}
