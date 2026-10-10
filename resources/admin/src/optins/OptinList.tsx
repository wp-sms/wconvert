import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronDown,
  Copy,
  EyeOff,
  Inbox,
  Info,
  LayoutGrid,
  List,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Split,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { NativeSelect } from '../components/ui/native-select';
import { Skeleton } from '../components/ui/skeleton';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent, OptionSeparator, refusal } from '../components/ui/option-menu';
import { listGoals, type GoalEntry } from '../goals/api';
import { renderingFor, tierProductName } from '../goals/availability';
import { displayTypeLabel } from '../displayTypes';
import { PickerSearch } from '../discovery/PickerSearch';
import { adminSettings, productModuleActive } from '../settings';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { EmptyState } from '../shell/EmptyState';
import { OptionStrip } from '../shell/OptionStrip';
import { Region, RegionError, RegionErrorState } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { leadsHref, reportHref } from '../nav';
import { readDashboard, type DashboardPayload } from '../stats/api';
import { formatCount, formatRange, formatRate, labelOf } from '../lib/format';
import {
  campaignName,
  createVariant,
  declareWinner,
  deleteOptin,
  duplicateCampaign,
  canUnpublish,
  listOptins,
  publishOptin,
  readCampaignPreviews,
  statusOf,
  unpublishOptin,
  type CampaignPreview,
  type OptinSummary,
  type OptinStatus,
} from './api';
import { DataTable, DataTableHead, DataTableColumn, DataTableBody, DataTableRow, DataTableCell, DataTableActions } from '../shell/DataTable';
import { CampaignSkeleton } from './CampaignSkeleton';
import { CampaignDetailsDialog } from './DetailsDialog';
import type { CampaignResults } from './CampaignSummary';
import { decisionCopy, type DecisionKind } from './decisionCopy';
import { StatusBadge } from './StatusBadge';
import './campaigns.css';

import { productHealthLabel, ProductHealthDetails, useProductHealth } from './ProductHealth';

const Design = lazy(() => import('./CampaignDesign'));
const PAGE_SIZE = 12;
type RowResult = {
  count: number;
  shown: number;
  rate: number | null;
  label: string;
  capture: boolean;
};
type Decision = {
  kind: DecisionKind;
  row: OptinSummary;
  parent?: OptinSummary;
};

const nameOf = campaignName;

