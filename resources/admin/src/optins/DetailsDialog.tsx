import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Copy, EyeOff, Inbox, MoreHorizontal, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Disclosure } from '../shell/Disclosure';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import type { GoalEntry } from '../goals/api';
import type { Loadable } from '../shell/loadable';
import { CampaignSummary, type CampaignResults } from './CampaignSummary';
import { canUnpublish, statusOf, type OptinSummary } from './api';
import { decisionCopy } from './decisionCopy';
import { StatusBadge } from './StatusBadge';

const Facts = lazy(() => import('./CampaignDetails'));

export type { CampaignResults };

/** The two status changes Details can ask; delete stays in the row's menu only. */
export type DetailsDecision = 'publish' | 'pause';

/**
 * **A campaign's Details** — a Medium `AdminDialog` (ADR 0131, decision 1;
 * amended by ADR 0137).
 *
 * The header is the campaign itself: its name, its status and one line saying
 * what it is. The body is {@link CampaignSummary}, the one the editor's
 * Details shows too (ADR 0138). The footer holds a ⋯ menu for the status
 * changes, then the report and the editor.
 *
 * Publish and Unpublish confirm in place — the footer becomes the question —
 * because a dialog never stacks another (GUIDELINES "Never nested"). Delete
 * stays in the row's menu, so the destructive action lives in one place.
 *
 * There is no ID in it, with one exception folded away at the bottom: the
 * free page events identify a campaign by nothing else.
 */
