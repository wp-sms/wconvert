import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DataTableActions, DataTableBody, DataTableCell, DataTableRow } from '../shell/DataTable';
import { useShownAfterDelay } from '../shell/skeletonDelay';

/** Reserve the same preview, fields and actions in both campaign layouts. */
export function CampaignSkeleton() {
  const shown = useShownAfterDelay();
  if (!shown) return null;
  return <DataTableBody>
    {[0, 1, 2, 3].map((row) => <DataTableRow key={row} className="wconvert-campaign-row">
      <DataTableCell label={__('Campaign', 'wconvert')} className="wconvert-campaign-identity">
        <div className="wconvert-preview-button" aria-hidden="true"><Skeleton className="wconvert-campaign-thumbnail" /></div>
        <div className="min-w-0 flex-1">
          {row === 0 && <span role="status" className="sr-only">{__('Loading campaigns…', 'wconvert')}</span>}
          <Skeleton aria-hidden="true" className="w-32 max-w-full" style={{ blockSize: '1lh' }} />
          <Skeleton aria-hidden="true" className="mt-2 w-24 max-w-full" style={{ blockSize: '1lh' }} />
        </div>
      </DataTableCell>
      <DataTableCell label={__('Status', 'wconvert')} className="wconvert-campaign-state"><Skeleton aria-hidden="true" className="w-20 max-w-full" style={{ blockSize: '1lh' }} /></DataTableCell>
      <DataTableCell label={__('Results', 'wconvert')} className="wconvert-campaign-results"><Skeleton aria-hidden="true" className="w-16 max-w-full" style={{ blockSize: '1lh' }} /></DataTableCell>
      <DataTableActions className="wconvert-campaign-row-actions"><Skeleton aria-hidden="true" className="w-32 max-w-full" style={{ blockSize: 'var(--control-height-sm)' }} /></DataTableActions>
    </DataTableRow>)}
  </DataTableBody>;
}
