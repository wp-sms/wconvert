import { __, sprintf } from '@wordpress/i18n';
import { Square, SquareCheck } from 'lucide-react';

/** One real checkbox and one visual treatment in every template library. */
export function CompareSelection({ name, checked, disabled = false, onChange }: {
  name: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  const Icon = checked ? SquareCheck : Square;
  return <label className="wconvert-compare-choice">
    <input type="checkbox" checked={checked} disabled={disabled}
      aria-label={sprintf(__('Compare design: %s', 'wconvert'), name)} onChange={onChange} />
    <Icon size={16} aria-hidden="true" /><span>{__('Compare', 'wconvert')}</span>
  </label>;
}
