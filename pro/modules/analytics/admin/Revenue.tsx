import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '@/shell/DataTable';
import { ReportTarget } from '@/stats/ReportNavigation';
import { ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RegionSkeleton } from '@/shell/RegionSkeleton';
import { EmptyState } from '@/shell/EmptyState';
import { InfoTip } from '@/shell/InfoTip';
import { ReportDisclosure } from '@/stats/ReportDisclosure';
import { reportHref } from '@/nav';
import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Region, RegionHeader, RegionBody, RegionFooter, RegionError, RegionErrorState } from '@/shell/Region';
import { Button } from '@/components/ui/button';
import type { ReportExtensionProps } from '@/stats/extensions';
import { formatCount } from '@/stats/format';
import { rangeLabel } from '@/stats/reporting';
interface Report {
  guide_url: string; available: boolean; consent_ready: boolean; site_matches: boolean;
  settings: { enabled: boolean; since: string | null };
  days?: number; month?: string; from?: string; to?: string; complete?: boolean; eligible_orders?: number; linked_orders?: number;
  currencies?: { currency: string; orders: number; amount: number | null; unallocated_refunds: number }[];
  orders?: { campaign: string; refunded: boolean; paid: string; status: string; id: number; currency: string; amount: number | null; url: string | null }[];
}
function money(amount: number | null, currency: string) {
  if (amount === null) return __('Unavailable', 'wconvert');
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(amount); }
  catch { return `${amount.toFixed(2)} ${currency}`; }
}
export default function Revenue({ period, optinId, campaignNames = {} }: ReportExtensionProps) {
  const [stored, setReport] = useState<(Report & { scope?: string }) | null>(null);
  const report = stored?.scope === optinId ? stored : null;
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setUpdating(true); setError('');
    const params = new URLSearchParams({ complete: '1', days: String(Math.max(1, period.days)) });
    if (period.month) params.set('month', period.month);
    if (optinId) params.set('optin_id', optinId);
    void apiFetch<Report>({ path: `/wconvert/v1/revenue?${params}`, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (data.from && (data.from !== period.from || data.to !== period.to)) throw new Error('period');
      setReport({ ...data, scope: optinId, month: period.month });
    }).catch(() => { if (!controller.signal.aborted) setError(__('Could not refresh campaign sales. Any totals below still use their displayed dates.', 'wconvert')); }).finally(() => { if (!controller.signal.aborted) setUpdating(false); });
    return () => controller.abort();
  }, [period.from, period.to, period.days, period.month, optinId, retry]);
  async function change(enabled: boolean) {
    setBusy(true); setError('');
    try { const saved = await apiFetch<{ settings: Report['settings'] }>({ path: '/wconvert/v1/revenue', method: 'POST', data: { enabled } }); setReport(previous => previous ? { ...previous, settings: saved.settings, site_matches: true } : previous); setRetry(n => n + 1); }
    catch { setError(__('Could not save this setting. Try again.', 'wconvert')); }
    finally { setBusy(false); }
  }
  if (!report && !error) return <RegionSkeleton label={__('Campaign sales', 'wconvert')} lines={3} />;
  if (report && !report.available) return report.settings.since ? <Region className="wa-report"><RegionHeader title={__('Campaign sales', 'wconvert')} icon={<ShoppingBag />} /><EmptyState icon={ShoppingBag} title={__('WooCommerce is unavailable', 'wconvert')}>{__('Activate WooCommerce to read sales. Your tracking settings are kept.', 'wconvert')}</EmptyState></Region> : null;
  const Failure = report ? RegionError : RegionErrorState;
  const enabled = !!report?.settings.enabled && report.site_matches;
  const firstSetup = report && !report.settings.since;
  const status = !enabled ? __('Tracking is off', 'wconvert') : !report.consent_ready ? __('Needs consent setup', 'wconvert') : __('Tracking is on', 'wconvert');
  const trackingControl = report && !optinId ? <Button variant={firstSetup ? 'default' : 'outline'} disabled={busy} onClick={() => void change(!enabled)}>{busy ? __('Saving…', 'wconvert') : enabled ? __('Turn off tracking', 'wconvert') : __('Turn on tracking', 'wconvert')}</Button> : null;
  return <ReportTarget name="sales" label={__('Sales', 'wconvert')}><Region className="wa-report">
    <RegionHeader title={__('Campaign sales', 'wconvert')} icon={<ShoppingBag />} description={__('Paid orders linked to your campaigns.', 'wconvert')} trailing={report && <Badge variant={enabled && !report.consent_ready ? 'warning' : 'outline'}>{status}</Badge>} />
    {error && <Failure message={error} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />}
    {report && <>
      {firstSetup ? <><RegionBody className="wa-sales-setup">
        <div><h3>{__('Link campaigns to paid orders', 'wconvert')}</h3><p className="wa-muted">{__('Link future orders to a signup or click. Earlier orders stay unlinked.', 'wconvert')}</p>
          <ol className="wa-setup-steps">
            <li><strong>{__('Set up consent', 'wconvert')}</strong><span>{report.consent_ready ? __('Consent integration detected. Visitors must still grant statistics consent.', 'wconvert') : __('Use a consent plugin that supports the WP Consent API.', 'wconvert')}</span></li>
            <li><strong>{__('Turn on tracking', 'wconvert')}</strong><span>{__('A signup or eligible click can link one checkout within 30 minutes.', 'wconvert')}</span></li>
          </ol>
        </div>
        </RegionBody><RegionFooter><div className="wa-report-actions">{trackingControl}{optinId && <Button asChild variant="outline"><a href={reportHref()}>{__('Open sales setup', 'wconvert')}</a></Button>}<a href={report.guide_url} target="_blank" rel="noreferrer">{__('Setup guide', 'wconvert')}</a></div>
      </RegionFooter></> : <>
        <RegionBody>
          <div className="wa-report-meta"><span>{report.from && report.to ? rangeLabel(report.from, report.to) : __('Report not loaded', 'wconvert')}</span><span>{__('By order paid date', 'wconvert')}</span>{updating && <span role="status">{__('Updating… Previous dates shown.', 'wconvert')}</span>}</div>
          {enabled && !report.consent_ready && <div className="wa-report-notice"><strong>{__('Finish consent setup to link new orders.', 'wconvert')}</strong><a href={report.guide_url} target="_blank" rel="noreferrer">{__('View setup guide', 'wconvert')}</a></div>}
          {!report.site_matches && <p className="wa-report-notice">{__('The site address changed. Turn on tracking again in Tracking & setup below.', 'wconvert')}</p>}
          {period.days === 0 ? <EmptyState icon={ShoppingBag} title={__('No complete days yet', 'wconvert')}>{__('Today’s paid orders will appear tomorrow.', 'wconvert')}</EmptyState>
            : report.complete === undefined ? <p className="wa-muted">{__('Sales totals have not loaded yet. Use Retry if loading failed.', 'wconvert')}</p>
            : report.complete === false ? <EmptyState icon={ShoppingBag} title={__('Choose a shorter period', 'wconvert')}>{__('This report is too large to total safely. No partial totals are shown.', 'wconvert')}</EmptyState>
            : (report.linked_orders ?? 0) === 0 ? <EmptyState icon={ShoppingBag} title={__('No linked orders in this period', 'wconvert')}>{__('With tracking on and statistics consent granted, a signup or click can link a checkout within 30 minutes. Today’s paid orders appear tomorrow.', 'wconvert')}</EmptyState>
            : <SalesTotals report={report} />}
          {report.complete && period.days > 0 && <p className="wa-muted wa-report-context">{__('Linked after a signup or eligible click within 30 minutes. A link does not prove the campaign caused the sale.', 'wconvert')}</p>}
          {report.complete && period.days > 0 && <p className="wa-muted wa-report-context">{sprintf(__('%s eligible paid orders across your store in this period.', 'wconvert'), formatCount(report.eligible_orders ?? 0))} <InfoTip label={__('About linked orders', 'wconvert')}>{__('Orders may be unlinked because consent was not granted, the interaction expired or tracking failed.', 'wconvert')}</InfoTip></p>}
        </RegionBody>
        {report.complete && period.days > 0 && !!report.orders?.length && <ReportDisclosure title={__('View linked orders', 'wconvert')}>
          <p className="wa-muted">{__('Up to 50 recent linked orders. Open an order to review it in WooCommerce.', 'wconvert')}</p>
          <DataTable label={__('Linked orders', 'wconvert')}>
            <DataTableHead><DataTableColumn>{__('Order', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Paid on', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Net product revenue', 'wconvert')}</DataTableColumn></DataTableHead>
            <DataTableBody>{report.orders.map(order => <DataTableRow key={order.id}>
              <DataTableCell label={__('Order', 'wconvert')}>{order.url ? <a href={order.url}>#{order.id}</a> : `#${order.id}`}</DataTableCell>
              <DataTableCell label={__('Campaign', 'wconvert')}><a href={reportHref({ optinId: order.campaign, month: report.month, days: report.days })}>{campaignNames[order.campaign] ?? `${__('Campaign', 'wconvert')} ${order.campaign}`}</a></DataTableCell>
              <DataTableCell label={__('Paid on', 'wconvert')}>{order.paid}</DataTableCell>
              <DataTableCell label={__('Status', 'wconvert')}>{order.status}{order.refunded && <small className="block wa-muted">{__('Refund recorded', 'wconvert')}</small>}</DataTableCell>
              <DataTableCell label={__('Net product revenue', 'wconvert')} numeric>{money(order.amount, order.currency)}</DataTableCell>
            </DataTableRow>)}</DataTableBody>
          </DataTable>
        </ReportDisclosure>}
        <ReportDisclosure title={__('Tracking & setup', 'wconvert')}>
          <div className="wa-report-setting"><SlidersHorizontal aria-hidden="true" className="size-5" /><div><strong>{status}</strong><p className="wa-muted">{__('Turning tracking off keeps existing order links.', 'wconvert')}</p></div><div className="wconvert-toolbar">{trackingControl}{optinId && <a href={reportHref()}>{__('Manage tracking', 'wconvert')}</a>}</div></div>
          <p className="wa-muted">{sprintf(__('First enabled: %s', 'wconvert'), new Date(report.settings.since!).toLocaleDateString())}</p>
          <a href={report.guide_url} target="_blank" rel="noreferrer">{__('Test your setup', 'wconvert')}</a>
        </ReportDisclosure>
      </>}
      <ReportDisclosure title={__('How sales are linked', 'wconvert')}>
        <dl className="wa-report-definitions">
          <div><dt>{__('Last interaction · 30-minute window', 'wconvert')}</dt><dd>{__('An accepted signup, offer click, cart-return click or quiz result-link click can link one checkout in the same WooCommerce session. Appearances, dismissals and coupon copies do not qualify.', 'wconvert')}</dd></div>
          <div><dt>{__('Net product revenue', 'wconvert')}</dt><dd>{__('Product totals after discounts and product refunds. Tax, shipping and fees are excluded. Currencies stay separate; an unallocated refund makes the amount unavailable.', 'wconvert')}</dd></div>
          <div><dt>{__('Paid orders only', 'wconvert')}</dt><dd>{__('Orders use their paid date. Later refunds update that original period. Unpaid, failed and cancelled orders are excluded. Unmarked gateway test payments may be included.', 'wconvert')}</dd></div>
        </dl>
        <p className="wa-muted">{__('Sales require statistics consent. Other devices and later sessions are not linked.', 'wconvert')}</p>
      </ReportDisclosure>
    </>}
  </Region></ReportTarget>;
}

