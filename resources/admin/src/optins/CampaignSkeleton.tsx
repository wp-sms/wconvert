import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { DataTableActions, DataTableBody, DataTableCell, DataTableRow } from '../shell/DataTable';
import { useShownAfterDelay } from '../shell/skeletonDelay';

/**
 * The campaign rows while they arrive, cell for cell under the five headings:
 * the select box, the picture and name, status, results and the next action.
 * A row of four cells in a five-column grid sat every bar one heading to the
 * left of where its value would land.
 *
 * The picture is the box {@see CampaignThumbnail} draws while a design's code
 * downloads, so skeleton, preview read and design chunk are one box until the
 * design is in. `wait` is for a re-read over rows already shown
 * ({@see useShownAfterDelay}); a first fill paints at once.
 */
export function CampaignSkeleton({ wait = false }: { wait?: boolean }) {
  const shown = useShownAfterDelay(wait);
  if (!shown) return null;
  return <DataTableBody>
    {[0, 1, 2, 3].map((row) => <DataTableRow key={row} className="wconvert-campaign-row">
      <DataTableCell label={__('Select', 'wconvert')} className="wconvert-campaign-select"><Skeleton aria-hidden="true" className="size-5 rounded-sm" /></DataTableCell>
      <DataTableCell label={__('Campaign', 'wconvert')} className="wconvert-campaign-identity">
        <div className="wconvert-preview-button" aria-hidden="true"><div className="wconvert-campaign-thumbnail"><div className="wconvert-preview-placeholder" /></div></div>
        <div className="min-w-0 flex-1">
          {row === 0 && <span role="status" className="sr-only">{__('Loading campaigns…', 'wconvert')}</span>}
          <Skeleton aria-hidden="true" className="w-full max-w-32" style={{ blockSize: '1lh' }} />
          <Skeleton aria-hidden="true" className="mt-1 w-full max-w-24 text-micro" style={{ blockSize: '1lh' }} />
        </div>
      </DataTableCell>
      <DataTableCell label={__('Status', 'wconvert')} className="wconvert-campaign-state"><Skeleton aria-hidden="true" className="w-full max-w-20" style={{ blockSize: '1lh' }} /></DataTableCell>
      <DataTableCell label={__('Results', 'wconvert')} numeric className="wconvert-campaign-results"><Skeleton aria-hidden="true" className="ms-auto w-full max-w-16" style={{ blockSize: '1lh' }} /></DataTableCell>
      <DataTableActions className="wconvert-campaign-row-actions"><Skeleton aria-hidden="true" className="w-full max-w-32" style={{ blockSize: 'var(--control-height)' }} /></DataTableActions>
    </DataTableRow>)}
  </DataTableBody>;
}
