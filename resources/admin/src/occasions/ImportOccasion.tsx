import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CalendarPlus, MoreHorizontal, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent } from '../components/ui/option-menu';
import { messageOf } from '../shell/loadable';
import { importOccasion, type OccasionNotice } from './api';
import { NewOccasionDialog } from './NewOccasion';

/**
 * The ⋯ beside Create campaign: a new occasion (ADR 0171), or an imported
 * one (#280, ADR 0153) — there even before a site has any occasion, which is
 * when an agency's file arrives. Imported campaigns land as drafts and the
 * list says which did not.
 */
export function ImportOccasionMenu({ disabled = false, onImported, onCreated }: {
  disabled?: boolean;
  onImported: (notice: OccasionNotice) => void;
  /** A new occasion was saved: its page is where campaigns are made for it. */
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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
          <OptionItem icon={CalendarPlus} name={__('New occasion', 'wconvert')} onSelect={() => setCreating(true)} />
          <OptionItem icon={Upload} name={__('Import occasion', 'wconvert')} onSelect={() => setOpen(true)} />
        </OptionGroup>
      </OptionMenuContent>
    </DropdownMenu>
    {creating && <NewOccasionDialog returnFocusTo={trigger} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onCreated(id); }} />}
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
      const data = typeof cause === 'object' && cause !== null && 'data' in cause
        ? (cause as { data?: { errors?: Record<string, string>; refused?: { name: string; reason: string }[] } }).data : undefined;
      const errors = data?.errors;
      // Or no campaign could come across, and each says why.
      if (data?.refused) setProblems(data.refused.map((refused) => sprintf(/* translators: 1: a campaign's name, 2: why it was not imported. */ __('%1$s wasn’t imported. %2$s', 'wconvert'), refused.name, refused.reason)));
      if (errors) setProblems(Object.entries(errors).slice(0, 8).map(([path, message]) => `${whereIn(document, path)}: ${message}`));
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

/**
 * Where in the file a refusal points, in words: the campaign's own name, or
 * its place in the file, never the key path the server reports (GUIDELINES §8).
 */
export function whereIn(document: unknown, path: string): string {
  const [head, index] = path.split('.');
  if (head === 'campaigns' && index !== undefined) {
    const campaigns = typeof document === 'object' && document !== null && Array.isArray((document as { campaigns?: unknown }).campaigns)
      ? (document as { campaigns: unknown[] }).campaigns : [];
    const name = (campaigns[Number(index)] as { name?: unknown } | undefined)?.name;
    return typeof name === 'string' && name.trim() !== '' ? name : sprintf(/* translators: %d: a campaign's position in the imported file, from 1. */ __('Campaign %d', 'wconvert'), Number(index) + 1);
  }
  return head === 'occasion' ? __('Occasion', 'wconvert') : head === 'campaigns' ? __('Campaigns', 'wconvert') : __('File', 'wconvert');
}
