import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { optinsHref } from '../nav';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Shell } from '../shell/Shell';
import { StatRowSkeleton } from '../shell/Stat';

/** The occasion page's way back to Campaigns. */
export function OccasionBack() {
  return (
    <Button asChild variant="ghost" className="-ms-3 self-start">
      <a href={optinsHref()}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Campaigns', 'wconvert')}</a>
    </Button>
  );
}

/**
 * The occasion page while it loads. Outside its chunk, so the page's own code
 * arriving and its reads in flight are the one placeholder, not two.
 *
 * It is the loaded page's frame: the dates line under the title and the two
 * header actions are reserved, and the body is the three regions the page
 * draws — Results with its three numbers, Dates, and the campaigns table under
 * its own column names. One region of six lines stood in for all of it, so the
 * header grew a line and the body was rebuilt when the occasion landed.
 */
export function OccasionSkeleton() {
  const control = (className: string) => <Skeleton aria-hidden="true" className={className} style={{ blockSize: 'var(--control-height)' }} />;
  return <Shell section="optins" pageTitle={__('Occasion', 'wconvert')} pageBack={<OccasionBack />}
    pageDescription={<Skeleton inline aria-hidden="true" className="inline-block h-[1lh] w-full max-w-56 align-top" />}
    actions={<><Skeleton aria-hidden="true" className="size-12" /><Skeleton aria-hidden="true" className="h-12 w-[266px] min-w-0 shrink" /></>}>
    <div className="flex flex-col gap-5">
      <RegionSkeleton label={__('Results', 'wconvert')} trailing={control('w-44')}>
        <StatRowSkeleton stats={3} />
      </RegionSkeleton>
      {/* The timeline: its day axis, a lane per campaign, and the key under them. */}
      <RegionSkeleton label={__('Dates', 'wconvert')}>
        <div aria-hidden="true" className="grid gap-3">
          <Skeleton className="ms-[200px] h-[1lh] w-auto text-note max-sm:ms-0" />
          {[0, 1, 2].map((lane) => <div key={lane} className="flex items-center gap-4">
            <Skeleton className="h-[1lh] w-[184px] shrink-0 max-sm:w-24" />
            <Skeleton className="h-5 flex-1" />
          </div>)}
          <Skeleton className="mt-2 h-[1lh] w-full max-w-80" />
        </div>
      </RegionSkeleton>
      <RegionSkeleton label={__('Campaigns', 'wconvert')} flush>
        <DataTable className="wconvert-campaign-table is-occasion">
          <DataTableHead>
            <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
            <DataTableColumn>{__('Dates', 'wconvert')}</DataTableColumn>
            <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn>
            <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
          </DataTableHead>
          <DataTableBody>
            {[0, 1].map((row) => <DataTableRow key={row} className="wconvert-campaign-row">
              <DataTableCell label="" className="wconvert-campaign-identity">
                <div className="wconvert-campaign-thumbnail" aria-hidden="true"><div className="wconvert-preview-placeholder" /></div>
                <div className="min-w-0 flex-1"><Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-36" /><Skeleton aria-hidden="true" className="mt-1 h-[1lh] w-16 text-micro" /></div>
              </DataTableCell>
              <DataTableCell label=""><Skeleton aria-hidden="true" className="h-[1lh] w-full max-w-28" /><Skeleton aria-hidden="true" className="mt-1 h-[1lh] w-full max-w-40 text-note" /></DataTableCell>
              <DataTableCell label=""><Skeleton aria-hidden="true" className="h-[1lh] w-14" /></DataTableCell>
              <DataTableCell label="" numeric><Skeleton aria-hidden="true" className="ms-auto h-[1lh] w-20" /></DataTableCell>
              <DataTableActions><Skeleton aria-hidden="true" className="w-32" style={{ blockSize: 'var(--control-height)' }} /></DataTableActions>
            </DataTableRow>)}
          </DataTableBody>
        </DataTable>
      </RegionSkeleton>
    </div>
  </Shell>;
}
