import { ChevronRight } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
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
import { formatWhen } from '../lib/format';
import type { Lead } from './api';
import { CampaignLink, contactOf, titleOf, type CampaignName } from './LeadDetail';

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
 */
export function EventTable({
  leads,
  nameOf,
  returnTo,
  goalOf,
  onOpen,
  showPerson = true,
}: {
  leads: Lead[];
  nameOf: (id: string) => CampaignName;
  returnTo: string;
  goalOf?: (id: string) => string | undefined;
  onOpen: (lead: Lead, trigger: HTMLButtonElement) => void;
  showPerson?: boolean;
}) {
  return (
    <DataTable>
      <DataTableHead>
        {showPerson && <DataTableColumn>{__('Submitted by', 'wconvert')}</DataTableColumn>}
        <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
        <DataTableColumn>{__('Details', 'wconvert')}</DataTableColumn>
        <DataTableColumn>{__('Submitted', 'wconvert')}</DataTableColumn>
        <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
      </DataTableHead>
      <DataTableBody>
        {leads.map((lead) => {
          const goal = goalOf?.(lead.optin_id);
          const summary = lead.fields.message || lead.fields.interest_label;
          return (
            <DataTableRow key={lead.id}>
              {showPerson && (
                <DataTableCell label={__('Submitted by', 'wconvert')}>
                  <LeadIdentity lead={lead} />
                </DataTableCell>
              )}
              <DataTableCell label={__('Campaign', 'wconvert')}>
                <CampaignLink id={lead.optin_id} name={nameOf(lead.optin_id)} returnTo={returnTo} />
                {goal && <span className="mt-1 block text-note text-muted-foreground">{goal}</span>}
              </DataTableCell>
              <DataTableCell label={__('Details', 'wconvert')}>
                <span dir="auto" className="line-clamp-2 max-w-sm break-words text-note text-muted-foreground">
                  {summary || '—'}
                </span>
              </DataTableCell>
              <DataTableCell label={__('Submitted', 'wconvert')}>
                <time className="text-note" dateTime={lead.created_at.replace(' ', 'T')} title={formatWhen(lead.created_at, 'detail')}>
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

/** The name leads; the email or phone sits under it, or leads itself where there is no name. */
function LeadIdentity({ lead }: { lead: Lead }) {
  const name = lead.fields.name?.trim() || null;
  const contact = contactOf(lead);
  const initials = name?.split(/\s+/).map((part) => Array.from(part)[0]).slice(0, 2).join('').toLocaleUpperCase();
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-note font-semibold text-action">{initials || '—'}</span>
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
