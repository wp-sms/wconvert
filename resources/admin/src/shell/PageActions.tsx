import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Description } from './Description';

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
  /** Hands the page header a screen's own title, or takes it back. */
  readonly setHeading: (heading: PageHeadingContent | null) => void;
}

/** What a page's title block says. */
export interface PageHeadingContent {
  readonly title: ReactNode;
  /** Beside the h1 rather than in it, so a tip's button is not part of the heading's name (ADR 0187). */
  readonly aside?: ReactNode;
  /** The line under the title. */
  readonly description?: ReactNode;
}

const PageActionSlot = createContext<Slot>({ present: false, target: null, backTarget: null, setHeading: () => undefined });

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
 * the window it loaded, which is the screen's state and not the frame's. Its
 * target is outside `.wconvert-page-actions`, whose rules would make it a 48px
 * toolbar button (ADR 0187).
 */
export function PageBack({ href, children }: { href: string; children: ReactNode }) {
  const slot = useContext(PageActionSlot);
  const link = (
    <Button asChild variant="ghost" className="wconvert-page-back flex h-6 w-fit py-0 has-[>svg]:px-1.5">
      <a href={href}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{children}</a>
    </Button>
  );

  if (!slot.present) {
    return link;
  }

  return slot.backTarget === null ? null : createPortal(link, slot.backTarget);
}

/** The page's title block: the one h1, what stands beside it, and its line. */
export function PageTitle({ title, aside, description }: PageHeadingContent) {
  return (
    <div className="wconvert-page-copy">
      <div className="wconvert-page-title-row">
        <h1 className="m-0 wconvert-page-title text-foreground">{title}</h1>
        {aside && <div className="wconvert-page-title-aside">{aside}</div>}
      </div>
      {description && <Description className="wconvert-page-description">{description}</Description>}
    </div>
  );
}

/**
 * Titles the page with what a screen reports on, in place of its section's name
 * (ADR 0190). Only the screen knows that name, and only once it has read it, so
 * it registers with the frame rather than the frame asking.
 *
 * A layout effect, so the title changes in the commit that asked for it and no
 * frame shows the section's. Leaving gives the section's title back.
 *
 * It does not portal: the frame has to know whether to draw its own title at
 * all, and a registered heading is that answer. With no frame above it, it draws
 * in place, as {@see PageAction} does.
 */
export function PageHeading({ title, aside, description }: PageHeadingContent) {
  const { present, setHeading } = useContext(PageActionSlot);

  useLayoutEffect(() => {
    if (!present) {
      return undefined;
    }

    setHeading({ title, aside, description });

    return () => setHeading(null);
  }, [present, setHeading, title, aside, description]);

  return present ? null : <PageTitle title={title} aside={aside} description={description} />;
}
