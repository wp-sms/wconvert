import { __ } from '@wordpress/i18n';
import { Skeleton } from '../../components/ui/skeleton';

/**
 * The Flow map while its code loads: three cards down the middle, as the map
 * opens (GUIDELINES §12). The announcement lives here, not at the call site,
 * and every bar is hidden from assistive tech.
 */
export function FlowSkeleton() {
  return <div className="wconvert-journey-map wconvert-flow-loading">
    <span role="status" className="sr-only">{__('Loading the Flow map…', 'wconvert')}</span>
    {[0, 1, 2].map(card => <Skeleton key={card} aria-hidden="true" className="h-20 w-60" />)}
  </div>;
}