function SalesTotals({ report }: { report: Report }) {
  const currencies = report.currencies ?? [];
  if (currencies.length === 1) {
    const row = currencies[0];
    return <dl className="wa-report-metrics" aria-label={__('Linked sales', 'wconvert')}>
      <div><dt>{__('Net product revenue', 'wconvert')}</dt><dd>{money(row.amount, row.currency)}</dd><small>{__('After discounts and product refunds', 'wconvert')}</small>{row.unallocated_refunds > 0 && <p className="wa-muted">{__('A refund has no product allocation.', 'wconvert')}</p>}</div>
      <div><dt>{__('Linked paid orders', 'wconvert')}</dt><dd>{formatCount(row.orders)}</dd><small>{__('After a signup or eligible click', 'wconvert')}</small></div>
      <div><dt>{__('Average order value', 'wconvert')}</dt><dd>{money(row.amount === null ? null : row.amount / row.orders, row.currency)}</dd><small>{__('Based on net product revenue', 'wconvert')}</small></div>
    </dl>;
  }
  return <DataTable label={__('Linked product revenue by currency', 'wconvert')}>
    <DataTableHead><DataTableColumn>{__('Currency', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Paid orders', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Net product revenue', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Average order value', 'wconvert')}</DataTableColumn></DataTableHead>
    <DataTableBody>{currencies.map(row => <DataTableRow key={row.currency}>
      <DataTableCell label={__('Currency', 'wconvert')}>{row.currency}</DataTableCell><DataTableCell label={__('Paid orders', 'wconvert')} numeric>{formatCount(row.orders)}</DataTableCell>
      <DataTableCell label={__('Net product revenue', 'wconvert')} numeric>{money(row.amount, row.currency)}{row.unallocated_refunds > 0 && <small className="block">{__('A refund has no product allocation.', 'wconvert')}</small>}</DataTableCell>
      <DataTableCell label={__('Average order value', 'wconvert')} numeric>{money(row.amount === null ? null : row.amount / row.orders, row.currency)}</DataTableCell>
    </DataTableRow>)}</DataTableBody>
  </DataTable>;
}
