# Shared layouts
Shell wraps reading screens; OptinBuilder owns its editing workspace.

## resources/admin/src/shell/Shell.tsx

```tsx
import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ChartColumn, Inbox, Megaphone, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SECTIONS, hashFor, type SectionId } from '../nav';
import { Description } from './Description';
import { PageActionSlotProvider } from './PageActions';

/**
 * The frame every WConvert screen is drawn inside.
 *
 * **The page is WConvert's, not WordPress's** (ADR 0035). There is no
 * `nav-tab`, no `.wrap` and no `wp-heading-inline` here; the tokens are
 * WConvert's ([ADR 0037](../../../../docs/adr/0037-the-admin-inherits-token-structure-and-owns-its-values.md))
 * and the chrome around this frame — the admin menu, the toolbar and the
 * footer — is the part WordPress still owns and this deliberately leaves
 * alone.
 *
 * **A petrol masthead, a white page header, and then the page.** The bar is
 * the strongest statement available that this screen is not WordPress's,
 * which is the whole of ADR 0035, and it is what both of the plugin admins
 * worth measuring against do with their identity.
 *
 * **The shell does not draw a surface around the screen.** It did, and that
 * was wrong: a Leads screen is a table AND a retention setting, two different
 * objects that one card merges into a single blob — which is why a rule had to
 * be invented to separate them again. ACF and Gravity Forms both put the table
 * itself on the page background and let each region own its own edges, and
 * that is the contract #64-#72 wanted, and every screen holds to it now.
 * `.wconvert-legacy` — the wrapper that supplied one surface to a screen not
 * yet converted — was scaffolding, and it left with the last conversion exactly
 * as planned. It exists nowhere in this tree.
 *
 * **Structure is carried by rules and alignment, never by shadow or motion.**
 * That is not asceticism — it is what the subject is. WConvert counts events:
 * impressions, conversions, dismissals, submissions
 * ([ADR 0019](../../../../docs/adr/0019-analytics-stores-daily-counters-not-events.md)).
 * A register is the right object, and a register is ruled lines and aligned
 * columns. A raised card would be borrowing authority the numbers already
 * have.
 *
 * **`section` is optional, and omitting it is what the builder does.**
 * Everything else in the admin is a list or a report a merchant reads in
 * passing; the builder is somewhere they sit down, and it replaces even the
 * tabs — leaving them up offers three ways out of an editor holding unsaved
 * work. That was the shape #62 settled, and one frame with an optional nav is
 * the whole of the difference between the two cases.
 *
 * **Five parts in one order, on every screen** (ADR 0039): masthead, page
 * header, page body — and inside the body, regions the SCREEN owns. The first
 * three are this file's and a screen may not draw them; the regions are the
 * screen's and this file may not draw those.
 *
 * **The measure is one number, declared once, and a screen may ask for the
 * wider one.** It was `max-w-6xl` written out three times — masthead, band and
 * `main` — with nothing linking them, which is how the band's rule came to stop
 * a hundred pixels short of the page body's edge once already (`44cf71e`). It
 * is now `--wconvert-measure`, and `wide` is the only escape from it.
 */
export function Shell({
  section,
  actions,
  bareHeader = false,
  wide = false,
  children,
}: {
  section?: SectionId;
  actions?: ReactNode;
  /**
   * Draw the header band with nothing in it but the slot.
   *
   * **This is how the builder gets the same band as every other screen.** It
   * has no `section` — it replaces even the nav (#62) — so it has no title for
   * the frame to draw, but it does have a title of its own and an action that
   * acts on the whole Optin. Reproducing the band inside `<main>` got the
   * surface right and the WIDTH wrong: `main` is a centred measure, so a band
   * drawn inside it stops where the measure does, and the rule under it stopped
   * a hundred pixels short of the screen. The band belongs to the frame, so the
   * frame draws it — and it reads the same `--wconvert-measure` `main` does,
   * which is what stops the two drifting apart a second time.
   */
  bareHeader?: boolean;
  /**
   * Draw this screen at the wider measure.
   *
   * ==========================================================================
   * THE BUILDER IS A PLACE RATHER THAN A LIST, SO IT GETS ITS OWN MEASURE.
   * ==========================================================================
   * 1152px is right for the four reading screens — they are tables and prose,
   * and the line-length research is unambiguous about not widening those. It
   * was never chosen for an editor, and three things followed from applying it
   * to one anyway: the tab column came out at 616px, which is quoted in three
   * places as the reason the block inspector sits UNDER the tree rather than
   * beside it; selecting a block low in a long tree put its controls below the
   * fold; and the live preview was clamped ~4% under the width every shipped
   * design asks for.
   *
   * So this screen gets 1440px, and the extra buys a third pane rather than a
   * wider single column — see `.wconvert-panes`'s container query in
   * `index.css`, and the field cap that stops the inspector's `widefat` inputs
   * growing past a readable measure with it.
   *
   * **Nothing forbade this.** ADR 0038 owns the responsive FLOORS and its whole
   * posture is that the builder is allowed different numbers from the reading
   * screens; ADR 0039 owns anatomy and ordering and says nothing about measure.
   * `index.css` carried a dead comment describing exactly this rule, justified
   * in exactly these terms, left behind when the two measures converged. WSMS
   * does the same thing from the other end — `app-shell.tsx` defaults to
   * `max-w-5xl` and keeps a `FULL_WIDTH_SECTIONS` allowlist; this is the same
   * mechanism with a cap instead of no cap.
   */
  wide?: boolean;
  children: ReactNode;
}) {
  /*
   * State rather than a `useRef`, because a ref does not re-render and the
   * screens portalling into this node need to hear that it exists. The
   * callback form runs once on mount with the node and once on unmount with
   * null, which is exactly the two events {@see PageAction} cares about.
   */
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const banded = section !== undefined || bareHeader;
  const slot = useMemo(() => ({ present: banded, target }), [banded, target]);

  return (
    <PageActionSlotProvider value={slot}>
      {/*
        **The three bands read one number, and they must move together.** The
        band's width is declared here and `main`'s is declared below it, and the
        builder portals its title, its Save and its stats into the band — so a
        measure applied to one and not the other is the bug `44cf71e` fixed
        once: the rule under the band stopping short of where every other
        screen's page body runs to. `data-measure` is what the three read, and
        it is the only place the choice is expressed.
      */}
      <div
        data-measure={wide ? 'wide' : 'default'}
        className="font-sans text-body leading-normal text-foreground"
      >
        <div className="bg-primary">
          <div className="wconvert-measure mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
            <Wordmark />
            {section !== undefined && <SectionNav current={section} />}
          </div>
        </div>

        {banded && (
          <div className="border-b border-border bg-card">
            <div className="wconvert-measure mx-auto w-full px-4 py-4 sm:px-6">
              {section === undefined ? (
                <div ref={setTarget} />
              ) : (
                <PageHeader section={section} actions={actions} actionSlot={setTarget} />
              )}
            </div>
          </div>
        )}

        <main className="wconvert-measure mx-auto w-full px-4 py-5 sm:px-6">{children}</main>
      </div>
    </PageActionSlotProvider>
  );
}

/**
 * A tile and a word, inverted for the bar they sit on.
 *
 * There is no logo yet, and this is shaped so that there being one later is a
 * change to one component rather than to a layout — ADR 0037's point that a
 * future brand does not start from zero, made in markup.
 */
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-sm bg-card text-body font-bold text-primary"
      >
        W
      </span>
      <span className="text-heading font-semibold tracking-tight text-primary-foreground">
        {__('WConvert', 'wconvert')}
      </span>
    </div>
  );
}

/**
 * What this screen is, and the one thing a merchant most often comes here to
 * do.
 *
 * **The title is not a repeat of the tab, it is the anchor for the sentence
 * under it.** Every screen gets the same three parts — name, one line saying
 * what it holds, and an action slot — so #64-#72 convert a screen without
 * each inventing a header, and a merchant meets the same anatomy five times.
 *
 * **The action sits BESIDE the title, not at the far edge.** Both of the
 * plugin admins worth measuring against do this — ACF's *"Field Groups
 * + Add New"*, Gravity Forms' *"Forms  Add New"* — and the reason is that the
 * eye pairs them: a button a thousand pixels away from the words it acts on
 * is a button in the same band rather than a button about that thing.
 *
 * **At most TWO actions, and only actions that act on the whole screen**
 * (ADR 0039). The order is primary solid, then secondary outline, reading
 * order; a screen with one action has the primary and nothing else. A third is
 * not a spacing problem — it is the signal that one of them is really scoped to
 * a region and belongs in that region's toolbar, or that this screen is two
 * screens. Nothing that acts on a row or on a filtered set may appear here,
 * however well it would fit.
 *
 * The slot after `actions` is for a screen that owns its own page-scoped action
 * — Leads' CSV export, whose URL carries the screen's filter
 * ({@see PageAction}). `display: contents` so an empty slot is not a gap in the
 * band, and after `actions` so the frame's primary keeps first position.
 */
function PageHeader({
  section,
  actions,
  actionSlot,
}: {
  section: SectionId;
  actions?: ReactNode;
  actionSlot: (node: HTMLElement | null) => void;
}) {
  const entry = SECTIONS.find((candidate) => candidate.id === section);

  return (
    <>
      <div className="wconvert-page-actions flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="m-0 me-1 text-title font-semibold leading-tight tracking-tight text-foreground">
          {entry?.label}
        </h1>
        {actions}
        <div ref={actionSlot} className="contents" />
      </div>
      <Description className="mt-1">{descriptionFor(section)}</Description>
    </>
  );
}

/**
 * Four sections, and which one is open.
 *
 * **Tabs rather than WSMS's left rail.** That is not disagreement about taste:
 * WSMS has twenty-five sections and a rail exists to make twenty-five
 * navigable. Copying it here would be copying a response to a scale WConvert
 * does not have (ADR 0036).
 *
 * **Real `href`s, and the click is not what navigates.** The hash change is,
 * and {@see App} is what hears it — which is what keeps a tab middle-clickable,
 * copyable and reachable by keyboard with nothing here re-implementing any of
 * it. `nav.ts` is the translation underneath and is untouched by this
 * redesign; the strip it feeds was always the disposable half.
 *
 * The icons are lucide, because dashicons is WordPress chrome and ADR 0035
 * stopped rendering that. They are `aria-hidden`: each one sits beside the
 * label it decorates, so announcing it would read the tab twice.
 *
 * **The pill is a fixed 2rem and its `<li>` is a flex box**, which is not
 * decoration: an `inline-flex` anchor inside a block `<li>` sits on a LINE BOX,
 * and a line box reserves room under the baseline for descenders. That put six
 * pixels of petrol under every pill and none above it — the bar read as
 * misaligned because it was, by 6px, and the wordmark beside it was centred
 * correctly the whole time. A flex `<li>` has no line box, and stating the
 * height means the two can never drift apart again. 2rem is
 * `--control-height-sm`, which is what the rest of the admin's secondary
 * controls stand at (ADR 0039).
 *
 * **The active section is a WHITE pill, not a lighter shade of the bar.**
 * ACF lightens its bar for the active item, and the same move here measured
 * worse the further it went — white on petrol lightened 22% is 3.78:1, under
 * the bar's own 5.95:1 and under AA. Inverting instead puts petrol on white at
 * 5.95:1, which is the highest-contrast pair available and reads as selected
 * rather than as slightly-different. The inactive labels sit at 85% white,
 * measured at 4.78:1 — quieter than the pill without dropping under the bar.
 *
 * **The two literal whites below are the only ones in the admin, and neither
 * has a token to become.** Every other colour on every screen reads a custom
 * property; these two do not, because there is no token for either job.
 * `hover:bg-white/10` is *a translucent lift over the primary* — it has to be
 * the bar's own colour plus light, which a solid `--accent` cannot be over a
 * petrol ground. `focus-visible:outline-white` is *a focus ring that clears the
 * primary*: `--ring` is petrol, and a petrol ring on a petrol bar is a focus
 * indicator a keyboard merchant cannot see.
 *
 * Inventing `--nav-hover` and `--nav-ring` for one caller each would be two
 * tokens whose only definition is this component — so they stay literal and
 * the reason stays here, where the next audit will find it.
 */
function SectionNav({ current }: { current: SectionId }) {
  return (
    <nav aria-label={__('WConvert sections', 'wconvert')}>
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {SECTIONS.map((entry) => {
          const Icon = ICONS[entry.id];
          const active = entry.id === current;

          return (
            <li key={entry.id} className="flex">
              <a
                href={hashFor(entry.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex h-(--control-height-sm) items-center gap-2 rounded-sm px-3 font-medium',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  active
                    ? 'bg-card text-primary'
                    : 'text-primary-foreground/85 hover:bg-white/10 hover:text-primary-foreground',
                ].join(' ')}
              >
                <Icon aria-hidden="true" className="size-4" />
                {entry.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * One icon per section, keyed by the id `nav.ts` owns.
 *
 * Keyed rather than carried on the `Section` entries, because `nav.ts` is a
 * pure hash↔section translation with no markup in it and an icon component is
 * markup. The `Record` is what makes adding a section there a type error here
 * rather than a blank space on the tab.
 */
const ICONS: Record<SectionId, LucideIcon> = {
  optins: Megaphone,
  analytics: ChartColumn,
  leads: Inbox,
  destinations: Send,
};

/**
 * One line saying what a section holds.
 *
 * ==========================================================================
 * THE SUBTITLE LABELS. THE DECISION POINT EXPLAINS.
 * ==========================================================================
 * These were four sentences long enough to be read once and skipped forever
 * after — which is the worst return a permanent line can earn, because it
 * taxes every visit and informs one. A subtitle's job is to say what the
 * screen is; a guarantee's job is to be on screen where it is acted on.
 *
 * So the promises did not disappear, they MOVED:
 *
 * - *"One row is one submission, never one person"* (ADR 0021) is now help
 *   text on the submission count, which is the exact number a merchant would
 *   otherwise read as a headcount.
 * - *"The Lead log is not a Destination — it is written first and always"*
 *   (ADR 0007) is in the Destinations empty state and in the remove confirm,
 *   which are the two moments a merchant is deciding something about it.
 *
 * Each is now read at the point it changes an answer, rather than three lines
 * above a table on every visit.
 *
 * **A function, not a constant**, because `__()` must not run at module scope:
 * the catalogue is not loaded when the bundle is evaluated, so a top-level
 * call would freeze the English string into every locale.
 *
 * It lives beside the section rather than inside the screen because it
 * describes the SECTION — what this part of WConvert is for — which is the
 * same thing `nav.ts` names and the tab labels.
 */
function descriptionFor(section: SectionId): string {
  switch (section) {
    case 'optins':
      return __('What you show visitors, and whether it’s live.', 'wconvert');
    case 'analytics':
      return __('How each goal is performing.', 'wconvert');
    case 'leads':
      return __('Every form submission, as it was captured.', 'wconvert');
    case 'destinations':
      return __('Where captured leads are sent on to.', 'wconvert');
  }
}

```

