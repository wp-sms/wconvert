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
