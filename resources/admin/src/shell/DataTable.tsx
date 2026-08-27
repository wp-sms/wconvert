import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * A table that becomes a list of row-cards below 640px, **without stopping
 * being a table** (ADR 0039).
 *
 * The transformation is entirely in `index.css`: one media query turns the
 * table elements into blocks, hides the header row visually, and draws each
 * cell as a label-and-value pair off `data-label`. Nothing here changes with the
 * viewport, and no JavaScript measures anything.
 *
 * **640px is the table's own number.** ADR 0038 owns 782 (the builder's floor)
 * and 360 (a floor, not a breakpoint), and a table reusing either would make one
 * number mean two things. The two alternatives were refused on what they cost
 * the reader: horizontal scroll makes a lead log something you drag sideways,
 * and column hiding decides for the merchant which of their own columns matter.
 *
 * **Every role is written out, and that is the load-bearing detail.**
 * `display: block` on a `<tr>` can take its implicit `row` role with it in a
 * real browser — so a stylesheet would have quietly removed the table from the
 * accessibility tree, on the narrow viewport, where nobody is running a screen
 * reader against a checked layout. Explicit roles survive the display change,
 * and they are also what keeps `lead-log.test.tsx`'s `findByRole('row', …)`
 * honest rather than accidentally passing on jsdom's implicit ones.
 *
 * The register is defined once in `index.css` rather than as utilities here,
 * because Tailwind's utilities are `!important` (ADR 0035) and a `py-3` on a
 * cell would beat every padding the row-card treatment needs to change.
 */
export function DataTable({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <table role="table" className={cn('wconvert-table', className)}>
      {children}
    </table>
  );
}

/**
 * The column names, muted, in the small-caps label register.
 *
 * It renders the `<tr>` itself: a header row is always exactly one row, and
 * making callers spell it is an invitation to put two there.
 */
export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead role="rowgroup">
      <tr role="row">{children}</tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody role="rowgroup">{children}</tbody>;
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr role="row">{children}</tr>;
}

/**
 * One column name.
 *
 * `numeric` right-aligns it and its cells together — a column of counts is read
 * by comparing lengths, so the heading has to move with the numbers or it stops
 * naming them.
 */
export function DataTableColumn({
  numeric = false,
  className,
  children,
}: {
  numeric?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <th role="columnheader" scope="col" className={cn(numeric && 'is-numeric', className)}>
      {children}
    </th>
  );
}

/**
 * One value, carrying the label it is shown under when the table is a card.
 *
 * **`label` is required and is not the same string as the column heading by
 * accident** — it is the same string, passed twice, because the two are read in
 * different places and a cell that loses its label below 640px is a value with
 * nothing saying what it is. A screen that finds itself wanting to omit one is a
 * screen with a column it cannot name.
 */
export function DataTableCell({
  label,
  numeric = false,
  className,
  children,
}: {
  label: string;
  numeric?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td role="cell" data-label={label} className={cn(numeric && 'is-numeric', className)}>
      {children}
    </td>
  );
}

/**
 * The trailing Actions cell — the one place a row's own actions live.
 *
 * It takes no `data-label`: below 640px it becomes the card's footer, under a
 * rule, and a heading reading "Actions" above two buttons is a label for
 * something that is already labelled.
 *
 * More than two controls collapse into an overflow menu rather than widening
 * this cell, which is the rule and not this component's business.
 *
 * The row inside it is laid out from `index.css` rather than by utilities,
 * because its alignment FLIPS below 640px — trailing edge in a table, leading
 * edge in a card, where the actions sit under the card's own rule. A Tailwind
 * `justify-end` is an `!important` declaration a media query cannot take back.
 */
export function DataTableActions({ children }: { children: ReactNode }) {
  return (
    <td role="cell" className="wconvert-table__actions">
      <div className="wconvert-table__actions-row">{children}</div>
    </td>
  );
}