## resources/admin/src/shell/PageActions.tsx

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
}

const PageActionSlot = createContext<Slot>({ present: false, target: null });

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

```

## resources/admin/src/shell/Region.tsx

```tsx
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Description } from './Description';
import { cn } from '../lib/utils';

/**
 * A card with its own edge, holding **exactly one concern** (ADR 0039).
 *
 * That is the whole rule, and the Leads screen is why it needed writing down: a
 * table of captured [[Lead]]s and the setting that deletes them shared one
 * block, so the object a merchant was looking at was "leads and also a thing
 * that destroys leads". Two concerns are two regions, and the edge between them
 * is what says so.
 *
 * **The shell draws no surface** — that was removed in #63 for exactly this
 * reason — so a region drawing its own is not decoration. It is the only thing
 * between the page background and the content.
 *
 * `label` names the region for a screen reader where there is no visible
 * heading. A region that renders a {@see RegionHeader} does not need it: the
 * heading is already the name, and passing both spells one thing twice.
 */
export function Region({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn('overflow-hidden rounded-md border border-border bg-card', className)}
    >
      {children}
    </section>
  );
}

/**
 * What this region is, where the page header does not already say it.
 *
 * **`<h2>` by default**, because the page header owns the `<h1>` and a region is
 * a level under it — which is also what makes a screen with two regions
 * readable by heading navigation rather than by scrolling.
 *
 * `level` exists for a screen whose regions are a repeating SET rather than a
 * list of unrelated concerns: analytics draws one region per [[Goal]], and
 * those sit under the page's own subject rather than each introducing a new
 * one. `dashboard.test.tsx` pins them at level 3, which is the same reading
 * arrived at from the other side.
 *
 * `trailing` is for what belongs on the title's line and is not an action — the
 * window a set of numbers covers, a badge naming a state. Actions do not go
 * here: they are page-scoped and belong in the page header, or region-scoped
 * and belong in a {@see Toolbar} (ADR 0039).
 */
