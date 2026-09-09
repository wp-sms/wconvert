import type { ReactNode } from 'react';

/**
 * The strip at the top of a region, holding only what is scoped to **that
 * region** (ADR 0039).
 *
 * That scoping is the whole of it. The Leads filter row held an Optin
 * `<select>`, a grouping checkbox and the screen's CSV export in one line,
 * because that is where there was room — so the one control acting on the whole
 * screen sat between two that act on one table, and none of the three read as
 * what it was. Export CSV is page-scoped and moved to the page header; what is
 * left here qualifies the region under it, which is what a toolbar is for.
 *
 * **Filters lead, the count trails.** A count is a fact about the set the region
 * is showing and changes when the filters change, so the two belong on one line
 * with the controls that move the number on the left of it — reading order,
 * cause then effect.
 *
 * `.wconvert-toolbar` is what sizes the controls inside it to
 * `--control-height-sm`; see `index.css`. The class is the rule's subject, so a
 * control added here later inherits the height without anybody remembering to
 * pass a size.
 */
export function Toolbar({
  children,
  trailing,
  dense = false,
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  /**
   * Spend the builder card's gutter instead of the screen's own inset.
   *
   * **A toolbar inside a card is not a toolbar across a screen.** `px-4` is
   * right where this strip spans the page — the Lead log's filters, the design
   * picker's — and 16px where every band under it is 8 is the top of the five
   * steps the card's left edge took on the way down. The builder passes it;
   * `LeadLog` and `TemplatePicker` do not, and are untouched.
   *
   * The number lives in `index.css` rather than as a second Tailwind class,
   * because `px-4` compiles to `!important` in the utilities layer and only a
   * layered `!important` rule beats it — the recipe ADR 0042 rule 6 states and
   * this file already spends four times over.
   */
  dense?: boolean;
}) {
  return (
    <div
      className={`wconvert-toolbar${
        dense ? ' wconvert-toolbar--dense' : ''
      } flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
      {trailing !== undefined && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{trailing}</div>
      )}
    </div>
  );
}

/**
 * How many rows the set has, as **one text node**.
 *
 * One node is a design decision and a test constraint at once, and they agree.
 * `lead-log.test.tsx` asserts `findByText('7 submissions')`; splitting the
 * number away from its noun to style them differently would break it, and the
 * reason it would break is the reason not to — a number whose unit is a
 * separate element is a number a screen can eventually render without its unit,
 * and on the Lead log the unit is the only thing stopping it being read as a
 * count of *people* (ADR 0021).
 *
 * **A count is stated only where the set can be large enough to need one.** The
 * Optin list has none and is not missing one — and the design picker draws its
 * whole toolbar, count included, on the same test.
 */
export function ToolbarCount({
  children,
  hint,
  live = false,
}: {
  children: string;
  hint?: string;
  /**
   * Speak the number when it changes.
   *
   * **For a count that moves without the page moving.** The design picker's
   * chips filter the grid under a toolbar that keeps focus exactly where it
   * was, so a screen-reader user presses *Side by side* and is told nothing at
   * all — the content changed and nothing announced it (ADR 0038).
   *
   * Off by default, because most counts here change only as the result of a
   * navigation the reader already heard: the Lead log's number arrives with a
   * new table, and announcing it again would be the same fact twice.
   */
  live?: boolean;
}) {
  return (
    <span
      className="tabular-nums text-muted-foreground"
      title={hint}
      aria-live={live ? 'polite' : undefined}
    >
      {/*
        **The count keeps a text node of its own**, so it is still findable as
        exactly the words it says. Folding the hint in beside it would make the
        element's text "7 submissions One row is…", which is not what anything
        reading this number is looking for.
      */}
      <span>{children}</span>
      {/*
        **The hint is a `title` AND a sentence in the accessibility tree.** A
        `title` alone is a pointer-only affordance — no keyboard reaches it and
        support in screen readers is uneven — and what it says here is a
        correction to how the number reads, which is exactly the reader who
        must not miss it.
      */}
      {hint !== undefined && <span className="sr-only"> {hint}</span>}
    </span>
  );
}
