import { useRef, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { captureTime } from './calendar';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { editorHref, leadsHref } from '../nav';
import type { Lead } from './api';

/** One compact row per capture; the original answers belong in its detail dialog. */
export function EventTable({
  leads,
  nameOf,
  returnTo,
  goalOf,
  onRelated,
}: {
  leads: Lead[];
  nameOf: (id: string) => string;
  returnTo: string;
  goalOf?: (id: string) => string | undefined;
  onRelated?: (identifier: string) => void;
}) {
  const [selected, setSelected] = useState<Lead | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <DataTable>
        <DataTableHead>
          <DataTableColumn>{__('Submitted by', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
          <DataTableColumn>
            {__('Captured details', 'wconvert')}
          </DataTableColumn>
          <DataTableColumn>{__('Submitted', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Details', 'wconvert')}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {leads.map((lead) => (
            <DataTableRow key={lead.id}>
              <DataTableCell label={__('Submitted by', 'wconvert')}>
                <LeadIdentity lead={lead} />
                {lead.email && lead.phone && (
                  <bdi
                    dir="ltr"
                    className="block text-note text-muted-foreground"
                  >
                    {lead.phone}
                  </bdi>
                )}
              </DataTableCell>
              <DataTableCell label={__('Campaign', 'wconvert')}>
                <a href={editorHref(lead.optin_id, returnTo)}>
                  {nameOf(lead.optin_id)}
                </a>
                {goalOf?.(lead.optin_id) && <span className="mt-1 block text-note text-muted-foreground">{goalOf(lead.optin_id)}</span>}
              </DataTableCell>
              <DataTableCell label={__('Captured details', 'wconvert')}>
                <span className="line-clamp-2 max-w-sm break-words text-note text-muted-foreground">
                  {lead.fields.message ||
                    lead.fields.interest_label ||
                    lead.fields.interest ||
                    __('Contact details captured', 'wconvert')}
                </span>
              </DataTableCell>
              <DataTableCell label={__('Submitted', 'wconvert')}>
                <bdi dir="ltr" className="text-note">
                  <time dateTime={lead.created_at.replace(' ', 'T')} title={lead.created_at}>{captureTime(lead.created_at)}</time>
                </bdi>
              </DataTableCell>
              <DataTableCell label={__('Details', 'wconvert')}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={sprintf(__('Open submission from %s', 'wconvert'), lead.fields.name || lead.email || lead.phone || lead.id)}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setSelected(lead);
                  }}
                >
                  {__('Open', 'wconvert')}<ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-auto sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
            else document.getElementById('wconvert-lead-search')?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{__('Submission details', 'wconvert')}</DialogTitle>
            <DialogDescription>
              {__(
                'Read the original answers and capture context.',
                'wconvert',
              )}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <div>
                <LeadIdentity lead={selected} />
                <p className="mb-0 mt-2 text-note text-muted-foreground"><time title={selected.created_at}>{captureTime(selected.created_at)}</time></p>
              </div>
              {selected.fields.message && <section className="border-y border-border py-5">
                <h3 className="m-0 text-body font-semibold">{__('What they said', 'wconvert')}</h3>
                <blockquote className="mx-0 mb-0 mt-3 border-s-2 border-primary ps-4 whitespace-pre-wrap break-words">{selected.fields.message}</blockquote>
              </section>}
              <section>
                <h3 className="mb-3 mt-0 text-body font-semibold">{__('Capture context', 'wconvert')}</h3>
                <a className="inline-flex items-center gap-2 text-primary" href={editorHref(selected.optin_id, returnTo)}>{nameOf(selected.optin_id)}<ExternalLink aria-hidden="true" className="size-3" /></a>
                {goalOf?.(selected.optin_id) && <p className="mb-0 mt-1 text-note text-muted-foreground">{goalOf(selected.optin_id)}</p>}
              </section>
              <dl className="m-0 flex flex-col gap-4">
                {[
                  ['email', selected.email],
                  ['phone', selected.phone],
                  ...Object.entries(selected.fields).filter(
                    ([name]) =>
                      name !== 'name' &&
                      name !== 'message' &&
                      name !== 'interest_label' &&
                      name !== 'consent_text',
                  ),
                ].map(
                  ([name, value]) =>
                    value && (
                      <div key={name}>
                        <dt className="text-note font-medium text-muted-foreground">
                          {fieldLabel(name!)}
                        </dt>
                        <dd className="m-0 break-words whitespace-pre-wrap">
                          {name === 'interest' &&
                          selected.fields.interest_label ? (
                            <>
                              {selected.fields.interest_label}
                              <span className="block text-note text-muted-foreground">
                                {sprintf(
                                  __('Sent value: %s', 'wconvert'),
                                  value,
                                )}
                              </span>
                            </>
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    ),
                )}
              </dl>
              {(selected.email || selected.phone) && <div className="rounded-md border border-border bg-muted/30 p-4">
                {onRelated ? <Button variant="link" className="h-auto p-0 text-start whitespace-normal" onClick={() => { const identifier = selected.email || selected.phone!; setSelected(null); onRelated(identifier); }}>{selected.email ? __('View submissions using this email', 'wconvert') : __('View submissions using this phone', 'wconvert')}<ChevronRight aria-hidden="true" className="size-4" /></Button>
                  : <a className="text-primary" href={leadsHref({ identifier: selected.email || selected.phone! })}>{__('View submissions using this identifier', 'wconvert')}</a>}
                <p className="mb-0 mt-1 text-note text-muted-foreground">{__('Search all retained captures, outside the current filters. These remain separate submissions, not a merged contact.', 'wconvert')}</p>
              </div>}
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer font-medium">
                  {__('Consent at capture', 'wconvert')}
                </summary>
                <p className="mb-0 break-words whitespace-pre-wrap text-note">
                  {selected.fields.consent_text ||
                    __(
                      'No consent text was recorded with this submission.',
                      'wconvert',
                    )}
                </p>
                <p className="mb-0 text-note text-muted-foreground">{__('This records the wording at submission, not a current subscription status.', 'wconvert')}</p>
              </details>
              <div className="border-t border-border pt-3 text-note text-muted-foreground">
                <span className="block">{__('Lead ID', 'wconvert')}</span>
                <bdi dir="ltr" className="break-all">
                  {selected.id}
                </bdi>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function fieldLabel(name: string): string {
  switch (name) {
    case 'email':
      return __('Email', 'wconvert');
    case 'phone':
      return __('Phone', 'wconvert');
    case 'message':
      return __('Message', 'wconvert');
    case 'interest':
      return __('Interest', 'wconvert');
    default:
      return name.replaceAll('_', ' ');
  }
}

function LeadIdentity({ lead }: { lead: Lead }) {
  const initials = lead.fields.name?.trim().split(/\s+/).map((part) => Array.from(part)[0]).slice(0, 2).join('').toLocaleUpperCase();
  return <span className="flex items-center gap-3">
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-note font-semibold text-primary">{initials || '—'}</span>
    <span className="min-w-0">{lead.fields.name && <span className="block font-medium">{lead.fields.name}</span>}<bdi dir="ltr" className="block break-all text-note text-muted-foreground">{lead.email ?? lead.phone ?? '—'}</bdi></span>
  </span>;
}
