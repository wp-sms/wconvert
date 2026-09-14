import { useEffect, useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Download, Inbox, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionError, RegionErrorState, RegionFooter } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { exportUrl, readLog, type LeadGroup, type LeadLog as LeadLogPayload, type LeadPage, type LeadQuery } from './api';
import { EventTable } from './EventTable';
import { RetentionSummary } from './RetentionSummary';
import { flattened, listOptins, type OptinSummary } from '../optins/api';
import { leadsHref } from '../nav';

const ALL_OPTINS = 'all';
const EMPTY_QUERY: LeadQuery = {};
const queryKeyOf = (query: LeadQuery) => JSON.stringify({ optinId: query.optinId || undefined,
  search: query.search || undefined, purpose: query.purpose || undefined,
  identifier: query.identifier || undefined, leadId: query.leadId || undefined,
  from: query.from || undefined, to: query.to || undefined });
const submissionCount = (count: number) => sprintf(_n('%s submission', '%s submissions', count, 'wconvert'), String(count));

export interface LeadLogProps {
  query?: LeadQuery;
  onQueryChange?: (query: LeadQuery) => void;
}

/** History remains a log of immutable capture events. Grouping never changes its headline count. */
export function LeadLog({ query, onQueryChange }: LeadLogProps) {
  const [localQuery, setLocalQuery] = useState<LeadQuery>(EMPTY_QUERY);
  const queryKey = queryKeyOf(query ?? localQuery);
  const requested = useMemo(() => JSON.parse(queryKey) as LeadQuery, [queryKey]);
  const [grouped, setGrouped] = useState(false);
  const scope = `${queryKey}:${grouped}`;
  const [paging, setPaging] = useState<{ scope: string; cursor?: string; snapshot?: string; previous: (string | undefined)[] }>({ scope: '', previous: [] });
  const cursor = paging.scope === scope ? paging.cursor : undefined;
  const snapshot = paging.scope === scope ? paging.snapshot : undefined;
  const pageNumber = paging.scope === scope ? paging.previous.length + 1 : 1;
  const request = useMemo<LeadPage>(() => ({ ...requested, grouped, cursor, snapshot }), [requested, grouped, cursor, snapshot]);
  const [log, setLog] = useState<Loadable<LeadLogPayload>>(LOADING);
  const [applied, setApplied] = useState<{ query: LeadPage; page: number }>({ query: {}, page: 1 });
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [optins, setOptins] = useState<OptinSummary[]>([]);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [namesRetry, setNamesRetry] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<{ group: LeadGroup; query: LeadPage } | null>(null);

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

  const names = useMemo(() => new Map(optins.map((optin) => [optin.id, optin.name])), [optins]);
  const nameOf = (id: string) => names.get(id) || id;
  const changeQuery = (next: LeadQuery) => {
    if (onQueryChange) onQueryChange(next);
    else setLocalQuery(next);
  };
  const data = log.status === 'ready' ? log.data : null;
  const csv = data === null ? null : exportUrl(applied.query);
  const shownGrouped = applied.query.grouped === true;
  const hasAppliedFilters = queryKeyOf(applied.query) !== '{}';
  const rows = data === null ? 0 : shownGrouped ? data.groups.length : data.leads.length;
  const showingPrevious = data !== null && (queryKeyOf(applied.query) !== queryKey || shownGrouped !== grouped || applied.query.cursor !== cursor);
  const next = () => {
    if (!data?.next_cursor) return;
    setPaging({ scope, cursor: data.next_cursor, snapshot: data.snapshot,
      previous: [...(paging.scope === scope ? paging.previous : []), cursor] });
  };
  const previous = () => {
    const held = paging.previous;
    setPaging({ ...paging, cursor: held[held.length - 1], previous: held.slice(0, -1) });
  };

  return <div className="flex flex-col gap-5">
    {csv !== null && <PageAction><Button asChild variant="outline"><a href={csv}>
      <Download aria-hidden="true" />{__('Export matching submissions', 'wconvert')}
    </a></Button></PageAction>}
    <Region label={__('Submissions', 'wconvert')}>
      <RegionBody>
        <div role="group" aria-label={__('Submission purpose', 'wconvert')} className="mb-4 flex flex-wrap gap-2">
          {[{ value: undefined, label: __('All submissions', 'wconvert') }, { value: 'subscribers' as const, label: __('Subscriber collection', 'wconvert') }, { value: 'enquiries' as const, label: __('Enquiries', 'wconvert') }].map(({ value, label }) => <Button key={value ?? 'all'} size="sm" variant={requested.purpose === value ? 'secondary' : 'ghost'} aria-pressed={requested.purpose === value} onClick={() => changeQuery({ ...requested, purpose: value })}>{label}</Button>)}
        </div>
        <HistoryFilters key={queryKey} query={requested} optins={optins} onApply={changeQuery} />
      </RegionBody>
      <Toolbar trailing={data === null ? undefined : <ToolbarCount hint={__('The total counts submissions, never people.', 'wconvert')}>
        {submissionCount(data.submissions)}
      </ToolbarCount>}>
        <span className="wconvert-check"><Checkbox id="wconvert-lead-grouped" checked={grouped}
          onCheckedChange={(checked) => setGrouped(checked === true)} />
        <Label htmlFor="wconvert-lead-grouped">{__('Group by email or phone', 'wconvert')}</Label></span>
        <Button variant="ghost" size="sm" disabled={updating} onClick={() => {
          setPaging({ scope, previous: [] }); setRetry((value) => value + 1);
        }}>{__('Refresh submissions', 'wconvert')}</Button>
      </Toolbar>
      {data !== null && <RegionBody className="py-3 text-note text-muted-foreground">
        <p className="m-0">{scopeDescription(applied.query, nameOf)}</p>
        <p className="m-0">{__('CSV includes all retained matching submissions captured before this view loaded, across all pages. Grouping does not change the export.', 'wconvert')}</p>
      </RegionBody>}
      {updating && <RegionBody><p role="status" className="m-0 text-note">{data ? __('Updating submissions…', 'wconvert') : __('Loading submissions…', 'wconvert')}</p></RegionBody>}
      {showingPrevious && <RegionBody><p className="m-0 text-note">{__('The table and export still show the last successful filters until the new results load.', 'wconvert')}</p></RegionBody>}
      {error !== null && data !== null && <RegionError message={error} />}
      {namesError !== null && <RegionError message={namesError} />}
      {(error !== null || namesError !== null) && <RegionBody><Button variant="outline" onClick={() => {
        if (error !== null) setRetry((value) => value + 1);
        if (namesError !== null) setNamesRetry((value) => value + 1);
      }}>{__('Retry loading submissions', 'wconvert')}</Button></RegionBody>}
      {log.status === 'failed' ? <RegionErrorState message={log.message} /> : data === null ? <DataTable><TableSkeleton columns={5} /></DataTable> : rows === 0 ? (
        <EmptyState icon={Inbox} title={applied.query.leadId ? __('Submission not found', 'wconvert') : hasAppliedFilters ? __('No matching submissions', 'wconvert') : __('No submissions yet', 'wconvert')}
          action={hasAppliedFilters ? <Button variant="outline" onClick={() => changeQuery({})}>{__('Clear filters', 'wconvert')}</Button>
            : <Button asChild variant="outline"><a href="#optins">{__('Go to Campaigns', 'wconvert')}</a></Button>}>
          {applied.query.leadId ? __('This ID may no longer be retained, or another filter may exclude it. Captures removed by retention or privacy tools cannot be recovered here.', 'wconvert')
            : hasAppliedFilters ? __('Try another search, date period or Campaign, or clear the filters.', 'wconvert')
              : __('A row appears the moment a visitor submits a published Campaign.', 'wconvert')}
        </EmptyState>
      ) : shownGrouped ? <DataTable>
        <DataTableHead><DataTableColumn>{__('Identifier', 'wconvert')}</DataTableColumn><DataTableColumn numeric>{__('Submissions', 'wconvert')}</DataTableColumn><DataTableColumn>{__('Last submitted', 'wconvert')}</DataTableColumn><DataTableColumn>{__('History', 'wconvert')}</DataTableColumn></DataTableHead>
        <DataTableBody>{data.groups.map((group) => <DataTableRow key={group.identifier}>
          <DataTableCell label={__('Identifier', 'wconvert')}><bdi dir="ltr">{group.identifier}</bdi></DataTableCell>
          <DataTableCell label={__('Submissions', 'wconvert')} numeric>{submissionCount(group.submissions)}</DataTableCell>
          <DataTableCell label={__('Last submitted', 'wconvert')}><bdi dir="ltr">{group.latest_at ?? '—'}</bdi></DataTableCell>
          <DataTableCell label={__('History', 'wconvert')}><Button variant="link" size="sm" onClick={() => setSelectedGroup({ group, query: applied.query })}>{__('View submissions', 'wconvert')}</Button></DataTableCell>
        </DataTableRow>)}</DataTableBody>
      </DataTable> : <EventTable leads={data.leads} nameOf={nameOf} returnTo={leadsHref(applied.query)} />}
      {data !== null && rows > 0 && <RegionFooter>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span>{sprintf(shownGrouped
            ? _n('Page %1$d · %2$d identifier group shown. Total above counts all matching submissions.', 'Page %1$d · %2$d identifier groups shown. Total above counts all matching submissions.', rows, 'wconvert')
            : _n('Page %1$d · %2$d submission shown.', 'Page %1$d · %2$d submissions shown.', rows, 'wconvert'), applied.page, rows)}</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={updating || showingPrevious || applied.page <= 1} onClick={previous}>{__('Newer', 'wconvert')}</Button>
            <Button variant="outline" size="sm" disabled={updating || showingPrevious || !data.next_cursor} onClick={next}>{__('Older', 'wconvert')}</Button></div>
        </div>
      </RegionFooter>}
    </Region>
    <RetentionSummary />
    <Dialog open={selectedGroup !== null} onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>{__('Submission history', 'wconvert')}</DialogTitle><DialogDescription>{selectedGroup?.group.identifier}</DialogDescription></DialogHeader>
        {selectedGroup !== null && <GroupEvents key={`${selectedGroup.group.identifier}:${selectedGroup.query.snapshot}`} group={selectedGroup.group} query={selectedGroup.query} nameOf={nameOf} />}
      </DialogContent>
    </Dialog>
  </div>;
}

