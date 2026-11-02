import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { formatCount } from '../lib/format';
import { cn } from '../lib/utils';
import { ToolbarCount } from './Toolbar';

interface PageStep { label: string; disabled: boolean; onClick: () => void }

/**
 * A way through pages: back, where this is, forward. The position is spoken as
 * it changes, because focus stays on the button that changed it.
 *
 * This takes words rather than numbers for Leads, which pages by cursor under a
 * snapshot (ADR 0071): it knows no last page, and its steps are Newer and Older.
 */
export function PageSteps({ label, position, previous, next, className }: {
  label: string;
  position: string;
  previous?: PageStep;
  next?: PageStep;
  className?: string;
}) {
  return (
    <nav className={cn('wconvert-toolbar flex flex-wrap items-center gap-3', className)} aria-label={label}>
      {previous && <Button variant="outline" disabled={previous.disabled} onClick={previous.onClick}>
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{previous.label}
      </Button>}
      <span aria-live="polite" aria-atomic="true">{position}</span>
      {next && <Button variant="outline" disabled={next.disabled} onClick={next.onClick}>
        {next.label}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
      </Button>}
    </nav>
  );
}

/** {@see PageSteps} where the pages are counted: zero-based here, one-based on screen. */
export function ListPages({ label, page, pages, onChange, disabled = false, className }: {
  label: string;
  page: number;
  pages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <PageSteps
      label={label}
      className={className}
      position={sprintf(/* translators: 1: this page's number, 2: how many pages there are. */ __('Page %1$s of %2$s', 'wconvert'), formatCount(page + 1), formatCount(pages))}
      previous={pages > 1 ? { label: __('Previous', 'wconvert'), disabled: disabled || page === 0, onClick: () => onChange(page - 1) } : undefined}
      next={pages > 1 ? { label: __('Next', 'wconvert'), disabled: disabled || page === pages - 1, onClick: () => onChange(page + 1) } : undefined}
    />
  );
}

/**
 * **A list's foot is one line: its count, its dates, its pages** (§20, ADR
 * 0132). Campaigns had all three, Sending issues only its pages and Leads a
 * page number, so the same question got three answers.
 *
 * `.wconvert-footer` is what the button-wrapping rule in `index.css` keys on
 * ({@see RegionFooter}). It is not `RegionFooter` itself because that spends
 * `px-4` as `!important`, and Campaigns' foot keeps its table's wider inset.
 */
export function ListFoot({ count, hint, dates, pages, className, children }: {
  /** One text node, noun included ({@see ToolbarCount}). */
  count: string;
  /** A correction to how the number reads. */
  hint?: string;
  /** The window the rows are from, where the list has one. */
  dates?: string | null;
  pages?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('wconvert-footer wconvert-list-foot', className)}>
      <span><ToolbarCount hint={hint}>{count}</ToolbarCount>{dates ? ` · ${dates}` : null}</span>
      {pages}
      {children}
    </div>
  );
}