/** Campaign management owns its layout; existing reads and mutation routes own the facts. */
export function OptinList({
  onEdit,
  onCreate,
  onBusyChange,
  onEmptyChange,
}: {
  onEdit: (id: string) => void;
  onCreate?: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** An empty list carries the one Create button, so the header drops its own. */
  onEmptyChange?: (empty: boolean) => void;
}) {
  const [list, setList] = useState<Loadable<OptinSummary[]>>(LOADING);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string> | null>(null);
  // Details names a row's Goal and what counts as its success (ADR 0138).
  const [goalEntries, setGoalEntries] = useState<readonly GoalEntry[] | null>(null);
  const [report, setReport] = useState<DashboardPayload | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const busyRef = useRef(new Set<string>());
  const mutationErrorsRef = useRef(new Map<string, { message: string; action: () => Promise<unknown>; openCreated: boolean }>());
  const [mutationErrors, setMutationErrors] = useState(new Map(mutationErrorsRef.current));
  const createdToOpen = useRef<string | null>(null);
  const listRequest = useRef(0);
  useEffect(() => {
    if (busy.size === 0 && createdToOpen.current) {
      const id = createdToOpen.current;
      createdToOpen.current = null;
      if (mutationErrorsRef.current.size === 0) onEdit(id);
    }
  }, [busy, onEdit]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selected, setSelected] = useState<OptinSummary | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | OptinStatus>('all');
  const [layout, setLayout] = useState<'list' | 'gallery'>('list');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Record<string, CampaignPreview>>({});
  const [previewError, setPreviewError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const createFocus = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(async () => {
    const request = ++listRequest.current;
    try {
      const data = await listOptins();
      if (request !== listRequest.current) return;
      setList(ready(data));
      setError(null);
    } catch (cause) {
      if (request !== listRequest.current) return;
      setList((previous) => (previous.status === 'ready' ? previous : failed(cause)));
      setError(messageOf(cause));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setLabelsError(null);
    void listGoals()
      .then((goals) => {
        if (active) { setLabels(Object.fromEntries(goals.map((g) => [g.id, g.label]))); setGoalEntries(goals); }
      })
      .catch((cause) => {
        if (active) setLabelsError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  useEffect(() => {
    let active = true;
    setReportLoading(true);
    setReportError(null);
    void readDashboard(days, true)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((cause) => {
        if (active) setReportError(messageOf(cause));
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days, refreshKey]);

  const numbers = useMemo(
    () =>
      Object.fromEntries(
        (report?.goals ?? []).flatMap((g) =>
          g.optins.map((r) => [
            r.id,
            {
              count: r.conversions,
              shown: r.impressions,
              rate: r.conversion_rate,
              label: g.result_label,
              capture: g.action === 'submit',
            } satisfies RowResult,
          ]),
        ),
      ),
    [report],
  );
  const rows = list.status === 'ready' ? list.data : [];
  const family = (c: OptinSummary) => [c, ...c.arms];
  // A pasted ID still finds its campaign, though no screen shows one (ADR 0131).
  const needle = query.trim().toLocaleLowerCase();
  const matches = (c: OptinSummary) =>
    (filter === 'all' || family(c).some((r) => statusOf(r) === filter)) &&
    family(c).some(
      (r) =>
        `${r.name} ${labels?.[r.goal] ?? ''}`.toLocaleLowerCase().includes(needle) ||
        r.id.toLocaleLowerCase() === needle,
    );
  // A family ranks by its own row's results; variants stay under it.
  const resultOf = (c: OptinSummary) => numbers[c.id]?.count ?? -1;
  const visible = rows
    .filter(matches)
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'results'
          ? resultOf(b) - resultOf(a) || b.id.localeCompare(a.id)
          : b.id.localeCompare(a.id),
    );
  const lastPage = Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1),
    currentPage = Math.min(page, lastPage);
  const shown = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const displayed = shown.flatMap((c) => (collapsed.has(c.id) ? [c] : family(c)));
  const ids = displayed.map((c) => c.id).join(',');
  // Only a site that can put a product in a campaign is asked about products:
  // a free install has neither module and meets no product checks (ADR 0116).
  const productChecks = productModuleActive();
  const productHealth = useProductHealth(productChecks ? ids : '', refreshKey);
  useEffect(() => {
    let active = true;
    setPreviews({});
    setPreviewError(false);
    if (!ids) return;
    const values = ids.split(','),
      batches: string[][] = [];
    for (let i = 0; i < values.length; i += PAGE_SIZE) batches.push(values.slice(i, i + PAGE_SIZE));
    void Promise.all(batches.map(readCampaignPreviews))
      .then((responses) => {
        if (active) setPreviews(Object.fromEntries(responses.flat().map((p) => [p.id, p])));
      })
      .catch(() => {
        if (active) setPreviewError(true);
      });
    return () => {
      active = false;
    };
  }, [ids, refreshKey]);
  const run = async (id: string, action: () => Promise<unknown>, openCreated = false) => {
    if (busyRef.current.has(id)) return;
    mutationErrorsRef.current.delete(id);
    setMutationErrors(new Map(mutationErrorsRef.current));
    busyRef.current.add(id);
    setBusy(new Set(busyRef.current));
    onBusyChange?.(true);
    let createdId: string | null = null;
    try {
      const result = await action();
      await refresh();
      setRefreshKey((n) => n + 1);
      if (
        openCreated &&
        result &&
        typeof result === 'object' &&
        'id' in result &&
        typeof result.id === 'string'
      )
        createdId = result.id;
    } catch (cause) {
      const row = rows.find((candidate) => candidate.id === id);
      const name = row ? nameOf(row) : __('Deleted campaign', 'wconvert');
      /* translators: 1: a campaign's name, 2: why an action on it failed. */
      mutationErrorsRef.current.set(id, { message: sprintf(__('%1$s: %2$s', 'wconvert'), name, messageOf(cause)), action, openCreated });
      setMutationErrors(new Map(mutationErrorsRef.current));
    } finally {
      if (createdId) createdToOpen.current = createdId;
      busyRef.current.delete(id);
      setBusy(new Set(busyRef.current));
      onBusyChange?.(busyRef.current.size > 0);
    }
    // The effect opens a created draft after every pending write releases navigation.
  };
  // One path for a confirmed decision, whether the list's confirm or Details' strip asked it.
  const decide = (d: Decision) =>
    void run(d.parent?.id ?? d.row.id, () =>
      d.kind === 'delete'
        ? deleteOptin(d.row.id)
        : d.kind === 'pause'
          ? unpublishOptin(d.row.id)
          : d.kind === 'winner'
            ? declareWinner(d.parent!.id, d.row.id)
            : publishOptin(d.row.id),
    );
  const duplicate = (row: OptinSummary, parent: OptinSummary) =>
    void run(parent.id, () => duplicateCampaign(row.id, sprintf(__('%s — copy', 'wconvert'), nameOf(row))), true);
  // An arm's A/B test is its parent row; a campaign is its own.
  const parentOf = (row: OptinSummary) =>
    row.parent_id === null ? row : rows.find((candidate) => candidate.id === row.parent_id) ?? row;
  const request = (next: Decision, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setDecision(next);
  };
  const openDetails = (row: OptinSummary, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setSelected(row);
  };
  const edit = (id: string) => {
    if (busyRef.current.size > 0) return;
    setSelected(null);
    onEdit(id);
  };
  const period = report ? { days: report.days } : { days };
  const reportReady = report !== null;
  // A key the registry does not name is "Unknown goal", never the stored key.
  const goalOf = (row: OptinSummary): string | null =>
    labelsError ? __('Goal unavailable', 'wconvert') : labels === null ? null : labelOf(row.goal, labels, __('Unknown goal', 'wconvert'));
  const describe = (row: OptinSummary): string =>
    [previews[row.id] ? displayTypeLabel(previews[row.id].display_type) : null, goalOf(row)].filter(Boolean).join(' · ');
  const resultsOf = (row: OptinSummary): CampaignResults =>
    report
      ? { status: 'ready', days: report.days, from: report.from, to: report.to, result: numbers[row.id] }
      : reportError
        ? { status: 'failed' }
        : { status: 'loading' };
  const filters = [
    ['all', __('All', 'wconvert')],
    ['published', __('Published', 'wconvert')],
    ['draft', __('Drafts', 'wconvert')],
    ['suspended', __('Suspended', 'wconvert')],
  ] as const;
  const preview = (row: OptinSummary) => (
    <div className="wconvert-campaign-thumbnail">
      {previews[row.id]?.template ? (
        <Suspense fallback={<div className="wconvert-preview-placeholder" />}>
          <Design template={previews[row.id].template!} />
        </Suspense>
      ) : (
        <div
          className="wconvert-preview-placeholder"
          aria-label={
            previewError
              ? __('Preview unavailable', 'wconvert')
              : previews[row.id]
                ? __('No saved design', 'wconvert')
                : __('Loading preview', 'wconvert')
          }
        >
          <Megaphone aria-hidden="true" />
        </div>
      )}
    </div>
  );
  const rowView = (row: OptinSummary, parent: OptinSummary, arm: boolean) => {
    const status = statusOf(row),
      result = numbers[row.id],
      testing = parent.arms.length > 0,
      name = nameOf(row),
      variants = parent.arms.length + 1;
    const nextLabel = row.has_unpublished_changes
      ? __('Review changes', 'wconvert')
      : status === 'suspended'
        ? __('Review issue', 'wconvert')
        : status === 'draft'
          ? __('Continue editing', 'wconvert')
          : __('Edit', 'wconvert');
    return (
      <CampaignRow key={row.id} name={name} arm={arm}>
        <DataTableCell label={__('Campaign', 'wconvert')} className="wconvert-campaign-identity">
          {/* The name is the keyboard door to Details; the picture is a second, pointer-only one. */}
          <button
            type="button"
            className="wconvert-preview-button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => openDetails(row, e.currentTarget)}
          >
            {preview(row)}
          </button>
          <div className="min-w-0">
            <button type="button" className="wconvert-campaign-name" aria-haspopup="dialog" onClick={(e) => openDetails(row, e.currentTarget)}>
              {name}
            </button>
            <p className="wconvert-campaign-meta">{describe(row)}</p>
            {testing && !arm && (
              <button
                type="button"
                className="wconvert-family-toggle"
                aria-expanded={!collapsed.has(row.id)}
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.add(row.id);
                    return next;
                  })
                }
              >
                {sprintf(_n('A/B test · %d variant', 'A/B test · %d variants', variants, 'wconvert'), variants)}
                <ChevronDown aria-hidden="true" className="wconvert-family-toggle__chevron" />
              </button>
            )}
            {arm && <span className="wconvert-campaign-meta">{__('Variant', 'wconvert')}</span>}
          </div>
        </DataTableCell>
        <DataTableCell label={__('Status', 'wconvert')} className="wconvert-campaign-state">
          <StatusBadge status={status} />
          {canUnpublish(status) && row.has_unpublished_changes && (
            <p className="wconvert-campaign-note">{__('Unpublished changes', 'wconvert')}</p>
          )}
          {status === 'suspended' && <p className="wconvert-campaign-note">{row.suspended}</p>}
          {productHealthLabel(productHealth.rows[row.id]) && <button type="button" className="wconvert-product-health-link" aria-haspopup="dialog" onClick={e => openDetails(row, e.currentTarget)}>
            {productHealthLabel(productHealth.rows[row.id])}
          </button>}
        </DataTableCell>
        <DataTableCell label={__('Results', 'wconvert')} numeric className="wconvert-campaign-results">
          {reportReady && result ? (
            <a
              href={reportHref({ optinId: row.id, ...period })}
              aria-label={sprintf(__('View %s report', 'wconvert'), name)}
            >
              <strong>{formatCount(result.count)}</strong>
              <span>{result.label}</span>
              {result.shown > 0 && (
                <span>
                  {/* translators: 1: a conversion rate such as "2.5%", 2: how many times the campaign was shown. */}
                  {sprintf(__('%1$s of %2$s shown', 'wconvert'), formatRate(result.rate), formatCount(result.shown))}
                </span>
              )}
            </a>
          ) : !reportReady && reportLoading ? (
            <Skeleton aria-hidden="true" className="ms-auto w-10 max-w-full" style={{ blockSize: '1lh' }} />
          ) : (
            <span>
              {!reportReady && reportError
                ? __('Results unavailable', 'wconvert')
                : status === 'draft'
                  ? __('No results yet', 'wconvert')
                  : __('No results in this period', 'wconvert')}
            </span>
          )}
        </DataTableCell>
        <DataTableActions className="wconvert-campaign-row-actions">
          <Button variant="ghost" className="text-action" disabled={busy.size > 0} onClick={() => onEdit(row.id)}>
            {nextLabel}
          </Button>
          <CampaignMenu
            row={row}
            name={name}
            parent={parent}
            arm={arm}
            busy={busy.has(parent.id)}
            navigationBusy={busy.size > 0}
            missingDesign={previews[row.id]?.template === null}
            result={result}
            reportReady={reportReady}
            days={period.days}
            range={report ? { from: report.from, to: report.to } : undefined}
            onDetails={(trigger) => openDetails(row, trigger)}
            onDuplicate={() => duplicate(row, parent)}
            onTest={() => void run(parent.id, () => createVariant(parent.id), true)}
            onDecision={(kind, trigger) => request({ kind, row, parent }, trigger)}
          />
        </DataTableActions>
      </CampaignRow>
    );
  };
  const empty = list.status === 'ready' && rows.length === 0;
  useEffect(() => onEmptyChange?.(empty), [empty, onEmptyChange]);
  const decisionWords = decision ? decisionCopy(decision.kind, decision.row.parent_id !== null, nameOf(decision.row)) : null;
  return (
    <div className="wconvert-campaign-workspace" data-layout={layout}>
      {/*
        One sheet (GUIDELINES §1): the filters, the rows, the pager and the
        footer are all inside the region, so it draws the only edge.
      */}
      <Region label={__('Campaigns', 'wconvert')}>
        {list.status === 'failed' ? (
          <RegionErrorState message={list.message} onRetry={() => void refresh()} />
        ) : (
          <>
            {error && <RegionError message={error} onRetry={() => void refresh()} />}
            {[...mutationErrors].map(([id, failure]) => (
              <RegionError
                key={id}
                message={failure.message}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy.has(id) || (failure.openCreated && busy.size > 0)}
                    onClick={() => void run(id, failure.action, failure.openCreated)}
                  >
                    {busy.has(id) ? __('Trying again…', 'wconvert') : __('Try again', 'wconvert')}
                  </Button>
                }
              />
            ))}
            {(reportError || previewError || labelsError) && <RegionError
              message={[
                reportError && (report ? __('Results couldn’t refresh. The previous period and results remain below.', 'wconvert') : __('Results couldn’t load.', 'wconvert')),
                previewError && __('Design previews couldn’t load.', 'wconvert'),
                labelsError && __('Goal names couldn’t load.', 'wconvert'),
              ].filter(Boolean).join(' ')}
              onRetry={() => setRefreshKey((n) => n + 1)}
            />}
            {productChecks && productHealth.failed && (
              <RegionError message={__('Products couldn’t be checked.', 'wconvert')} onRetry={productHealth.recheck} />
            )}
            {productChecks && productHealth.loading && (
              <p role="status" className="sr-only">{__('Checking products…', 'wconvert')}</p>
            )}
            {!empty && (
              <>
                <div className="wconvert-toolbar wconvert-campaign-filterbar">
                  <OptionStrip
                    label={__('Filter campaigns by status', 'wconvert')}
                    value={filter}
                    onChange={(value) => {
                      setFilter(value as typeof filter);
                      setPage(0);
                    }}
                    // A status nothing is in filters nothing, so only All and
                    // the statuses in use are offered — and the selected one,
                    // so a chip never vanishes from under the pointer.
                    options={filters
                      .map(([id, label]) => ({
                        value: id,
                        label,
                        count: list.status === 'ready'
                          ? rows.filter((c) => id === 'all' || family(c).some((r) => statusOf(r) === id)).length
                          : undefined,
                      }))
                      .filter((option) => option.value === 'all' || option.value === filter || option.count !== 0)}
                  />
                  <label className="wconvert-campaign-period">
                    {__('Results period', 'wconvert')}
                    <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value))}>
                      <option value={30}>{__('Last 30 days', 'wconvert')}</option>
                      <option value={7}>{__('Last 7 days', 'wconvert')}</option>
                    </NativeSelect>
                  </label>
                </div>
                <div className="wconvert-toolbar wconvert-campaign-toolbar">
                  <PickerSearch
                    label={__('Search campaigns', 'wconvert')}
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      setPage(0);
                    }}
                  />
                  <div className="wconvert-campaign-viewtools">
                    <NativeSelect
                      aria-label={__('Sort campaigns', 'wconvert')}
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="newest">{__('Newest first', 'wconvert')}</option>
                      <option value="name">{__('Name A–Z', 'wconvert')}</option>
                      <option value="results">{__('Most results', 'wconvert')}</option>
                    </NativeSelect>
                    <div className="wconvert-campaign-layout" role="group" aria-label={__('Campaign layout', 'wconvert')}>
                      <label>
                        <input type="radio" name="campaign-layout" aria-label={__('List view', 'wconvert')} checked={layout === 'list'} onChange={() => setLayout('list')} />
                        <List aria-hidden="true" />
                      </label>
                      <label>
                        <input type="radio" name="campaign-layout" aria-label={__('Gallery view', 'wconvert')} checked={layout === 'gallery'} onChange={() => setLayout('gallery')} />
                        <LayoutGrid aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
            {empty ? (
              <EmptyState
                icon={Megaphone}
                title={__('No campaigns yet', 'wconvert')}
                action={
                  onCreate && (
                    <Button ref={createFocus} onClick={onCreate}>
                      <Plus aria-hidden="true" />
                      {__('Create your first campaign', 'wconvert')}
                    </Button>
                  )
                }
              >
                {__('Choose a goal, pick a ready-made setup, and publish when you’re ready.', 'wconvert')}
              </EmptyState>
            ) : list.status === 'ready' && visible.length === 0 ? (
              <EmptyState
                icon={Search}
                title={__('No campaigns found', 'wconvert')}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                      setPage(0);
                    }}
                  >
                    {__('Clear filters', 'wconvert')}
                  </Button>
                }
              >
                {__('Try another name or clear your filters.', 'wconvert')}
              </EmptyState>
            ) : (
              <DataTable label={__('Campaigns', 'wconvert')} className="wconvert-campaign-table">
                <DataTableHead>
                  <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
                  <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
                  <DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn>
                  <DataTableColumn>{__('Next action', 'wconvert')}</DataTableColumn>
                </DataTableHead>
                {list.status === 'loading' ? <CampaignSkeleton /> : <DataTableBody>
                  {shown.flatMap((c) => [
                    rowView(c, c, false),
                    ...(!collapsed.has(c.id) ? c.arms.map((arm) => rowView(arm, c, true)) : []),
                  ])}
                </DataTableBody>}
              </DataTable>
            )}
            {/* One line: how many and over which dates, then the pages. */}
            {list.status === 'ready' && !empty && <div className="wconvert-footer wconvert-campaign-footer">
              <span>
                {sprintf(_n('%d campaign', '%d campaigns', visible.length, 'wconvert'), visible.length)}
                {report && <> · {formatRange(report.from, report.to)}</>}
              </span>
              {lastPage > 0 && (
                <nav className="wconvert-toolbar wconvert-campaign-pagination" aria-label={__('Campaign pages', 'wconvert')}>
                  <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                    <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
                    {__('Previous', 'wconvert')}
                  </Button>
                  <span aria-live="polite" aria-atomic="true">
                    {sprintf(__('Page %1$d of %2$d', 'wconvert'), currentPage + 1, lastPage + 1)}
                  </span>
                  <Button variant="outline" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>
                    {__('Next', 'wconvert')}
                    <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
                  </Button>
                </nav>
              )}
              {shown.some((c) => c.arms.length > 0) && (
                <p className="wconvert-campaign-test-note">
                  {__('A/B tests split visitors by browser, not by person.', 'wconvert')}
                </p>
              )}
            </div>}
          </>
        )}
      </Region>
      <CampaignDetailsDialog
        row={selected}
        name={selected ? nameOf(selected) : ''}
        meta={selected ? [selected.parent_id !== null ? __('A/B variant', 'wconvert') : null, describe(selected)].filter(Boolean).join(' · ') : ''}
        // A campaign with no saved design gets a sentence, not a large empty frame.
        thumbnail={selected && previews[selected.id]?.template !== null && preview(selected)}
        missingDesign={selected !== null && previews[selected.id]?.template === null}
        results={selected ? resultsOf(selected) : { status: 'loading' }}
        goalId={selected?.goal ?? ''}
        goal={goalEntries ? ready(goalEntries.find((entry) => entry.id === selected?.goal) ?? null) : labelsError ? failed(new Error(labelsError)) : LOADING}
        productCheck={selected && (
          <ProductHealthDetails
            health={productHealth.rows[selected.id]}
            loading={productHealth.loading}
            failed={productHealth.failed}
            onRecheck={productHealth.recheck}
            reviewDisabled={busy.size > 0}
            onReview={() => edit(selected.id)}
          />
        )}
        reportLink={selected ? reportHref({ optinId: selected.id, ...period }) : ''}
        leadsLink={selected && reportReady && numbers[selected.id]?.capture
          ? leadsHref({ optinId: selected.id, ...(report ? { from: report.from, to: report.to } : {}) }) : undefined}
        editBusy={busy.size > 0}
        onEdit={() => selected && edit(selected.id)}
        onDecide={(kind) => {
          if (!selected) return;
          const row = selected;
          setSelected(null);
          decide({ kind, row, parent: parentOf(row) });
        }}
        onDuplicate={() => {
          if (!selected) return;
          const row = selected;
          setSelected(null);
          duplicate(row, parentOf(row));
        }}
        onClose={() => setSelected(null)}
        returnFocus={returnFocus}
      />
      <ConfirmDialog
        variant={decision?.kind === 'delete' ? 'destructive' : 'default'}
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={decisionWords?.title ?? ''}
        description={decisionWords?.description ?? ''}
        confirmLabel={decisionWords?.confirmLabel ?? ''}
        returnFocusTo={returnFocus}
        onConfirm={() => {
          if (!decision) return;
          const d = decision;
          setDecision(null);
          decide(d);
        }}
      />
    </div>
  );
}

