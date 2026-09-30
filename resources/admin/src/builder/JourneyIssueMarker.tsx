import { __, _n, sprintf } from '@wordpress/i18n';
import { TriangleAlert } from 'lucide-react';
import type { JourneyReadinessIssue } from './structure/journeyReadiness';

export function JourneyIssueMarker({ issues, onIssue }: {
  issues?: readonly JourneyReadinessIssue[]; onIssue?(issue: JourneyReadinessIssue): void;
}) {
  if (!issues?.length || !onIssue) return null;
  const count = sprintf(_n('%d issue', '%d issues', issues.length, 'wconvert'), issues.length);
  return <button type="button" className="wconvert-flow-issue nodrag" onClick={() => onIssue(issues[0])}
    aria-label={sprintf(__('%1$s: %2$s', 'wconvert'), count, issues[0].said)}>
    <TriangleAlert aria-hidden="true" size={16} />
    {count}
  </button>;
}
