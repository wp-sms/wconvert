import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Region, RegionBody, RegionHeader, RegionError, RegionErrorState } from '../shell/Region';
import { Button } from '../components/ui/button';
import type { DashboardPayload } from '../stats/api';
interface Report {
  rows: { scope: string; kind: string; total: string }[];
  definitions: Record<string, Record<string, { name: string; order: number }>>;
  from: string; to: string; days: number; truncated: boolean;
}
const labels: Record<string, string> = {
  screen_shown: __('Shown', 'wconvert'), screen_advanced: __('Completed', 'wconvert'),
  screen_skipped: __('Skipped', 'wconvert'), screen_dismissed: __('Dismissed', 'wconvert'),
};
export function JourneyReport({ id, period }: { id: string; period?: Pick<DashboardPayload, 'days' | 'month' | 'from' | 'to'> }) {
  const [stored, setReport] = useState<(Report & { campaign: string }) | null>(null);
  const report = stored?.campaign === id && period?.days !== 0 ? stored : null;
  const [updating, setUpdating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const days = period?.days, month = period?.month, from = period?.from, to = period?.to;
  useEffect(() => {
    const controller = new AbortController(); setUpdating(true); setFailed(false);
    if (days === 0) return () => controller.abort();
    const query = new URLSearchParams();
    if (days !== undefined) { query.set('days', String(days)); query.set('complete', '1'); }
    if (month) query.set('month', month);
    void apiFetch<Report>({ path: `/wconvert/v1/optins/${id}/journey-stats?${query}`, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { if (from && (value.from !== from || value.to !== to)) setFailed(true); else setReport({ ...value, campaign: id }); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setUpdating(false); });
    return () => controller.abort();
  }, [id, days, month, from, to, retry]);
  const Failure = report ? RegionError : RegionErrorState;
  return <Region>
    <RegionHeader title={__('Signup and screen activity', 'wconvert')} level={3} description={report ? `${report.from} – ${report.to}${period ? '' : ` · ${__('Includes today', 'wconvert')}`}` : undefined} />
    <RegionBody>
      <p className="text-note">{__('Activity totals can overlap. They do not measure unique visitors or exact abandonment. Screen versions are reported separately.', 'wconvert')}</p>
      {updating && report && <p role="status">{__('Updating activity. Showing the dates above.', 'wconvert')}</p>}
      {failed && <Failure message={__('Could not load matching journey totals. Any activity below still uses its displayed dates.', 'wconvert')} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />}
      {days === 0 ? <p>{__('No complete days in this period.', 'wconvert')}</p>
        : report === null ? (failed ? null : <p role="status">{__('Loading activity…', 'wconvert')}</p>)
        : report.rows.length === 0 ? <p>{__('No journey activity in this period.', 'wconvert')}</p> : <>
          {report.truncated && <p>{__('Showing the first 5,000 activity rows. Choose a shorter period for a complete view.', 'wconvert')}</p>}
          <DataTable label={__('Journey activity', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Channel or screen', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Activity', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Total', 'wconvert')}</DataTableColumn></DataTableHead>
              <DataTableBody>{report.rows.map(row => {
                const [group, revision, screen] = row.scope.split(':');
                const name = group === 'channel' ? (revision === 'email_marketing' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert'))
                  : `${report.definitions[revision]?.[screen]?.name ?? __('Screen', 'wconvert')} · ${sprintf(__('Version %d', 'wconvert'), Object.keys(report.definitions).indexOf(revision) + 1)}`;
                return <DataTableRow key={`${row.scope}:${row.kind}`}><DataTableCell label={__('Channel or screen', 'wconvert')}>{name}</DataTableCell><DataTableCell label={__('Activity', 'wconvert')}>{labels[row.kind] ?? __('Accepted', 'wconvert')}</DataTableCell><DataTableCell label={__('Total', 'wconvert')} numeric>{Number(row.total).toLocaleString()}</DataTableCell></DataTableRow>;
              })}</DataTableBody></DataTable></>}
    </RegionBody>
  </Region>;
}
