import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ChartColumn, Inbox, Megaphone, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SECTIONS, hashFor, type SectionId } from '../nav';

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
 * **Three bands, and the split is the whole design.** A masthead that says
 * where you are, a page header that says what this screen is, and a bounded
 * surface holding the screen itself. The first two share the card background
 * and are separated by a rule, so they read as one sheet; the third sits on
 * the page background, so content is obviously a thing ON the page rather
 * than loose text floating in it.
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
 */
export function Shell({
  section,
  actions,
  children,
}: {
  section?: SectionId;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="font-sans text-sm leading-normal text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Masthead nav={section !== undefined && <SectionNav current={section} />} />
        </div>
      </div>

      {section !== undefined && (
        <div className="border-b border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <PageHeader section={section} actions={actions} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <div className="rounded-md border border-border bg-card p-4 sm:p-5">{children}</div>
      </main>
    </div>
  );
}

/**
 * Who this is, and where you are in it.
 *
 * The nav sits under the wordmark rather than beside it, because four sections
 * at the top of a full-width page beside a five-letter word would leave most
 * of the row empty and the tabs reading as an afterthought hung off the brand.
 */
function Masthead({ nav }: { nav: ReactNode }) {
  return (
    <>
      <div className={`flex items-center gap-2.5 ${nav ? 'pt-4 pb-3' : 'py-4'}`}>
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-sm bg-primary text-xs font-bold text-primary-foreground"
        >
          W
        </span>
        <span className="text-base font-semibold tracking-tight text-foreground">
          {__('WConvert', 'wconvert')}
        </span>
      </div>
      {nav}
    </>
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
 * The screens used to draw an `<h2>` spelling their own section name a second
 * time, forty-five pixels below the tab that already said it. Those are gone:
 * one name per screen, in one place, at the size a page title should be.
 */
function PageHeader({ section, actions }: { section: SectionId; actions?: ReactNode }) {
  const entry = SECTIONS.find((candidate) => candidate.id === section);

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {/*
          * `m-0` and `mb-0` are not tidying. Preflight zeroes these in
          * `@layer base`, and an unlayered wp-admin heading rule outranks a
          * layered one however specific it is — so the `<h1>` was carrying the
          * browser's 16px above AND below it, which is a third of this band's
          * height. A utility is `!important` and unlayered, so it wins. Any
          * element this shell draws states its own box for the same reason.
          */}
        <h1 className="m-0 text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {entry?.label}
        </h1>
        <p className="mt-1.5 mb-0 max-w-2xl text-pretty text-muted-foreground">
          {descriptionFor(section)}
        </p>
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
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
 */
function SectionNav({ current }: { current: SectionId }) {
  return (
    <nav aria-label={__('WConvert sections', 'wconvert')}>
      <ul className="-mb-px flex flex-wrap items-end gap-x-1">
        {SECTIONS.map((entry) => {
          const Icon = ICONS[entry.id];
          const active = entry.id === current;

          return (
            <li key={entry.id}>
              <a
                href={hashFor(entry.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex items-center gap-2 rounded-t-sm border-b-2 px-3 py-2.5 text-sm font-medium',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
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
 * **A function, not a constant**, because `__()` must not run at module scope:
 * the catalogue is not loaded when the bundle is evaluated, so a top-level
 * call would freeze the English string into every locale.
 *
 * It lives beside the section rather than inside the screen because it
 * describes the SECTION — what this part of WConvert is for — which is the
 * same thing `nav.ts` names and the tab labels. Destinations already carried
 * its line inside the component; the other three had none, and the asymmetry
 * showed.
 *
 * The Leads line is doing real work rather than filling a slot. CONTEXT.md's
 * sharpest rule is that a [[Lead]] is an event and never a person, and the
 * count above the table is the exact place a merchant would read it the other
 * way. Saying so under the title is cheaper than a support conversation.
 */
function descriptionFor(section: SectionId): string {
  switch (section) {
    case 'optins':
      return __(
        'Every popup, floating bar, slide-in and inline form on this site, and whether it is live.',
        'wconvert'
      );
    case 'analytics':
      return __(
        'Impressions, conversions and dismissals, counted per day against the Goal each Optin was built for.',
        'wconvert'
      );
    case 'leads':
      return __(
        'Every form submission, as it was captured. One row is one submission, never one person.',
        'wconvert'
      );
    case 'destinations':
      return __(
        'Where a captured Lead is sent on to. The Lead log is not one — it is written first and always, whatever happens here.',
        'wconvert'
      );
  }
}