export function RegionHeader({
  title,
  description,
  level = 2,
  trailing,
}: {
  title: string;
  description?: string;
  level?: 2 | 3;
  trailing?: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
      <div className="min-w-0">
        <Heading className="m-0 text-heading font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </Heading>
        {description !== undefined && (
          <Description className="mt-1">{description}</Description>
        )}
      </div>
      {trailing}
    </div>
  );
}

/** Content that is not a table, at the region's own padding. */
export function RegionBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}

/**
 * Below the data: a truncation notice, a step's Back and Continue, pagination
 * when it arrives.
 *
 * It exists so #66 does not have to invent a place for the sentence saying the
 * log is capped, and so the next screen that needs one finds it already decided
 * (ADR 0039).
 *
 * **Two screens invented one anyway**, at `px-4 py-3` — the creation flow's step
 * footer and the Destinations card's repair-and-remove row. Neither matched this
 * one's padding, and neither carried `.wconvert-footer`, so neither got the rule
 * in `index.css` that lets a button's label WRAP rather than push the strip
 * sideways: at 360px with a German label, *"Erfassungsdatensätze als CSV-Datei
 * herunterladen"* in a `whitespace-nowrap shrink-0` button takes the whole
 * screen with it. The class is what the rule is keyed on, so routing them
 * through here is what fixes it rather than a note asking them to remember.
 *
 * **It states no control height**, and that is deliberate: a step's Back and
 * Continue are what the merchant came to press and stand at `--control-height`,
 * while a card's repair action qualifies the card and stands at the small one.
 * Which of the two is the caller's `size`, because it is a question about the
 * control's scope rather than about the strip (ADR 0039).
 */
