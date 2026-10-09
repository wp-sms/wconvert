import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChevronRight, Download, Inbox, Plus, Search, Trash2 } from 'lucide-react';
import { InfoTip } from '../shell/InfoTip';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { AdminDialog, AdminDialogContent } from '../components/ui/admin-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { CheckRow } from '../shell/CheckRow';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { DateRangePicker, presetLabel, type DateRange } from '../shell/DateRangePicker';
import { EmptyState } from '../shell/EmptyState';
import { Field } from '../shell/Field';
import { OptionStrip } from '../shell/OptionStrip';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { formatCount, formatDay, formatRange, formatWhen } from '../lib/format';
import { canExport, eraseIdentifier, exportLeads, readLog, type Lead, type LeadGroup, type LeadLog as LeadLogPayload, type LeadPage, type LeadQuery } from './api';
import { EventTable } from './EventTable';
import { ExportMenu } from './ExportMenu';
import { useNotSent, type NotSent } from './notSent';
import { LeadDetail, framed, submissionCount, type CampaignName } from './LeadDetail';
import { LeadHistory } from './LeadHistory';
import { journeysSupported } from '../settings';
import { RetentionSummary } from './RetentionSummary';
import { flattened, listOptins, type OptinSummary } from '../optins/api';
import { createHref, hashFor, leadsHref } from '../nav';
import { LEAD_PRESETS, presetWindow, rangeOf, siteToday, type DayWindow } from './calendar';
import { listGoals } from '../goals/api';

const EMPTY_QUERY: LeadQuery = {};
const NONE: readonly NotSent[] = [];
const queryKeyOf = (query: LeadQuery) => JSON.stringify({ order: query.order, optinId: query.optinId || undefined,
  search: query.search || undefined, purpose: query.purpose || undefined,
  identifier: query.identifier || undefined, leadId: query.leadId || undefined,
  from: query.from || undefined, to: query.to || undefined });

/** What the log's one dialog is showing: a single submission, or a lead's history. */
type Opened = { kind: 'submission'; lead: Lead } | { kind: 'history'; group: LeadGroup; query: LeadPage };

export interface LeadLogProps {
  /** Called whenever the log re-reads on its own, so the page's sending count can too. */
  onRefresh?: () => void;
  query?: LeadQuery;
  onQueryChange?: (query: LeadQuery) => void;
}

/**
 * History remains a log of immutable submissions. Grouping never changes its headline count.
 *
 * **Nothing here is a page action** (ADR 0132): the header keeps Sending
 * issues alone. Refresh is the window regaining focus, and Export is one menu
 * in the toolbar beside the set it exports.
 */