export function CampaignDetailsDialog({
  row,
  name,
  meta,
  thumbnail,
  missingDesign = false,
  results,
  goal,
  goalId,
  productCheck,
  reportLink,
  leadsLink,
  editBusy,
  onEdit,
  onDecide,
  onDuplicate,
  onClose,
  returnFocus,
}: {
  row: OptinSummary | null;
  name: string;
  meta: string;
  thumbnail: ReactNode;
  missingDesign?: boolean;
  results: CampaignResults;
  /** The row's Goal, as the list read the registry. */
  goal: Loadable<GoalEntry | null>;
  goalId: string;
  productCheck: ReactNode;
  reportLink: string;
  /** Its submissions for the period, only when it captures. */
  leadsLink?: string;
  editBusy: boolean;
  onEdit: () => void;
  onDecide: (kind: DetailsDecision) => void;
  onDuplicate: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const openEditor = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const question = useId();
  const [asking, setAsking] = useState<DetailsDecision | null>(null);
  const status = row ? statusOf(row) : 'draft';
  const arm = row !== null && row.parent_id !== null;
  useEffect(() => setAsking(null), [row?.id]);
  // Asking puts the caret on Cancel; backing out puts it back on the ⋯ that
  // asked, once that has re-rendered — never on a timer a reopened menu would lose.
  const backingOut = useRef(false);
  useEffect(() => {
    if (asking) keep.current?.focus();
    else if (backingOut.current) {
      backingOut.current = false;
      more.current?.focus();
    }
  }, [asking]);
  const notes = row ? [
    missingDesign ? __('No design yet. Choose one in the editor before publishing.', 'wconvert') : null,
    row.suspended || null,
    row.has_unpublished_changes
      ? status === 'suspended'
        ? __('The saved draft has unpublished changes. Resolve the issue before it can show again.', 'wconvert')
        : __('The previous version is still published. Open the editor to publish your changes.', 'wconvert')
      : null,
  ].filter((note): note is string => note !== null) : [];
  const words = asking ? decisionCopy(asking, arm, name) : null;
  const cancel = () => {
    backingOut.current = true;
    setAsking(null);
  };
  const publishes = !canUnpublish(status) || (row?.has_unpublished_changes ?? false);
  return (
    <AdminDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AdminDialogContent
        size="md"
        className="wconvert-campaign-detail"
        // Read-only facts come first; focus waits on the primary action rather
        // than on the first control in the body, which is the developer
        // disclosure at the bottom and would scroll the facts out of view.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          openEditor.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        // Escape backs out of the question before it closes Details.
        onEscapeKeyDown={(event) => {
          if (!asking) return;
          event.preventDefault();
          cancel();
        }}
      >
        <AdminDialogHeader title={name} badge={row && <StatusBadge status={status} />} meta={meta} />
        <AdminDialogBody className="wconvert-campaign-detail__body">
          {row && (
            <CampaignSummary
              notes={notes}
              thumbnail={thumbnail}
              goal={goal}
              goalId={goalId}
              results={results}
              status={status}
              howItRuns={<Suspense fallback={<RowsSkeleton rows={4} />}><Facts key={row.id} id={row.id} /></Suspense>}
              productCheck={productCheck}
              developers={<ForDevelopers key={row.id} value={row.id} variant={row.parent_id !== null} />}
            />
          )}
        </AdminDialogBody>
        {words && asking ? (
          <div role="group" aria-labelledby={question} className="wconvert-dialog__footer wconvert-campaign-detail__confirm wconvert-toolbar">
            <p id={question}>
              <strong>{words.title}</strong> {words.description}
            </p>
            <div className="wconvert-dialog__actions">
              <Button ref={keep} type="button" variant="outline" onClick={cancel}>
                {__('Cancel', 'wconvert')}
              </Button>
              <Button type="button" disabled={editBusy} onClick={() => onDecide(asking)}>
                {words.confirmLabel}
              </Button>
            </div>
          </div>
        ) : (
          <AdminDialogFooter
            back={row && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button ref={more} variant="outline" size="icon" disabled={editBusy} aria-label={sprintf(__('More actions for %s', 'wconvert'), name)}>
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" sideOffset={5} className="wconvert-campaign-menu">
                  {canUnpublish(status) && (
                    <DropdownMenuItem onSelect={() => setAsking('pause')}>
                      <EyeOff aria-hidden="true" />
                      {arm ? __('Unpublish variant', 'wconvert') : __('Unpublish campaign', 'wconvert')}
                    </DropdownMenuItem>
                  )}
                  {publishes && (
                    <DropdownMenuItem disabled={missingDesign} onSelect={() => setAsking('publish')}>
                      <Upload aria-hidden="true" />
                      {__('Publish saved draft', 'wconvert')}
                    </DropdownMenuItem>
                  )}
                  {publishes && missingDesign && (
                    <DropdownMenuLabel className="wconvert-menu-note text-micro font-normal text-muted-foreground">
                      {__('Add a design in the editor before publishing.', 'wconvert')}
                    </DropdownMenuLabel>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDuplicate}>
                    <Copy aria-hidden="true" />
                    {__('Duplicate as draft', 'wconvert')}
                  </DropdownMenuItem>
                  {leadsLink && (
                    <DropdownMenuItem asChild>
                      <a href={leadsLink}>
                        <Inbox aria-hidden="true" />
                        {__('View submissions', 'wconvert')}
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          >
            <Button variant="outline" asChild>
              <a href={reportLink}>{__('View report', 'wconvert')}</a>
            </Button>
            {/* The list's Next action says the same: a draft is still being made. */}
            <Button ref={openEditor} disabled={editBusy} onClick={onEdit}>
              {status === 'draft' ? __('Continue editing', 'wconvert') : __('Open editor', 'wconvert')}
            </Button>
          </AdminDialogFooter>
        )}
      </AdminDialogContent>
    </AdminDialog>
  );
}

/**
 * **The one ID on any screen** (ADR 0131, decision 10). The free page events
 * (`resources/loader/src/events.ts`) carry a campaign's ID and nothing else, so
 * a developer matching them has no other way to find it. Closed by default.
 */
export function ForDevelopers({ value, variant }: { value: string; variant: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const run = async () => {
    setCopy('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopy('copied');
    } catch {
      setCopy('failed');
      input.current?.focus();
      input.current?.select();
    }
  };
  return (
    <Disclosure variant="inline" title={__('For developers', 'wconvert')}>
      <p id={`${id}-hint`} className="m-0 text-note text-muted-foreground">
        {variant
          ? __('Page events carry this as optinId; their campaignId is the campaign this variant belongs to.', 'wconvert')
          : __('Page events identify this campaign only by this ID, as campaignId.', 'wconvert')}
      </p>
      <div className="wconvert-toolbar flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {variant ? __('Variant ID', 'wconvert') : __('Campaign ID', 'wconvert')}
        </label>
        <Input
          id={id}
          ref={input}
          value={value}
          readOnly
          dir="ltr"
          className="min-w-0 flex-[1_1_14rem] font-mono"
          aria-describedby={`${id}-hint`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" disabled={copy === 'copying'} onClick={() => void run()}>
          <Copy aria-hidden="true" />
          {copy === 'copying' ? __('Copying…', 'wconvert') : __('Copy ID', 'wconvert')}
        </Button>
      </div>
      <p role="status" className="m-0 text-note">
        {copy === 'copied' ? __('Copied.', 'wconvert') : ''}
      </p>
      {copy === 'failed' && (
        <p role="alert" className="m-0 text-note text-destructive">
          {__('Couldn’t copy. The ID is selected; copy it with your keyboard.', 'wconvert')}
        </p>
      )}
    </Disclosure>
  );
}
