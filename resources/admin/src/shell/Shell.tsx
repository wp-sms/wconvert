import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ChartColumn, Inbox, Megaphone, Settings } from 'lucide-react';
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
 * White navigation and a pale page heading keep the reading screens aligned
 * with the editor (ADR 0068). Regions retain their own surfaces.
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
  hidePageHeading = false,
  wide = false,
  children,
}: {
  section?: SectionId;
  actions?: ReactNode;
  /** A focused flow supplies its own visible prompt; retain the section heading for assistive navigation. */
  hidePageHeading?: boolean;
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
  /** Override the reading screen's 80rem measure with 90rem (ADR 0068). */
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
  const banded = !hidePageHeading && (section !== undefined || bareHeader);
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
        className="wconvert-panel font-sans text-body leading-normal text-foreground"
      >
        <div className="wconvert-panel-nav">
          <div className="wconvert-measure mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
            <Wordmark />
            {section !== undefined && <SectionNav current={section} />}
          </div>
        </div>

        {banded && (
          <div className="wconvert-panel-heading">
            <div className="wconvert-measure mx-auto w-full px-4 py-4 sm:px-6">
              {section === undefined ? (
                <div ref={setTarget} />
              ) : (
                <PageHeader section={section} actions={actions} actionSlot={setTarget} />
              )}
            </div>
          </div>
        )}

        <main className="wconvert-panel-main wconvert-measure mx-auto w-full px-4 py-5 sm:px-6">
          {hidePageHeading && section && <h1 className="sr-only">{SECTIONS.find((entry) => entry.id === section)?.label}</h1>}
          {children}
        </main>
      </div>
    </PageActionSlotProvider>
  );
}

/**
 * A petrol tile and a word on the white navigation bar.
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
        className="grid size-7 place-items-center rounded-sm bg-primary text-body font-bold text-primary-foreground"
      >
        W
      </span>
      <span className="text-heading font-semibold tracking-tight text-foreground">
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
 * Page actions sit at the trailing edge of the title row, wrapping below it
 * at narrow widths. Their scope is still the whole page (ADR 0068).
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
        <h1 className="m-0 me-auto text-title font-semibold leading-tight tracking-tight text-foreground">
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
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-secondary text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
  settings: Settings,
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
    case 'settings':
      return __('Shared settings for this site.', 'wconvert');
  }
}