function HistoryFilters({ query, optins, onApply }: { query: LeadQuery; optins: OptinSummary[]; onApply: (query: LeadQuery) => void }) {
  const [optinId, setOptinId] = useState(query.optinId ?? '');
  const [search, setSearch] = useState(query.leadId ?? query.identifier ?? query.search ?? '');
  const [from, setFrom] = useState(query.from ?? '');
  const [to, setTo] = useState(query.to ?? '');
  const [error, setError] = useState<string | null>(null);
  return <form className="flex flex-col gap-3" onSubmit={(event) => {
    event.preventDefault();
    if (from && to && from > to) { setError(__('The end date must be on or after the start date.', 'wconvert')); return; }
    const term = search.trim();
    const id = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(term) ? term.toUpperCase() : undefined;
    const identifier = !id && (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term) || /^(\+|00)[\d\s()-]+$/.test(term)) ? term : undefined;
    setError(null);
    onApply({ optinId: optinId || undefined, purpose: query.purpose, identifier, search: term && !id && !identifier ? term : undefined, leadId: id, from: from || undefined, to: to || undefined });
  }}>
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 basis-64 flex-1"><Label htmlFor="wconvert-lead-search">{__('Search submissions', 'wconvert')}</Label>
        <Input id="wconvert-lead-search" type="search" maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={__('Name, email, phone, message or Lead ID', 'wconvert')} /></div>
      <div><Label htmlFor="wconvert-lead-optin">{__('Campaign', 'wconvert')}</Label><Select value={optinId || ALL_OPTINS} onValueChange={(value) => setOptinId(value === ALL_OPTINS ? '' : value)}>
        <SelectTrigger id="wconvert-lead-optin" className="min-w-44 max-w-64"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value={ALL_OPTINS}>{__('All Campaigns', 'wconvert')}</SelectItem>
          {optinId && !optins.some((optin) => optin.id === optinId) && <SelectItem value={optinId}>{optinId}</SelectItem>}
          {optins.map((optin) => <SelectItem key={optin.id} value={optin.id}>{optin.name || optin.id}</SelectItem>)}
        </SelectContent></Select></div>
      <div><Label htmlFor="wconvert-lead-from">{__('From', 'wconvert')}</Label><Input id="wconvert-lead-from" className="w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
      <div><Label htmlFor="wconvert-lead-to">{__('To', 'wconvert')}</Label><Input id="wconvert-lead-to" className="w-40" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></div>
      <Button type="submit" variant="outline"><Search aria-hidden="true" />{__('Apply filters', 'wconvert')}</Button>
      {(search || optinId || from || to || query.purpose) && <Button type="button" variant="link" onClick={() => { setSearch(''); setOptinId(''); setFrom(''); setTo(''); setError(null); onApply({}); }}>{__('Clear filters', 'wconvert')}</Button>}
    </div>
    <p className="m-0 text-note text-muted-foreground">{__('Search captured names and messages, or enter a complete email, international phone number or Lead ID for an exact match. Dates include both days.', 'wconvert')}</p>
    {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
  </form>;
}

