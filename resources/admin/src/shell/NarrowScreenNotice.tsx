import { MonitorSmartphone } from 'lucide-react';
import { widerScreenMessage } from '../viewport';
import { Description } from './Description';

/**
 * What stands where the builder would, on a screen too narrow for it.
 *
 * **It says what is needed, not that something is unsupported** (ADR 0038). A
 * builder that silently degrades on a narrow viewport is a bug report; one
 * that names the width it wants is a decision the merchant can act on — and
 * the sentence quotes the same number the gate uses, so the two cannot drift.
 *
 * The four reading screens hold the other floor and work to 360px, so this is
 * the only place in the admin a viewport turns anything away.
 *
 * It draws its own surface, because the shell draws none — every region owns
 * its own edges now, and this is a region.
 */
export function NarrowScreenNotice() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-md border border-border bg-card px-5 py-10 text-center">
      <MonitorSmartphone aria-hidden="true" className="size-8 text-muted-foreground" />
      <Description>{widerScreenMessage()}</Description>
    </div>
  );
}
