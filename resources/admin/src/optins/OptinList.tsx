import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Copy,
  EyeOff,
  LayoutGrid,
  List,
  Megaphone,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { NativeSelect } from '../components/ui/native-select';
import { Skeleton } from '../components/ui/skeleton';
import { listGoals, type GoalEntry } from '../goals/api';
import { displayTypeLabel } from '../displayTypes';
import { PickerSearch } from '../discovery/PickerSearch';
import { productModuleActive } from '../settings';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { EmptyState } from '../shell/EmptyState';
import { OptionStrip } from '../shell/OptionStrip';
import { Region, RegionError, RegionErrorState } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { leadsHref, occasionHref, reportHref } from '../nav';
import type { Occasion } from '../discovery/api';
import { readOccasions, type OccasionNotice } from '../occasions/api';
import { OccasionNoticeView } from '../occasions/Notice';
import { readDashboard, type DashboardPayload } from '../stats/api';
import { rowResultOf, shownLine } from './rowResult';
import { formatCount, formatRange, labelOf } from '../lib/format';
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
import { CampaignMenu } from './CampaignMenu';
import { StatusBadge } from './StatusBadge';
import { GuideLink, SuspensionGuideLink } from '../shell/GuideLink';
import { GUIDES, docsUrl } from '../shell/docs';
import { CheckRow } from '../shell/CheckRow';
import { ToolbarCount } from '../shell/Toolbar';
import { groupConfirmCopy, plan, reduceResult, resultSentence, startResult, type ConfirmedAction, type GroupAction, type GroupPlan, type GroupResult } from './groupActions';
import './campaigns.css';

import { productHealthLabel, ProductHealthDetails, useProductHealth } from './ProductHealth';

