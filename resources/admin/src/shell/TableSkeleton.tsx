import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DataTableBody, DataTableCell, DataTableRow } from './DataTable';

/**
 * How long a fetch may take before anything is drawn to say it is happening.
 *
 * **A skeleton that flashes is worse than no skeleton.** A local REST call lands
 * in tens of milliseconds, and a placeholder that appears and vanishes inside
 * one is a screen that flickers on every filter change. 160ms is under the
 * threshold where a person reads a delay as the interface being slow, and over
 * the time a fast response takes — so the skeleton appears exactly when there is
 * a wait worth acknowledging.
 */
const DELAY_MS = 160;

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
 * The delay lives here rather than at every call site, because "do not flash"
 * is a property of the skeleton and not a decision each screen should be able
 * to get wrong. A caller renders it the moment it starts fetching and this
 * decides whether that is soon enough to be worth showing.
 */
export function TableSkeleton({ columns, rows = 4 }: { columns: number; rows?: number }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

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
