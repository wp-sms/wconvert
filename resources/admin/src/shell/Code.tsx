import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * A machine value, shown verbatim because no friendlier name exists.
 *
 * ============================================================================
 * FOUR SCREENS COPIED THE SAME IDIOM, AND THE SIZE WAS OFF-SCALE ON ALL FOUR.
 * ============================================================================
 * `<code className="font-mono text-xs">` appeared on the Lead log, the
 * Destinations failure table, the Optin list and the readiness dialog — a
 * captured field's name, a lead id, an unnamed Goal, an unnamed [[Playbook]]
 * member. Four call sites, one idiom, and `text-xs` is Tailwind's scale rather
 * than this admin's: the six roles in `index.css` do not include it, so every
 * copy of the idiom was a role the type scale never granted.
 *
 * `--text-micro` is the 12px role, and it carries the register with the size —
 * the 0.04em tracking and the 600 weight that a monospaced id wants anyway, and
 * that four hand-written `text-xs` classes each had to remember separately.
 *
 * **It never becomes a Badge**, which is the rule {@see OptinList} and
 * {@see ReadinessDialog} both argue in place: a badge in this admin is a STATE,
 * and dressing an unknown id as one would claim the thing is in a state called
 * `from_a_plugin_we_lack`.
 *
 * Colour stays at the call site. Where the value is the cell's own content it
 * reads at full strength; where it is a label beside the value it is muted —
 * and that is a decision about which of the two is the point, not about what a
 * `<code>` is.
 */
export function Code({ className, children }: { className?: string; children: ReactNode }) {
  return <code className={cn('font-mono text-micro', className)}>{children}</code>;
}
