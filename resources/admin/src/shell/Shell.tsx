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
 * WConvert's ([ADR 0037](../index.css)) and the chrome around this frame —
 * the admin menu, the toolbar and the footer — is the part WordPress still
 * owns and this deliberately leaves alone.
 *
 * The benchmark for that decision was not wp-admin. Lead capture is a category
 * where the competition is SaaS-grade, and a merchant evaluating the goal-first
 * flow is comparing it to OptinMonster and ConvertKit rather than to
 * Settings → Permalinks.
 */
export function Shell({ section, children }: { section: SectionId; children: ReactNode }) {
  return (
    <div className="font-sans text-[15px] leading-normal text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-5 sm:px-6">
          <Wordmark />
          <SectionNav current={section} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

/**
 * A frame with no section nav, for the screens that are a place rather than a
 * list.
 *
 * **The builder replaces even the tabs**, which was the shape #62 settled:
 * everything else in the admin is a list or a report a merchant reads in
 * passing, and the builder is somewhere they sit down. Leaving the tabs up
 * offers three ways out of an editor holding unsaved work.
 */
export function PlainShell({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[15px] leading-normal text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

/**
 * A tile and a word.
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
        className="grid size-7 place-items-center rounded-sm bg-primary text-sm font-bold text-primary-foreground"
      >
        W
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        {__('WConvert', 'wconvert')}
      </span>
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
      <ul className="-mb-px flex flex-wrap items-end gap-1">
        {SECTIONS.map((entry) => {
          const Icon = ICONS[entry.id];
          const active = entry.id === current;

          return (
            <li key={entry.id}>
              <a
                href={hashFor(entry.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex items-center gap-2 rounded-t-sm border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-fast',
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
