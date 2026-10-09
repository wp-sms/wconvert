import { __, sprintf } from '@wordpress/i18n';
import { Square, SquareCheck } from 'lucide-react';

/** The tray's sentence saying the comparison is full; a refused checkbox points at it. */
export const COMPARE_FULL = 'wconvert-compare-full';

/** One real checkbox and one visual treatment in every template library. */
export function CompareSelection({ name, checked, disabled = false, full = false, onChange }: {
  name: string; checked: boolean; disabled?: boolean;
  /** Two are already chosen: a refusal, so it keeps focus and says why (§14). */
  full?: boolean; onChange: () => void;
}) {
  const Icon = checked ? SquareCheck : Square;
  return <label className="wconvert-compare-choice" data-refused={full || undefined}>
    <input type="checkbox" checked={checked} disabled={disabled}
      aria-disabled={full || undefined} aria-describedby={full ? COMPARE_FULL : undefined}
      aria-label={sprintf(__('Compare design: %s', 'wconvert'), name)}
      onClick={full ? (event) => event.preventDefault() : undefined} onChange={full ? () => undefined : onChange} />
    <Icon size={16} aria-hidden="true" /><span>{__('Compare', 'wconvert')}</span>
  </label>;
}
