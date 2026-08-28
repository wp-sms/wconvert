import type { ReactNode } from 'react';
import { Skeleton } from '../components/ui/skeleton';
import { Description } from './Description';

/**
 * A set of cards, each offering one way forward, and the placeholder for the
 * set that is still arriving.
 *
 * The pair mirrors {@see DataTable} and {@see TableSkeleton}: a shape, and a
 * loading state built to that same shape so the screen does not jump when the
 * data lands. It moved out of the creation flow in #73 because the flow itself
 * is behind a lazy boundary now, and a fallback cannot live inside the chunk it
 * is waiting for.
 */

/**
 * `auto-fill` rather than `auto-fit`, and the difference shows on a [[Goal]]
 * with exactly one [[Playbook]]: `auto-fit` collapses the empty tracks and
 * stretches the single card to the full region, so its notes ran at a
 * thousand-pixel measure. `auto-fill` keeps the tracks, so one card is the same
 * card as one of four.
 *
 * **A 15rem floor rather than 16rem, and the reason is the fourth card.** At
 * 1152px a 16rem track gives exactly three columns for four Goals, so the set
 * read as a row of three with one orphan under it — which is the shape that
 * says "there are more of these below" about a list that has ended. 15rem fits
 * four, and it is still one column at 360px and two on a narrow laptop, with no
 * breakpoint anywhere.
 */
export function ChoiceGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
      {children}
    </ul>
  );
}

export function ChoiceCard({
  id,
  title,
  notes,
  badge,
  action,
}: {
  id: string;
  title: string;
  notes: string;
  badge?: ReactNode;
  action: (describedBy: string) => ReactNode;
}) {
  const titleId = `wconvert-choice-${id}`;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3
          id={titleId}
          className="m-0 text-heading font-semibold leading-tight tracking-tight text-foreground"
        >
          {title}
        </h3>
        {badge}
      </div>
      <Description className="flex-1">{notes}</Description>
      {/*
        **Four buttons all called "Choose" is four buttons a keyboard user
        cannot tell apart.** The visible label stays short because the card it
        sits in is what it refers to; `aria-describedby` is what carries that
        fact into the accessibility tree, so the button announces as "Choose,
        Grow my email list" without the card growing a longer label. ADR 0038
        sets AA as the bar, and this is the shape the ARIA practices give for a
        list of cards with one action each.
      */}
      <div className="mt-1">{action(titleId)}</div>
    </li>
  );
}

/** A card in the shape of the cards that are coming, never the empty state. */
export function ChoiceSkeleton() {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <Skeleton aria-hidden="true" className="h-4 w-40 max-w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-2/3" />
      <Skeleton aria-hidden="true" className="mt-1 h-9 w-24" />
    </li>
  );
}
