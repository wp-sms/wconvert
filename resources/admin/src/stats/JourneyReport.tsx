import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
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
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const days = period?.days, month = period?.month, from = period?.from, to = period?.to;
  useEffect(() => {
    const controller = new AbortController(); setReport(null); setFailed(false);
    if (days === 0) return () => controller.abort();
    const query = new URLSearchParams();
    if (days !== undefined) { query.set('days', String(days)); query.set('complete', '1'); }
    if (month) query.set('month', month);
    void apiFetch<Report>({ path: `/wconvert/v1/optins/${id}/journey-stats?${query}`, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { if (from && (value.from !== from || value.to !== to)) setFailed(true); else setReport(value); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, days, month, from, to, retry]);
  return <Region>
    <RegionHeader title={__('Signup and screen activity', 'wconvert')} level={3} description={report ? `${report.from} – ${report.to}${period ? '' : ` · ${__('Includes today', 'wconvert')}`}` : undefined} />
    <RegionBody>
      <p className="text-note">{__('Activity totals can overlap. They do not measure unique visitors or exact abandonment. Screen versions are reported separately.', 'wconvert')}</p>
      {failed ? <p role="alert">{__('Could not load matching journey totals. Refresh this report and try again.', 'wconvert')} <Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button></p>
        : days === 0 ? <p>{__('No complete days in this period.', 'wconvert')}</p>
        : report === null ? <p role="status">{__('Loading activity…', 'wconvert')}</p>
        : report.rows.length === 0 ? <p>{__('No journey activity in this period.', 'wconvert')}</p> : <>
          {report.truncated && <p>{__('Showing the first 5,000 activity rows. Choose a shorter period for a complete view.', 'wconvert')}</p>}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the labeled table region. */}
          <div className="wa-table-scroll" role="region" aria-label={__('Journey activity', 'wconvert')} tabIndex={0}>
            <table className="wa-table"><thead><tr><th scope="col">{__('Channel or screen', 'wconvert')}</th><th scope="col">{__('Activity', 'wconvert')}</th><th scope="col">{__('Total', 'wconvert')}</th></tr></thead>
              <tbody>{report.rows.map(row => {
                const [group, revision, screen] = row.scope.split(':');
                const name = group === 'channel' ? (revision === 'email_marketing' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert'))
                  : `${report.definitions[revision]?.[screen]?.name ?? __('Screen', 'wconvert')} · ${sprintf(__('Version %d', 'wconvert'), Object.keys(report.definitions).indexOf(revision) + 1)}`;
                return <tr key={`${row.scope}:${row.kind}`}><th scope="row">{name}</th><td>{labels[row.kind] ?? __('Accepted', 'wconvert')}</td><td>{Number(row.total).toLocaleString()}</td></tr>;
              })}</tbody></table>
          </div></>}
    </RegionBody>
  </Region>;
}
