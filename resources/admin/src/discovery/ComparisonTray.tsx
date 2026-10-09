import type { MouseEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { COMPARE_FULL } from './CompareSelection';

/**
 * Selection stays visible while browsing; comparison is available at two.
 * The count is said once, in the status, and the button is just the verb.
 */
export function ComparisonTray({ names, disabled = false, onCompare, onClear }: {
  names: string[]; disabled?: boolean;
  onCompare: (event: MouseEvent<HTMLButtonElement>) => void; onClear: () => void;
}) {
  if (!names.length) return null;
  return <aside className="wconvert-comparison-tray wconvert-toolbar" aria-label={__('Selected for comparison', 'wconvert')}>
    <div className="wconvert-comparison-tray__selection">
      <strong role="status">{sprintf(/* translators: %s: how many are selected, 1 or 2. */ __('%s of 2 selected', 'wconvert'), String(names.length))}</strong>
      <span>{names.map((name, index) => <span key={`${index}:${name}`}>{index > 0 && ' · '}<bdi>{name}</bdi></span>)}</span>
      {names.length >= 2 && <span id={COMPARE_FULL} className="text-note text-muted-foreground">{__('Compare two at a time. Clear one to add another.', 'wconvert')}</span>}
    </div>
    <Button variant="outline" disabled={disabled} onClick={onClear}>{__('Clear', 'wconvert')}</Button>
    <Button disabled={disabled || names.length !== 2} onClick={onCompare}>{__('Compare', 'wconvert')}</Button>
  </aside>;
}
