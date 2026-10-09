import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { ReportDisclosure } from './ReportDisclosure';
import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import { __, _n, sprintf } from '@wordpress/i18n';
import { readDestinations, type DestinationsPayload } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { sendingIssuesHref } from '../nav';
import { Region, RegionHeader, RegionBody, RegionErrorState } from '../shell/Region';
import { Button } from '../components/ui/button';
import { formatWhen } from '../lib/format';
import { wallKey } from '../lib/wallTime';
/** Current operational evidence stays separate from historical performance windows. */
export function DeliveryAttention() {
  const [data, setData] = useState<DestinationsPayload>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void readDestinations().then(value => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [retry]);
  if (failed && !data) return <Region><RegionHeader title={__('Sending needs attention', 'wconvert')} icon={<Send />} /><RegionErrorState message={__('Could not check how sending is going.', 'wconvert')} onRetry={() => setRetry(n => n + 1)} /></Region>;
  if (!data || issueCount(data) === 0) return null;
  // Stored times are site wall times; the newest across the three sources wins.
  const lastIssue = (id: string) => {
    const destination = data.destinations.find(d => d.id === id)!;
    const newest = [destination.health.last_error_at, destination.health.last_skipped_at, ...data.failures.filter(f => f.destination === id).map(f => f.at)]
      .map(at => (at ? wallKey(at) : null)).filter((at): at is string => at !== null).sort().at(-1);
    return newest === undefined ? null : formatWhen(newest, 'detail');
  };
  const affected = data.destinations.filter(d => d.health.consecutive_failures > 0 || d.health.skipped_captures > 0 || d.availability !== 'ready' || data.failures.some(f => f.destination === d.id));
  return <Region className="wa-report"><RegionHeader title={__('Sending needs attention', 'wconvert')} icon={<Send />} />
    <RegionBody className="wa-report-setting"><div><strong>{sprintf(_n('%d destination needs review', '%d destinations need review', issueCount(data), 'wconvert'), issueCount(data))}</strong><p className="wa-muted">{__('Current status, not limited to the report dates.', 'wconvert')}</p></div>
      <div className="wconvert-toolbar"><Button variant="outline" asChild><a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a></Button></div>
    </RegionBody>
    <ReportDisclosure title={__('Affected destinations', 'wconvert')}>
      <DataTable label={__('Destinations needing review', 'wconvert')}><DataTableHead><DataTableColumn>{__('Destination', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Last recorded issue', 'wconvert')}</DataTableColumn></DataTableHead><DataTableBody>{affected.map(d => <DataTableRow key={d.id}><DataTableCell label={__('Destination', 'wconvert')}><bdi>{d.label || __('Unnamed destination', 'wconvert')}</bdi></DataTableCell><DataTableCell label={__('Last recorded issue', 'wconvert')}>{lastIssue(d.id) ?? __('Setup needs review', 'wconvert')}</DataTableCell></DataTableRow>)}</DataTableBody></DataTable>
    </ReportDisclosure>
  </Region>;
}
