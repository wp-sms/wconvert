import { useId, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Field } from '../shell/Field';
import { siteLocale } from '../lib/format';
import { newAuthoringId } from '../authoringId';
import { zoneName } from '../discovery/model';
import { usePicker } from '../discovery/usePicker';

const MAX_OCCASIONS = 50;

/**
 * A sale or launch to plan campaigns around, added from the ⋯ beside Create
 * campaign (ADR 0171) — where Import occasion already is. Saving one never
 * schedules a campaign; its page is where campaigns are made for it.
 */
export function NewOccasionDialog({ returnFocusTo, onClose, onCreated }: {
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const picker = usePicker();
  const id = useId();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const items = picker.data?.occasions.items ?? [];
  const full = items.length >= MAX_OCCASIONS;
  const zone = picker.data ? zoneName(picker.data.timezone, siteLocale()) : '';

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AdminDialogContent size="sm" dirty={name !== '' || start !== '' || end !== ''} showCloseButton={!picker.saving}
        onCloseAutoFocus={(event) => { if (!returnFocusTo.current?.isConnected) return; event.preventDefault(); returnFocusTo.current.focus(); }}>
        <AdminDialogHeader title={__('New occasion', 'wconvert')} meta={zone
          ? sprintf(/* translators: %s: the site's time zone, e.g. “Central European Time”. */ __('Days follow this site’s time zone, %s. Saving one never schedules a campaign.', 'wconvert'), zone)
          : __('Saving one never schedules a campaign.', 'wconvert')} />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (full || !picker.data || name.trim() === '') return;
          const occasion = { id: `occasion-${newAuthoringId()}`, name: name.trim(), start, end };
          void picker.occasions([...items, occasion]).then(saved => { if (saved) onCreated(occasion.id); });
        }}>
          <AdminDialogBody className="flex flex-col gap-4">
            <Field label={__('Occasion name', 'wconvert')} htmlFor={`${id}-name`}>
              <Input id={`${id}-name`} required maxLength={120} value={name} placeholder={__('Anniversary sale', 'wconvert')} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label={__('First day', 'wconvert')} htmlFor={`${id}-start`}>
              <Input id={`${id}-start`} type="date" required value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label={__('Last day', 'wconvert')} htmlFor={`${id}-end`}>
              <Input id={`${id}-end`} type="date" required min={start || undefined} value={end} onChange={(event) => setEnd(event.target.value)} />
            </Field>
            {full && <p className="m-0 text-note text-muted-foreground">{sprintf(/* translators: %s: the most occasions you can keep, e.g. “50”. */ __('You can keep up to %s occasions. Delete one to add another.', 'wconvert'), String(MAX_OCCASIONS))}</p>}
          </AdminDialogBody>
          <AdminDialogFooter error={picker.error} back={<Button type="button" variant="outline" disabled={picker.saving} onClick={onClose}>{__('Cancel', 'wconvert')}</Button>}>
            <Button type="submit" disabled={picker.saving || !picker.data || full || name.trim() === ''}>{picker.saving ? __('Saving…', 'wconvert') : __('Add occasion', 'wconvert')}</Button>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
}
