import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Region, RegionBody } from '../shell/Region';

/**
 * The Leads screen before its first read: the purpose strip, the filters, the
 * toolbar and the table under its own column names.
 *
 * **One component is the chunk's fallback and the log's first load.** It is
 * outside the Leads chunk so {@see LeadsSection} can draw it while the code
 * downloads, and {@see LeadLog} draws it again until the first page arrives.
 * A bare table stood in for the chunk and the loaded screen then put filters
 * and a toolbar above it, so the rows dropped by a band on hand-off.
 *
 * The headings are real: they are known before any data is, and a header row
 * is what puts each bar under the word it will be. Details is left out because
 * it is drawn only when a row on the page has some, and a newsletter's do not.
 */
export function LeadLogSkeleton() {
  const bar = (className: string, height = 'var(--control-height)') => <Skeleton className={className} style={{ blockSize: height }} />;
  const label = <Skeleton className="h-[1lh] w-20 text-body leading-snug" />;
  return <div className="flex flex-col gap-5">
    <Region label={__('Submissions', 'wconvert')}>
      <span role="status" className="sr-only">{__('Loading submissions…', 'wconvert')}</span>
      <div aria-hidden="true">
        <RegionBody className="flex flex-col gap-4">
          <div className="wconvert-option-strip wconvert-option-strip--scroll">
            {['w-36', 'w-28', 'w-24'].map((width) => <span key={width}>{bar(width, 'var(--control-height-sm)')}</span>)}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-64">{bar('min-w-0 flex-1')}{bar('w-24 shrink-0 max-sm:w-9')}</div>
            <div className="flex min-w-0 grow basis-28 flex-col gap-1.5 sm:grow-0 sm:basis-auto">{label}{bar('w-full sm:w-64')}</div>
            <div className="flex min-w-0 flex-col gap-1.5">{label}{bar('w-32')}</div>
          </div>
        </RegionBody>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
          <span className="flex min-h-[33px] items-center gap-2"><Skeleton className="size-4 rounded-sm" /><Skeleton className="h-[1lh] w-40 text-body" /></span>
          {/* The order select and Export are the toolbar's small controls. */}
          <span className="flex gap-3">{bar('w-32', 'var(--control-height-sm)')}{bar('w-28', 'var(--control-height-sm)')}</span>
        </div>
      </div>
      {/* The status above speaks for it; a header row over empty bars is a table read aloud. */}
      <div aria-hidden="true">
      <DataTable>
        <DataTableHead>
          <DataTableColumn>{__('Submitted by', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Submitted', 'wconvert')}</DataTableColumn>
          <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
        </DataTableHead>
        <DataTableBody>
          {[0, 1, 2, 3].map((row) => <DataTableRow key={row}>
            <DataTableCell label="">
              {/* The person's avatar, name and contact: `LeadIdentity`'s shape. */}
              <span className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <span className="grid min-w-0 gap-1"><Skeleton className="h-[1lh] w-36 max-w-full" /><Skeleton className="h-[1lh] w-56 max-w-full text-note" /></span>
              </span>
            </DataTableCell>
            <DataTableCell label=""><Skeleton className="h-[1lh] w-24 max-w-full" /></DataTableCell>
            <DataTableCell label=""><Skeleton className="h-[1lh] w-28 max-w-full" /></DataTableCell>
            <DataTableActions><Skeleton className="size-8" /></DataTableActions>
          </DataTableRow>)}
        </DataTableBody>
      </DataTable>
      </div>
    </Region>
  </div>;
}
