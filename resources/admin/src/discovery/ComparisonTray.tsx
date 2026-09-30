import type { MouseEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';

/** Selection stays visible while browsing; comparison is available at two designs. */
export function ComparisonTray({ names, disabled = false, onCompare, onClear }: {
  names: string[]; disabled?: boolean;
  onCompare: (event: MouseEvent<HTMLButtonElement>) => void; onClear: () => void;
}) {
  if (!names.length) return null;
  return <aside className="wconvert-comparison-tray wconvert-toolbar" aria-label={__('Designs selected for comparison', 'wconvert')}>
    <div className="wconvert-comparison-tray__selection">
      <strong role="status">{sprintf(__('%s of 2 designs selected', 'wconvert'), String(names.length))}</strong>
      <span>{names.join(' · ')}</span>
    </div>
    <Button disabled={disabled || names.length !== 2} onClick={onCompare}>{sprintf(__('Compare designs (%s/2)', 'wconvert'), String(names.length))}</Button>
    <Button variant="outline" disabled={disabled} onClick={onClear}>{__('Clear comparison', 'wconvert')}</Button>
  </aside>;
}