const Design = lazy(() => import('./CampaignDesign'));
const PAGE_SIZE = 12;
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
  occasion,
  notice = null,
  onDismissNotice,
  onOccasionChange,
  onOpenOccasion,
  onCreateInOccasion,
}: {
  onEdit: (id: string) => void;
  onCreate?: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** An empty list carries the one Create button, so the header drops its own. */
  onEmptyChange?: (empty: boolean) => void;
  /** The Occasion filter, from the address so it survives a reload (ADR 0149). */
  occasion?: string;
  /** What an import did, kept above the rows it added. */
  notice?: OccasionNotice | null;
  onDismissNotice?: () => void;
  onOccasionChange?: (occasion?: string) => void;
  onOpenOccasion?: (occasion: string) => void;
  onCreateInOccasion?: (occasion: string) => void;
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
  // Ticked campaigns, by parent id. A variant is a sub-row and is never ticked.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [groupConfirm, setGroupConfirm] = useState<{ action: ConfirmedAction; plan: GroupPlan } | null>(null);
  const [groupResult, setGroupResult] = useState<GroupResult | null>(null);
  const trayFocus = useRef<HTMLElement | null>(null);
  const selectAll = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<Record<string, CampaignPreview>>({});
  const [previewError, setPreviewError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // The site's occasions, for the filter and each row's tag. A failed read
  // only hides both; the list itself does not depend on it.
  const [occasions, setOccasions] = useState<Occasion[] | null>(null);
  useEffect(() => {
    let active = true;
    readOccasions().then((data) => { if (active) setOccasions(data.items); }, () => { if (active) setOccasions([]); });
    return () => { active = false; };
  }, [refreshKey]);
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
          g.optins.map((r) => [r.id, rowResultOf(g, r)]),
        ),
      ),
    [report],
  );
  const all = list.status === 'ready' ? list.data : [];
  // A filter naming an occasion deleted since filters nothing.
  const chosen = occasion !== undefined && (occasions === null || occasions.some((item) => item.id === occasion)) ? occasion : undefined;
  const rows = chosen === undefined ? all : all.filter((c) => c.occasion === chosen);
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
  // A selection means "these, on this view": changing the view clears it.
  useEffect(() => setTicked(new Set()), [filter, query, currentPage, sort, chosen]);
  const tickedRows = shown.filter((c) => ticked.has(c.id));
  const allTicked = shown.length > 0 && tickedRows.length === shown.length;
  // A new selection, or any other action, makes the last group result old news.
  const toggle = (id: string) => {
    setGroupResult(null);
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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
    setGroupResult(null);
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
      const row = all.find((candidate) => candidate.id === id);
      const name = row ? nameOf(row) : __('Deleted campaign', 'wconvert');
      mutationErrorsRef.current.set(id, { message: sprintf(/* translators: 1: a campaign's name, 2: why an action on it failed. */ __('%1$s: %2$s', 'wconvert'), name, messageOf(cause)), action, openCreated });
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
  const copyOf = (row: OptinSummary) => duplicateCampaign(row.id, sprintf(/* translators: %s: a campaign's name, e.g. “Spring sale”. */ __('%s — copy', 'wconvert'), nameOf(row)));
  const duplicate = (row: OptinSummary, parent: OptinSummary) => void run(parent.id, () => copyOf(row), true);
  const groupPlan = (action: GroupAction) => plan(action, tickedRows, (row) => previews[row.id]?.template === null);
  /**
   * One row after another through the routes a single row uses, then one
   * refresh. A failure is recorded and the loop goes on; it lands in the same
   * "Try again" list a single row's failure does. Nothing opens the editor,
   * not even a copy.
   */
  const runGroup = async (action: GroupAction, group: GroupPlan) => {
    if (busyRef.current.size > 0) return;
    // Clearing the ticks takes the tray, and the button that started this, away.
    trayFocus.current = selectAll.current;
    if (document.activeElement?.closest('.wconvert-campaign-tray')) selectAll.current?.focus();
    setTicked(new Set());
    let result = startResult(action, group.skipped);
    setGroupResult(group.run.length ? null : result);
    if (!group.run.length) return;
    const ids = group.run.map((row) => row.id);
    for (const id of ids) {
      mutationErrorsRef.current.delete(id);
      busyRef.current.add(id);
    }
    setMutationErrors(new Map(mutationErrorsRef.current));
    setBusy(new Set(busyRef.current));
    onBusyChange?.(true);
    for (const row of group.run) {
      const call = action === 'publish'
        ? () => publishOptin(row.id)
        : action === 'pause'
          ? () => unpublishOptin(row.id)
          : action === 'delete'
            ? () => deleteOptin(row.id)
            : () => copyOf(row);
      try {
        await call();
        result = reduceResult(result, { type: 'done', row });
      } catch (cause) {
        result = reduceResult(result, { type: 'failed', row, message: messageOf(cause) });
        mutationErrorsRef.current.set(row.id, { message: sprintf(/* translators: 1: a campaign's name, 2: why an action on it failed. */ __('%1$s: %2$s', 'wconvert'), nameOf(row), messageOf(cause)), action: call, openCreated: false });
      }
    }
    setMutationErrors(new Map(mutationErrorsRef.current));
    await refresh();
    setRefreshKey((n) => n + 1);
    for (const id of ids) busyRef.current.delete(id);
    setBusy(new Set(busyRef.current));
    onBusyChange?.(busyRef.current.size > 0);
    setGroupResult(result);
  };
  const askGroup = (action: ConfirmedAction, trigger: HTMLElement | null) => {
    const group = groupPlan(action);
    // Nothing would run: say which and why, rather than ask to confirm nothing.
    if (!group.run.length) return void runGroup(action, group);
    trayFocus.current = trigger;
    setGroupConfirm({ action, plan: group });
  };
  // An arm's A/B test is its parent row; a campaign is its own.
  const parentOf = (row: OptinSummary) =>
    row.parent_id === null ? row : all.find((candidate) => candidate.id === row.parent_id) ?? row;
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
  const occasionOf = (row: OptinSummary): Occasion | undefined => row.occasion === null ? undefined : occasions?.find((item) => item.id === row.occasion);
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
          <Design template={previews[row.id].template!} displayType={previews[row.id].display_type} />
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
        <DataTableCell label={__('Select', 'wconvert')} className="wconvert-campaign-select">
          {!arm && (
            <CheckRow
              label={<span className="sr-only">{sprintf(/* translators: %s: a campaign's name. */ __('Select %s', 'wconvert'), name)}</span>}
              checked={ticked.has(row.id)}
              disabled={busy.size > 0}
              onChange={() => toggle(row.id)}
            />
          )}
        </DataTableCell>
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
            <p className="wconvert-campaign-meta">
              {describe(row)}
              {/* With no occasion chosen, a campaign's occasion is a link to its page. */}
              {!arm && chosen === undefined && occasionOf(row) && <>
                {describe(row) && ' · '}
                <a className="wconvert-occasion-tag" href={occasionHref(occasionOf(row)!.id)}>
                  <CalendarDays aria-hidden="true" /><bdi>{occasionOf(row)!.name}</bdi>
                </a>
              </>}
            </p>
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
                {sprintf(/* translators: %d: how many variants the A/B test has. */ _n('A/B test · %d variant', 'A/B test · %d variants', variants, 'wconvert'), variants)}
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
          {status === 'suspended' && <p className="wconvert-campaign-note">
            {row.suspended}
            <SuspensionGuideLink needs={row.suspended_needs} />
          </p>}
          {productHealthLabel(productHealth.rows[row.id]) && <button type="button" className="wconvert-product-health-link" aria-haspopup="dialog" onClick={e => openDetails(row, e.currentTarget)}>
            {productHealthLabel(productHealth.rows[row.id])}
          </button>}
        </DataTableCell>
        <DataTableCell label={__('Results', 'wconvert')} numeric className="wconvert-campaign-results">
          {reportReady && result ? (
            <a
              href={reportHref({ optinId: row.id, ...period })}
              aria-label={sprintf(/* translators: %s: a campaign's name. */ __('View %s report', 'wconvert'), name)}
            >
              <strong>{formatCount(result.count)}</strong>
              <span>{result.label}</span>
              {result.shown > 0 && (
                <span>{shownLine(result)}</span>
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
  const empty = list.status === 'ready' && all.length === 0;
  useEffect(() => onEmptyChange?.(empty), [empty, onEmptyChange]);
  const decisionWords = decision ? decisionCopy(decision.kind, decision.row.parent_id !== null, nameOf(decision.row), decision.row.arms.length) : null;
  const groupWords = groupConfirm ? groupConfirmCopy(groupConfirm.action, groupConfirm.plan) : null;
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
            {notice && onDismissNotice && <OccasionNoticeView notice={notice} onDismiss={onDismissNotice}
              action={onOpenOccasion && <Button type="button" variant="outline" onClick={() => onOpenOccasion(notice.occasion)}>{__('Open occasion', 'wconvert')}</Button>} />}
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
            {/* In the page from the moment the rows are, so a result is announced when it arrives. */}
            {list.status === 'ready' && !empty && <p role="status" className="wconvert-campaign-group-result">{groupResult && resultSentence(groupResult)}</p>}
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
                    {/* Shown only once the site has an occasion (ADR 0149). */}
                    {occasions !== null && occasions.length > 0 && onOccasionChange && (
                      <label className="wconvert-campaign-period wconvert-campaign-occasion">
                        {__('Occasion', 'wconvert')}
                        <NativeSelect value={chosen ?? ''} onChange={(e) => { onOccasionChange(e.target.value || undefined); setPage(0); }}>
                          <option value="">{__('All campaigns', 'wconvert')}</option>
                          {occasions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </NativeSelect>
                      </label>
                    )}
                    {chosen !== undefined && onOpenOccasion && (
                      <Button variant="outline" onClick={() => onOpenOccasion(chosen)}>{__('Open occasion', 'wconvert')}</Button>
                    )}
                    {chosen !== undefined && onCreateInOccasion && (
                      <Button variant="outline" disabled={busy.size > 0} onClick={() => onCreateInOccasion(chosen)}>
                        <Plus aria-hidden="true" />{__('New campaign in this occasion', 'wconvert')}
                      </Button>
                    )}
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
                guide={docsUrl(GUIDES.firstCampaign)}
                guideLabel={__('Follow the step-by-step guide', 'wconvert')}
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
                      if (chosen !== undefined) onOccasionChange?.(undefined);
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
                  <DataTableColumn className="wconvert-campaign-select">
                    {list.status === 'ready' && (
                      <CheckRow
                        label={<span className="sr-only">{__('Select all campaigns on this page', 'wconvert')}</span>}
                        checked={allTicked}
                        ref={(input: HTMLInputElement | null) => {
                          selectAll.current = input;
                          if (input) input.indeterminate = tickedRows.length > 0 && !allTicked;
                        }}
                        // Refused, not disabled: a group action unmounts the tray it
                        // was started from, and this is where focus goes (§14).
                        aria-disabled={busy.size > 0 || undefined}
                        onChange={() => {
                          if (busyRef.current.size > 0) return;
                          setGroupResult(null);
                          setTicked(allTicked ? new Set() : new Set(shown.map((c) => c.id)));
                        }}
                      />
                    )}
                  </DataTableColumn>
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
            {tickedRows.length > 0 && (
              <aside className="wconvert-comparison-tray wconvert-toolbar wconvert-campaign-tray" aria-label={__('Selected campaigns', 'wconvert')}>
                <div className="wconvert-comparison-tray__selection">
                  <ToolbarCount live>
                    {sprintf(/* translators: %d: how many campaigns are ticked. */ _n('%d campaign selected', '%d campaigns selected', tickedRows.length, 'wconvert'), tickedRows.length)}
                  </ToolbarCount>
                </div>
                {/* Beside the count and apart from the safe actions (ADR 0039). */}
                <Button variant="outline" className="wconvert-campaign-tray__delete text-destructive hover:text-destructive" disabled={busy.size > 0} onClick={(e) => askGroup('delete', e.currentTarget)}>
                  <Trash2 aria-hidden="true" />{__('Delete', 'wconvert')}
                </Button>
                <Button variant="outline" disabled={busy.size > 0} onClick={() => setTicked(new Set())}>{__('Clear', 'wconvert')}</Button>
                <Button variant="outline" disabled={busy.size > 0} onClick={() => void runGroup('duplicate', groupPlan('duplicate'))}>
                  <Copy aria-hidden="true" />{__('Duplicate', 'wconvert')}
                </Button>
                <Button variant="outline" disabled={busy.size > 0} onClick={(e) => askGroup('pause', e.currentTarget)}>
                  <EyeOff aria-hidden="true" />{__('Unpublish', 'wconvert')}
                </Button>
                <Button disabled={busy.size > 0} onClick={(e) => askGroup('publish', e.currentTarget)}>
                  <Upload aria-hidden="true" />{__('Publish', 'wconvert')}
                </Button>
              </aside>
            )}
            {/* One line: how many and over which dates, then the pages. */}
            {list.status === 'ready' && !empty && <div className="wconvert-footer wconvert-campaign-footer">
              <span>
                {sprintf(/* translators: %d: how many campaigns are listed. */ _n('%d campaign', '%d campaigns', visible.length, 'wconvert'), visible.length)}
                {report && <> · {formatRange(report.from, report.to)}</>}
              </span>
              {lastPage > 0 && (
                <nav className="wconvert-toolbar wconvert-campaign-pagination" aria-label={__('Campaign pages', 'wconvert')}>
                  <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                    <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
                    {__('Previous', 'wconvert')}
                  </Button>
                  <span aria-live="polite" aria-atomic="true">
                    {sprintf(/* translators: 1: this page's number, 2: how many pages. */ __('Page %1$d of %2$d', 'wconvert'), currentPage + 1, lastPage + 1)}
                  </span>
                  <Button variant="outline" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>
                    {__('Next', 'wconvert')}
                    <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
                  </Button>
                </nav>
              )}
              {shown.some((c) => c.arms.length > 0) && (
                <p className="wconvert-campaign-test-note">
                  {__('A/B tests split visitors by browser, not by person.', 'wconvert')}{' '}
                  <GuideLink href={docsUrl(GUIDES.abTest, 'check-the-split')}>{__('How the split works', 'wconvert')}</GuideLink>
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
      <ConfirmDialog
        variant={groupConfirm?.action === 'delete' ? 'destructive' : 'default'}
        open={groupConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setGroupConfirm(null);
        }}
        title={groupWords?.title ?? ''}
        description={groupWords?.description ?? ''}
        confirmLabel={groupWords?.confirmLabel ?? ''}
        returnFocusTo={trayFocus}
        onConfirm={() => {
          if (!groupConfirm) return;
          const { action, plan: group } = groupConfirm;
          setGroupConfirm(null);
          void runGroup(action, group);
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
