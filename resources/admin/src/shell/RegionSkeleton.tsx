import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { Region, RegionBody } from './Region';

/**
 * A region in the shape of a region: a title bar, and what will be under it.
 *
 * ============================================================================
 * A SKELETON MIRRORS THE LAYOUT IT REPLACES, OR IT IS JUST A SPINNER.
 * ============================================================================
 * That is the claim {@see TableSkeleton} and {@see ChoiceSkeleton} both make in
 * their own words — *"the columns do not move when the data lands, so the
 * screen does not jump"* — and two screens broke it by reaching for the only
 * skeleton that existed. Analytics drew a headless `DataTable` of four columns
 * where a `StatRow` and a sparkline were coming; Destinations drew a
 * three-column table where a stack of settings CARDS was coming. Neither
 * region contains a table at all.
 *
 * The third user is {@see BuilderSkeleton}, which had hand-rolled exactly this
 * — a bar for the heading and a block for the body — before there was anything
 * to share.
 *
 * `children` is for a region whose body has a shape worth mirroring, which on
 * Analytics is {@see StatRowSkeleton}; `lines` is the default for a body that
 * is a form or a list of sentences, where a run of bars is as close as a
 * placeholder can honestly get.
 *
 * The announcement is here rather than at the call site, and `aria-hidden` on
 * every bar: a screen reader has nothing to gain from six grey boxes and
 * everything to gain from the word "Loading" ({@see TableSkeleton}).
 */
export function RegionSkeleton({
  label,
  lines = 2,
  children,
}: {
  /** Names the region for a screen reader, since the heading is a bar. */
  label: string;
  lines?: number;
  children?: ReactNode;
}) {
  return (
    <Region label={label}>
      {/*
        The header band's own padding, so the title bar sits where the title
        will — `RegionHeader` cannot be used here because it takes a string.
      */}
      <div className="border-b border-border px-4 py-2.5">
        <Skeleton aria-hidden="true" className="h-[1lh] w-48 max-w-full text-heading" />
      </div>

      <RegionBody className="flex flex-col gap-4">
        <span role="status" className="text-note text-muted-foreground">
          {sprintf(__('Loading %s…', 'wconvert'), label)}
        </span>

        {children ??
          Array.from({ length: lines }, (_each, line) => (
            <Skeleton
              key={line}
              aria-hidden="true"
              className={line === 0 ? 'h-4 w-full max-w-md' : 'h-4 w-2/3 max-w-sm'}
            />
          ))}
      </RegionBody>
    </Region>
  );
}
