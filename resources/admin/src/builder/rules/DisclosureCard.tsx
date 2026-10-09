import type { ReactNode } from 'react';
import { Disclosure } from '../../shell/Disclosure';

/**
 * A setting most Campaigns leave alone, as a full-row card that opens and
 * closes (GUIDELINES §21). Closed, it still says what it is set to, so nobody
 * opens it just to check. The shared `Disclosure` card, under its old name.
 */
export function DisclosureCard({ title, current, open, children }: {
  readonly title: string;
  readonly current: string;
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  return <Disclosure title={title} summary={current} open={open}>{children}</Disclosure>;
}
