import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChevronRight, Download, Inbox, RefreshCw, Search, Trash2 } from 'lucide-react';
import { InfoTip } from '../shell/InfoTip';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { AdminDialog, AdminDialogContent } from '../components/ui/admin-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { CheckRow } from '../shell/CheckRow';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { Disclosure } from '../shell/Disclosure';
import { EmptyState } from '../shell/EmptyState';
import { Field } from '../shell/Field';
import { OptionStrip } from '../shell/OptionStrip';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { formatCount, formatDay, formatRange, formatWhen } from '../lib/format';
import { canExport, eraseIdentifier, exportLeads, readLog, type Lead, type LeadGroup, type LeadLog as LeadLogPayload, type LeadPage, type LeadQuery } from './api';
import { EventTable } from './EventTable';
import { LeadDetail, framed, submissionCount, type CampaignName } from './LeadDetail';
import { LeadHistory } from './LeadHistory';
import { journeysSupported } from '../settings';
import { RetentionSummary } from './RetentionSummary';
import { flattened, listOptins, type OptinSummary } from '../optins/api';
import { hashFor, leadsHref } from '../nav';
import { siteToday, shiftDay } from './calendar';
import { listGoals } from '../goals/api';

const EMPTY_QUERY: LeadQuery = {};
const queryKeyOf = (query: LeadQuery) => JSON.stringify({ order: query.order, optinId: query.optinId || undefined,
  search: query.search || undefined, purpose: query.purpose || undefined,
  identifier: query.identifier || undefined, leadId: query.leadId || undefined,
  from: query.from || undefined, to: query.to || undefined });

/** What the log's one dialog is showing: a single submission, or a lead's history. */
type Opened = { kind: 'submission'; lead: Lead } | { kind: 'history'; group: LeadGroup; query: LeadPage };

export interface LeadLogProps {
  onRefresh?: () => void;
  query?: LeadQuery;
  onQueryChange?: (query: LeadQuery) => void;
}

