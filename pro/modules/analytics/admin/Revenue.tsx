import { DataTable, DataTableHead, DataTableBody, DataTableRow, DataTableColumn, DataTableCell } from '@/shell/DataTable';
import { reportHref } from '@/nav';
import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Region, RegionHeader, RegionBody, RegionError, RegionErrorState } from '@/shell/Region';
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
  if (report && !report.available) return report.settings.since ? <Region><RegionHeader title={__('Campaign sales', 'wconvert')} /><RegionBody><p>{__('WooCommerce is unavailable. Tracking settings are retained; sales totals cannot be read.', 'wconvert')}</p></RegionBody></Region> : null;
  const Failure = report ? RegionError : RegionErrorState;
  return <Region label={__('Campaign sales', 'wconvert')}>
    <RegionHeader title={__('Campaign sales', 'wconvert')} />
    <RegionBody>
      <p className="wa-muted">{__('Paid orders linked to a campaign interaction. This does not prove the campaign caused the sale.', 'wconvert')}</p>
      {error && <Failure message={error} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />}
      {!report && !error && <p role="status">{__('Loading campaign sales…', 'wconvert')}</p>}
      {updating && report && <p role="status">{__('Updating sales. Showing the accepted report below.', 'wconvert')}</p>}
      {report && <>
        <p className="wa-muted">{__('Last interaction · 30-minute window', 'wconvert')} · <a href={report.guide_url} target="_blank" rel="noreferrer">{__('Test your setup', 'wconvert')}</a></p>
        {!optinId && <div className="wa-header-actions">
          <p>{report.settings.enabled && report.site_matches ? __('Tracking is on', 'wconvert') : __('Tracking is off', 'wconvert')}</p>
          <Button variant="outline" disabled={busy} onClick={() => void change(!(report.settings.enabled && report.site_matches))}>
            {busy ? __('Saving…', 'wconvert') : report.settings.enabled && report.site_matches ? __('Turn off tracking', 'wconvert') : __('Turn on tracking', 'wconvert')}
          </Button>
        </div>}
        {!report.consent_ready && <p className="wa-notice">{__('Set up a consent plugin that declares its consent type through the WP Consent API. Sales are linked only when statistics consent is granted.', 'wconvert')}</p>}
        {!report.site_matches && report.settings.since && <p className="wa-notice">{__('The site address changed. Turn on tracking again for this site.', 'wconvert')}</p>}
        {!report.settings.since ? <p>{__('Start tracking to link future checkouts. Earlier orders cannot be attributed.', 'wconvert')}</p> : <>
          <p className="wa-muted">{sprintf(__('Tracking first enabled: %s. Report: %s. Orders use their paid date; later refunds update that original period.', 'wconvert'), new Date(report.settings.since).toLocaleDateString(), report.from && report.to ? rangeLabel(report.from, report.to) : __('Not loaded yet', 'wconvert'))}</p>
          {period.days === 0 ? <p>{__('No complete days yet this month.', 'wconvert')}</p> : report.complete === undefined ? <p>{__('Sales totals have not loaded yet.', 'wconvert')}</p> : report.complete === false ? <p className="wa-notice">{__('This period is too large to total safely. Choose a shorter period. No partial totals are shown.', 'wconvert')}</p> : <>
            <p><strong>{formatCount(report.linked_orders ?? 0)}</strong> {optinId ? __('paid orders linked to this campaign', 'wconvert') : __('paid orders linked to campaigns', 'wconvert')}</p>
            <p className="wa-muted">{sprintf(__('%s eligible paid orders across the store in this period. Unlinked orders may include visitors without consent, expired interactions or failed tracking.', 'wconvert'), formatCount(report.eligible_orders ?? 0))}</p>
            {!!report.currencies?.length && <DataTable label={__('Linked product revenue by currency', 'wconvert')}>
              <DataTableHead><DataTableColumn>{__('Currency', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Paid orders', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Net product revenue', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Average order value', 'wconvert')}</DataTableColumn></DataTableHead>
              <DataTableBody>{report.currencies.map(row => <DataTableRow key={row.currency}>
                <DataTableCell label={__('Currency', 'wconvert')}>{row.currency}</DataTableCell>
                <DataTableCell label={__('Paid orders', 'wconvert')} numeric>{formatCount(row.orders)}</DataTableCell>
                <DataTableCell label={__('Net product revenue', 'wconvert')} numeric>{money(row.amount, row.currency)}{row.unallocated_refunds > 0 && <small className="block">{__('A refund has no product allocation.', 'wconvert')}</small>}</DataTableCell>
                <DataTableCell label={__('Average order value', 'wconvert')} numeric>{money(row.amount === null ? null : row.amount / row.orders, row.currency)}</DataTableCell>
              </DataTableRow>)}</DataTableBody>
            </DataTable>}
            {!!report.orders?.length && <details className="wa-help"><summary>{__('View linked orders', 'wconvert')}</summary><p>{__('Up to 50 recent linked orders. Order links require WooCommerce order permissions.', 'wconvert')}</p><ul>{report.orders.map(order => <li key={order.id}>{order.url ? <a href={order.url}>#{order.id}</a> : `#${order.id}`} · <a href={reportHref({ optinId: order.campaign, month: report.month, days: report.days })}>{campaignNames[order.campaign] ?? `${__('Campaign', 'wconvert')} ${order.campaign}`}</a> · {order.paid} · {order.status}{order.refunded ? ` · ${__('Refund recorded', 'wconvert')}` : ''} · {money(order.amount, order.currency)}</li>)}</ul></details>}
          </>}
        </>}
        <details className="wa-help"><summary>{__('How sales are linked', 'wconvert')}</summary>
          <p>{__('The last accepted signup, offer click, cart-return click or quiz result-link click can receive credit. Appearances, dismissals and coupon copies do not.', 'wconvert')}</p>
          <p>{__('Checkout must create the order within 30 minutes of the interaction, in the same WooCommerce session, with statistics consent. Each interaction can credit one order. Other devices and later sessions are not linked.', 'wconvert')}</p>
          <p>{__('Revenue is product line totals after discounts and product refunds. Tax, shipping and fees are excluded. Currency totals are never combined. This report includes paid and refunded orders, not unpaid, failed or cancelled orders.', 'wconvert')}</p>
          <p>{__('Tracking starts when enabled. Pausing it keeps existing order links. Test orders marked by an integration as WConvert test orders are excluded; gateways without that marker may include test payments.', 'wconvert')}</p>
        </details>
      </>}
    </RegionBody>
  </Region>;
}
