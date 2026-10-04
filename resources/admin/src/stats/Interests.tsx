import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { DashboardPayload } from './api';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { Button } from '../components/ui/button';
interface Answers { questions: { question: string; answered: number; choices: { label: string; count: number }[] }[]; answered: number; choices: { label: string; count: number }[]; retained: number; truncated: boolean; from: string; to: string; }
export function Interests({ id, period }: { id: string; period: DashboardPayload }) {
  const [data, setData] = useState<Answers>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const { days, month, from, to } = period;
  useEffect(() => {
    const controller = new AbortController(); setData(undefined); setError(false);
    if (days === 0) return () => controller.abort();
    const query = month ? `month=${encodeURIComponent(month)}` : `days=${days}`;
    void apiFetch<Answers>({ path: `/wconvert/v1/optins/${id}/interests?complete=1&${query}`, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { if (value.from !== from || value.to !== to) setError(true); else setData(value); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, days, month, from, to, retry]);
  if (days === 0 || (data && !data.answered && !data.questions?.length)) return null;
  return <Region><RegionHeader title={__('Submitted interests', 'wconvert')} level={3} description={__('Answers from leads first captured in this period. Later additions are included; anonymous answers are not.', 'wconvert')} /><RegionBody>
    {error ? <p role="alert">{__('Could not load submitted interests.', 'wconvert')} <Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button></p> : !data ? <p role="status">{__('Loading interests…', 'wconvert')}</p> : <>
      {data.answered > 0 && <p>{sprintf(__('%d retained leads included an interest.', 'wconvert'), data.answered)}</p>}
      {data.truncated && <p>{__('Based on the latest 1,000 retained submissions. Choose a shorter period for a complete view.', 'wconvert')}</p>}
      <ul>{data.choices.map((choice, i) => <li key={i}>{choice.label}: <strong>{choice.count.toLocaleString()}</strong></li>)}</ul>
      {data.questions?.map((question, i) => <div key={i}><h4>{question.question}</h4><p>{sprintf(__('%d retained responses. Multiple choices may overlap.', 'wconvert'), question.answered)}</p><ul>{question.choices.map((choice, n) => <li key={n}>{choice.label}: <strong>{choice.count.toLocaleString()}</strong></li>)}</ul></div>)}
      <p className="wa-muted">{__('Changed answer labels stay separate. Retention and erasure can change these totals.', 'wconvert')}</p>
    </>}
  </RegionBody></Region>;
}
