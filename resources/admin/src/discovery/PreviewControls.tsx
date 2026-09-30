import { __ } from '@wordpress/i18n';
import { OptionStrip } from '../shell/OptionStrip';
import type { Template } from '@renderer/types';

/** Screen names describe inventory, never promise a particular visitor path. */
export function PreviewControls({ mobile, onMobile, template, step, onStep, disabled = false, journey = false }: {
  mobile: boolean; onMobile: (mobile: boolean) => void; template?: Template;
  step: number; onStep: (step: number) => void; disabled?: boolean; journey?: boolean;
}) {
  return <div className="wconvert-preview-controls wconvert-toolbar">
    <OptionStrip label={__('Preview size', 'wconvert')} value={mobile ? 'mobile' : 'desktop'} disabled={disabled}
      options={[{value:'desktop',label:__('Desktop','wconvert')},{value:'mobile',label:__('Mobile','wconvert')}]}
      onChange={value => onMobile(value === 'mobile')} />
    {template && template.tree.steps.length > 4 ? <label className="wconvert-preview-controls__screen">{__('Screen', 'wconvert')}<select className="wconvert-picker__select" disabled={disabled} value={journey ? '' : String(Math.min(step, template.tree.steps.length - 1))} onChange={event=>onStep(Number(event.target.value))}>{journey && <option value="">{__('Visitor journey', 'wconvert')}</option>}{template.tree.steps.map((screen,index)=><option key={index} value={index}>{screen.name || __('Screen','wconvert')}</option>)}</select></label> : template && template.tree.steps.length > 1 && <OptionStrip label={__('Preview screen', 'wconvert')}
      value={journey ? '' : String(Math.min(step, template.tree.steps.length - 1))} disabled={disabled}
      options={template.tree.steps.map((screen,index) => ({value:String(index),label:screen.name || (index === 0 ? __('Main screen','wconvert') : __('Screen','wconvert'))}))}
      onChange={value => onStep(Number(value))} />}
  </div>;
}
