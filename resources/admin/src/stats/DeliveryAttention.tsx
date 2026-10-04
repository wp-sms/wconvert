import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { ReportDisclosure } from './ReportDisclosure';
import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import { __, _n, sprintf } from '@wordpress/i18n';
import { readDestinations, type DestinationsPayload } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { sendingIssuesHref } from '../nav';
import { Region, RegionHeader, RegionBody, RegionErrorState } from '../shell/Region';
import { Button } from '../components/ui/button';
/** Current operational evidence stays separate from historical performance windows. */
export function DeliveryAttention() {
  const [data, setData] = useState<DestinationsPayload>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void readDestinations().then(value => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (failed) return <Region><RegionHeader title={__('Sending needs attention', 'wconvert')} icon={<Send />} /><RegionErrorState message={__('Current sending health is unavailable.', 'wconvert')} hint={__('Open sending issues to review your connections.', 'wconvert')} action={<Button asChild variant="outline"><a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a></Button>} /></Region>;
  if (!data || issueCount(data) === 0) return null;
  const affected = data.destinations.filter(d => d.health.consecutive_failures > 0 || d.health.skipped_captures > 0 || d.availability !== 'ready' || data.failures.some(f => f.destination === d.id));
  return <Region className="wa-report"><RegionHeader title={__('Sending needs attention', 'wconvert')} icon={<Send />} trailing={<Badge variant="outline">{__('Current status', 'wconvert')}</Badge>} />
    <RegionBody className="wa-report-setting"><div><strong>{sprintf(_n('%d destination needs review', '%d destinations need review', issueCount(data), 'wconvert'), issueCount(data))}</strong><p className="wa-muted">{__('Check connections and recent failures. This status is independent of the report dates.', 'wconvert')}</p></div>
      <div className="wconvert-toolbar"><Button variant="outline" asChild><a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a></Button></div>
    </RegionBody>
    <ReportDisclosure title={__('Affected destinations', 'wconvert')}>
      <DataTable label={__('Destinations needing review', 'wconvert')}><DataTableHead><DataTableColumn>{__('Destination', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Last recorded issue', 'wconvert')}</DataTableColumn></DataTableHead><DataTableBody>{affected.map(d => <DataTableRow key={d.id}><DataTableCell label={__('Destination', 'wconvert')}>{d.label}</DataTableCell><DataTableCell label={__('Last recorded issue', 'wconvert')}>{[d.health.last_error_at, d.health.last_skipped_at, ...data.failures.filter(f => f.destination === d.id).map(f => f.at)].filter((at): at is string => at !== null && Number.isFinite(Date.parse(at.replace(' ', 'T')))).sort((a, b) => Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T')))[0] ?? __('Setup needs review', 'wconvert')}</DataTableCell></DataTableRow>)}</DataTableBody></DataTable>
    </ReportDisclosure>
  </Region>;
}
