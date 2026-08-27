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
export function Toolbar({ children, trailing }: { children?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="wconvert-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
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
 * Optin list has none and is not missing one.
 */
export function ToolbarCount({ children }: { children: string }) {
  return <span className="tabular-nums text-muted-foreground">{children}</span>;
}
