import { Monitor, Smartphone } from 'lucide-react';
import { __ } from '@wordpress/i18n';

/** Width simulation shared by static and interactive previews; it never remounts a form. */
export function PreviewWidth({ mobile, onChange }: { mobile: boolean; onChange(mobile: boolean): void }) {
  return <div className="wconvert-preview-width" role="group" aria-label={__('Preview width', 'wconvert')}>
    <button type="button" aria-pressed={!mobile} onClick={() => onChange(false)}><Monitor aria-hidden="true" size={15} />{__('Desktop', 'wconvert')}</button>
    <button type="button" aria-pressed={mobile} onClick={() => onChange(true)}><Smartphone aria-hidden="true" size={15} />{__('Mobile', 'wconvert')}</button>
  </div>;
}
