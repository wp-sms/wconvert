import type { ReactNode } from 'react';
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
      <dt className="text-xs font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'm-0 tabular-nums leading-none tracking-tight text-foreground',
          emphasis ? 'text-3xl font-semibold' : 'text-xl font-medium',
        )}
        title={hint}
      >
        {value}
      </dd>
    </div>
  );
}
