import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';

/**
 * The analytics overview before its numbers: the impact cards, the "Results
 * by goal" heading and the goal cards, in the classes the loaded overview
 * uses — which is why those rules are in the eager `analytics-frame.css`.
 *
 * **One component is the chunk's fallback and the report's first read.**
 * {@see AnalyticsSection} draws it while the Analytics code downloads and
 * {@see Dashboard} draws it until the report arrives. One region with a row
 * of four stats stood in for a grid of cards before, so the screen was
 * rebuilt when the numbers landed.
 *
 * The heading is real text, because it is what places the goal cards, but
 * like the cards it is `aria-hidden`: the overview is only the likeliest of
 * the report's views, and the one status line says what is coming.
 */
export function AnalyticsSkeleton() {
  return (
    <div className="wconvert-analytics">
      <p role="status" className="sr-only">{__('Loading analytics…', 'wconvert')}</p>
      <div className="wa-impact-grid" aria-hidden="true">
        {[0, 1, 2].map((card) => (
          <div key={card} className={card === 0 ? 'wa-impact wa-impact-primary' : 'wa-impact'}>
            <div className="wa-impact-main">
              <span className="wa-impact-label"><Skeleton className="h-[1lh] w-28" /></span>
              <strong><Skeleton className="h-[1lh] w-20" /></strong>
            </div>
          </div>
        ))}
      </div>
      {/* Hidden from the accessibility tree: on a goal or a test the report has no such heading. */}
      <div className="wa-section-heading" aria-hidden="true">
        <h3>{__('Results by goal', 'wconvert')}</h3>
      </div>
      <div className="wa-goal-grid" aria-hidden="true">
        {[0, 1].map((card) => (
          <div key={card} className="wa-goal-card">
            <Skeleton className="wa-goal-icon" />
            <span>
              <b><Skeleton className="h-[1lh] w-32" /></b>
              <span><strong className="inline-block align-bottom"><Skeleton className="h-[1lh] w-24" /></strong></span>
              <small><Skeleton className="h-[1lh] w-full max-w-48" /></small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
