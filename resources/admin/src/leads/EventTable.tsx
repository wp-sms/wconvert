import { ChevronRight, User } from 'lucide-react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  DataTable,
  DataTableActions,
  DataTableActionsColumn,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { formatCount, formatWhen } from '../lib/format';
import type { Lead } from './api';
import { CampaignLink, contactOf, titleOf, type CampaignName } from './LeadDetail';
import type { NotSent } from './notSent';

/**
 * What a row says it holds: the message or interest, else how many questions
 * were answered — the answers themselves belong in the detail.
 */
const summaryOf = (lead: Lead): string | null => {
  const answered = lead.question_answers?.length ?? 0;
  return lead.fields.message || lead.fields.interest_label
    || (answered > 0 ? sprintf(_n('%s answer', '%s answers', answered, 'wconvert'), formatCount(answered)) : null);
};

/**
 * One compact row per submission; the answers belong in its detail.
 *
 * It opens nothing itself. The log and a lead's history each own the one
 * dialog the detail opens in, so a history never stacks a second modal over
 * itself (ADR 0131). `data-lead` is how a history puts focus back on the row
 * it came from.
 *
 * `showPerson` is off inside a lead's history, where every row shares the
 * email or phone the dialog is already titled by.
 *
 * **Details is drawn only when a row on this page has some** (ADR 0132). A
 * newsletter-only shop's submissions carry no message, and a column reading
 * "—" on every row is width taken from the date for nothing.
 *
 * A row the failure ring names reads "Not sent", amber because the site held
 * it back; a row it does not name says nothing either way (ADR 0008).
 */
export function EventTable({
  leads,
  nameOf,
  returnTo,
  notSentOf,
  onOpen,
  showPerson = true,
}: {
  leads: Lead[];
  nameOf: (id: string) => CampaignName;
  returnTo: string;
  notSentOf?: (id: string) => readonly NotSent[];
  onOpen: (lead: Lead, trigger: HTMLButtonElement) => void;
  showPerson?: boolean;
}) {
  const hasDetails = leads.some((lead) => summaryOf(lead) !== null);
  return (
    <DataTable>
      <DataTableHead>
        {showPerson && <DataTableColumn>{__('Submitted by', 'wconvert')}</DataTableColumn>}
        <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
        {hasDetails && <DataTableColumn>{__('Details', 'wconvert')}</DataTableColumn>}
        <DataTableColumn>{__('Submitted', 'wconvert')}</DataTableColumn>
        <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
      </DataTableHead>
      <DataTableBody>
        {leads.map((lead) => {
          const summary = summaryOf(lead);
          const notSent = (notSentOf?.(lead.id).length ?? 0) > 0;
          return (
            <DataTableRow key={lead.id}>
              {showPerson && (
                <DataTableCell label={__('Submitted by', 'wconvert')}>
                  <LeadIdentity lead={lead} />
                </DataTableCell>
              )}
              <DataTableCell label={__('Campaign', 'wconvert')}>
                {/* The goal is the detail's to say; here it doubled every row's height. */}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CampaignLink id={lead.optin_id} name={nameOf(lead.optin_id)} returnTo={returnTo} />
                  {notSent && <Badge variant="warning">{__('Not sent', 'wconvert')}</Badge>}
                </span>
              </DataTableCell>
              {hasDetails && (
                <DataTableCell label={__('Details', 'wconvert')}>
                  <span dir="auto" className="line-clamp-2 max-w-sm break-words text-note text-muted-foreground">
                    {summary ?? '—'}
                  </span>
                </DataTableCell>
              )}
              <DataTableCell label={__('Submitted', 'wconvert')}>
                {/* A list date is at most "Oct 3, 2025"; it never needs two lines. */}
                <time className="whitespace-nowrap text-note" dateTime={lead.created_at.replace(' ', 'T')} title={formatWhen(lead.created_at, 'detail')}>
                  {formatWhen(lead.created_at, 'list')}
                </time>
              </DataTableCell>
              <DataTableActions>
                <Button
                  variant="ghost"
                  data-lead={lead.id}
                  aria-label={sprintf(__('Open submission from %s', 'wconvert'), lead.fields.name?.trim() || titleOf(lead))}
                  onClick={(event) => onOpen(lead, event.currentTarget)}
                >
                  {__('Open', 'wconvert')}<ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </Button>
              </DataTableActions>
            </DataTableRow>
          );
        })}
      </DataTableBody>
    </DataTable>
  );
}

/**
 * The name leads; the email or phone sits under it, or leads itself where there
 * is no name. A nameless lead gets a neutral person mark rather than "—", which
 * down a column read as missing data.
 */
function LeadIdentity({ lead }: { lead: Lead }) {
  const name = lead.fields.name?.trim() || null;
  const contact = contactOf(lead);
  const initials = name?.split(/\s+/).map((part) => Array.from(part)[0]).slice(0, 2).join('').toLocaleUpperCase();
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-note font-semibold text-action">
        {initials || <User className="size-4 text-muted-foreground" />}
      </span>
      <span className="min-w-0">
        {name !== null && <span dir="auto" className="block font-medium break-words">{name}</span>}
        {contact !== null
          ? <bdi dir="ltr" className={name !== null ? 'block break-all text-note text-muted-foreground' : 'block break-all font-medium'}>{contact}</bdi>
          : name === null && <span className="block text-muted-foreground">{__('Unnamed lead', 'wconvert')}</span>}
        {lead.email && lead.phone && <bdi dir="ltr" className="block break-all text-note text-muted-foreground">{lead.phone}</bdi>}
      </span>
    </span>
  );
}