/** History remains a log of immutable submissions. Grouping never changes its headline count. */
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
  const [retry, setRetry] = useState(0);
  const [optins, setOptins] = useState<OptinSummary[] | null>(null);
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [namesError, setNamesError] = useState<string | null>(null);
  const [namesRetry, setNamesRetry] = useState(0);
  const [opened, setOpened] = useState<Opened | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [erasureOpen, setErasureOpen] = useState(false);
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
    }).finally(() => { if (active) setUpdating(false); });
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
  const csv = data !== null && canExport();
  // Question answers exist only where journeys run, or where a removed module
  // left answered submissions behind (ADR 0127).
  const questionCsv = csv && (journeysSupported() || data.leads.some((lead) => (lead.question_answers?.length ?? 0) > 0));
  const shownGrouped = applied.query.grouped === true;
  const hasAppliedFilters = queryKeyOf(applied.query) !== '{}';
  const rows = data === null ? 0 : shownGrouped ? data.groups.length : data.leads.length;
  const showingPrevious = data !== null && (queryKeyOf(applied.query) !== queryKey || shownGrouped !== grouped || applied.query.cursor !== cursor);
  const privacyIdentifier = !showingPrevious && data !== null && data.submissions > 0
    ? exactIdentifierScope(applied.query)
    : null;
  const erasureCsv = erasurePreview !== null && canExport();
  const oldestFirst = applied.query.order === 'oldest';
  const next = () => {
    if (!data?.next_cursor) return;
    setPaging({ scope, cursor: data.next_cursor, snapshot: data.snapshot,
      previous: [...(paging.scope === scope ? paging.previous : []), cursor] });
  };
  const previous = () => {
    const held = paging.previous;
    setPaging({ ...paging, cursor: held[held.length - 1], previous: held.slice(0, -1) });
  };
  const open = (next: Opened, button: HTMLElement) => {
    trigger.current = button;
    setOpened(next);
  };
  const retryLog = () => setRetry((value) => value + 1);

  return <div className="flex flex-col gap-5">
    <PageAction><Button variant="outline" disabled={updating} onClick={() => { setPaging({ scope, previous: [] }); retryLog(); onRefresh?.(); }}><RefreshCw aria-hidden="true" />{__('Refresh submissions', 'wconvert')}</Button></PageAction>
    {csv && <PageAction><Button variant="outline" onClick={() => exportLeads(applied.query)}>
      <Download aria-hidden="true" />{__('Export matching submissions', 'wconvert')}
    </Button></PageAction>}
    {questionCsv && <PageAction><Button variant="outline" onClick={() => exportLeads(applied.query, 'questions')}>
      <Download aria-hidden="true" />{__('Export question answers', 'wconvert')}
    </Button></PageAction>}
    <Region label={__('Submissions', 'wconvert')}>
      <RegionBody className="flex flex-col gap-4">
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
      </RegionBody>
      <Toolbar trailing={data === null ? undefined : <div className="flex flex-wrap items-center justify-end gap-1"><ToolbarCount hint={__('The total counts submissions, never people.', 'wconvert')}>
        {submissionCount(data.submissions)}
      </ToolbarCount><InfoTip label={__('About this count and export', 'wconvert')}>
          <p className="m-0 font-medium">{scopeDescription(applied.query, nameOf)}</p>
          <p className="mb-0 text-muted-foreground">{__('Export includes every matching submission on all pages, as of when this list loaded. Grouping doesn’t change it.', 'wconvert')}</p>
      </InfoTip>{privacyIdentifier !== null && <Button variant="outline" onClick={() => {
        setErasurePreview(null);
        setErasureError(null);
        setErasureOpen(true);
        void readLog({ identifier: privacyIdentifier, grouped: false }).then((preview) => {
          setErasurePreview({ identifier: privacyIdentifier, submissions: preview.submissions, snapshot: preview.snapshot });
        }).catch((cause: unknown) => setErasureError(messageOf(cause)));
      }}><Trash2 aria-hidden="true" />{__('Delete this lead', 'wconvert')}</Button>}</div>}>
        <CheckRow label={__('Group by email or phone', 'wconvert')} checked={grouped} onChange={(event) => setGrouped(event.currentTarget.checked)} />
      </Toolbar>
      {updating && <RegionBody><p role="status" className="m-0 text-note">{data ? __('Updating submissions…', 'wconvert') : __('Loading submissions…', 'wconvert')}</p></RegionBody>}
      {showingPrevious && <RegionBody><p className="m-0 text-note">{__('Showing the previous results until the new ones load.', 'wconvert')}</p></RegionBody>}
      {erasureNotice !== null && <RegionBody><p role="status" className="m-0 rounded-md border border-border bg-surface p-3 text-note">{erasureNotice}</p></RegionBody>}
      {error !== null && data !== null && <RegionError message={error} onRetry={retryLog} />}
      {namesError !== null && <RegionError message={sprintf(__('Campaign names couldn’t be loaded: %s', 'wconvert'), namesError)} onRetry={() => setNamesRetry((value) => value + 1)} />}
      {log.status === 'failed' ? <RegionErrorState message={log.message} onRetry={retryLog} /> : data === null ? <DataTable><TableSkeleton columns={5} /></DataTable> : rows === 0 ? (
        <EmptyState icon={Inbox} title={applied.query.leadId ? __('Submission not found', 'wconvert') : hasAppliedFilters ? __('No matching submissions', 'wconvert') : __('No submissions yet', 'wconvert')}
          action={hasAppliedFilters ? <Button variant="outline" onClick={() => changeQuery({})}>{__('Clear filters', 'wconvert')}</Button>
            : <Button asChild variant="outline"><a href={hashFor('optins')}>{__('Go to campaigns', 'wconvert')}</a></Button>}>
          {applied.query.leadId ? __('Retention or a privacy request may have deleted it, or another filter excludes it.', 'wconvert')
            : hasAppliedFilters ? __('Try another search, period or campaign.', 'wconvert')
              : __('Submissions appear here when a visitor fills in a published campaign.', 'wconvert')}
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
      </DataTable> : <EventTable leads={data.leads} nameOf={nameOf} goalOf={goalOf} returnTo={leadsHref(applied.query)} onOpen={(lead, button) => open({ kind: 'submission', lead }, button)} />}
      {data !== null && rows > 0 && (applied.page > 1 || data.next_cursor !== null) && <RegionFooter>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span>{sprintf(__('Page %s', 'wconvert'), formatCount(applied.page))}</span>
          <div className="flex gap-2"><Button variant="outline" disabled={updating || showingPrevious || applied.page <= 1} onClick={previous}>{oldestFirst ? __('Older', 'wconvert') : __('Newer', 'wconvert')}</Button>
            <Button variant="outline" disabled={updating || showingPrevious || !data.next_cursor} onClick={next}>{oldestFirst ? __('Newer', 'wconvert') : __('Older', 'wconvert')}</Button></div>
        </div>
      </RegionFooter>}
    </Region>
    <RetentionSummary refreshKey={retry} />
    <AdminDialog open={opened !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpened(null); }}>
      <AdminDialogContent size="md" onCloseAutoFocus={(event) => {
        // "See all from" re-renders the table, so the row that opened the
        // dialog can be gone; the search is the next place a hand would be.
        event.preventDefault();
        if (trigger.current?.isConnected) trigger.current.focus();
        else document.getElementById('wconvert-lead-search')?.focus();
      }}>
        {opened?.kind === 'submission' && <LeadDetail lead={opened.lead} campaign={nameOf(opened.lead.optin_id)} goal={goalOf(opened.lead.optin_id)}
          returnTo={leadsHref(applied.query)} backLabel={__('All leads', 'wconvert')} onBack={() => setOpened(null)} onSeeAll={seeAll} />}
        {opened?.kind === 'history' && <LeadHistory key={`${opened.group.identifier}:${opened.query.snapshot}`} group={opened.group} query={opened.query}
          filtered={queryKeyOf(opened.query) !== '{}'} nameOf={nameOf} goalOf={goalOf} onClose={() => setOpened(null)} onSeeAll={seeAll} />}
      </AdminDialogContent>
    </AdminDialog>
    <AlertDialog open={erasureOpen} onOpenChange={(isOpen) => { if (!erasing) setErasureOpen(isOpen); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{framed(__('Delete every submission from %s?', 'wconvert'), erasurePreview?.identifier ?? privacyIdentifier ?? '')}</AlertDialogTitle>
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
                setErasureOpen(false);
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

type Period = 'all' | '7' | '30' | 'custom';

/** The preset a date pair spells, decided on the site's day. */
function periodOf(from: string, to: string, today: string | null): Period {
  if (!from && !to) return 'all';
  if (today && to === today && from === shiftDay(today, -6)) return '7';
  if (today && to === today && from === shiftDay(today, -29)) return '30';
  return 'custom';
}

function periodLabel(from: string | undefined, to: string | undefined, today: string | null): string | null {
  const period = periodOf(from ?? '', to ?? '', today);
  if (period === 'all') return null;
  if (period === '7') return __('Last 7 days', 'wconvert');
  if (period === '30') return __('Last 30 days', 'wconvert');
  if (from && to) return formatRange(from, to);
  return from ? sprintf(__('From %s', 'wconvert'), formatDay(from)) : sprintf(__('Until %s', 'wconvert'), formatDay(to ?? ''));
}

interface Draft { search: string; optinId: string; from: string; to: string; order: 'newest' | 'oldest'; custom: boolean }

const draftOf = (query: LeadQuery): Draft => ({ search: query.leadId ?? query.identifier ?? query.search ?? '', optinId: query.optinId ?? '',
  from: query.from ?? '', to: query.to ?? '', order: query.order ?? 'newest', custom: false });

/**
 * **One apply model** (ADR 0131): a choice applies the moment it is made, and
 * what is typed applies on Enter — the search, or a custom date when the field
 * is left. Every change applies the whole form as it stands, so a search typed
 * and not yet sent is never dropped by picking a campaign.
 *
 * The draft follows the applied query rather than being remounted by it, so
 * a select keeps focus through the read its own change started.
 */
function HistoryFilters({ query, optins, onApply }: { query: LeadQuery; optins: OptinSummary[] | null; onApply: (query: LeadQuery) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(query));
  const [expanded, setExpanded] = useState(Boolean(query.from || query.to || query.order));
  const [error, setError] = useState<string | null>(null);
  // The purpose strip sits outside this form; its change must not reset a draft.
  const syncKey = queryKeyOf({ ...query, purpose: undefined });
  const [synced, setSynced] = useState(syncKey);
  if (synced !== syncKey) {
    setSynced(syncKey);
    setDraft(draftOf(query));
    setError(null);
    if (query.from || query.to || query.order) setExpanded(true);
  }
  const today = siteToday();
  const period: Period = draft.custom ? 'custom' : periodOf(draft.from, draft.to, today);
  const apply = (next: Draft) => {
    setDraft(next);
    if (next.from && next.to && next.from > next.to) { setError(__('The end date must be on or after the start date.', 'wconvert')); return; }
    const term = next.search.trim();
    // A pasted submission ID still finds its row, though no screen shows one.
    const id = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(term) ? term.toUpperCase() : undefined;
    const identifier = !id && (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term) || /^(\+|00)[\d\s()-]+$/.test(term)) ? term : undefined;
    const built: LeadQuery = { order: next.order === 'oldest' ? 'oldest' : undefined, optinId: next.optinId || undefined, purpose: query.purpose, identifier,
      search: term && !id && !identifier ? term : undefined, leadId: id, from: next.from || undefined, to: next.to || undefined };
    setError(null);
    if (queryKeyOf(built) !== queryKeyOf(query)) onApply(built);
  };
  const summary = [periodLabel(query.from, query.to, today), query.order === 'oldest' ? __('Oldest first', 'wconvert') : null].filter(Boolean).join(' · ');
  const missing = draft.optinId !== '' && !(optins ?? []).some((optin) => optin.id === draft.optinId);

  return <form className="flex flex-col gap-3" aria-label={__('Filter submissions', 'wconvert')} onSubmit={(event) => { event.preventDefault(); apply(draft); }}>
    <div className="flex flex-wrap items-end gap-3">
      <Field label={__('Search submissions', 'wconvert')} htmlFor="wconvert-lead-search" className="basis-64 flex-1">
        <div className="flex gap-2">
          <Input id="wconvert-lead-search" type="search" maxLength={254} value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder={__('Name, email, phone or message', 'wconvert')} />
          <Button type="submit" variant="outline"><Search aria-hidden="true" />{__('Search', 'wconvert')}</Button>
        </div>
      </Field>
      <Field label={__('Campaign', 'wconvert')} htmlFor="wconvert-lead-optin">
        <NativeSelect id="wconvert-lead-optin" className="w-64" value={draft.optinId} onChange={(event) => apply({ ...draft, optinId: event.target.value })}>
          <option value="">{__('All campaigns', 'wconvert')}</option>
          {missing && <option value={draft.optinId}>{optins === null ? __('Selected campaign', 'wconvert') : __('Deleted campaign', 'wconvert')}</option>}
          {(optins ?? []).map((optin) => <option key={optin.id} value={optin.id}>{optin.name.trim() || __('Unnamed campaign', 'wconvert')}</option>)}
        </NativeSelect>
      </Field>
      {queryKeyOf(query) !== '{}' && <Button type="button" variant="link" onClick={() => { setError(null); setDraft(draftOf({})); onApply({}); }}>{__('Clear filters', 'wconvert')}</Button>}
    </div>
    <Disclosure variant="inline" title={__('More filters', 'wconvert')} summary={expanded ? undefined : summary || undefined} open={expanded} onToggle={setExpanded}>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={__('Period', 'wconvert')} htmlFor="wconvert-lead-period">
          <NativeSelect id="wconvert-lead-period" value={period} onChange={(event) => {
            const value = event.target.value as Period;
            if (value === 'custom') setDraft({ ...draft, custom: true });
            else if (value === 'all') apply({ ...draft, custom: false, from: '', to: '' });
            else if (today) apply({ ...draft, custom: false, from: shiftDay(today, 1 - Number(value)), to: today });
          }}>
            <option value="all">{__('Any time', 'wconvert')}</option>
            <option value="7" disabled={!today}>{__('Last 7 days', 'wconvert')}</option>
            <option value="30" disabled={!today}>{__('Last 30 days', 'wconvert')}</option>
            <option value="custom">{__('Custom dates', 'wconvert')}</option>
          </NativeSelect>
        </Field>
        {period === 'custom' && <>
          <Field label={__('From', 'wconvert')} htmlFor="wconvert-lead-from">
            <Input id="wconvert-lead-from" className="w-40" type="date" value={draft.from} aria-describedby="wconvert-lead-dates" onChange={(event) => setDraft({ ...draft, custom: true, from: event.target.value })} onBlur={() => apply(draft)} />
          </Field>
          <Field label={__('To', 'wconvert')} htmlFor="wconvert-lead-to">
            <Input id="wconvert-lead-to" className="w-40" type="date" value={draft.to} min={draft.from || undefined} aria-describedby="wconvert-lead-dates" onChange={(event) => setDraft({ ...draft, custom: true, to: event.target.value })} onBlur={() => apply(draft)} />
          </Field>
        </>}
        <Field label={__('Order', 'wconvert')} htmlFor="wconvert-lead-order">
          <NativeSelect id="wconvert-lead-order" value={draft.order} onChange={(event) => apply({ ...draft, order: event.target.value === 'oldest' ? 'oldest' : 'newest' })}>
            <option value="newest">{__('Newest first', 'wconvert')}</option>
            <option value="oldest">{__('Oldest first', 'wconvert')}</option>
          </NativeSelect>
        </Field>
      </div>
      {period === 'custom' && <p id="wconvert-lead-dates" className="mb-0 mt-2 text-note text-muted-foreground">{__('Both days are included.', 'wconvert')}</p>}
    </Disclosure>
    {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
  </form>;
}

function scopeDescription(query: LeadQuery, nameOf: (id: string) => CampaignName): string {
  const campaign = query.optinId ? nameOf(query.optinId) : __('All campaigns', 'wconvert');
  const parts = [campaign === null ? __('Deleted campaign', 'wconvert') : campaign ?? __('Selected campaign', 'wconvert'),
    query.purpose === 'subscribers' ? __('Subscribers', 'wconvert') : query.purpose === 'enquiries' ? __('Enquiries', 'wconvert') : undefined,
    query.leadId ? __('One submission', 'wconvert') : query.identifier || query.search,
    periodLabel(query.from, query.to, siteToday()) ?? __('Any time', 'wconvert')];
  return sprintf(__('Showing: %s', 'wconvert'), parts.filter(Boolean).join(' · '));
}
