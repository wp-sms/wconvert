import apiFetch from '@wordpress/api-fetch';

/** Settings → Email reports, as `GET /reports/weekly` returns it (ADR 0176). */
export interface WeeklySummarySetting {
  enabled: boolean;
  /** Comma-separated; the admin email when nothing else was chosen. */
  recipients: string;
  default_recipient: string;
  /** Nothing is sent before the first publish. */
  waiting_for_publish: boolean;
  /** When the next one goes, in the site's words and time zone; null if not scheduled. */
  next_send: string | null;
}

export const readWeeklySummary = () => apiFetch<WeeklySummarySetting>({ path: '/wconvert/v1/reports/weekly' });

export const saveWeeklySummary = (enabled: boolean, recipients: string) => apiFetch<WeeklySummarySetting>({
  path: '/wconvert/v1/reports/weekly',
  method: 'POST',
  data: { enabled, recipients },
});

export const sendTestSummary = (recipients: string) => apiFetch<{ sent: boolean; to: string[] }>({
  path: '/wconvert/v1/reports/weekly/test',
  method: 'POST',
  data: { recipients },
});