export function RegionFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'wconvert-footer border-t border-border px-4 py-2.5 text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The failure, at the top of **the region that failed**.
 *
 * **Not at the top of the page**, which is where all five screens put every
 * error regardless of what produced it. A screen has more than one thing on it
 * that can fail independently, and an error a long way from the control that
 * caused it is an error the merchant has to guess the subject of.
 *
 * **The words "fail independently" are the whole scope of that rule**, and
 * three screens read past them. Analytics, Destinations and the builder each
 * make ONE read that feeds every region on the screen — so there is no region
 * that failed on its own, and the honest placement is above them all. What
 * those three were doing was `<Region><RegionError /></Region>`: a card
 * containing nothing but this band, whose `border-b` then drew a line with
 * nothing under it. {@see PageError} is that case, drawn as what it is.
 *
 * It carries no dismiss control on purpose: it clears when the next fetch
 * succeeds, so there is no path where a merchant hides a failure and then
 * reads the stale data underneath it as current.
 */
export function RegionError({ message }: { message: string }) {
  return (
    <div className="border-b border-border px-4 py-2.5">
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        {/*
          **`line-clamp-none`, because `AlertTitle` ships `line-clamp-1`.** A
          region's error is a whole sentence from the server — often the only
          thing on screen saying what went wrong — and the vendored default
          truncated every one of them to a single line with an ellipsis. Two
          call sites in this admin already remembered to undo it and these two
          did not, which is the argument for undoing it HERE: the component
          that decides what an error looks like is the one place the decision
          belongs.
        */}
        <AlertTitle className="line-clamp-none">{message}</AlertTitle>
      </Alert>
    </div>
  );
}