function CampaignRow({
  name,
  arm,
  children,
}: {
  name: string;
  arm: boolean;
  children: React.ReactNode;
}) {
  return (
    <DataTableRow
      className={arm ? 'wconvert-campaign-row is-arm' : 'wconvert-campaign-row'}
      label={name}
    >
      {children}
    </DataTableRow>
  );
}

/** Every row action past the next one, with an icon and a label (GUIDELINES §20). */
function CampaignMenu({
  row,
  name,
  parent,
  arm,
  busy,
  navigationBusy,
  missingDesign,
  result,
  reportReady,
  days,
  range,
  onDetails,
  onDuplicate,
  onTest,
  onDecision,
}: {
  row: OptinSummary;
  name: string;
  parent: OptinSummary;
  arm: boolean;
  busy: boolean;
  navigationBusy: boolean;
  missingDesign: boolean;
  result?: RowResult;
  reportReady: boolean;
  days: number;
  range?: { from: string; to: string };
  onDetails: (trigger: HTMLElement | null) => void;
  onDuplicate: () => void;
  onTest: () => void;
  onDecision: (kind: Decision['kind'], trigger: HTMLElement | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    status = statusOf(row);
  const availability = adminSettings()?.variants?.availability ?? 'locked';
  const upsell = !arm && availability !== 'ready' && renderingFor(availability, 'settings_list') === 'upsell';
  const publish = (replaces: boolean) => (
    <OptionItem
      icon={Upload}
      name={__('Publish saved draft', 'wconvert')}
      // The one action whose result is not in its name (ADR 0139).
      hint={replaces ? __('Replaces the live version', 'wconvert') : null}
      refused={missingDesign ? refusal(__('Add a design first', 'wconvert'), __('Add a design in the editor before publishing.', 'wconvert')) : null}
      onSelect={() => onDecision('publish', trigger.current)}
    />
  );
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={sprintf(__('More actions for %s', 'wconvert'), name)}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <OptionMenuContent align="end" sideOffset={5} className="wconvert-campaign-menu" aria-label={sprintf(/* translators: %s: a campaign's name. */ __('More actions for %s', 'wconvert'), name)}>
        <OptionGroup heading={name}>
          <OptionItem icon={Info} name={__('Details', 'wconvert')} onSelect={() => onDetails(trigger.current)} />
          <OptionItem icon={ChartNoAxesCombined} name={__('View report', 'wconvert')} href={reportHref({ optinId: row.id, days })} />
          {reportReady && result?.capture && (
            <OptionItem icon={Inbox} name={__('View submissions', 'wconvert')} href={leadsHref({ optinId: row.id, ...range })} />
          )}
          <OptionSeparator />
          <OptionItem icon={Copy} name={__('Duplicate as draft', 'wconvert')} disabled={navigationBusy} onSelect={onDuplicate} />
          {!arm && availability === 'ready' && (
            <OptionItem icon={Split} disabled={navigationBusy} onSelect={onTest}
              name={parent.arms.length ? __('Add another variant', 'wconvert') : __('Create A/B test', 'wconvert')} />
          )}
          <OptionSeparator />
          {canUnpublish(status) ? (
            <OptionItem icon={EyeOff} name={arm ? __('Unpublish variant', 'wconvert') : __('Unpublish campaign', 'wconvert')}
              onSelect={() => onDecision('pause', trigger.current)} />
          ) : publish(false)}
          {canUnpublish(status) && row.has_unpublished_changes && publish(true)}
          {parent.arms.length > 0 && (
            <OptionItem icon={Trophy} name={__('Use this variant', 'wconvert')} onSelect={() => onDecision('winner', trigger.current)} />
          )}
          <OptionSeparator />
          <OptionItem icon={Trash2} destructive name={arm ? __('Delete variant', 'wconvert') : __('Delete campaign', 'wconvert')}
            onSelect={() => onDecision('delete', trigger.current)} />
        </OptionGroup>
        {/* Upsells are grey with a lock (GUIDELINES §14): a line, not a dead item, because the route does not exist on this build. */}
        {upsell && (
          <OptionGroup heading={sprintf(/* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */ __('With %s', 'wconvert'), tierProductName(adminSettings()?.variants?.tier ?? undefined))} icon="lock">
            <OptionItem icon={Split} name={__('Create A/B test', 'wconvert')} />
          </OptionGroup>
        )}
      </OptionMenuContent>
    </DropdownMenu>
  );
}
