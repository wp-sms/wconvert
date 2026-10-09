import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { PlaybookEntry } from '../goals/api';
import { displayTypeLabel } from '../displayTypes';
import { ComparisonGrid } from './ComparisonGrid';
import { SetupPreview } from './SetupPreview';
import { startingPointDisplayType } from './model';
import { StartingPointSummary } from '../goals/StartingPointFacts';
import type { RuleVocabulary } from '../builder/api';

/** Side by side, with what differs — format and timing — and a way to start from either. */
export function SetupComparison({ entries, onInspect, onUse, busy = false, vocabulary = null, failed, onRetry }: {
  entries: PlaybookEntry[]; onInspect: (entry: PlaybookEntry) => void;
  /** Comparison can finish the job: Use starts the draft from that column (ADR 0112, amended). */
  onUse?: (entry: PlaybookEntry) => void; busy?: boolean; vocabulary?: RuleVocabulary | null;
  failed: Set<string>; onRetry: (id: string) => void;
}) {
  return <ComparisonGrid>{entries.map(entry => <section key={entry.id} >
    <h3 className="m-0 text-heading font-semibold">{entry.name}</h3>
    <p className="text-note">{displayTypeLabel(startingPointDisplayType(entry))}</p>
    <SetupPreview entry={entry} comparison failed={failed.has(entry.id)} onRetry={() => onRetry(entry.id)} />
    <StartingPointSummary playbook={entry} vocabulary={vocabulary} />
    <div className="wconvert-toolbar flex flex-wrap gap-2">
      {onUse && <Button aria-label={sprintf(__('Use setup: %s', 'wconvert'), entry.name)} disabled={busy} onClick={() => onUse(entry)}>{__('Use this setup', 'wconvert')}</Button>}
      <Button variant="outline" aria-label={sprintf(__('Review setup: %s', 'wconvert'), entry.name)} onClick={() => onInspect(entry)}>{__('Review this setup', 'wconvert')}</Button>
    </div>
  </section>)}</ComparisonGrid>;
}
