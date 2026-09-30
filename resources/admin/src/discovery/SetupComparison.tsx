import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { PlaybookEntry } from '../goals/api';
import { displayTypeLabel } from '../displayTypes';
import { SetupPreview } from './SetupPreview';
import { startingPointDisplayType } from './model';

/** Inspection only: choosing a column continues to the exact setup review. */
export function SetupComparison({ entries, onInspect, failed, onRetry }: {
  entries: PlaybookEntry[]; onInspect: (entry: PlaybookEntry) => void;
  failed: Set<string>; onRetry: (id: string) => void;
}) {
  return <div className="grid min-w-0 gap-6 md:grid-cols-2">{entries.map(entry => <section key={entry.id} className="min-w-0 rounded-lg border p-4">
    <h3 className="m-0 text-heading font-semibold">{entry.name}</h3>
    <p className="text-note">{displayTypeLabel(startingPointDisplayType(entry))}</p>
    <SetupPreview entry={entry} />
    {failed.has(entry.id) && <Button variant="outline" onClick={() => onRetry(entry.id)}>{__('Retry preview', 'wconvert')}</Button>}
    {entry.requirements && <ul className="list-disc ps-5 text-note">{entry.requirements.map(item => <li key={item}>{item}</li>)}</ul>}
    <Button variant="outline" aria-label={sprintf(__('Review setup: %s', 'wconvert'), entry.name)} onClick={() => onInspect(entry)}>{__('Review this setup', 'wconvert')}</Button>
  </section>)}</div>;
}
