import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

/**
 * Lines of text that are on their way, where a whole region or table would
 * be too much: a fact inside a form, a list inside a popover, an inline value.
 *
 * It replaces a visible "Loading …" sentence. A sentence is text the loaded
 * state does not have, so the line it took was given back and the control
 * under it moved; a bar the height of the line holds the space and says
 * nothing a screen reader has to hear twice. The `status` is said once,
 * screen-reader only (GUIDELINES §12), and names what is loading.
 *
 * `inline` draws one bar inside running text, for a value mid-sentence.
 */
export function LineSkeleton({ status, lines = 1, inline = false, className }: {
  status: string;
  lines?: number;
  inline?: boolean;
  /** The text size the bars stand for, e.g. `text-note`, so `1lh` is that line. */
  className?: string;
}) {
  if (inline) {
    return <span role="status">
      <span className="sr-only">{status}</span>
      <Skeleton aria-hidden="true" className={cn('inline-block h-[1lh] w-12 align-top', className)} />
    </span>;
  }
  return <div role="status" className="flex flex-col gap-1.5">
    <span className="sr-only">{status}</span>
    {Array.from({ length: lines }, (_each, line) => (
      <Skeleton key={line} aria-hidden="true" className={cn('h-[1lh] max-w-full', line === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full max-w-sm', className)} />
    ))}
  </div>;
}
