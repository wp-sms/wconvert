import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import { ReportTarget } from './ReportNavigation';
import { Route } from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { ReportDisclosure } from './ReportDisclosure';
import { rangeLabel } from './reporting';
import { formatCount } from './format';
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
  if (!report && !failed && days !== 0) return <RegionSkeleton label={__('Signup and screen activity', 'wconvert')} lines={3} />;
  const Failure = report ? RegionError : RegionErrorState;
  const channels = report?.rows.filter(row => row.scope.startsWith('channel:')) ?? [];
  const screens = new Map<string, Record<string, number>>();
  for (const row of report?.rows ?? []) {
    if (!row.scope.startsWith('screen:')) continue;
    const counts = screens.get(row.scope) ?? {};
    counts[row.kind] = Number(row.total);
    screens.set(row.scope, counts);
  }
  return <ReportTarget name="activity" label={__('Screen activity', 'wconvert')}><Region className="wa-report">
    <RegionHeader title={__('Signup and screen activity', 'wconvert')} level={3} icon={<Route />} description={__('See which screens were shown and which actions followed.', 'wconvert')} />
    {failed && <Failure message={__('Could not load matching journey totals. Activity below still uses its displayed dates.', 'wconvert')} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />}
    {days === 0 ? <EmptyState icon={Route} title={__('No complete days yet', 'wconvert')}>{__('Today’s activity will appear tomorrow.', 'wconvert')}</EmptyState> : report && <>
      <RegionBody>
        <div className="wa-report-meta"><span>{rangeLabel(report.from, report.to)}</span>{!period && <span>{__('Includes today', 'wconvert')}</span>}{updating && <span role="status">{__('Updating… Previous dates shown.', 'wconvert')}</span>}</div>
        {report.rows.length === 0 ? <EmptyState icon={Route} title={__('No activity in this period', 'wconvert')}>{__('This report fills as visitors use your published campaign’s signup and question screens.', 'wconvert')}</EmptyState> : <>
          {report.truncated && <p className="wa-report-notice">{__('Showing the first 5,000 activity rows. Choose a shorter period for a complete view.', 'wconvert')}</p>}
          {channels.length > 0 && <DataTable label={__('Accepted signups', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Signup', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Accepted', 'wconvert')}</DataTableColumn></DataTableHead>
            <DataTableBody>{channels.map(row => <DataTableRow key={`${row.scope}:${row.kind}`}><DataTableCell label={__('Signup', 'wconvert')}>{row.scope === 'channel:email_marketing' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert')}</DataTableCell><DataTableCell label={__('Accepted', 'wconvert')} numeric>{formatCount(Number(row.total))}</DataTableCell></DataTableRow>)}</DataTableBody>
          </DataTable>}
          {screens.size > 0 && <DataTable label={__('Screen activity', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Screen', 'wconvert')}</DataTableColumn>{[__('Shown', 'wconvert'), __('Completed', 'wconvert'), __('Skipped', 'wconvert'), __('Dismissed', 'wconvert')].map(label => <DataTableColumn numeric key={label}>{label}</DataTableColumn>)}</DataTableHead>
            <DataTableBody>{Array.from(screens, ([scope, counts]) => {
              const [, revision, screen] = scope.split(':');
              const definition = report.definitions[revision]?.[screen];
              const version = Object.keys(report.definitions).indexOf(revision) + 1;
              return <DataTableRow key={scope}><DataTableCell label={__('Screen', 'wconvert')}><strong>{definition?.name ?? __('Screen', 'wconvert')}</strong><small className="block wa-muted">{version > 0 ? sprintf(__('Version %d', 'wconvert'), version) : __('Earlier version', 'wconvert')}</small></DataTableCell>
                {Object.entries({ screen_shown: __('Shown', 'wconvert'), screen_advanced: __('Completed', 'wconvert'), screen_skipped: __('Skipped', 'wconvert'), screen_dismissed: __('Dismissed', 'wconvert') }).map(([kind, label]) => <DataTableCell label={label} numeric key={kind}>{counts[kind] === undefined ? '—' : formatCount(counts[kind])}</DataTableCell>)}
              </DataTableRow>;
            })}</DataTableBody>
          </DataTable>}
        </>}
      </RegionBody>
      <ReportDisclosure title={__('How to read this activity', 'wconvert')}>
        <p>{__('Counts are activity, not unique visitors. The same visitor can complete, skip or dismiss different screens, so these totals do not measure abandonment.', 'wconvert')}</p>
        <p>{__('Versions stay separate when a screen changes. A dash means no recorded activity for that action; it is not an inferred zero.', 'wconvert')}</p>
      </ReportDisclosure>
    </>}
  </Region></ReportTarget>;
}
