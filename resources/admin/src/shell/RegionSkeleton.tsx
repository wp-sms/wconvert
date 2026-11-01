import { createContext, useContext, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { Region, RegionBody } from './Region';
import { useShownAfterDelay } from './skeletonDelay';

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
 * So the header is the {@see RegionHeader} it stands for, line for line: the
 * `icon` the loaded region shows, a `description` line where it has one, and
 * a `trailing` action where it carries one. A heading without its description
 * is a region that grows a line when it lands.
 *
 * `children` is for a region whose body has a shape worth mirroring, which on
 * Analytics is {@see StatRowSkeleton}; `lines` is the default for a body that
 * is a form or a list of sentences, where a run of bars is as close as a
 * placeholder can honestly get.
 *
 * **The announcement is screen-reader only, and there is one.** A visible
 * "Loading…" line is a row of text the loaded region does not have, so the
 * body jumped by it; and every bar is `aria-hidden`, because a screen reader
 * has nothing to gain from six grey boxes. `label` is the region's own NAME —
 * "Answers", "License" — never a sentence: the status says "Loading answers…"
 * from it, and a label of "Loading license…" read "Loading loading license……".
 */
export function RegionSkeleton({
  label,
  description = false,
  trailing,
  icon,
  lines = 2,
  className,
  flush = false,
  footer = false,
  announce = true,
  children,
}: {
  /** The region's name, for a screen reader, since the heading is a bar. */
  label: string;
  /** Reserve the header's description line. */
  description?: boolean;
  /** Reserve a header action: `true` for one button, or the shape itself. */
  trailing?: ReactNode;
  /** The header's icon, drawn as the loaded region draws it. */
  icon?: ReactNode;
  lines?: number;
  /** The loaded region's own class, where it has one (`wa-report`). */
  className?: string;
  /** The body runs edge to edge, as a region holding a table does. */
  flush?: boolean;
  /** Reserve a {@see RegionFooter} with its one action, as a settings form has. */
  footer?: boolean;
  /** Off for the second of a run of identical placeholders, which the first has announced. */
  announce?: boolean;
  children?: ReactNode;
}) {
  // A first fill paints at once; inside a `Reread` it waits ({@see useShownAfterDelay}).
  if (!useShownAfterDelay()) return null;

  return (
    <Region label={label} className={className}>
      {announce && <span role="status" className="sr-only">
        {sprintf(/* translators: %s: the name of the section loading, lower-cased when it starts a sentence, e.g. “answers”. */ __('Loading %s…', 'wconvert'), sentenceCase(label))}
      </span>}

      {/* `RegionHeader`'s own frame, so each bar sits where its text will. */}
      <div aria-hidden="true" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon && <span className="wconvert-region-icon">{icon}</span>}
          <div className="min-w-0 flex-1">
            <Skeleton className="h-[1lh] w-full max-w-48 text-heading leading-tight" />
            {description && <Skeleton className="mt-1 h-[1lh] w-full max-w-80 text-note" />}
          </div>
        </div>
        {trailing === true ? <Skeleton className="w-28" style={{ blockSize: 'var(--control-height-sm)' }} /> : trailing}
      </div>

      {flush ? <Announced value={true}>{children}</Announced> : <RegionBody className="flex flex-col gap-4">
        <Announced value={true}>{children}</Announced>
        {children === undefined &&
          Array.from({ length: lines }, (_each, line) => (
            <Skeleton
              key={line}
              aria-hidden="true"
              className={line === 0 ? 'h-4 w-full max-w-md' : 'h-4 w-2/3 max-w-sm'}
            />
          ))}
      </RegionBody>}
      {footer && <div aria-hidden="true" className="flex justify-end border-t border-border px-4 py-2.5">
        <Skeleton className="w-36" style={{ blockSize: 'var(--control-height)' }} />
      </div>}
    </Region>
  );
}

/**
 * Whether a skeleton is inside a region that has already said "Loading". A
 * body skeleton with its own announcement ({@see StatRowSkeleton}) stays quiet
 * there, so a screen reader hears the region once and not twice.
 */
const Announced = createContext(false);

export function useAnnounced(): boolean {
  return useContext(Announced);
}

/**
 * A region's title is title-cased ("Monthly targets") and this sentence puts it
 * mid-sentence, where domain nouns are lowercase (ADR 0131). An acronym or a
 * name whose second letter is a capital is left as it is.
 */
function sentenceCase(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}
