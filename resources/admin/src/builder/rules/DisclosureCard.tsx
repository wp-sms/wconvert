import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A setting most Campaigns leave alone, as a full-row card that opens and
 * closes (GUIDELINES §21). Closed, it still says what it is set to, so nobody
 * opens it just to check.
 */
export function DisclosureCard({ title, current, open, children }: {
  readonly title: string;
  readonly current: string;
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  return <details className="wconvert-display-disclosure-card" open={open || undefined}>
    <summary><span>{title}<small>{current}</small></span><ChevronDown aria-hidden="true" /></summary>
    <div className="wconvert-display-disclosure-card__body">{children}</div>
  </details>;
}
