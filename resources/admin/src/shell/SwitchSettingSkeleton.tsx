import { Skeleton } from '../components/ui/skeleton';
import { RegionSkeleton } from './RegionSkeleton';

/**
 * A {@see SwitchSetting} while its value is read: the heading, the switch's
 * row with its hint under it, and the footer that holds Save. Its own file so
 * the eager Settings skeleton can draw it without the switch's code.
 */
export function SwitchSettingSkeleton({ title }: { title: string }) {
  return (
    <RegionSkeleton label={title} footer>
      <span className="flex items-start gap-2">
        <Skeleton aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-sm" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-48" />
          <Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-xl text-note" />
        </span>
      </span>
    </RegionSkeleton>
  );
}
