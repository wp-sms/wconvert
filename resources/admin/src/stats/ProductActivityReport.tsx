import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Region, RegionBody, RegionHeader, RegionErrorState } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { EmptyState } from '../shell/EmptyState';
import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '../shell/DataTable';
import { ReportTarget } from './ReportNavigation';
import { ReportDisclosure } from './ReportDisclosure';
import { rangeLabel } from './reporting';
import { formatCount } from './format';
import type { DashboardPayload } from './api';
import { productModuleActive } from '../settings';

interface ProductReport {
  available: boolean; collecting: boolean; since: string | null;
  from: string; to: string; days: number; recorded_from: string | null;
  truncated: boolean; retention_days: number;
  rows: { id: number; name: string; shown: number; clicked: number; added: number }[];
}

export function ProductActivityReport({ id, period }: { id: string; period?: Pick<DashboardPayload, 'days' | 'month' | 'from' | 'to'> }) {
  const days = period?.days, month = period?.month, from = period?.from, to = period?.to;
  const key = `${id}:${days}:${month}:${from}:${to}`;
  const [stored, setStored] = useState<{ key: string; value: ProductReport } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const report = stored?.key === key ? stored.value : null;
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (days !== undefined && days > 0) { query.set('days', String(days)); query.set('complete', '1'); }
    if (month) query.set('month', month);
    setFailure(null);
    void apiFetch<ProductReport>({ path: `/wconvert/v1/optins/${id}/product-stats?${query}`, signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return;
        if (from && (value.from !== from || value.to !== to)) { setFailure(key); return; }
        setStored({ key, value });
      }).catch(() => { if (!controller.signal.aborted) setFailure(key); });
    return () => controller.abort();
  }, [id, key, days, month, from, to, retry]);
  // A site with neither product module rarely has activity — only what a
  // removed Pro left behind — so it waits quietly instead of flashing a
  // placeholder for a report that almost always stays away.
  const quiet = !productModuleActive();
  if (!report && failure !== key) return quiet ? null : <RegionSkeleton label={__('Product activity', 'wconvert')} lines={3} />;
  if (quiet && failure === key) return null;
  if (report && !report.available && failure !== key) return null;
  return <ReportTarget name="products" label={__('Product activity', 'wconvert')}><Region className="wa-report">
    <RegionHeader title={__('Product activity', 'wconvert')} level={3} icon={<Package />} description={__('See which products shoppers notice and add.', 'wconvert')} />
    {failure === key ? <RegionErrorState message={__('Could not load product activity.', 'wconvert')} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} /> : report && <>
      <RegionBody>
        <div className="wa-report-meta"><span>{rangeLabel(report.from, report.to)}</span>{!period && <span>{__('Includes today', 'wconvert')}</span>}</div>
        {report.since && <p className="wa-muted">{sprintf(__('Tracking started %s. Earlier product activity is unavailable.', 'wconvert'), rangeLabel(report.since, report.since))}</p>}
        {!report.collecting && <p className="wa-report-notice">{__('Tracking is unavailable. Saved activity is still shown.', 'wconvert')}</p>}
        {report.recorded_from && report.recorded_from !== report.from && report.recorded_from !== report.since && <p className="wa-report-notice">{sprintf(__('Available activity: %s. The rest of this period is not recorded or has expired.', 'wconvert'), rangeLabel(report.recorded_from, report.to))}</p>}
        {report.truncated ? <EmptyState icon={Package} title={__('Choose a shorter period', 'wconvert')}>{__('More than 100 products have activity. Narrow the dates to see a complete table.', 'wconvert')}</EmptyState>
          : report.days === 0 ? <EmptyState icon={Package} title={__('No complete days yet', 'wconvert')}>{__('Today’s activity will appear tomorrow.', 'wconvert')}</EmptyState>
          : !report.recorded_from ? <EmptyState icon={Package} title={__('No product data for these dates', 'wconvert')}>{__('Choose dates after tracking started and within the last 90 days.', 'wconvert')}</EmptyState>
          : report.rows.length === 0 ? <EmptyState icon={Package} title={__('No product activity recorded', 'wconvert')}>{__('Activity appears when shoppers see or use recommendations. Previews do not count.', 'wconvert')}</EmptyState>
          : <DataTable className="wa-product-table" label={__('Recommended product activity', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Product', 'wconvert')}</DataTableColumn>{[__('Shown', 'wconvert'), __('Clicked', 'wconvert'), __('Added', 'wconvert')].map(label => <DataTableColumn key={label} numeric>{label}</DataTableColumn>)}</DataTableHead>
            <DataTableBody>{report.rows.map(row => <DataTableRow key={row.id}>
              <DataTableCell label={__('Product', 'wconvert')}><div><strong>{row.name}</strong><small className="block wa-muted">{sprintf(__('Product #%d', 'wconvert'), row.id)}</small></div></DataTableCell>
              <DataTableCell numeric label={__('Shown', 'wconvert')}>{formatCount(row.shown)}</DataTableCell>
              <DataTableCell numeric label={__('Clicked', 'wconvert')}>{formatCount(row.clicked)}</DataTableCell>
              <DataTableCell numeric label={__('Added', 'wconvert')}>{formatCount(row.added)}</DataTableCell>
            </DataTableRow>)}</DataTableBody>
          </DataTable>}
      </RegionBody>
      <ReportDisclosure title={__('What these numbers mean', 'wconvert')}>
        <p>{__('Shown counts a visible product card. Clicked counts a product-page link. Each counts once per product per campaign appearance. Added counts WooCommerce-confirmed additions, not button presses or purchases.', 'wconvert')}</p>
        <p>{__('These are recorded actions, not unique shoppers. Totals can differ from campaign results. Product names are current; sales remain at campaign level.', 'wconvert')}</p>
        <p>{sprintf(__('Product activity is kept for %d days. Tracking can miss activity when blocked or inactive; the first day may be partial. Older campaign totals stay unchanged.', 'wconvert'), report.retention_days)}</p>
      </ReportDisclosure>
    </>}
  </Region></ReportTarget>;
}
