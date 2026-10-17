import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { MoreHorizontal, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent } from '../components/ui/option-menu';
import { messageOf } from '../shell/loadable';
import { importOccasion, type OccasionNotice } from './api';

/**
 * Import an occasion file (#280, ADR 0153), from the ⋯ beside Create campaign
 * — there even before a site has any occasion, which is when an agency's file
 * arrives. Its campaigns land as drafts and the list says which did not.
 */
export function ImportOccasionMenu({ disabled = false, onImported }: { disabled?: boolean; onImported: (notice: OccasionNotice) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} variant="outline" size="icon" disabled={disabled} aria-label={__('More campaign actions', 'wconvert')}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <OptionMenuContent align="end" sideOffset={5} aria-label={__('More campaign actions', 'wconvert')}>
        <OptionGroup>
          <OptionItem icon={Upload} name={__('Import occasion', 'wconvert')} onSelect={() => setOpen(true)} />
        </OptionGroup>
      </OptionMenuContent>
    </DropdownMenu>
    {open && <ImportDialog returnFocusTo={trigger} onClose={() => setOpen(false)} onImported={(notice) => { setOpen(false); onImported(notice); }} />}
  </>;
}

function ImportDialog({ returnFocusTo, onClose, onImported }: {
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onImported: (notice: OccasionNotice) => void;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null); setProblems([]);
    let document: unknown;
    try { document = JSON.parse(await file.text()); }
    catch { setBusy(false); setError(__('This file isn’t an occasion file.', 'wconvert')); return; }
    try {
      const result = await importOccasion(document);
      onImported({
        occasion: result.occasion.id,
        kind: 'import',
        title: sprintf(/* translators: 1: an occasion's name, 2: how many draft campaigns came in. */
          _n('Imported %1$s with %2$d draft campaign.', 'Imported %1$s with %2$d draft campaigns.', result.created.length, 'wconvert'),
          result.occasion.name, result.created.length),
        problems: result.refused.map((refused) => sprintf(/* translators: 1: a campaign's name, 2: why it was not imported. */ __('%1$s wasn’t imported. %2$s', 'wconvert'), refused.name, refused.reason)),
      });
    } catch (cause) {
      setError(messageOf(cause));
      // A 422 names each wrong value; nothing was written.
      const errors = typeof cause === 'object' && cause !== null && 'data' in cause
        ? (cause as { data?: { errors?: Record<string, string> } }).data?.errors : undefined;
      if (errors) setProblems(Object.entries(errors).slice(0, 8).map(([path, message]) => `${path}: ${message}`));
    } finally { setBusy(false); }
  };
  return (
    <AdminDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <AdminDialogContent size="sm" showCloseButton={!busy}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <AdminDialogHeader title={__('Import an occasion', 'wconvert')} />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void run(); }}>
          <AdminDialogBody className="flex flex-col gap-3">
            <label htmlFor={`${id}-file`} className="wconvert-occasion-drop">
              <Upload aria-hidden="true" />
              <span className="font-semibold">{file ? file.name : __('Choose an occasion file (.json)', 'wconvert')}</span>
              <span className="text-note text-muted-foreground">{__('Exported from WConvert', 'wconvert')}</span>
              <input id={`${id}-file`} type="file" accept=".json,application/json" className="sr-only" disabled={busy}
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); setProblems([]); }} />
            </label>
            <p className="m-0 text-note">{__('Its campaigns arrive as drafts. Nothing is published.', 'wconvert')}</p>
            {problems.length > 0 && <ul className="wconvert-occasion-notice__problems">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
          </AdminDialogBody>
          <AdminDialogFooter error={error} back={<Button type="button" variant="outline" disabled={busy} onClick={onClose}>{__('Cancel', 'wconvert')}</Button>}>
            <Button type="submit" disabled={busy || !file}>{busy ? __('Importing…', 'wconvert') : __('Import', 'wconvert')}</Button>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
}
