import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { Description } from '../shell/Description';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { useShownAfterDelay } from '../shell/skeletonDelay';

/**
 * Destinations before its one read, in either of its two places.
 *
 * **On Settings the heading is real and the list is not.** The screen's own
 * `<h2>` and its description are drawn before any data, so the placeholder is
 * the stack of destination cards under them — a region skeleton there drew a
 * second "Destinations" title bar under the first.
 *
 * **On Sending issues** it is a region named for that view.
 *
 * Outside the chunk, so {@see SendingIssuesSection} and the Settings skeleton
 * draw what {@see Destinations} itself draws on its first read.
 */
export function DestinationsSkeleton({ mode }: { mode: 'settings' | 'issues' }) {
  const shown = useShownAfterDelay();
  if (mode === 'issues') return <RegionSkeleton label={__('Sending issues', 'wconvert')} description lines={3} />;
  if (!shown) return null;
  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <h2 className="m-0 text-heading font-semibold">{__('Destinations', 'wconvert')}</h2>
        <Description className="mt-1">{__('Reusable places to send submissions. Campaigns pick theirs in the Destinations tab.', 'wconvert')}</Description>
      </div>
      <DestinationCardsSkeleton />
    </div>
  );
}

/**
 * The configured cards while they are read: each a region with the provider's
 * icon, name and line under it, Edit and its menu, and the health line below.
 * Announced once, by the first.
 */
export function DestinationCardsSkeleton() {
  const actions = <span aria-hidden="true" className="flex items-center gap-2">
    <Skeleton className="w-[76px]" style={{ blockSize: 'var(--control-height)' }} />
    <Skeleton className="size-8" />
  </span>;
  return <>
    {[0, 1].map((card) => (
      // An empty icon tile: the provider's mark is not known until the read lands.
      <RegionSkeleton key={card} label={__('Destinations', 'wconvert')} announce={card === 0}
        icon={<span />} description trailing={actions}>
        {/* The card's health line: one sentence of body text. */}
        <Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-96" />
      </RegionSkeleton>
    ))}
  </>;
}
