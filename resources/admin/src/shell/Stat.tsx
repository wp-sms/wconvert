import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

/**
 * A row of numbers that belong to one subject.
 *
 * **A bulleted list is not a set of statistics.** That is what the analytics
 * screen shipped: *Impressions 0*, *Conversion rate —*, *Dismissals 0* as `<li>`s
 * with the value bolded after the label, which reads as prose about numbers
 * rather than as numbers. A merchant scanning a Goal card is comparing
 * magnitudes, and magnitudes are compared down a column — so the value leads,
 * large and lined up, and the label sits under it in the small-caps register the
 * table headers already use (ADR 0039).
 *
 * **That last claim used to be false.** The label was `text-xs tracking-wide` —
 * 12px at 0.025em — against the table header's 0.04em, so the docblock named a
 * register the component did not actually share. `text-micro` is the register,
 * from the type scale, and the table header reads the same token: one spelling,
 * so the two cannot drift apart again.
 *
 * It wraps rather than scrolling: four stats at 360px are two rows of two, and
 * every one of them is still a number with its name under it.
 */
export function StatRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <dl
      className={cn(
        'm-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]',
        className,
      )}
    >
      {children}
    </dl>
  );
}

/**
 * One number and what it counts.
 *
 * `<dt>`/`<dd>` rather than two `<span>`s, because that is what a term and its
 * value are — and it is what lets a screen reader announce "Impressions, 1,204"
 * instead of two unrelated strings. The visual order is reversed with
 * `flex-col-reverse` so the DOM keeps term-then-value while the eye gets
 * value-then-term.
 *
 * **`emphasis` is for the headline number a Goal is judged on**, and there is at
 * most one per row. Everything else is the same size, because a card where three
 * numbers all shout has no headline at all.
 */
export function Stat({
  label,
  value,
  emphasis = false,
  hint,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-micro uppercase text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'm-0 tabular-nums leading-none tracking-tight text-foreground',
          /*
            **Two sizes, both from the scale, and the gap between them is the
            hierarchy.** The secondary number was `text-xl` — 20px, a size that
            existed nowhere else in the admin and that read as "slightly less
            headline". `--text-heading` is the size of a card's title, which is
            what a stat that is not the headline is: a labelled figure, legible
            at a glance, not competing with the one number the Goal is judged
            on.
          */
          emphasis ? 'text-figure font-semibold' : 'text-heading font-medium',
        )}
        title={hint}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The same row, before its numbers arrive.
 *
 * ============================================================================
 * IT RESERVES THE HEIGHT BY BEING THE SAME SHAPE, NOT BY NAMING ONE.
 * ============================================================================
 * ADR 0039: a region that fetches owes a loading state. The builder's strip had
 * none — it was `stats !== null &&`, so the numbers popped in after the
 * dashboard read and pushed the tab strip down, and `emphasis` makes that jump
 * taller.
 *
 * A `min-block-size` here would be a number that has to be kept equal to a
 * number in {@link Stat}, and nothing would notice when the type scale moved.
 * These placeholders are the same `<dt>`/`<dd>` at the same sizes with a block
 * of `1em` where the figure goes, so the reserved height is the real height by
 * construction — the same bargain {@see TableSkeleton} makes with its columns.
 *
 * One `sr-only` "Loading…" for the row rather than one per placeholder, so a
 * screen reader hears it once ({@see TableSkeleton}).
 */
export function StatRowSkeleton({
  stats,
  className,
}: {
  /** How many stats the row will hold. The first takes the headline's size. */
  stats: number;
  className?: string;
}) {
  return (
    <StatRow className={className}>
      {/* `<div>` and not `<span>`: a `<dl>`'s content model takes one. */}
      <div className="sr-only">{__('Loading…', 'wconvert')}</div>
      {Array.from({ length: stats }, (_, index) => (
        <div key={index} className="flex flex-col-reverse gap-0.5">
          {/*
            **The label is a placeholder too, and that is a concession worth
            naming.** The headline's word is the GOAL's — *Submissions*,
            *Click-throughs to the offer* — and it arrives on the same read as
            the numbers, so nothing here can draw it early. One line is
            reserved; a Goal whose words wrap to two in this column still grows
            the row by a line when they land. Reserving two would shrink it by
            one for every Goal whose words fit, which is the same jump upwards.
          */}
          <dt className="text-micro uppercase text-muted-foreground">
            <Skeleton aria-hidden="true" className="h-[1lh] w-24 max-w-full" />
          </dt>
          <dd className={cn('m-0', index === 0 ? 'text-figure' : 'text-heading')}>
            {/*
              **`1lh`, not `1em`.** A figure's box is its LINE box, and the type
              scale pairs a line-height with every size — so `1em` reserved the
              font size and came up 4px short on the two supporting numbers.
              This is the same height by construction whatever the scale does
              next, which is the whole reason there is no `min-block-size` here.
            */}
            <Skeleton aria-hidden="true" className="h-[1lh] w-16 max-w-full" />
          </dd>
        </div>
      ))}
    </StatRow>
  );
}
