import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DataTableBody, DataTableCell, DataTableRow } from './DataTable';
import { useShownAfterDelay } from './skeletonDelay';

/**
 * Rows in the shape of the rows that are coming.
 *
 * **Loading is a state every region owes, and it is never the empty state**
 * (ADR 0039). It matches the region's own shape rather than being a spinner
 * because the point is that the table is about to be here: the columns do not
 * move when the data lands, so the screen does not jump.
 *
 * `aria-hidden` and a `role="status"` sentence beside it, rather than a grid of
 * announced placeholders — a screen reader has nothing to gain from seven empty
 * cells and everything to gain from the word "Loading".
 *
 * The delay lives in {@see useShownAfterDelay} rather than at every call site,
 * because "do not flash" is a property of the skeleton and not a decision each
 * screen should be able to get wrong. A caller renders it the moment it starts
 * fetching and that decides whether it is soon enough to be worth showing —
 * and that hook is where the line between a delaying skeleton and an immediate
 * one is now written down.
 */
export function TableSkeleton({ columns, rows = 4 }: { columns: number; rows?: number }) {
  const shown = useShownAfterDelay();

  if (!shown) {
    return null;
  }

  return (
    <DataTableBody>
      {Array.from({ length: rows }, (_, row) => (
        <DataTableRow key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <DataTableCell key={column} label="">
              {/*
                One announcement for the whole table, on the first cell of the
                first row. A `role="status"` per placeholder would say "Loading"
                once per cell, which is a screen reader reading a spinner
                twenty-eight times.
              */}
              {row === 0 && column === 0 ? (
                <span role="status" className="inline-flex items-center">
                  <span className="sr-only">{__('Loading…', 'wconvert')}</span>
                  <Skeleton aria-hidden="true" className="h-4 w-40 max-w-full" />
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="h-4 w-24 max-w-full" />
              )}
            </DataTableCell>
          ))}
        </DataTableRow>
      ))}
    </DataTableBody>
  );
}
