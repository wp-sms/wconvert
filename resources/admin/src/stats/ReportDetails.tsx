import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChartColumn, Pause, Play, Split } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { PageError, Region } from '../shell/Region';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { messageOf } from '../shell/loadable';
import { StatusBadge } from '../optins/StatusBadge';
import type { OptinStatus } from '../optins/api';
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

/**
 * The report's three states in the campaign list's words (GUIDELINES §20): a
 * campaign that is no longer published is a Draft, and one kept only for its
 * results is Deleted. The report's own keys never reach the screen.
 */
const STATUS: Record<OptinReport['status'], OptinStatus> = {
  published: 'published',
  paused: 'draft',
  historical: 'deleted',
};

/**
 * A change against the previous period, with its sign. A fall is not amber:
 * amber means the site is holding something back (§14), and a lower number is
 * a fact, not a fault — so it reads as neutral text.
 */
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
    <span className={`wa-change ${delta > 0 ? 'wa-change-up' : ''}`}>
      {sprintf(
        __('%s vs previous period', 'wconvert'),
        `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatRate(Math.abs(delta))}`,
      )}
    </span>
  );
}
function Status({ value }: { value: OptinReport['status'] }) {
  return <StatusBadge status={STATUS[value]} />;
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
        <dt>{__('Shown', 'wconvert')}</dt>
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
          {card.rate_label}
        </dt>
        <dd>{formatRate(numbers.conversion_rate)}</dd>
        <small>
          {sprintf(
            /* translators: 1: results, 2: times shown. */
            __('%1$s ÷ %2$s shown', 'wconvert'),
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
          <h2><bdi>{optin?.name ?? card.label}</bdi></h2>
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
            'This campaign is a draft, so it is not shown. Its earlier results are below.',
            'wconvert',
          )}
        </p>
      )}
      {optin?.status === 'historical' && (
        <p className="wa-notice">
          {__(
            'This campaign was deleted. Its results stay here, and it can no longer be edited.',
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
      {card.action === 'add_to_cart' && <div className="wa-panel wa-handoff">
        <div><h3>{__('Items added to basket', 'wconvert')}</h3><p className="wa-muted">{__('All confirmed additions. Adding two extras counts twice here and once in Basket additions. These are not purchases.', 'wconvert')}</p></div>
        <strong>{formatCount(numbers.items_added ?? 0)}</strong>
      </div>}
      {numbers.deliveries !== null && (
        <div className="wa-panel wa-handoff">
          <div>
            <p className="wa-eyebrow">{__('After submission', 'wconvert')}</p>
            <h3>{__('Email handoffs', 'wconvert')}</h3>
            <p className="wa-muted">
              {__(
                'Sends can land on a later day and resends count again, so a difference is not a queue or failure count.',
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
                'Each variant has its own results, counted once in these totals.',
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
                  ? __('from draft campaigns', 'wconvert')
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
    <Region label={__('Campaign contributions', 'wconvert')} className="wa-campaigns">
      <Toolbar
        trailing={
          <ToolbarCount>
            {sprintf(
              _n('%s campaign', '%s campaigns', groups.length, 'wconvert'),
              formatCount(groups.length),
            )}
          </ToolbarCount>
        }
      >
        <Input
          type="search"
          className="w-64 max-w-full"
          aria-label={__('Find a campaign', 'wconvert')}
          placeholder={__('Find a campaign…', 'wconvert')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <NativeSelect
          aria-label={__('Campaign status', 'wconvert')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{__('All statuses', 'wconvert')}</option>
          <option value="published">{__('Published', 'wconvert')}</option>
          <option value="paused">{__('Draft', 'wconvert')}</option>
          <option value="historical">{__('Deleted', 'wconvert')}</option>
        </NativeSelect>
      </Toolbar>
      {groups.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title={__('No campaigns match', 'wconvert')}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setStatus('all');
              }}
            >
              {__('Clear filters', 'wconvert')}
            </Button>
          }
        />
      ) : (
        <DataTable label={__('Campaign contributions', 'wconvert')}>
          <DataTableHead>
            <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
            {cards.length > 1 && <DataTableColumn>{__('Goal', 'wconvert')}</DataTableColumn>}
            <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Shown', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Rate', 'wconvert')}</DataTableColumn>
            <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
          </DataTableHead>
          <DataTableBody>
            {groups.map(({ card, root, arms, numbers }) => (
              <DataTableRow key={root.id}>
                <DataTableCell label={__('Campaign', 'wconvert')}>
                  <a
                    className="wa-campaign-name"
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
                    <bdi>{root.name}</bdi>
                  </a>
                  {arms.length > 1 && (
                    <small className="wa-cell-note">
                      {__('Includes variant history', 'wconvert')}
                    </small>
                  )}
                </DataTableCell>
                {cards.length > 1 && (
                  <DataTableCell label={__('Goal', 'wconvert')}>{card.label}</DataTableCell>
                )}
                <DataTableCell label={__('Status', 'wconvert')}>
                  <Status value={root.status} />
                </DataTableCell>
                <DataTableCell label={__('Results', 'wconvert')} numeric>
                  {formatCount(numbers.conversions)}
                  <small className="wa-cell-note">{card.result_label}</small>
                </DataTableCell>
                <DataTableCell label={__('Shown', 'wconvert')} numeric>
                  {formatCount(numbers.impressions)}
                </DataTableCell>
                <DataTableCell label={__('Rate', 'wconvert')} numeric>
                  {formatRate(numbers.conversion_rate)}
                </DataTableCell>
                <DataTableActions>
                  {arms.length > 1 && (
                    <Button asChild variant="ghost">
                      <a
                        href={reportHref({
                          month: payload.month,
                          days: payload.days,
                          experiment: root.id,
                          compare: query.compare,
                        })}
                      >
                        {__('Compare variants', 'wconvert')}
                      </a>
                    </Button>
                  )}
                </DataTableActions>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </Region>
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
    [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reason = useId();
  const draft = optin.status === 'paused';
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (draft) await publishOptin(optin.id);
      else await unpublishOptin(optin.id);
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
            // Refused, not busy: it keeps focus so the reason is reachable (§14).
            <Button variant="outline" aria-disabled="true" aria-describedby={reason}>
              {__('View submissions', 'wconvert')}
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
                {__('View submissions', 'wconvert')}
              </a>
            </Button>
          ))}
        {optin.status !== 'historical' && (
          <>
            <Button asChild variant="outline">
              <a href={editorHref(optin.id, reportHref(query))}>
                {__('Open editor', 'wconvert')}
              </a>
            </Button>
            <Button
              ref={trigger}
              variant="outline"
              disabled={busy || disabled}
              onClick={() => setConfirm(true)}
            >
              {draft ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              {busy
                ? draft
                  ? __('Publishing…', 'wconvert')
                  : __('Unpublishing…', 'wconvert')
                : draft
                  ? __('Publish campaign', 'wconvert')
                  : __('Unpublish campaign', 'wconvert')}
            </Button>
          </>
        )}
      </div>
      {card.action === 'submit' && payload.days === 0 && (
        <p id={reason} className="wa-muted">
          {__('Submissions open once this month has a complete day.', 'wconvert')}
        </p>
      )}
      {error && <PageError message={error} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={
          draft
            ? __('Publish this campaign?', 'wconvert')
            : __('Unpublish this campaign?', 'wconvert')
        }
        description={
          draft
            ? __(
                'This publishes the latest saved draft, including any edits made since it was unpublished. Its results stay in this report.',
                'wconvert',
              )
            : __(
                'It stops showing on your site. Its results stay in this report, and other A/B variants keep their own state.',
                'wconvert',
              )
        }
        confirmLabel={
          draft
            ? __('Publish campaign', 'wconvert')
            : __('Unpublish campaign', 'wconvert')
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
        <h2><bdi>{family.root.name}</bdi></h2>
        <p className="wa-muted">
          {__(
            'Results cover the selected dates, including past uses of each design. They do not prove a winner.',
            'wconvert',
          )}
        </p>
      </div>
      <div className="wa-experiment-grid">
        {family.arms.map((arm) => (
          <div className="wa-panel wa-arm" key={arm.id}>
            <div className="wa-detail-heading">
              <h3><bdi>{arm.name}</bdi></h3>
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
          'Each variant counts once in goal totals. Visitors are assigned per browser, not per person.',
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
          'This design becomes the campaign and the other variants are retired. Their results stay in this report. This is your choice, not a statistically proven winner, and an unpublished design stays unpublished.',
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