function scopeDescription(query: LeadQuery, nameOf: (id: string) => string): string {
  const parts = [query.optinId ? nameOf(query.optinId) : __('All Campaigns', 'wconvert'),
    query.purpose === 'subscribers' ? __('Subscriber collection', 'wconvert') : query.purpose === 'enquiries' ? __('Enquiries', 'wconvert') : undefined,
    query.leadId || query.identifier || query.search,
    query.from || query.to ? sprintf(__('%1$s to %2$s', 'wconvert'), query.from || __('the beginning', 'wconvert'), query.to || __('now', 'wconvert')) : __('All dates', 'wconvert')];
  return sprintf(__('Showing: %s', 'wconvert'), parts.filter(Boolean).join(' · '));
}


function GroupEvents({ group, query, nameOf }: { group: LeadGroup; query: LeadPage; nameOf: (id: string) => string }) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [data, setData] = useState<LeadLogPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const filter = useMemo(() => ({ ...query, groupIdentifier: group.identifier, grouped: false, cursor }), [query, group.identifier, cursor]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void readLog(filter).then((next) => { if (active) { setData(next); setError(null); } })
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, retry]);
  const csv = exportUrl(filter);
  return <div className="flex flex-col gap-4">
    <p>{submissionCount(data?.submissions ?? group.submissions)}{__(' within the selected filters. These are capture events, not a contact profile.', 'wconvert')}</p>
    {csv && <Button asChild variant="outline" className="self-start"><a href={csv}><Download aria-hidden="true" />{__('Export these submissions', 'wconvert')}</a></Button>}
    {loading && <p role="status">{__('Loading submissions…', 'wconvert')}</p>}
    {error && <div><p role="alert">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>{__('Retry', 'wconvert')}</Button></div>}
    {data !== null && data.leads.length === 0 && <p>{__('No retained submissions match this group and these filters.', 'wconvert')}</p>}
    {data !== null && <EventTable leads={data.leads} nameOf={nameOf} returnTo={leadsHref(query)} />}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={loading || error !== null || previous.length === 0} onClick={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)); }}>{__('Newer submissions', 'wconvert')}</Button>
      <Button variant="outline" disabled={loading || error !== null || !data?.next_cursor} onClick={() => { setPrevious([...previous, cursor]); setCursor(data?.next_cursor ?? undefined); }}>{__('Older submissions', 'wconvert')}</Button></div>
  </div>;
}
