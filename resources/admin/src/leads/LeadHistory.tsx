import { useEffect, useMemo, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Download, Inbox } from 'lucide-react';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import { DataTable } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageError } from '../shell/Region';
import { TableSkeleton } from '../shell/TableSkeleton';
import { messageOf } from '../shell/loadable';
import { formatCount } from '../lib/format';
import { journeysSupported } from '../settings';
import { leadsHref } from '../nav';
import { canExport, exportLeads, readLog, type Lead, type LeadGroup, type LeadLog, type LeadPage } from './api';
import { EventTable } from './EventTable';
import { LeadDetail, submissionCount, type CampaignName } from './LeadDetail';

/**
 * Every submission from one email or phone, under the log's filters — and one
 * of them, opened **in place** with Back rather than in a second dialog over
 * this one (ADR 0131). The history stays mounted while a submission is open,
 * so Back returns to the same page of it with focus on the row it left.
 *
 * The pager is in the footer, outside the scroll, so it is reachable without
 * scrolling through a page of rows.
 */
export function LeadHistory({
  group,
  query,
  filtered,
  nameOf,
  goalOf,
  onClose,
  onSeeAll,
}: {
  group: LeadGroup;
  query: LeadPage;
  /** Whether the log's filters narrow this history, which the meta line then says. */
  filtered: boolean;
  nameOf: (id: string) => CampaignName;
  goalOf: (id: string) => string | undefined;
  onClose: () => void;
  onSeeAll: (contact: string) => void;
}) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [data, setData] = useState<LeadLog | null>(null);
  const [shownPage, setShownPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState<Lead | null>(null);
  const returnTo = useRef<string | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const filter = useMemo(() => ({ ...query, includeCounts: false, groupIdentifier: group.identifier, grouped: false, cursor }), [query, group.identifier, cursor]);
  const requestedPage = previous.length + 1;

  useEffect(() => {
    let active = true;
    setLoading(true);
    void readLog(filter).then((next) => {
      if (!active) return;
      setData(next);
      setShownPage(requestedPage);
      setError(null);
    }).catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, requestedPage, retry]);

  // Opening a submission moves focus to its Back; Back returns it to the row.
  useEffect(() => {
    if (open !== null) back.current?.focus();
    else if (returnTo.current !== null) {
      rows.current?.querySelector<HTMLElement>(`[data-lead="${returnTo.current}"]`)?.focus();
      returnTo.current = null;
    }
  }, [open]);

  const returnHref = leadsHref(query);
  if (open !== null) {
    return (
      <LeadDetail
        lead={open}
        campaign={nameOf(open.optin_id)}
        goal={goalOf(open.optin_id)}
        returnTo={returnHref}
        backLabel={__('Back', 'wconvert')}
        backRef={back}
        onBack={() => { returnTo.current = open.id; setOpen(null); }}
        onSeeAll={onSeeAll}
      />
    );
  }

  const total = data?.submissions ?? group.submissions;
  const paged = previous.length > 0 || Boolean(data?.next_cursor);
  const csv = canExport();
  const answersCsv = csv && (journeysSupported() || (data?.leads.some((lead) => (lead.question_answers?.length ?? 0) > 0) ?? false));
  const oldestFirst = query.order === 'oldest';
  const goBack = <Button variant="outline" disabled={loading || previous.length === 0} onClick={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)); }}>
    {oldestFirst ? __('Older', 'wconvert') : __('Newer', 'wconvert')}
  </Button>;
  const goOn = <Button variant="outline" disabled={loading || error !== null || !data?.next_cursor} onClick={() => { setPrevious([...previous, cursor]); setCursor(data?.next_cursor ?? undefined); }}>
    {oldestFirst ? __('Newer', 'wconvert') : __('Older', 'wconvert')}
  </Button>;

  return (
    <>
      <AdminDialogHeader
        title={<bdi dir="ltr" title={group.identifier}>{group.identifier}</bdi>}
        meta={filtered
          ? sprintf(_n('%s submission matches the current filters', '%s submissions match the current filters', total, 'wconvert'), formatCount(total))
          : submissionCount(total)}
      >
        {csv && (
          <div className="wconvert-toolbar mt-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportLeads(filter)}><Download aria-hidden="true" />{__('Export these submissions', 'wconvert')}</Button>
            {answersCsv && <Button variant="outline" onClick={() => exportLeads(filter, 'questions')}><Download aria-hidden="true" />{__('Export question answers', 'wconvert')}</Button>}
          </div>
        )}
      </AdminDialogHeader>
      <AdminDialogBody ref={rows} className="flex flex-col gap-4">
        {error !== null && <PageError message={error} onRetry={() => setRetry((value) => value + 1)} />}
        {data === null
          ? error === null && <DataTable><TableSkeleton columns={4} /></DataTable>
          : data.leads.length === 0
            ? <EmptyState icon={Inbox} title={__('No matching submissions', 'wconvert')}>
              {__('They may have been deleted since the list loaded.', 'wconvert')}
            </EmptyState>
            : <EventTable leads={data.leads} nameOf={nameOf} goalOf={goalOf} returnTo={returnHref} showPerson={false}
              onOpen={(lead) => setOpen(lead)} />}
      </AdminDialogBody>
      <AdminDialogFooter
        back={<Button variant="outline" onClick={onClose}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('All leads', 'wconvert')}</Button>}
        note={paged ? sprintf(__('Page %s', 'wconvert'), formatCount(shownPage)) : undefined}
      >
        {paged && <>{goBack}{goOn}</>}
      </AdminDialogFooter>
    </>
  );
}
