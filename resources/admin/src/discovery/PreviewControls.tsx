import { __ } from '@wordpress/i18n';
import { OptionStrip } from '../shell/OptionStrip';
import type { Template } from '@renderer/types';

/** Screen names describe inventory, never promise a particular visitor path. */
export function PreviewControls({ mobile, onMobile, template, step, onStep, disabled = false, journey = false }: {
  mobile: boolean; onMobile: (mobile: boolean) => void; template?: Template;
  step: number; onStep: (step: number) => void; disabled?: boolean; journey?: boolean;
}) {
  return <>
    <OptionStrip label={__('Preview size', 'wconvert')} value={mobile ? 'mobile' : 'desktop'} disabled={disabled}
      options={[{value:'desktop',label:__('Desktop','wconvert')},{value:'mobile',label:__('Mobile','wconvert')}]}
      onChange={value => onMobile(value === 'mobile')} />
    {template && template.tree.steps.length > 1 && <OptionStrip label={__('Preview screen', 'wconvert')}
      value={journey ? '' : String(Math.min(step, template.tree.steps.length - 1))} disabled={disabled}
      options={template.tree.steps.map((screen,index) => ({value:String(index),label:screen.name || (index === 0 ? __('Main screen','wconvert') : __('Screen','wconvert'))}))}
      onChange={value => onStep(Number(value))} />}
  </>;
}
