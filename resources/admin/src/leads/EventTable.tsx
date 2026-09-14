import { useRef, useState } from 'react';
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
import { editorHref } from '../nav';
import type { Lead } from './api';

/** One compact row per capture; the original answers belong in its detail dialog. */
export function EventTable({
  leads,
  nameOf,
  returnTo,
}: {
  leads: Lead[];
  nameOf: (id: string) => string;
  returnTo: string;
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
                {lead.fields.name && (
                  <span className="block font-medium">{lead.fields.name}</span>
                )}
                <bdi dir="ltr" className="block break-all">
                  {lead.email ?? lead.phone ?? '—'}
                </bdi>
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
                  {lead.created_at}
                </bdi>
              </DataTableCell>
              <DataTableCell label={__('Details', 'wconvert')}>
                <Button
                  variant="link"
                  size="sm"
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setSelected(lead);
                  }}
                >
                  {__('View captured details', 'wconvert')}
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
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{__('Submission details', 'wconvert')}</DialogTitle>
            <DialogDescription>
              {__(
                'The original capture, not a contact profile or a sending status.',
                'wconvert',
              )}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <h3 className="m-0 break-words text-heading font-semibold">
                  {selected.fields.name || selected.email || selected.phone}
                </h3>
                <p className="mb-0 mt-1 text-note text-muted-foreground">
                  {nameOf(selected.optin_id)} · {selected.created_at}
                </p>
              </div>
              <dl className="m-0 flex flex-col gap-4">
                {[
                  ['email', selected.email],
                  ['phone', selected.phone],
                  ...Object.entries(selected.fields).filter(
                    ([name]) =>
                      name !== 'name' &&
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
