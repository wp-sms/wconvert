import { lazy, Suspense, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Copy } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { Disclosure } from '../shell/Disclosure';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { formatCount, formatRange, formatRate } from '../lib/format';
import { statusOf, type OptinSummary } from './api';
import { StatusBadge } from './StatusBadge';

const Facts = lazy(() => import('./CampaignDetails'));

/** One campaign's numbers for the list's period, as the list already read them. */
export type CampaignResults =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; days: number; from: string; to: string; result?: { count: number; shown: number; rate: number | null; label: string } };

/**
 * **A campaign's Details** — a Medium `AdminDialog` (ADR 0131, decision 6).
 *
 * The header is the campaign itself: its name, its status and one line saying
 * what it is. The body reads top to bottom the way a merchant asks: what it
 * looks like, how it did, who it shows to and where, what happens after
 * signup, and whether its products still exist. The footer holds the two
 * doors out — the report and the editor.
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
  productCheck,
  reportLink,
  editBusy,
  onEdit,
  onClose,
  returnFocus,
}: {
  row: OptinSummary | null;
  name: string;
  meta: string;
  thumbnail: ReactNode;
  missingDesign?: boolean;
  results: CampaignResults;
  productCheck: ReactNode;
  reportLink: string;
  editBusy: boolean;
  onEdit: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const openEditor = useRef<HTMLButtonElement>(null);
  const status = row ? statusOf(row) : 'draft';
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
      >
        <AdminDialogHeader title={name} badge={row && <StatusBadge status={status} />} meta={meta} />
        <AdminDialogBody className="wconvert-campaign-detail__body">
          {row && (
            <>
              {thumbnail}
              {missingDesign && (
                <p className="wconvert-campaign-detail__note">
                  {__('No design yet. Choose one in the editor before publishing.', 'wconvert')}
                </p>
              )}
              {row.suspended && <p className="wconvert-campaign-detail__note">{row.suspended}</p>}
              {row.has_unpublished_changes && (
                <p className="wconvert-campaign-detail__note">
                  {status === 'suspended'
                    ? __('The saved draft has unpublished changes. Resolve the issue before it can show again.', 'wconvert')
                    : __('The previous version is still published. Open the editor to publish your changes.', 'wconvert')}
                </p>
              )}
              <Results results={results} status={status} />
              <Suspense fallback={<RowsSkeleton rows={4} />}>
                <Facts key={row.id} id={row.id} />
              </Suspense>
              {productCheck}
              <ForDevelopers key={row.id} value={row.id} variant={row.parent_id !== null} />
            </>
          )}
        </AdminDialogBody>
        <AdminDialogFooter>
          <Button variant="outline" asChild>
            <a href={reportLink}>{__('View report', 'wconvert')}</a>
          </Button>
          <Button ref={openEditor} disabled={editBusy} onClick={onEdit}>
            {__('Open editor', 'wconvert')}
          </Button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}

/** The list's numbers for this campaign, never a second read. */
function Results({ results, status }: { results: CampaignResults; status: ReturnType<typeof statusOf> }) {
  const heading = useId();
  const title =
    results.status === 'ready'
      ? sprintf(_n('Last %d day', 'Last %d days', results.days, 'wconvert'), results.days)
      : __('Results', 'wconvert');
  return (
    <section className="wconvert-campaign-facts" aria-labelledby={heading}>
      <h3 id={heading}>
        {title}
        {results.status === 'ready' && <small>{formatRange(results.from, results.to)}</small>}
      </h3>
      {results.status === 'loading' ? (
        <div className="wconvert-campaign-detail-stats" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <div key={key}>
              <Skeleton className="w-12" style={{ blockSize: '1lh' }} />
              <Skeleton className="mt-1 w-20" style={{ blockSize: '1lh' }} />
            </div>
          ))}
        </div>
      ) : results.status === 'failed' ? (
        <p>{__('Results couldn’t load.', 'wconvert')}</p>
      ) : results.result ? (
        <div className="wconvert-campaign-detail-stats">
          <p>
            <strong>{formatCount(results.result.count)}</strong>
            <span>{results.result.label}</span>
          </p>
          <p>
            <strong>{formatCount(results.result.shown)}</strong>
            <span>{__('Shown', 'wconvert')}</span>
          </p>
          <p>
            <strong>{formatRate(results.result.rate)}</strong>
            <span>{__('Conversion rate', 'wconvert')}</span>
          </p>
        </div>
      ) : (
        <p>{status === 'draft' ? __('No results yet.', 'wconvert') : __('No results in this period.', 'wconvert')}</p>
      )}
    </section>
  );
}

/**
 * **The one ID on any screen** (ADR 0131, decision 10). The free page events
 * (`resources/loader/src/events.ts`) carry a campaign's ID and nothing else, so
 * a developer matching them has no other way to find it. Closed by default.
 */
function ForDevelopers({ value, variant }: { value: string; variant: boolean }) {
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
