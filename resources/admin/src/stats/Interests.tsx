import { ReportTarget } from './ReportNavigation';
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
interface Answers { questions: { question: string; multiple: boolean; answered: number; choices: { label: string; count: number }[] }[]; answered: number; choices: { label: string; count: number }[]; retained: number; truncated: boolean; from: string; to: string; }
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
  if (!data && !error) return <RegionSkeleton label={__('Answers', 'wconvert')} lines={3} />;
  const Failure = data ? RegionError : RegionErrorState;
  return <ReportTarget name="answers" label={__('Answers', 'wconvert')}><Region className="wa-report">
    <RegionHeader title={__('Answers', 'wconvert')} level={3} icon={<ChartBar />} description={__('What visitors chose when they submitted this campaign.', 'wconvert')} />
    {error && <Failure message={data ? __('Could not refresh answers. The answers below keep their dates.', 'wconvert') : __('Could not load answers.', 'wconvert')} onRetry={() => setRetry(n => n + 1)} />}
    {data && <><RegionBody>
      <div className="wa-report-meta"><span>{rangeLabel(data.from, data.to)}</span><span>{__('By submission date', 'wconvert')}</span>{updating && <span role="status">{__('Updating… Previous dates shown.', 'wconvert')}</span>}</div>
      {data.truncated && <p className="wa-report-notice">{sprintf(__('Showing the latest %s submissions. Choose a shorter period for all answers.', 'wconvert'), formatCount(1000))}</p>}
      <div className="wa-answer-groups">
        {data.answered > 0 && <AnswerDistribution title={__('Selected interests', 'wconvert')} answered={data.answered} choices={data.choices} />}
        {data.questions?.map((question, i) => <AnswerDistribution key={i} title={question.question} answered={question.answered} choices={question.choices} multiple={question.multiple} />)}
      </div>
    </RegionBody>
    <ReportDisclosure title={__('About these answers', 'wconvert')}>
      <p>{__('Percentages use saved responses to each question. Anonymous answers are excluded.', 'wconvert')}</p>
      <p>{__('Submissions are counted by the date they were made, including answers added later. Changed labels stay separate, and deleting old submissions can change these totals.', 'wconvert')}</p>
    </ReportDisclosure></>}
  </Region></ReportTarget>;
}
function AnswerDistribution({ title, answered, choices, multiple = false }: { title: string; answered: number; multiple?: boolean; choices: { label: string; count: number }[] }) {
  return <div className="wa-answer-group"><div className="wa-answer-heading"><h4>{title}</h4><span className="wa-muted">{sprintf(_n('%s response', '%s responses', answered, 'wconvert'), formatCount(answered))}</span></div>
    {multiple && <p className="wa-muted">{__('Multiple answers allowed; percentages can exceed 100%.', 'wconvert')}</p>}
    <ul className="wa-answer-bars">{choices.map((choice, i) => <li key={i}>
      <div className="wa-answer-label"><span>{choice.label}</span><span className="wa-answer-value"><strong>{sprintf(__('%1$s of %2$s', 'wconvert'), formatCount(choice.count), formatCount(answered))}</strong><span className="wa-muted">{formatRate(answered > 0 ? choice.count / answered : null)}</span></span></div>
      <div className="wa-answer-track" aria-hidden="true"><span style={{ inlineSize: `${answered > 0 ? Math.min(100, choice.count / answered * 100) : 0}%` }} /></div>
    </li>)}</ul>
  </div>;
}
