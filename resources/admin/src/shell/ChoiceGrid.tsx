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
  current = false,
  action,
}: {
  id: string;
  title: string;
  notes: string;
  badge?: ReactNode;
  /**
   * This card is the one already in use.
   *
   * **`aria-current` and not a colour**, which is the rule the design gallery
   * already follows: selection said only by a border is selection said only to
   * people who can see it. It arrived with the second screen that picks a
   * [[Goal]] (ADR 0059) — the creation flow has no "already chosen" state,
   * because nothing exists yet to have chosen one.
   */
  current?: boolean;
  action: (describedBy: string) => ReactNode;
}) {
  const titleId = `wconvert-choice-${id}`;

  return (
    <li
      aria-current={current ? 'true' : undefined}
      className={`wconvert-choice flex flex-col gap-2 rounded-md border border-border bg-card p-4${current ? ' is-chosen' : ''}`}
    >
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
      <div>{action(titleId)}</div>
    </li>
  );
}

/**
 * A card in the shape of the cards that are coming, never the empty state.
 *
 * **`gap-2` because {@see ChoiceCard} is `gap-2`.** It was `gap-3` with an
 * extra `mt-1` before the action, against the card's `gap-2` and its own
 * `mt-1` — so the placeholder was four pixels taller per row than the thing it
 * stands for, and the grid moved when the data landed. That is the one claim
 * this component exists to make.
 */
export function ChoiceSkeleton() {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <Skeleton aria-hidden="true" className="h-4 w-40 max-w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-2/3" />
      <Skeleton aria-hidden="true" className="h-9 w-24" />
    </li>
  );
}
