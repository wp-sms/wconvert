import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
interface Report {
  rows: { scope: string; kind: string; total: string }[];
  definitions: Record<string, Record<string, { name: string; order: number }>>;
}
const labels: Record<string, string> = {
  screen_shown: __('Shown', 'wconvert'), screen_advanced: __('Completed', 'wconvert'),
  screen_skipped: __('Skipped', 'wconvert'), screen_dismissed: __('Dismissed', 'wconvert'),
};
export function JourneyReport({ id }: { id: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setReport(null); setFailed(false);
    void apiFetch<Report>({ path: `/wconvert/v1/optins/${id}/journey-stats`, signal: controller.signal })
      .then(setReport).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id]);
  return <section className="wconvert-details-section">
    <h3>{__('Signup and screen totals · last 30 days', 'wconvert')}</h3>
    <p className="text-note">{__('Each journey counts once as a Conversion. Email and SMS totals may overlap. Screen activity is approximate, not unique visitors or exact abandonment.', 'wconvert')}</p>
    {failed ? <p role="alert">{__('Could not load journey totals.', 'wconvert')}</p> : report === null ? <p>{__('Loading…', 'wconvert')}</p> : report.rows.length === 0 ? <p>{__('No journey activity yet.', 'wconvert')}</p> :
      <table className="w-full text-sm"><thead><tr><th>{__('Channel or screen', 'wconvert')}</th><th>{__('Activity', 'wconvert')}</th><th>{__('Total', 'wconvert')}</th></tr></thead>
        <tbody>{report.rows.map(row => {
          const [group, revision, screen] = row.scope.split(':');
          const name = group === 'channel' ? (revision === 'email_marketing' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert'))
            : `${report.definitions[revision]?.[screen]?.name ?? __('Screen', 'wconvert')} · ${sprintf(__('Version %d', 'wconvert'), Object.keys(report.definitions).indexOf(revision) + 1)}`;
          return <tr key={`${row.scope}:${row.kind}`}><td>{name}</td><td>{labels[row.kind] ?? __('Accepted', 'wconvert')}</td><td>{Number(row.total).toLocaleString()}</td></tr>;
        })}</tbody></table>}
  </section>;
}