/**
 * The failure, with a sentence saying what to do about it.
 *
 * Used where the region has nothing else to show — a first fetch that failed
 * leaves no table to sit above, so the alert IS the region's content.
 *
 * **The hint has a default, and nine of the ten call sites are why.** They all
 * spelled the identical string; the tenth spelled nothing, so the creation
 * flow's second step was the one screen in the admin whose failure named no
 * way out of itself. That is not a decision each caller should be making — an
 * error the merchant can do nothing about is the shape ADR 0042 rule 3 refuses
 * — so the door is the component's and a caller passes one only where it has a
 * better one to offer.
 */
export function RegionErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <RegionBody>
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        <AlertTitle className="line-clamp-none">{message}</AlertTitle>
        <AlertDescription>
          {hint ?? __('Reload the page to try again.', 'wconvert')}
        </AlertDescription>
      </Alert>
    </RegionBody>
  );
}

/**
 * The failure of a read that feeds **the whole screen**.
 *
 * {@see RegionError} is for a region that failed on its own, and its rule
 * against a page-top banner is scoped to a screen whose regions fail
 * INDEPENDENTLY. Three screens are not that: Analytics reads one payload and
 * draws a card per [[Goal]] from it, Destinations reads one payload and draws a
 * card per route, and the builder's save acts on the whole draft. A failure
 * there belongs to no card in particular, and putting it on the first one
 * would claim it was about that card.
 *
 * All three hand-rolled it as `<Region><RegionError /></Region>` — a card whose
 * only content was a band with a bottom border, drawing a rule above nothing.
 * Here the alert is the whole thing, with no surface behind it, because a
 * page-scoped error is not a region and should not look like one.
 *
 * Like `RegionError` it has no dismiss control: it clears when the next read
 * succeeds, so a merchant cannot hide it and read the stale data under it as
 * current.
 */
