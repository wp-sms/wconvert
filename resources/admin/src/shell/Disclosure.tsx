import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * **The one collapsible** (GUIDELINES §21, ADR 0131). The whole row is the
 * trigger; a trailing 16px chevron turns when open; the body's inline start
 * lines up with the title text, not with a marker. Native `details`/`summary`
 * supplies the behaviour and its announcement.
 *
 * - `card` is bordered, for a setting most campaigns leave alone. Closed, its
 *   `summary` line still says what it is set to, so nobody opens it to check.
 * - `inline` has no border, for "Other details", "For developers" and help
 *   that sits inside something else.
 *
 * It replaced eight treatments: the browser's triangle in about forty places,
 * a leading chevron, an icon swap, text-only toggles and one with no marker.
 */
export function Disclosure({
  title,
  summary,
  variant = 'card',
  open,
  onToggle,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  /** A second line under the title: the current value, or what is inside. */
  summary?: ReactNode;
  variant?: 'card' | 'inline';
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <details
      className={cn('wconvert-disclosure', `wconvert-disclosure--${variant}`, className)}
      open={open || undefined}
      onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}
    >
      <summary>
        <span className="wconvert-disclosure__title">
          {title}
          {summary && <small>{summary}</small>}
        </span>
        <ChevronDown aria-hidden="true" className="wconvert-disclosure__chevron" />
      </summary>
      <div className={cn('wconvert-disclosure__body', bodyClassName)}>{children}</div>
    </details>
  );
}
