import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

/**
 * Where a page-scoped action a SCREEN owns is rendered.
 *
 * **The problem this solves is Leads' Export CSV.** It acts on the whole log, so
 * ADR 0039 puts it in the page header beside the title — but the URL it points
 * at carries the screen's Optin filter, which is the screen's state and does not
 * belong to {@see App}. Lifting the filter up to the frame to satisfy a button's
 * placement is the shape that quietly grows a context; portalling the button
 * down to the frame keeps the state where it is used.
 *
 * It also keeps `lead-log.test.tsx` honest rather than adjusted. That test
 * renders `<LeadLog />` on its own and asserts a link named "Export CSV" — and
 * it should, because the export IS the screen's, however the frame draws it.
 * With no `Shell` above it there is no header to portal into, and the fallback
 * below renders the action in place. The test asserts the same thing before and
 * after the move, which is what a test asserting behaviour is supposed to do.
 */
interface Slot {
  /** Is there a page header at all? The builder's frame has none. */
  readonly present: boolean;
  /** The node to portal into, once the header's ref has run. */
  readonly target: HTMLElement | null;
  /** Where the way back goes: above the title. */
  readonly backTarget: HTMLElement | null;
}

const PageActionSlot = createContext<Slot>({ present: false, target: null, backTarget: null });

export const PageActionSlotProvider = PageActionSlot.Provider;

/**
 * A page-scoped action, rendered into the page header.
 *
 * **The three-way answer is why `present` exists separately from `target`.**
 * A callback ref runs after the first commit, so a naive `target === null` test
 * would render the action inline for one frame and then move it — a button
 * flashing into the middle of the page on every load. Knowing a header is
 * coming lets this render nothing until it arrives, while a screen with no
 * header at all still gets its action drawn where it stands.
 */
export function PageAction({ children }: { children: ReactNode }) {
  const slot = useContext(PageActionSlot);

  if (!slot.present) {
    return <>{children}</>;
  }

  return slot.target === null ? null : createPortal(children, slot.target);
}

/**
 * The way back to the page this one sits inside: **one ghost link, above the
 * title** (§11). It had been an outline button among the heading's actions on
 * Sending issues, this on an occasion, and a link in the body on a report.
 *
 * It portals for the reason {@see PageAction} does: a report's way back keeps
 * the window it loaded, which is the screen's state and not the frame's.
 */
export function PageBack({ href, children }: { href: string; children: ReactNode }) {
  const slot = useContext(PageActionSlot);
  const link = (
    <Button asChild variant="ghost" className="-ms-3 self-start">
      <a href={href}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{children}</a>
    </Button>
  );

  if (!slot.present) {
    return link;
  }

  return slot.backTarget === null ? null : createPortal(link, slot.backTarget);
}