export function PageError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <CircleAlert />
      <AlertTitle className="line-clamp-none">{message}</AlertTitle>
    </Alert>
  );
}

```

## resources/admin/src/shell/Toolbar.tsx

```tsx
import type { ReactNode } from 'react';

/**
 * The strip at the top of a region, holding only what is scoped to **that
 * region** (ADR 0039).
 *
 * That scoping is the whole of it. The Leads filter row held an Optin
 * `<select>`, a grouping checkbox and the screen's CSV export in one line,
 * because that is where there was room — so the one control acting on the whole
 * screen sat between two that act on one table, and none of the three read as
 * what it was. Export CSV is page-scoped and moved to the page header; what is
 * left here qualifies the region under it, which is what a toolbar is for.
 *
 * **Filters lead, the count trails.** A count is a fact about the set the region
 * is showing and changes when the filters change, so the two belong on one line
 * with the controls that move the number on the left of it — reading order,
 * cause then effect.
 *
 * `.wconvert-toolbar` is what sizes the controls inside it to
 * `--control-height-sm`; see `index.css`. The class is the rule's subject, so a
 * control added here later inherits the height without anybody remembering to
 * pass a size.
 */
export function Toolbar({
  children,
  trailing,
  dense = false,
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  /**
   * Spend the builder card's gutter instead of the screen's own inset.
   *
   * **A toolbar inside a card is not a toolbar across a screen.** `px-4` is
   * right where this strip spans the page — the Lead log's filters, the design
   * picker's — and 16px where every band under it is 8 is the top of the five
   * steps the card's left edge took on the way down. The builder passes it;
   * `LeadLog` and `TemplatePicker` do not, and are untouched.
   *
   * The number lives in `index.css` rather than as a second Tailwind class,
   * because `px-4` compiles to `!important` in the utilities layer and only a
   * layered `!important` rule beats it — the recipe ADR 0042 rule 6 states and
   * this file already spends four times over.
   */
  dense?: boolean;
}) {
  return (
    <div
      className={`wconvert-toolbar${
        dense ? ' wconvert-toolbar--dense' : ''
      } flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
      {trailing !== undefined && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{trailing}</div>
      )}
    </div>
  );
}

/**
 * How many rows the set has, as **one text node**.
 *
 * One node is a design decision and a test constraint at once, and they agree.
 * `lead-log.test.tsx` asserts `findByText('7 submissions')`; splitting the
 * number away from its noun to style them differently would break it, and the
 * reason it would break is the reason not to — a number whose unit is a
 * separate element is a number a screen can eventually render without its unit,
 * and on the Lead log the unit is the only thing stopping it being read as a
 * count of *people* (ADR 0021).
 *
 * **A count is stated only where the set can be large enough to need one.** The
 * Optin list has none and is not missing one — and the design picker draws its
 * whole toolbar, count included, on the same test.
 */
export function ToolbarCount({
  children,
  hint,
  live = false,
}: {
  children: string;
  hint?: string;
  /**
   * Speak the number when it changes.
   *
   * **For a count that moves without the page moving.** The design picker's
   * chips filter the grid under a toolbar that keeps focus exactly where it
   * was, so a screen-reader user presses *Side by side* and is told nothing at
   * all — the content changed and nothing announced it (ADR 0038).
   *
   * Off by default, because most counts here change only as the result of a
   * navigation the reader already heard: the Lead log's number arrives with a
   * new table, and announcing it again would be the same fact twice.
   */
  live?: boolean;
}) {
  return (
    <span
      className="tabular-nums text-muted-foreground"
      title={hint}
      aria-live={live ? 'polite' : undefined}
    >
      {/*
        **The count keeps a text node of its own**, so it is still findable as
        exactly the words it says. Folding the hint in beside it would make the
        element's text "7 submissions One row is…", which is not what anything
        reading this number is looking for.
      */}
      <span>{children}</span>
      {/*
        **The hint is a `title` AND a sentence in the accessibility tree.** A
        `title` alone is a pointer-only affordance — no keyboard reaches it and
        support in screen readers is uneven — and what it says here is a
        correction to how the number reads, which is exactly the reader who
        must not miss it.
      */}
      {hint !== undefined && <span className="sr-only"> {hint}</span>}
    </span>
  );
}

```

## resources/admin/src/shell/BuilderSkeleton.tsx

```tsx
import type { Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PageAction } from './PageActions';
import { RegionSkeleton } from './RegionSkeleton';

/**
 * The builder in the shape of the builder, and the way out of it.
 *
 * ============================================================================
 * IT IS HERE BECAUSE IT HAS TO LOAD BEFORE THE BUILDER DOES (#73).
 * ============================================================================
 * The builder is behind a lazy boundary, so opening it is a network fetch
 * before a single component of it exists. Whatever stands in that gap cannot
 * live inside the chunk it is waiting for — a fallback shipped with the thing
 * it is a fallback for is a blank frame — so it lives out here with the
 * reading screens and costs them these few lines.
 *
 * **And it is the same skeleton the builder's own first fetch draws.** The gap
 * is two waits end to end: the chunk arrives, then `getOptin` does. Two
 * different placeholders across those two moments is a screen that redraws
 * itself for no reason a merchant can see, so {@see OptinBuilder} renders this
 * one too and the wait reads as one wait.
 *
 * The proportions are the builder's own: a band with the name where the name
 * goes, and one region under it. Nothing here is announced — the `role="status"`
 * sentence carries the whole of what a screen reader needs from a placeholder,
 * and a grid of announced boxes is a spinner read aloud.
 */
export function BuilderSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <PageAction>
        <BackLink onClose={onClose} />
        <Skeleton aria-hidden="true" className="mt-3 h-9 w-72 max-w-full" />
      </PageAction>
      <RegionSkeleton label={__('Optin builder', 'wconvert')}>
        <Skeleton aria-hidden="true" className="h-4 w-full max-w-md" />
        <Skeleton aria-hidden="true" className="h-48 w-full" />
      </RegionSkeleton>
    </div>
  );
}

/**
 * The way out of the builder.
 *
 * A `<button>` rather than an `<a>`: the list is a state this bundle holds and
 * the builder has no URL of its own, so an `href="#"` a handler cancels would
 * be a link that lies about being one.
 *
 * **It lives out here so the skeleton can carry it.** A merchant who opened the
 * builder on a slow connection must be able to leave again before the chunk
 * lands, and the control that leaves cannot be inside the chunk. So the
 * skeleton above and {@see OptinBuilder} render the same component, in the same
 * band, and the way out does not move when the wait ends.
 *
 * {@see App} draws its own below 782px and again over the creation flow, and
 * those are not in the header band: they sit in the page body, so they carry
 * the spacing of where they stand. There is exactly one of the three on screen
 * at a time.
 *
 * **All three are now this component**, which is what makes that sentence
 * true rather than aspirational — App spelled the button out twice, so a
 * change to the way back was a change in three places and the two copies had
 * already drifted a `size` apart from this one. `-ms-3` travels with the
 * control, because pulling a ghost button's padding back so its label starts
 * on the text edge is a fact about the button; `className` is the caller's,
 * because how much room sits under it is a fact about where it stands.
 *
 * It takes a ref because it is what the unsaved-changes confirm has to put the
 * caret back on — a triggerless dialog restores focus to nothing, which leaves
 * a keyboard merchant on `<body>` ({@see ConfirmDialog}).
 */
export function BackLink({
  onClose,
  ref,
  className,
}: {
  onClose: () => void;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button ref={ref} variant="ghost" size="sm" className="-ms-3" onClick={onClose}>
        {/* Back is the other way in Persian; see {@see GoalScreen}'s footer. */}
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        {__('All Optins', 'wconvert')}
      </Button>
    </div>
  );
}

```
