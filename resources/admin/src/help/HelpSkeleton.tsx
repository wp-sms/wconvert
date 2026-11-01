import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';

/**
 * The Help page while its code downloads. The page is static — no read
 * follows — so this is only the chunk's wait: the search bar and the cards
 * under it, in the page's own proportions, so the page lands without a jump.
 */
export function HelpSkeleton() {
  return (
    <div className="grid gap-6">
      <p role="status" className="sr-only">{__('Loading help…', 'wconvert')}</p>
      <div aria-hidden="true" className="mb-4 max-w-[46rem]">
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <Skeleton className="h-[1lh] w-12 text-note" />
          {['w-36', 'w-20', 'w-[86px]', 'w-24'].map((width) => <Skeleton key={width} className={`h-[30px] rounded-full ${width}`} />)}
        </div>
      </div>
      <Skeleton aria-hidden="true" className="h-[100px] w-full rounded-lg" />
      <div aria-hidden="true" className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
