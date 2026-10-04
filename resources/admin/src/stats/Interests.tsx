import { ChartBar } from 'lucide-react';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { ReportDisclosure } from './ReportDisclosure';
import { rangeLabel } from './reporting';
import { formatCount, formatRate } from './format';
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { DashboardPayload } from './api';
import { Region, RegionBody, RegionHeader, RegionError, RegionErrorState } from '../shell/Region';
import { Button } from '../components/ui/button';
interface Answers { questions: { question: string; answered: number; choices: { label: string; count: number }[] }[]; answered: number; choices: { label: string; count: number }[]; retained: number; truncated: boolean; from: string; to: string; }
export function Interests({ id, period }: { id: string; period: DashboardPayload }) {
  const [stored, setData] = useState<Answers & { campaign: string }>();
  const data = stored?.campaign === id ? stored : undefined;
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const { days, month, from, to } = period;
  useEffect(() => {
    const controller = new AbortController(); setUpdating(true); setError(false);
    if (days === 0) return () => controller.abort();
    const query = month ? `month=${encodeURIComponent(month)}` : `days=${days}`;
    void apiFetch<Answers>({ path: `/wconvert/v1/optins/${id}/interests?complete=1&${query}`, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { if (value.from !== from || value.to !== to) setError(true); else setData({ ...value, campaign: id }); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setUpdating(false); });
    return () => controller.abort();
  }, [id, days, month, from, to, retry]);
  if (days === 0 || (data && !data.answered && !data.questions?.length && !updating && !error)) return null;
  if (!data && !error) return <RegionSkeleton label={__('Submitted interests', 'wconvert')} lines={3} />;
  const Failure = data ? RegionError : RegionErrorState;
  return <Region className="wa-report">
    <RegionHeader title={__('Submitted interests', 'wconvert')} level={3} icon={<ChartBar />} description={__('What captured leads chose in your forms and quizzes.', 'wconvert')} />
    {error && <Failure message={__('Could not refresh interests. Answers below still use their displayed dates.', 'wconvert')} action={<Button variant="outline" onClick={() => setRetry(n => n + 1)}>{__('Retry', 'wconvert')}</Button>} />}
    {data && <><RegionBody>
      <div className="wa-report-meta"><span>{rangeLabel(data.from, data.to)}</span><span>{__('By first capture date', 'wconvert')}</span>{updating && <span role="status">{__('Updating… Previous dates shown.', 'wconvert')}</span>}</div>
      {data.truncated && <p className="wa-report-notice">{__('Showing the latest 1,000 retained submissions. Choose a shorter period for all answers.', 'wconvert')}</p>}
      <div className="wa-answer-groups">
        {data.answered > 0 && <AnswerDistribution title={__('Selected interests', 'wconvert')} answered={data.answered} choices={data.choices} />}
        {data.questions?.map((question, i) => <AnswerDistribution key={i} title={question.question} answered={question.answered} choices={question.choices} />)}
      </div>
    </RegionBody>
    <ReportDisclosure title={__('About these answers', 'wconvert')}>
      <p>{__('Counts and percentages use retained responses to each question. Multiple choices can overlap, so percentages may add up to more than 100%. Anonymous answers are not included.', 'wconvert')}</p>
      <p>{__('Leads are included by their first capture date. Later answers are included. Changed labels stay separate; retention and erasure can change these totals.', 'wconvert')}</p>
    </ReportDisclosure></>}
  </Region>;
}
function AnswerDistribution({ title, answered, choices }: { title: string; answered: number; choices: { label: string; count: number }[] }) {
  return <div className="wa-answer-group"><div className="wa-answer-heading"><h4>{title}</h4><span className="wa-muted">{sprintf(_n('%s response', '%s responses', answered, 'wconvert'), formatCount(answered))}</span></div>
    <ul className="wa-answer-bars">{choices.map((choice, i) => <li key={i}>
      <div className="wa-answer-label"><span>{choice.label}</span><span className="wa-answer-value"><strong>{formatCount(choice.count)}</strong><span className="wa-muted">{formatRate(answered > 0 ? choice.count / answered : null)}</span></span></div>
      <div className="wa-answer-track" aria-hidden="true"><span style={{ inlineSize: `${answered > 0 ? Math.min(100, choice.count / answered * 100) : 0}%` }} /></div>
    </li>)}</ul>
  </div>;
}