export function LeadLog({ query, onQueryChange, onRefresh }: LeadLogProps) {
  const [localQuery, setLocalQuery] = useState<LeadQuery>(EMPTY_QUERY);
  const [privateQuery, setPrivateQuery] = useState<Pick<LeadQuery, 'search' | 'identifier'>>({});
  const queryKey = queryKeyOf({ ...(query ?? localQuery), ...privateQuery });
  const requested = useMemo(() => JSON.parse(queryKey) as LeadQuery, [queryKey]);
  const [grouped, setGrouped] = useState(false);
  const scope = `${queryKey}:${grouped}`;
  const [paging, setPaging] = useState<{ scope: string; cursor?: string; snapshot?: string; previous: (string | undefined)[] }>({ scope: '', previous: [] });
  const cursor = paging.scope === scope ? paging.cursor : undefined;
  const snapshot = paging.scope === scope ? paging.snapshot : undefined;
  const pageNumber = paging.scope === scope ? paging.previous.length + 1 : 1;
  const request = useMemo<LeadPage>(() => ({ ...requested, grouped, cursor, snapshot, includeCounts: true }), [requested, grouped, cursor, snapshot]);
  const [log, setLog] = useState<Loadable<LeadLogPayload>>(LOADING);
  const [applied, setApplied] = useState<{ query: LeadPage; page: number }>({ query: {}, page: 1 });
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  // A re-read nobody asked for (the window regaining focus) keeps the table still.
  const [quiet, setQuiet] = useState(false);
  const [retry, setRetry] = useState(0);
  const [optins, setOptins] = useState<OptinSummary[] | null>(null);
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [namesError, setNamesError] = useState<string | null>(null);
  const [namesRetry, setNamesRetry] = useState(0);
  const [opened, setOpened] = useState<Opened | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [erasureTarget, setErasureTarget] = useState<string | null>(null);
  const erasureReturn = useRef<HTMLElement | null>(null);
  const [sendingKey, setSendingKey] = useState(0);
  const notSent = useNotSent(sendingKey);
  const notSentOf = useCallback((id: string) => notSent.get(id) ?? NONE, [notSent]);
  const [erasurePreview, setErasurePreview] = useState<{ identifier: string; submissions: number; snapshot: string } | null>(null);
  const [erasing, setErasing] = useState(false);
  const [erasureError, setErasureError] = useState<string | null>(null);
  const [erasureNotice, setErasureNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUpdating(true);
    void readLog(request).then((payload) => {
      if (!active) return;
      setLog(ready(payload));
      setApplied({ query: { ...request, snapshot: payload.snapshot }, page: pageNumber });
      setError(null);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(messageOf(cause));
      setLog((current) => current.status === 'ready' ? current : failed(cause));
    }).finally(() => { if (active) { setUpdating(false); setQuiet(false); } });
    return () => { active = false; };
  }, [request, pageNumber, retry]);

  useEffect(() => {
    let active = true;
    void listOptins(true).then((list) => {
      if (active) { setOptins(flattened(list)); setNamesError(null); }
    }).catch((cause: unknown) => { if (active) setNamesError(messageOf(cause)); });
    return () => { active = false; };
  }, [namesRetry]);

  useEffect(() => {
    let active = true;
    void listGoals().then((entries) => { if (active) setGoals(Object.fromEntries(entries.map((entry) => [entry.id, entry.label]))); }).catch(() => { /* Missing purpose metadata must never invent a label. */ });
    return () => { active = false; };
  }, [namesRetry]);
  const goalsByOptin = useMemo(() => new Map((optins ?? []).map((optin) => [optin.id, goals[optin.goal]])), [optins, goals]);
  const goalOf = useCallback((id: string) => goalsByOptin.get(id), [goalsByOptin]);
  // Soft-deleted campaigns are in the list, so a name missing from a loaded
  // list is a campaign that is gone — never shown as its ID (ADR 0131).
  const names = useMemo(() => optins === null ? null : new Map(optins.map((optin) => [optin.id, optin.name.trim() || __('Unnamed campaign', 'wconvert')])), [optins]);
  const nameOf = useCallback((id: string): CampaignName => names === null ? undefined : names.get(id) ?? null, [names]);
  const changeQuery = (next: LeadQuery) => {
    setQuiet(false);
    const { search, identifier, ...bookmarkable } = next;
    setPrivateQuery({ search, identifier });
    setErasureNotice(null);
    if (onQueryChange) onQueryChange(bookmarkable);
    else setLocalQuery(bookmarkable);
  };
  const seeAll = (contact: string) => {
    setOpened(null);
    setGrouped(false);
    changeQuery({ identifier: contact });
  };
  const data = log.status === 'ready' ? log.data : null;
  // An export of nothing is not offered.
  const csv = data !== null && data.submissions > 0 && canExport();
  // Question answers exist only where journeys run, or where a removed module
  // left answered submissions behind (ADR 0127).
  const questionCsv = csv && (journeysSupported() || data.leads.some((lead) => (lead.question_answers?.length ?? 0) > 0));
  const shownGrouped = applied.query.grouped === true;
  const hasAppliedFilters = queryKeyOf(applied.query) !== '{}';
  // The selected purpose chip already carries this number; a narrower filter is what makes it worth repeating.
  const narrowed = queryKeyOf({ ...applied.query, purpose: undefined }) !== '{}';
  // Nothing captured at all, not nothing matching: no filters, toolbar or zeros to sit around it.
  const neverCaptured = data !== null && data.submissions === 0 && !hasAppliedFilters && queryKey === '{}';
  // Soft-deleted campaigns are in the list; only a live published one can be filled in.
  const anyPublished = optins === null ? null : optins.some((optin) => optin.published_at !== null && optin.deleted_at === null);
  const rows = data === null ? 0 : shownGrouped ? data.groups.length : data.leads.length;
  const showingPrevious = data !== null && (queryKeyOf(applied.query) !== queryKey || shownGrouped !== grouped || applied.query.cursor !== cursor);
  const privacyIdentifier = !showingPrevious && data !== null && data.submissions > 0
    ? exactIdentifierScope(applied.query)
    : null;
  const erasureCsv = erasurePreview !== null && canExport();
  const startErasure = (identifier: string, returnTo: HTMLElement | null) => {
    erasureReturn.current = returnTo;
    setErasurePreview(null);
    setErasureError(null);
    setErasureTarget(identifier);
    void readLog({ identifier, grouped: false }).then((preview) => {
      setErasurePreview({ identifier, submissions: preview.submissions, snapshot: preview.snapshot });
    }).catch((cause: unknown) => setErasureError(messageOf(cause)));
  };
  // From a submission: close it first, then confirm. A confirm never stands on a dialog.
  const eraseFrom = (contact: string) => {
    setOpened(null);
    startErasure(contact, trigger.current);
  };
  const oldestFirst = applied.query.order === 'oldest';
  const next = () => {
    if (!data?.next_cursor) return;
    setQuiet(false);
    setPaging({ scope, cursor: data.next_cursor, snapshot: data.snapshot,
      previous: [...(paging.scope === scope ? paging.previous : []), cursor] });
  };
  const previous = () => {
    setQuiet(false);
    const held = paging.previous;
    setPaging({ ...paging, cursor: held[held.length - 1], previous: held.slice(0, -1) });
  };
  const open = (next: Opened, button: HTMLElement) => {
    trigger.current = button;
    setOpened(next);
  };
  // One outage is one door: a log retry also re-reads the campaign names when
  // those failed with it, rather than drawing a second "Try again" above it.
  const retryLog = () => {
    setQuiet(false);
    setRetry((value) => value + 1);
    if (namesError !== null) setNamesRetry((value) => value + 1);
  };

  /*
   * **Coming back to the tab is the refresh** — the button it replaces sat
   * first among three outline actions above the data. Only the first page
   * re-reads: a later page is read under its snapshot so Older and Newer stay
   * stable (ADR 0071), and new submissions arrive at the top anyway.
   */
  const onFocus = useRef(() => {});
  useEffect(() => {
    onFocus.current = () => {
      if (pageNumber !== 1) return;
      setPaging({ scope, previous: [] });
      retryLog();
      setQuiet(true);
      setSendingKey((value) => value + 1);
      onRefresh?.();
    };
  });
  useEffect(() => {
    const refresh = () => onFocus.current();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return <div className="flex flex-col gap-5">
    <Region label={__('Submissions', 'wconvert')}>
      {!neverCaptured && <RegionBody className="flex flex-col gap-4">
        <OptionStrip
          label={__('Submission purpose', 'wconvert')}
          value={requested.purpose ?? 'all'}
          options={[
            { value: 'all', label: __('All submissions', 'wconvert'), count: data?.purpose_counts?.all },
            { value: 'subscribers', label: __('Subscribers', 'wconvert'), count: data?.purpose_counts?.subscribers },
            { value: 'enquiries', label: __('Enquiries', 'wconvert'), count: data?.purpose_counts?.enquiries },
          ]}
          onChange={(value) => changeQuery({ ...requested, purpose: value === 'subscribers' || value === 'enquiries' ? value : undefined })}
        />
        <HistoryFilters query={requested} optins={optins} onApply={changeQuery} />
      </RegionBody>}
      {!neverCaptured && <Toolbar trailing={data === null ? undefined : <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {narrowed && <ToolbarCount hint={__('The total counts submissions, never people.', 'wconvert')}>{submissionCount(data.submissions)}</ToolbarCount>}
        {/* A small select beside the set it orders: the only thing More filters had left. */}
        <NativeSelect aria-label={__('Order', 'wconvert')} value={requested.order ?? 'newest'}
          onChange={(event) => changeQuery({ ...requested, order: event.target.value === 'oldest' ? 'oldest' : undefined })}>
          <option value="newest">{__('Newest first', 'wconvert')}</option>
          <option value="oldest">{__('Oldest first', 'wconvert')}</option>
        </NativeSelect>
        {csv && <>
          <ExportMenu filter={applied.query} answers={questionCsv} />
          <InfoTip label={__('About this export', 'wconvert')}>
            <p className="m-0 font-medium">{scopeDescription(applied.query, nameOf)}</p>
            <p className="mb-0 text-muted-foreground">{__('Export includes every matching submission on all pages, as of when this list loaded. Grouping doesn’t change it.', 'wconvert')}</p>
          </InfoTip>
        </>}
        {privacyIdentifier !== null && <Button variant="outline" onClick={(event) => startErasure(privacyIdentifier, event.currentTarget)}>
          <Trash2 aria-hidden="true" />{__('Delete this lead', 'wconvert')}
        </Button>}
      </div>}>
        <CheckRow label={__('Group by email or phone', 'wconvert')} checked={grouped} onChange={(event) => { setQuiet(false); setGrouped(event.currentTarget.checked); }} />
      </Toolbar>}
      {/* One line while a read is in flight; the rows it will replace dim under it. */}
      {/* A first load is announced by its skeleton (§12); only a re-read needs a line. */}
      {updating && !quiet && data && <RegionBody><p role="status" className="m-0 text-note">{__('Updating…', 'wconvert')}</p></RegionBody>}
      {showingPrevious && !updating && <RegionBody><p className="m-0 text-note">{__('Showing the previous results.', 'wconvert')}</p></RegionBody>}
      {erasureNotice !== null && <RegionBody><p role="status" className="m-0 rounded-md border border-border bg-surface p-3 text-note">{erasureNotice}</p></RegionBody>}
      {error !== null && data !== null && <RegionError message={error} onRetry={retryLog} />}
      {namesError !== null && log.status !== 'failed' && <RegionError message={sprintf(__('Campaign names couldn’t be loaded: %s', 'wconvert'), namesError)} onRetry={() => setNamesRetry((value) => value + 1)} />}
      <div aria-busy={updating || undefined} className={updating && !quiet && data !== null ? 'opacity-60' : undefined}>
      {log.status === 'failed' ? <RegionErrorState message={log.message} onRetry={retryLog} /> : data === null ? <DataTable><TableSkeleton columns={5} /></DataTable> : rows === 0 ? (
        hasAppliedFilters ? <EmptyState icon={Inbox} title={applied.query.leadId ? __('Submission not found', 'wconvert') : __('No matching submissions', 'wconvert')}
          action={<Button variant="outline" onClick={() => changeQuery({})}>{__('Clear filters', 'wconvert')}</Button>}>
          {applied.query.leadId ? __('Retention or a privacy request may have deleted it, or another filter excludes it.', 'wconvert')
            : __('Try another search, period or campaign.', 'wconvert')}
        </EmptyState>
          // The way out is the action that fills it: create the first campaign, or go to the ones there are.
          : <EmptyState icon={Inbox} title={__('No submissions yet', 'wconvert')}
            action={anyPublished === false
              ? <Button asChild><a href={createHref()}><Plus aria-hidden="true" />{__('Create campaign', 'wconvert')}</a></Button>
              : <Button asChild><a href={hashFor('optins')}>{__('View campaigns', 'wconvert')}</a></Button>}>
            {__('Submissions appear here the moment a visitor fills in a published campaign.', 'wconvert')}
          </EmptyState>
      ) : shownGrouped ? <DataTable>
        <DataTableHead><DataTableColumn>{__('Email or phone', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Submissions', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Last submitted', 'wconvert')}</DataTableColumn><DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn></DataTableHead>
        <DataTableBody>{data.groups.map((group) => <DataTableRow key={group.identifier}>
          <DataTableCell label={__('Email or phone', 'wconvert')}><bdi dir="ltr" className="break-all">{group.identifier}</bdi></DataTableCell>
          <DataTableCell label={__('Submissions', 'wconvert')} numeric>{formatCount(group.submissions)}</DataTableCell>
          <DataTableCell label={__('Last submitted', 'wconvert')}>{group.latest_at === null ? '—' : <time className="text-note" dateTime={group.latest_at.replace(' ', 'T')} title={formatWhen(group.latest_at, 'detail')}>{formatWhen(group.latest_at, 'list')}</time>}</DataTableCell>
          <DataTableActions><Button variant="ghost" aria-label={sprintf(__('Open submissions from %s', 'wconvert'), group.identifier)} onClick={(event) => open({ kind: 'history', group, query: applied.query }, event.currentTarget)}>
            {__('Open', 'wconvert')}<ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          </Button></DataTableActions>
        </DataTableRow>)}</DataTableBody>
      </DataTable> : <EventTable leads={data.leads} nameOf={nameOf} notSentOf={notSentOf} returnTo={leadsHref(applied.query)} onOpen={(lead, button) => open({ kind: 'submission', lead }, button)} />}
      </div>
      {data !== null && rows > 0 && (applied.page > 1 || data.next_cursor !== null) && <RegionFooter>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span>{sprintf(__('Page %s', 'wconvert'), formatCount(applied.page))}</span>
          <div className="flex gap-2"><Button variant="outline" disabled={updating || showingPrevious || applied.page <= 1} onClick={previous}>{oldestFirst ? __('Older', 'wconvert') : __('Newer', 'wconvert')}</Button>
            <Button variant="outline" disabled={updating || showingPrevious || !data.next_cursor} onClick={next}>{oldestFirst ? __('Newer', 'wconvert') : __('Older', 'wconvert')}</Button></div>
        </div>
      </RegionFooter>}
    </Region>
    {/* One outage is one door: while the log has failed, its Try again re-reads this too. */}
    {log.status !== 'failed' && <RetentionSummary refreshKey={retry} />}
    <AdminDialog open={opened !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpened(null); }}>
      <AdminDialogContent size="md" onCloseAutoFocus={(event) => {
        // "See all from" re-renders the table, so the row that opened the
        // dialog can be gone; the search is the next place a hand would be.
        event.preventDefault();
        if (trigger.current?.isConnected) trigger.current.focus();
        else document.getElementById('wconvert-lead-search')?.focus();
      }}>
        {opened?.kind === 'submission' && <LeadDetail lead={opened.lead} campaign={nameOf(opened.lead.optin_id)} goal={goalOf(opened.lead.optin_id)}
          returnTo={leadsHref(applied.query)} closes onBack={() => setOpened(null)} onSeeAll={seeAll} onErase={eraseFrom} notSent={notSentOf(opened.lead.id)} />}
        {opened?.kind === 'history' && <LeadHistory key={`${opened.group.identifier}:${opened.query.snapshot}`} group={opened.group} query={opened.query}
          filtered={queryKeyOf(opened.query) !== '{}'} nameOf={nameOf} goalOf={goalOf} notSentOf={notSentOf} onClose={() => setOpened(null)} onSeeAll={seeAll} onErase={eraseFrom} />}
      </AdminDialogContent>
    </AdminDialog>
    <AlertDialog open={erasureTarget !== null} onOpenChange={(isOpen) => { if (!erasing && !isOpen) setErasureTarget(null); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => {
        // Opened from a submission, the button that asked is gone with its dialog.
        event.preventDefault();
        if (erasureReturn.current?.isConnected) erasureReturn.current.focus();
        else document.getElementById('wconvert-lead-search')?.focus();
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{framed(__('Delete every submission from %s?', 'wconvert'), erasureTarget ?? '')}</AlertDialogTitle>
          <AlertDialogDescription>
            {erasurePreview === null ? __('Counting their submissions…', 'wconvert') : sprintf(
              _n(
                'This permanently deletes %s submission, from every campaign.',
                'This permanently deletes all %s submissions, from every campaign.',
                erasurePreview.submissions,
                'wconvert',
              ),
              formatCount(erasurePreview.submissions),
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="m-0 text-note text-muted-foreground">{__('Campaign totals in analytics stay. Copies already sent to destinations, exported files and backups aren’t touched; remove those separately.', 'wconvert')}</p>
        {erasureCsv && <Button variant="outline" className="self-start" onClick={() => {
          if (erasurePreview !== null) exportLeads({ identifier: erasurePreview.identifier, snapshot: erasurePreview.snapshot });
        }}><Download aria-hidden="true" />{__('Export them first', 'wconvert')}</Button>}
        {erasureError !== null && <p role="alert" className="m-0 text-note text-destructive">{erasureError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={erasing}>{__('Cancel', 'wconvert')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={erasing || erasurePreview === null}
            onClick={(event) => {
              event.preventDefault();
              if (erasurePreview === null) return;
              setErasing(true);
              setErasureError(null);
              void eraseIdentifier(erasurePreview.identifier).then((result) => {
                setErasureTarget(null);
                setErasurePreview(null);
                setErasureNotice(sprintf(
                  _n('%s submission deleted. Copies in destinations, exports and backups aren’t affected.', '%s submissions deleted. Copies in destinations, exports and backups aren’t affected.', result.removed, 'wconvert'),
                  formatCount(result.removed),
                ));
                setPaging({ scope, previous: [] });
                retryLog();
                onRefresh?.();
              }).catch((cause: unknown) => setErasureError(messageOf(cause))).finally(() => setErasing(false));
            }}
          >
            {erasing ? __('Deleting…', 'wconvert') : __('Delete permanently', 'wconvert')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

/** Privacy erasure is identifier-wide; ordinary filters must never narrow it. */
function exactIdentifierScope(query: LeadPage): string | null {
  if (!query.identifier || query.optinId || query.leadId || query.search || query.purpose || query.from || query.to || query.groupIdentifier) {
    return null;
  }

  return query.identifier;
}

/** A window's dates as one phrase, or null for any time. */
function windowSummary({ from, to }: DayWindow): string | null {
  if (from && to) return from === to ? formatDay(from) : formatRange(from, to);
  if (from) return sprintf(__('From %s', 'wconvert'), formatDay(from));
  if (to) return sprintf(__('Until %s', 'wconvert'), formatDay(to));
  return null;
}

/** The dates a chosen window means on the log, resolved on the site's day. */
function windowOf(range: DateRange, today: string | null): DayWindow {
  if (range.preset === 'custom') return { from: range.from, to: range.to };
  if (range.preset === 'all' || today === null) return {};
  return presetWindow(range.preset, today);
}

interface Draft { search: string; optinId: string }

const draftOf = (query: LeadQuery): Draft => ({ search: query.leadId ?? query.identifier ?? query.search ?? '', optinId: query.optinId ?? '' });

/**
 * **One apply model** (ADR 0131): a choice applies the moment it is made, and
 * what is typed applies on Enter. Every change applies the whole form as it
 * stands, so a search typed and not yet sent is never dropped by picking a
 * campaign or a period.
 *
 * **The period is the shared date control, in the row, not folded away**
 * (ADR 0132). Its presets resolve to the same `from`/`to` the log has always
 * read, so a link still bookmarks the dates, and a bookmarked pair reads back
 * as the preset it spells today. Without the site's timezone nothing can say
 * what "today" is, so only Any time and custom dates are offered.
 *
 * The draft follows the applied query rather than being remounted by it, so
 * a select keeps focus through the read its own change started.
 */
function HistoryFilters({ query, optins, onApply }: { query: LeadQuery; optins: OptinSummary[] | null; onApply: (query: LeadQuery) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(query));
  // The purpose strip and the toolbar's order sit outside this form; neither resets a draft.
  const syncKey = queryKeyOf({ ...query, purpose: undefined, order: undefined });
  const [synced, setSynced] = useState(syncKey);
  if (synced !== syncKey) {
    setSynced(syncKey);
    setDraft(draftOf(query));
  }
  const today = siteToday();
  const apply = (next: Draft, window: DayWindow = { from: query.from, to: query.to }) => {
    setDraft(next);
    const term = next.search.trim();
    // A pasted submission ID still finds its row, though no screen shows one.
    const id = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(term) ? term.toUpperCase() : undefined;
    const identifier = !id && (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term) || /^(\+|00)[\d\s()-]+$/.test(term)) ? term : undefined;
    const built: LeadQuery = { order: query.order, optinId: next.optinId || undefined, purpose: query.purpose, identifier,
      search: term && !id && !identifier ? term : undefined, leadId: id, from: window.from || undefined, to: window.to || undefined };
    if (queryKeyOf(built) !== queryKeyOf(query)) onApply(built);
  };
  const missing = draft.optinId !== '' && !(optins ?? []).some((optin) => optin.id === draft.optinId);

  // The date control's custom dates are a form of their own, portalled out of
  // this one in the DOM but not in React's tree; their submit is not a search.
  return <form className="flex flex-wrap items-end gap-3" aria-label={__('Filter submissions', 'wconvert')}
    onSubmit={(event) => { event.preventDefault(); if (event.target === event.currentTarget) apply(draft); }}>
    {/* Below `sm` the search takes the line and the campaign the next, rather than squeezing the input to nothing. */}
    <Field label={__('Search submissions', 'wconvert')} htmlFor="wconvert-lead-search" className="flex-1 basis-full sm:basis-64">
      <div className="flex gap-2">
        <Input id="wconvert-lead-search" className="min-w-0 flex-1" type="search" maxLength={254} value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder={__('Name, email, phone or message', 'wconvert')} />
        <Button type="submit" variant="outline"><Search aria-hidden="true" />{__('Search', 'wconvert')}</Button>
      </div>
    </Field>
    <Field label={__('Campaign', 'wconvert')} htmlFor="wconvert-lead-optin" className="basis-full sm:basis-auto">
      <NativeSelect id="wconvert-lead-optin" className="w-full sm:w-64" value={draft.optinId} onChange={(event) => apply({ ...draft, optinId: event.target.value })}>
        <option value="">{__('All campaigns', 'wconvert')}</option>
        {missing && <option value={draft.optinId}>{optins === null ? __('Selected campaign', 'wconvert') : __('Deleted campaign', 'wconvert')}</option>}
        {(optins ?? []).map((optin) => <option key={optin.id} value={optin.id}>{optin.name.trim() || __('Unnamed campaign', 'wconvert')}</option>)}
      </NativeSelect>
    </Field>
    <DateRangePicker label={__('Period', 'wconvert')} value={rangeOf(query, today)} presets={today === null ? ['all'] : ['all', ...LEAD_PRESETS]}
      summary={windowSummary(query)} today={today} onChange={(range) => apply(draft, windowOf(range, today))} />
    {queryKeyOf(query) !== '{}' && <Button type="button" variant="link" onClick={() => { setDraft(draftOf({})); onApply({}); }}>{__('Clear filters', 'wconvert')}</Button>}
  </form>;
}

/** What the period filter reads as in a sentence: the preset's name, else its dates. */
function periodOf(query: LeadQuery): string {
  const range = rangeOf(query, siteToday());
  return range.preset === 'custom' ? windowSummary(query) ?? presetLabel('all') : presetLabel(range.preset);
}

function scopeDescription(query: LeadQuery, nameOf: (id: string) => CampaignName): string {
  const campaign = query.optinId ? nameOf(query.optinId) : __('All campaigns', 'wconvert');
  const parts = [campaign === null ? __('Deleted campaign', 'wconvert') : campaign ?? __('Selected campaign', 'wconvert'),
    query.purpose === 'subscribers' ? __('Subscribers', 'wconvert') : query.purpose === 'enquiries' ? __('Enquiries', 'wconvert') : undefined,
    query.leadId ? __('One submission', 'wconvert') : query.identifier || query.search,
    periodOf(query)];
  return sprintf(__('Showing: %s', 'wconvert'), parts.filter(Boolean).join(' · '));
}
