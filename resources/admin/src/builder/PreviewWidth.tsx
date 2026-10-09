import { __ } from '@wordpress/i18n';
import { OptionStrip } from '../shell/OptionStrip';

/**
 * Width simulation shared by static and interactive previews; it never
 * remounts a form. Drawn as the same `OptionStrip` the template picker's
 * `PreviewControls` and the editor canvas use, so preview size looks one way
 * everywhere (GUIDELINES §7).
 */
export function PreviewWidth({ mobile, onChange }: { mobile: boolean; onChange(mobile: boolean): void }) {
  return <OptionStrip label={__('Preview size', 'wconvert')} value={mobile ? 'mobile' : 'desktop'}
    options={[{ value: 'desktop', label: __('Desktop', 'wconvert') }, { value: 'mobile', label: __('Mobile', 'wconvert') }]}
    onChange={value => onChange(value === 'mobile')} />;
}
