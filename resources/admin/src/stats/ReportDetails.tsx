import { useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Pause, Play, Split } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageError } from '../shell/Region';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { messageOf } from '../shell/loadable';
import {
  destinationHref,
  editorHref,
  leadsHref,
  reportHref,
  type ReportQuery,
} from '../nav';
import { publishOptin, unpublishOptin, declareWinner } from '../optins/api';
import { adminSettings } from '../settings';
import type { DashboardPayload, GoalReport, Numbers, OptinReport } from './api';
import { formatCount, formatRate } from './format';
import { families } from './reporting';
import { ActivityChart } from './ActivityChart';

const statusLabel = (status: OptinReport['status']) =>
  status === 'published'
    ? __('Published', 'wconvert')
    : status === 'paused'
      ? __('Paused', 'wconvert')
      : __('Historical', 'wconvert');
export function Change({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (previous === undefined)
    return (
      <span className="wa-change">
        {__('Comparison unavailable', 'wconvert')}
      </span>
    );
  if (previous === 0)
    return (
      <span className="wa-change">
        {current === 0
          ? __('No change', 'wconvert')
          : __('No earlier results', 'wconvert')}
      </span>
    );
  const delta = (current - previous) / previous;
  return (
    <span className={`wa-change ${delta < 0 ? 'wa-change-down' : ''}`}>
      {delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}
      {sprintf(
        __('%s vs previous period', 'wconvert'),
        formatRate(Math.abs(delta)),
      )}
    </span>
  );
}
function Status({ value }: { value: OptinReport['status'] }) {
  return (
    <span className={`wa-status wa-status-${value}`}>{statusLabel(value)}</span>
  );
}
function Totals({
  card,
  numbers,
  previous,
}: {
  card: GoalReport;
  numbers: Numbers;
  previous?: Numbers;
}) {
  return (
    <dl className="wa-numbers">
      <div>
        <dt>{card.result_label}</dt>
        <dd>{formatCount(numbers.conversions)}</dd>
        {previous && (
          <Change
            current={numbers.conversions}
            previous={previous.conversions}
          />
        )}
      </div>
      <div>
        <dt>{__('Times shown', 'wconvert')}</dt>
        <dd>{formatCount(numbers.impressions)}</dd>
        {previous && (
          <Change
            current={numbers.impressions}
            previous={previous.impressions}
          />
        )}
      </div>
      <div>
        <dt>
          {card.rate_label ?? (card.action === 'submit'
            ? __('Submission rate', 'wconvert')
            : __('Click-through rate', 'wconvert'))}
        </dt>
        <dd>{formatRate(numbers.conversion_rate)}</dd>
        <small>
          {sprintf(
            __('Actions ÷ appearances: %1$s / %2$s', 'wconvert'),
            formatCount(numbers.conversions),
            formatCount(numbers.impressions),
          )}
        </small>
      </div>
    </dl>
  );
}
type DetailProps = {
  card: GoalReport;
  optin?: OptinReport;
  previous?: GoalReport;
  payload: DashboardPayload;
  query: ReportQuery;
  disabled: boolean;
  onRefresh: () => void;
};
export function GoalDetail({
  card,
  optin,
  previous,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps) {
  const numbers = optin ?? card;
  const prior = optin
    ? previous?.optins.find((o) => o.id === optin.id)
    : previous;
  const family = optin
    ? families(card).find((f) => f.arms.some((a) => a.id === optin.id))
    : undefined;
  return (
    <section aria-label={optin?.name ?? card.label}>
      <div className="wa-detail-heading">
        <div>
          <p className="wa-eyebrow">
            {optin ? card.label : __('Goal report', 'wconvert')}
          </p>
          <h2>{optin?.name ?? card.label}</h2>
        </div>
        {optin && <Status value={optin.status} />}
      </div>
      <p className="wa-muted">
        {numbers.deliveries === null
          ? card.measurement
          : __(
              'Resource requests count submitted forms. Email handoffs are reported separately below; neither count proves inbox arrival.',
              'wconvert',
            )}
      </p>
      {optin?.status === 'published' && optin.published_at && optin.published_at.slice(0, 10) > payload.to && numbers.impressions === 0 && (
        <p className="wa-notice">{__('Published after these report dates. New activity appears after each day ends.', 'wconvert')}</p>
      )}
      {optin?.status === 'paused' && (
        <p className="wa-notice">
          {__(
            'This campaign is paused. It is not being shown. Its earlier results remain included below.',
            'wconvert',
          )}
        </p>
      )}
      {optin?.status === 'historical' && (
        <p className="wa-notice">
          {__(
            'This deleted campaign is kept here for reporting. It is no longer shown and cannot be edited.',
            'wconvert',
          )}
        </p>
      )}
      <div className="wa-panel">
        <Totals card={card} numbers={numbers} previous={prior} />
        <ActivityChart
          key={optin?.id ?? card.goal}
          label={card.result_label}
          numbers={numbers}
          previous={prior}
        />
        {!optin && <Reconciliation card={card} />}
      </div>
      {numbers.deliveries !== null && (
        <div className="wa-panel wa-handoff">
          <div>
            <p className="wa-eyebrow">{__('After capture', 'wconvert')}</p>
            <h3>{__('Email handoffs', 'wconvert')}</h3>
            <p className="wa-muted">
              {__(
                'Send events may happen on a later day. Resends can count again; a difference is not a queue or failure count.',
                'wconvert',
              )}
            </p>
          </div>
          <div>
            <strong>{formatCount(numbers.deliveries)}</strong>
            <span>{__('Emails accepted for sending', 'wconvert')}</span>
          </div>
          <Button asChild variant="outline">
            <a href={destinationHref()}>
              {__('Review destinations', 'wconvert')}
            </a>
          </Button>
        </div>
      )}
      {family && family.arms.length > 1 && (
        <div className="wa-notice wa-experiment-link">
          <div>
            <b>{__('A/B comparison and variant history', 'wconvert')}</b>
            <p>
              {__(
                'Each variant has its own results. Family totals are not added again.',
                'wconvert',
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <a
              href={reportHref({
                month: payload.month,
                days: payload.days,
                goal: card.goal,
                experiment: family.root.id,
                compare: query.compare,
              })}
            >
              <Split aria-hidden="true" />
              {__('Compare variants', 'wconvert')}
            </a>
          </Button>
        </div>
      )}
      {optin ? (
        <CampaignActions
          optin={optin}
          card={card}
          payload={payload}
          query={query}
          disabled={disabled}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          <div className="wa-section-heading">
            <h3>{__('Campaign contributions', 'wconvert')}</h3>
            <span>{__('Never-published drafts are excluded', 'wconvert')}</span>
          </div>
          <CampaignTable cards={[card]} payload={payload} query={query} />
        </>
      )}
    </section>
  );
}
function Reconciliation({ card }: { card: GoalReport }) {
  return (
    <div className="wa-reconciliation">
      {(['published', 'paused', 'historical'] as const).map((status) => {
        const rows = card.optins.filter((o) => o.status === status);
        return (
          rows.length > 0 && (
            <span key={status}>
              <b>{formatCount(rows.reduce((n, o) => n + o.conversions, 0))}</b>{' '}
              {status === 'published'
                ? __('from published campaigns', 'wconvert')
                : status === 'paused'
                  ? __('from paused campaigns', 'wconvert')
                  : __('from deleted campaigns', 'wconvert')}
            </span>
          )
        );
      })}
      <small>
        {__(
          'Includes each variant once. Status describes the campaign now, not when the action happened.',
          'wconvert',
        )}
      </small>
    </div>
  );
}
export function CampaignTable({
  cards,
  payload,
  query,
}: {
  cards: GoalReport[];
  payload: DashboardPayload;
  query: ReportQuery;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all');
  const groups = cards
    .flatMap((card) => families(card).map((family) => ({ card, ...family })))
    .filter((f) =>
      f.arms.some(
        (a) =>
          a.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
          (status === 'all' || a.status === status),
      ),
    );
  return (
    <div className="wa-panel">
      <div className="wa-table-tools">
        <input
          aria-label={__('Find a campaign', 'wconvert')}
          placeholder={__('Find a campaign…', 'wconvert')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={__('Campaign status', 'wconvert')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{__('All statuses', 'wconvert')}</option>
          {(['published', 'paused', 'historical'] as const).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <span>
          {sprintf(
            _n('%d campaign', '%d campaigns', groups.length, 'wconvert'),
            groups.length,
          )}
        </span>
      </div>
      <div className="wa-table-wrap">
        <table className="wa-campaign-table">
          <caption className="sr-only">
            {__('Campaign contributions', 'wconvert')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{__('Campaign', 'wconvert')}</th>
              {cards.length > 1 && (
                <th scope="col">{__('Goal', 'wconvert')}</th>
              )}
              <th scope="col">{__('Status', 'wconvert')}</th>
              <th scope="col">{__('Results', 'wconvert')}</th>
              <th scope="col">{__('Shown', 'wconvert')}</th>
              <th scope="col">{__('Rate', 'wconvert')}</th>
              <th scope="col">
                <span className="sr-only">{__('Actions', 'wconvert')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ card, root, arms, numbers }) => (
              <tr key={root.id}>
                <th scope="row">
                  <a
                    href={reportHref({
                      month: payload.month,
                      days: payload.days,
                      goal: card.goal,
                      ...(arms.length > 1
                        ? { experiment: root.id }
                        : { optinId: root.id }),
                      compare: query.compare,
                    })}
                  >
                    {root.name}
                  </a>
                  {arms.length > 1 && (
                    <small>{__('Includes variant history', 'wconvert')}</small>
                  )}
                </th>
                {cards.length > 1 && <td>{card.label}</td>}
                <td>
                  <Status value={root.status} />
                </td>
                <td className="wa-numeric">
                  {formatCount(numbers.conversions)}
                  <small>{card.result_label}</small>
                </td>
                <td className="wa-numeric">
                  {formatCount(numbers.impressions)}
                </td>
                <td className="wa-numeric">
                  {formatRate(numbers.conversion_rate)}
                </td>
                <td>
                  {arms.length > 1 && (
                    <a
                      className="wa-table-compare"
                      href={reportHref({
                        month: payload.month,
                        days: payload.days,
                        experiment: root.id,
                        compare: query.compare,
                      })}
                    >
                      {__('Compare variants', 'wconvert')}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {groups.length === 0 && (
        <p className="wa-empty">
          {__('No campaigns match. Try another name or status.', 'wconvert')}
        </p>
      )}
    </div>
  );
}
function CampaignActions({
  optin,
  card,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps & { optin: OptinReport }) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (optin.status === 'paused') await publishOptin(optin.id);
      else await unpublishOptin(optin.id);
      setNotice(
        __('Campaign updated. Historical results are unchanged.', 'wconvert'),
      );
      onRefresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="wa-actions">
        {card.action === 'submit' &&
          (payload.days === 0 ? (
            <Button
              variant="outline"
              disabled
              title={__(
                'Capture history is available after this month has a complete day.',
                'wconvert',
              )}
            >
              {__('View captured leads', 'wconvert')}
            </Button>
          ) : (
            <Button asChild variant="outline">
              <a
                href={leadsHref({
                  optinId: optin.id,
                  from: payload.from,
                  to: payload.to,
                })}
              >
                {__('View captured leads', 'wconvert')}
              </a>
            </Button>
          ))}
        {optin.status !== 'historical' && (
          <>
            <Button asChild variant="outline">
              <a href={editorHref(optin.id, reportHref(query))}>
                {__('Edit campaign', 'wconvert')}
              </a>
            </Button>
            <Button
              ref={trigger}
              variant="outline"
              disabled={busy || disabled}
              onClick={() => setConfirm(true)}
            >
              {optin.status === 'paused' ? (
                <Play aria-hidden="true" />
              ) : (
                <Pause aria-hidden="true" />
              )}
              {optin.status === 'paused'
                ? __('Resume campaign', 'wconvert')
                : __('Pause campaign', 'wconvert')}
            </Button>
          </>
        )}
      </div>
      {error && <PageError message={error} />}{' '}
      {notice && (
        <p className="wa-muted" role="status">
          {notice}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={
          optin.status === 'paused'
            ? __('Resume this campaign?', 'wconvert')
            : __('Pause this campaign?', 'wconvert')
        }
        description={
          optin.status === 'paused'
            ? __(
                'Resuming publishes the latest saved draft, including any edits made while paused. Review the campaign first if you do not want those edits to go live. Historical results stay unchanged.',
                'wconvert',
              )
            : __(
                'This stops this design from appearing. Other A/B variants are separate designs and keep their own state. Its historical results stay available.',
                'wconvert',
              )
        }
        confirmLabel={
          optin.status === 'paused'
            ? __('Publish and resume', 'wconvert')
            : __('Pause campaign', 'wconvert')
        }
        onConfirm={() => {
          void run();
        }}
        returnFocusTo={trigger}
      />
    </>
  );
}
export function Experiment({
  card,
  optin,
  previous,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps & { optin: OptinReport }) {
  const family = families(card).find((f) =>
    f.arms.some((a) => a.id === optin.id),
  );
  const [chosen, setChosen] = useState<OptinReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (!family || family.arms.length < 2)
    return (
      <p className="wa-notice">
        {__(
          'No variant comparison is available for this campaign.',
          'wconvert',
        )}
      </p>
    );
  const live = family.arms.filter((a) => a.status !== 'historical');
  const canChoose =
    adminSettings()?.variants?.availability === 'ready' &&
    live.length > 1 &&
    family.root.status !== 'historical';
  const choose = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await declareWinner(family.root.id, chosen.id);
      onRefresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      setChosen(null);
    }
  };
  return (
    <section>
      <div className="wa-intro">
        <p className="wa-eyebrow">
          {__('A/B comparison and variant history', 'wconvert')}
        </p>
        <h2>{family.root.name}</h2>
        <p className="wa-muted">
          {__(
            'Results below cover the selected dates, including past uses of each design. They are not isolated test-round snapshots or a statistically proven winner.',
            'wconvert',
          )}
        </p>
      </div>
      <div className="wa-experiment-grid">
        {family.arms.map((arm) => (
          <div className="wa-panel wa-arm" key={arm.id}>
            <div className="wa-detail-heading">
              <h3>{arm.name}</h3>
              <Status value={arm.status} />
            </div>
            <Totals
              card={card}
              numbers={arm}
              previous={previous?.optins.find((row) => row.id === arm.id)}
            />
            <div className="wa-actions">
              <Button asChild variant="outline">
                <a
                  href={reportHref({
                    month: payload.month,
                    days: payload.days,
                    goal: card.goal,
                    optinId: arm.id,
                    compare: query.compare,
                  })}
                >
                  {__('View report', 'wconvert')}
                </a>
              </Button>
              {canChoose && arm.status !== 'historical' && (
                <Button
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setChosen(arm);
                  }}
                >
                  {__('Use this variant', 'wconvert')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="wa-notice">
        {__(
          'Each variant is counted once in overall and Goal totals. Retired variants remain inspectable. Assignment is per browser record, not per unique person.',
          'wconvert',
        )}
      </p>
      {error && <PageError message={error} />}
      <ConfirmDialog
        open={chosen !== null}
        onOpenChange={(open) => {
          if (!open) setChosen(null);
        }}
        title={sprintf(__('Use %s?', 'wconvert'), chosen?.name ?? '')}
        description={__(
          'This design becomes the campaign. Other current variants are retired and their results remain available. This is your selection, not a statistically proven winner. An unpublished selected design stays unpublished.',
          'wconvert',
        )}
        confirmLabel={__('Use selected variant', 'wconvert')}
        onConfirm={() => {
          void choose();
        }}
        returnFocusTo={trigger}
      />
    </section>
  );
}
