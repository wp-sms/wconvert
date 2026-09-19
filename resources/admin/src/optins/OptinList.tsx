import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Inbox,
  LayoutGrid,
  List,
  Megaphone,
  MoreHorizontal,
  Pause,
  Plus,
  Search,
  SlidersHorizontal,
  Split,
  Stethoscope,
  Trash2,
  Trophy,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { listGoals } from '../goals/api';
import { tierProductName } from '../goals/availability';
import { displayTypeLabel } from '../displayTypes';
import { adminSettings } from '../settings';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { EmptyState } from '../shell/EmptyState';
import { Region, RegionError, RegionErrorState } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { leadsHref, reportHref, settingsHref } from '../nav';
import { readDashboard, type DashboardPayload } from '../stats/api';
import { formatCount, formatRate } from '../stats/format';
import { rangeLabel } from '../stats/reporting';
import { InspectDialog } from './InspectDialog';
import {
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
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { CampaignSkeleton } from './CampaignSkeleton';
import { StatusBadge } from './StatusBadge';
import './campaigns.css';

const Design = lazy(() => import('./CampaignDesign'));
const Details = lazy(() => import('./CampaignDetails'));
const PAGE_SIZE = 12;
type RowResult = {
  count: number;
  shown: number;
  rate: number | null;
  label: string;
  capture: boolean;
};
type Decision = {
  kind: 'delete' | 'pause' | 'publish' | 'winner';
  row: OptinSummary;
  parent?: OptinSummary;
};
/** Campaign management owns its layout; existing reads and mutation routes own the facts. */
export function OptinList({
  onEdit,
  onCreate,
  onBusyChange,
}: {
  onEdit: (id: string) => void;
  onCreate?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [list, setList] = useState<Loadable<OptinSummary[]>>(LOADING);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string> | null>(null);
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
  const [inspecting, setInspecting] = useState(false);
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
        if (active) setLabels(Object.fromEntries(goals.map((g) => [g.id, g.label])));
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
  const matches = (c: OptinSummary) =>
    (filter === 'all' || family(c).some((r) => statusOf(r) === filter)) &&
    family(c).some((r) =>
      `${r.name} ${labels?.[r.goal] ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    );
  const visible = rows
    .filter(matches)
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.id.localeCompare(a.id)));
  const lastPage = Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1),
    currentPage = Math.min(page, lastPage);
  const shown = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const displayed = shown.flatMap((c) => (collapsed.has(c.id) ? [c] : family(c)));
  const ids = displayed.map((c) => c.id).join(',');
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
      const name = rows.find((row) => row.id === id)?.name ?? id;
      mutationErrorsRef.current.set(id, { message: `${name}: ${messageOf(cause)}`, action, openCreated });
      setMutationErrors(new Map(mutationErrorsRef.current));
    } finally {
      if (createdId) createdToOpen.current = createdId;
      busyRef.current.delete(id);
      setBusy(new Set(busyRef.current));
      onBusyChange?.(busyRef.current.size > 0);
    }
    // The effect opens a created draft after every pending write releases navigation.
  };
  const request = (next: Decision, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setDecision(next);
  };
  const openDetails = (row: OptinSummary, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setSelected(row);
  };
  const period = report ? { days: report.days } : { days };
  const reportReady = report !== null;
  const filters = [
    ['all', __('All', 'wconvert')],
    ['published', __('Published', 'wconvert')],
    ['draft', __('Drafts', 'wconvert')],
    ['suspended', __('Needs attention', 'wconvert')],
  ] as const;
  const preview = (row: OptinSummary) => (
    <div className="wc-campaign-thumbnail">
      {previews[row.id]?.template ? (
        <Suspense fallback={<div className="wc-preview-placeholder" />}>
          <Design template={previews[row.id].template!} />
        </Suspense>
      ) : (
        <div
          className="wc-preview-placeholder"
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
      testing = parent.arms.length > 0;
    const nextLabel = row.has_unpublished_changes
      ? __('Review changes', 'wconvert')
      : status === 'suspended'
        ? __('Review issue', 'wconvert')
        : status === 'draft'
          ? __('Continue editing', 'wconvert')
          : __('Edit', 'wconvert');
    return (
      <CampaignRow key={row.id} row={row} arm={arm}>
        <DataTableCell label={__('Campaign', 'wconvert')} className="wc-campaign-identity">
          <button
            className="wc-preview-button"
            onClick={(e) => openDetails(row, e.currentTarget)}
            aria-label={sprintf(__('Preview %s', 'wconvert'), row.name)}
          >
            {preview(row)}
          </button>
          <div>
            <button className="wc-campaign-name" onClick={(e) => openDetails(row, e.currentTarget)}>
              {row.name}
            </button>
            <p className="wc-campaign-meta">
              {displayTypeLabel(previews[row.id]?.display_type)}
              {previews[row.id] && labels?.[row.goal] ? ' · ' : ''}
              {labels?.[row.goal] ?? (labelsError ? __('Goal unavailable', 'wconvert') : labels === null ? null : <code>{row.goal}</code>)}
            </p>
            {testing && !arm && (
              <button
                className="wc-family-toggle"
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
                {collapsed.has(row.id) ? (
                  <ChevronRight className="wc-chevron-collapsed" aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                )}
                {sprintf(__('A/B test · %d designs', 'wconvert'), parent.arms.length + 1)}
              </button>
            )}
            {arm && <span className="wc-campaign-meta">{__('Variant', 'wconvert')}</span>}
          </div>
        </DataTableCell>
        <DataTableCell label={__('Status', 'wconvert')} className="wc-campaign-state">
          <StatusBadge status={status} />
          {canUnpublish(status) && row.has_unpublished_changes && (
            <p className="wc-campaign-note">{__('Unpublished changes', 'wconvert')}</p>
          )}
          {status === 'suspended' && <p className="wc-campaign-note">{row.suspended}</p>}
        </DataTableCell>
        <DataTableCell label={__('Results', 'wconvert')} numeric className="wc-campaign-results">
          {reportReady && result ? (
            <a
              href={reportHref({ optinId: row.id, ...period })}
              aria-label={sprintf(__('View %s report', 'wconvert'), row.name)}
            >
              <strong>{formatCount(result.count)}</strong>
              <span>{result.label}</span>
            </a>
          ) : (
            <span>
              {!reportReady && reportLoading
                ? '—'
                : !reportReady && reportError
                  ? __('Unavailable', 'wconvert')
                  : status === 'draft'
                    ? __('No results yet', 'wconvert')
                    : __('No activity', 'wconvert')}
            </span>
          )}
        </DataTableCell>
        <DataTableActions className="wc-campaign-actions">
          <Button
            variant="outline"
            disabled={busy.size > 0}
            onClick={(e) =>
              status === 'suspended' ? openDetails(row, e.currentTarget) : onEdit(row.id)
            }
          >
            {nextLabel}
          </Button>
          <CampaignMenu
            row={row}
            parent={parent}
            arm={arm}
            busy={busy.has(parent.id)}
            navigationBusy={busy.size > 0}
            missingDesign={previews[row.id]?.template === null}
            result={result}
            reportReady={reportReady}
            days={period.days}
            range={report ? { from: report.from, to: report.to } : undefined}
            onPreview={(trigger) => openDetails(row, trigger)}
            onInspect={() => setInspecting(true)}
            onDuplicate={() =>
              void run(
                parent.id,
                () => duplicateCampaign(row.id, sprintf(__('%s — copy', 'wconvert'), row.name)),
                true,
              )
            }
            onTest={() => void run(parent.id, () => createVariant(parent.id), true)}
            onDecision={(kind, trigger) => request({ kind, row, parent }, trigger)}
          />
        </DataTableActions>
      </CampaignRow>
    );
  };
  return (
    <div className="wc-campaign-workspace" data-layout={layout}>
      {list.status === 'failed' ? (
        <Region label={__('Campaigns', 'wconvert')}>
          <RegionErrorState message={list.message} action={
            <Button onClick={() => void refresh()} variant="outline">
              {__('Try again', 'wconvert')}
            </Button>
          } />
        </Region>
      ) : (
        <>
          <div className="wconvert-toolbar wc-campaign-filterbar">
            <div
              className="wc-campaign-filters"
              role="radiogroup"
              aria-label={__('Filter Campaigns by status', 'wconvert')}
            >
              {filters.map(([id, label]) => (
                <label key={id}>
                  <input type="radio" name="campaign-status" value={id} checked={filter === id}
                    aria-label={label} onChange={() => { setFilter(id); setPage(0); }} />
                  {label}
                  <span>
                    {list.status === 'loading'
                      ? '—'
                      : rows.filter(
                          (c) => id === 'all' || family(c).some((r) => statusOf(r) === id),
                        ).length}
                  </span>
                </label>
              ))}
            </div>
            <label className="wc-campaign-period">
              {__('Results', 'wconvert')}
              <select
                aria-label={__('Results period', 'wconvert')}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={30}>{__('Last 30 days', 'wconvert')}</option>
                <option value={7}>{__('Last 7 days', 'wconvert')}</option>
              </select>
            </label>
          </div>
          <Region label={__('Campaigns', 'wconvert')}>
            {error && <RegionError message={error} action={<Button variant="outline" onClick={() => void refresh()}>{__('Refresh campaigns', 'wconvert')}</Button>} />}
            {[...mutationErrors].map(([id, failure]) => <RegionError key={id} message={failure.message} action={<Button variant="outline" disabled={busy.has(id) || (failure.openCreated && busy.size > 0)} onClick={() => void run(id, failure.action, failure.openCreated)}>{__('Retry action', 'wconvert')}</Button>} />)}
            {(reportError || previewError || labelsError) && <RegionError
              message={[
                reportError && (report ? __('Results couldn’t refresh. The previous period and results remain below.', 'wconvert') : __('Results couldn’t load.', 'wconvert')),
                previewError && __('Design previews couldn’t load.', 'wconvert'),
                labelsError && __('Goal names couldn’t load.', 'wconvert'),
              ].filter(Boolean).join(' ')}
              action={<Button variant="outline" onClick={() => setRefreshKey((n) => n + 1)}>{__('Retry', 'wconvert')}</Button>}
            />}
            <div className="wconvert-toolbar wc-campaign-toolbar">
              <label className="wc-campaign-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  aria-label={__('Search Campaigns', 'wconvert')}
                  placeholder={__('Search campaigns…', 'wconvert')}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <div className="wc-campaign-viewtools">
                <select
                  aria-label={__('Sort campaigns', 'wconvert')}
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="newest">{__('Newest first', 'wconvert')}</option>
                  <option value="name">{__('Name A–Z', 'wconvert')}</option>
                </select>
                <div className="wc-campaign-layout" role="radiogroup" aria-label={__('Campaign layout', 'wconvert')}>
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
            {list.status === 'ready' && rows.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title={__('Start with one good campaign.', 'wconvert')}
                action={
                  onCreate && (
                    <Button ref={createFocus} onClick={onCreate}>
                      <Plus aria-hidden="true" />
                      {__('Create your first campaign', 'wconvert')}
                    </Button>
                  )
                }
              >
                {__('Choose a goal, customize a design, and publish when you’re ready.', 'wconvert')}
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
              <DataTable label={__('Campaigns', 'wconvert')} className="wc-campaign-table">
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
          </Region>
          <div className="wconvert-footer wc-campaign-footer">
            <span>
              {list.status === 'loading'
                ? __('Loading campaigns…', 'wconvert')
                : sprintf(
                    _n('%d campaign', '%d campaigns', visible.length, 'wconvert'),
                    visible.length,
                  )}
              {report && (
                <>
                  {' '}
                  · {rangeLabel(report.from, report.to)} · {__('Through yesterday', 'wconvert')}
                </>
              )}
            </span>
            <a href={settingsHref('experience')}>
              <SlidersHorizontal aria-hidden="true" />
              {__('Visitor experience', 'wconvert')}
            </a>
          </div>
          {shown.some((c) => c.arms.length > 0) && (
            <p className="wc-campaign-test-note">
              {__(
                'A/B assignments use browser storage, not unique people. Results count recorded views and conversions.',
                'wconvert',
              )}
            </p>
          )}
          {lastPage > 0 && (
            <div className="wconvert-footer wc-campaign-pagination">
              <Button
                    variant="outline"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {__('Previous', 'wconvert')}
              </Button>
              <span>
                {sprintf(__('Page %1$d of %2$d', 'wconvert'), currentPage + 1, lastPage + 1)}
              </span>
              <Button
                    variant="outline"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                {__('Next', 'wconvert')}
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="wc-campaign-detail"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {__(
                'Preview of the saved design. Display rules determine where and when visitors see it.',
                'wconvert',
              )}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              {preview(selected)}
              <StatusBadge status={statusOf(selected)} />
              {statusOf(selected) === 'published' && selected.has_unpublished_changes && (
                <p>
                  {__(
                    'Your previous version remains published. Review the saved draft in the editor before publishing your changes.',
                    'wconvert',
                  )}
                </p>
              )}
              {selected.suspended && <p>{selected.suspended}</p>}
              {statusOf(selected) === 'suspended' && selected.has_unpublished_changes && (
                <p>
                  {__(
                    'The saved draft has unpublished changes. Resolve the issue before this campaign can show again.',
                    'wconvert',
                  )}
                </p>
              )}
              <p>
                {displayTypeLabel(previews[selected.id]?.display_type)}
                {previews[selected.id] && labels?.[selected.goal] ? ' · ' : ''}
                {labels?.[selected.goal]}
              </p>
              {reportReady && numbers[selected.id] && (
                <div className="wc-campaign-detail-stats">
                  <div>
                    <strong>{formatCount(numbers[selected.id].count)}</strong>
                    <span>{numbers[selected.id].label}</span>
                  </div>
                  <div>
                    <strong>{formatCount(numbers[selected.id].shown)}</strong>
                    <span>{__('Times shown', 'wconvert')}</span>
                  </div>
                  <div>
                    <strong>{formatRate(numbers[selected.id].rate)}</strong>
                    <span>{__('Conversion rate', 'wconvert')}</span>
                  </div>
                </div>
              )}
              {reportReady && report && (
                <p>
                  {rangeLabel(report.from, report.to)} ·{' '}
                  {__('Through yesterday. Results include earlier activity.', 'wconvert')}
                </p>
              )}
              <Suspense fallback={<RowsSkeleton rows={4} />}>
                <Details key={selected.id} id={selected.id} />
              </Suspense>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy.size > 0}
                  onClick={() => {
                    if (busyRef.current.size > 0) return;
                    const id = selected.id;
                    setSelected(null);
                    onEdit(id);
                  }}
                >
                  {__('Open editor', 'wconvert')}
                </Button>
                <Button variant="outline" asChild>
                  <a href={reportHref({ optinId: selected.id, ...period })}>
                    {__('View report', 'wconvert')}
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <InspectDialog open={inspecting} onOpenChange={setInspecting} />
      <ConfirmDialog
        variant={decision?.kind === 'publish' ? 'default' : 'destructive'}
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={
          decision?.kind === 'delete'
            ? __('Delete this campaign?', 'wconvert')
            : decision?.kind === 'pause'
              ? __('Unpublish this campaign?', 'wconvert')
              : decision?.kind === 'winner'
                ? __('Use this design?', 'wconvert')
                : __('Publish the saved draft?', 'wconvert')
        }
        description={
          decision
            ? decision.kind === 'delete'
              ? sprintf(
                  __(
                    '“%s” stops being served and leaves this list. Its leads and conversions are kept.',
                    'wconvert',
                  ),
                  decision.row.name,
                )
              : decision.kind === 'pause'
                ? __(
                    'This design stops showing. Its saved draft, leads, and results are kept. Other A/B designs remain unchanged.',
                    'wconvert',
                  )
                : decision.kind === 'winner'
                  ? __(
                      'This design becomes the campaign. Other designs stop showing; their leads and results are kept. This does not establish statistical significance.',
                      'wconvert',
                    )
                  : __(
                      'The latest saved draft becomes the version visitors can see, subject to its display rules.',
                      'wconvert',
                    )
            : ''
        }
        confirmLabel={
          decision?.kind === 'delete'
            ? __('Delete campaign', 'wconvert')
            : decision?.kind === 'pause'
              ? __('Unpublish campaign', 'wconvert')
              : decision?.kind === 'winner'
                ? __('Use this design', 'wconvert')
                : __('Publish saved draft', 'wconvert')
        }
        returnFocusTo={returnFocus}
        onConfirm={() => {
          if (!decision) return;
          const d = decision;
          setDecision(null);
          void run(d.parent?.id ?? d.row.id, () =>
            d.kind === 'delete'
              ? deleteOptin(d.row.id)
              : d.kind === 'pause'
                ? unpublishOptin(d.row.id)
                : d.kind === 'winner'
                  ? declareWinner(d.parent!.id, d.row.id)
                  : publishOptin(d.row.id),
          );
        }}
      />
    </div>
  );
}

function CampaignRow({
  row,
  arm,
  children,
}: {
  row: OptinSummary;
  arm: boolean;
  children: React.ReactNode;
}) {
  return (
    <DataTableRow
      className={arm ? 'wc-campaign-row is-arm' : 'wc-campaign-row'}
      label={row.name}
    >
      {children}
    </DataTableRow>
  );
}
function CampaignMenu({
  row,
  parent,
  arm,
  busy,
  navigationBusy,
  missingDesign,
  result,
  reportReady,
  days,
  range,
  onPreview,
  onInspect,
  onDuplicate,
  onTest,
  onDecision,
}: {
  row: OptinSummary;
  parent: OptinSummary;
  arm: boolean;
  busy: boolean;
  navigationBusy: boolean;
  missingDesign: boolean;
  result?: RowResult;
  reportReady: boolean;
  days: number;
  range?: { from: string; to: string };
  onPreview: (trigger: HTMLElement | null) => void;
  onInspect: () => void;
  onDuplicate: () => void;
  onTest: () => void;
  onDecision: (kind: Decision['kind'], trigger: HTMLElement | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    status = statusOf(row);
  const availability = adminSettings()?.variants?.availability ?? 'locked';
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={sprintf(__('More actions for %s', 'wconvert'), row.name)}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5} className="wc-campaign-menu">
        <DropdownMenuLabel className="wc-menu-heading">{row.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onPreview(trigger.current)}>
          <Eye aria-hidden="true" />
          {__('Preview & details', 'wconvert')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={reportHref({ optinId: row.id, days })}>
            <ChartNoAxesCombined aria-hidden="true" />
            {__('View report', 'wconvert')}
          </a>
        </DropdownMenuItem>
        {reportReady && result?.capture && (
          <DropdownMenuItem asChild>
            <a href={leadsHref({ optinId: row.id, ...range })}>
              <Inbox aria-hidden="true" />
              {__('View submissions', 'wconvert')}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={navigationBusy} onSelect={onDuplicate}>
          <Copy aria-hidden="true" />
          {__('Duplicate as draft', 'wconvert')}
        </DropdownMenuItem>
        {!arm &&
          (availability === 'ready' ? (
            <DropdownMenuItem disabled={navigationBusy} onSelect={onTest}>
              <Split aria-hidden="true" />
              {parent.arms.length
                ? __('Add another variant', 'wconvert')
                : __('Create A/B test', 'wconvert')}
            </DropdownMenuItem>
          ) : availability === 'locked' ? (
            <DropdownMenuLabel className="wc-menu-note">
              {sprintf(
                __('A/B testing is available with %s.', 'wconvert'),
                tierProductName(adminSettings()?.variants?.tier ?? undefined),
              )}
            </DropdownMenuLabel>
          ) : null)}
        <DropdownMenuItem onSelect={onInspect}>
          <Stethoscope aria-hidden="true" />
          {__('Check visibility', 'wconvert')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canUnpublish(status) ? (
          <DropdownMenuItem onSelect={() => onDecision('pause', trigger.current)}>
            <Pause aria-hidden="true" />
            {__('Unpublish campaign', 'wconvert')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={missingDesign} onSelect={() => onDecision('publish', trigger.current)}>
            <Plus aria-hidden="true" />
            {__('Publish saved draft', 'wconvert')}
          </DropdownMenuItem>
        )}
        {canUnpublish(status) && row.has_unpublished_changes && (
          <DropdownMenuItem disabled={missingDesign} onSelect={() => onDecision('publish', trigger.current)}>
            <Plus aria-hidden="true" />
            {__('Publish saved draft', 'wconvert')}
          </DropdownMenuItem>
        )}
        {missingDesign && <DropdownMenuLabel className="wc-menu-note">{__('Add a design in the editor before publishing.', 'wconvert')}</DropdownMenuLabel>}
        {parent.arms.length > 0 && (
          <DropdownMenuItem onSelect={() => onDecision('winner', trigger.current)}>
            <Trophy aria-hidden="true" />
            {__('Use this design', 'wconvert')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onDecision('delete', trigger.current)}
        >
          <Trash2 aria-hidden="true" />
          {__('Delete campaign', 'wconvert')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
