import { __, _n, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import type { CampaignIssue } from './readiness/campaignIssues';

/**
 * A card's issues on the Flow map: the count, and on click every issue about
 * that screen from the campaign's one list (ADR 0133), each a way to its fix
 * (ADR 0135). It opened the first and hid the rest.
 */
export function JourneyIssueMarker({ issues, onIssue }: {
  issues?: readonly CampaignIssue[]; onIssue?(issue: CampaignIssue): void;
}) {
  if (!issues?.length || !onIssue) return null;
  const count = sprintf(_n('%d issue', '%d issues', issues.length, 'wconvert'), issues.length);
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="wconvert-flow-issue nodrag" aria-label={sprintf(/* translators: %s: “1 issue”, “3 issues”. */ __('%s on this screen. Show them', 'wconvert'), count)}>
        <TriangleAlert aria-hidden="true" size={16} />
        {count}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="wconvert-flow-issue__list">
      <ul aria-label={__('To fix on this screen', 'wconvert')}>
        {issues.map(issue => <li key={issue.key}><button type="button" onClick={() => onIssue(issue)}>{issue.said}</button></li>)}
      </ul>
    </PopoverContent>
  </Popover>;
}
