import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { SECTIONS, hashFor, type SectionId } from '../nav';
import { adminSettings } from '../settings';
import { Description } from './Description';
import { PageActionSlotProvider } from './PageActions';
import './header.css';
import { BrandMark, PlanBadge } from './Brand';
import { HeaderTools } from './HeaderTools';
import { Footer } from './Footer';

/** Harbor shared frame: dark navigation, light page heading and service footer (ADR 0097). */
export function Shell({
  section,
  actions,
  pageTitle,
  hideDescription = false,
  bareHeader = false,
  hidePageHeading = false,
  wide = false,
  children,
}: {
  section?: SectionId;
  actions?: ReactNode;
  pageTitle?: string;
  hideDescription?: boolean;
  bareHeader?: boolean;
  hidePageHeading?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const banded = !hidePageHeading && (section !== undefined || bareHeader);
  const slot = useMemo(() => ({ present: banded, target }), [banded, target]);
  const tier = adminSettings()?.installedTier ?? 'free';
  return (
    <PageActionSlotProvider value={slot}>
      <div
        data-measure={wide ? 'wide' : 'default'}
        data-section={section}
        className="wconvert-panel font-sans text-body leading-normal text-foreground"
      >
        <header className="wconvert-panel-nav">
          <div className="wconvert-measure wc-masthead mx-auto w-full">
            <div className="wc-brand">
              <BrandMark />
              <span>{__('WConvert', 'wconvert')}</span>
            </div>
            {section !== undefined && <HeaderTools />}
          </div>
          {section !== undefined && (
            <div className="wconvert-measure wc-navigation-row mx-auto w-full">
              <nav className="wc-section-nav" aria-label={__('WConvert sections', 'wconvert')}>
                <ul>{SECTIONS.map((entry) => (
                  <li key={entry.id}>
                    <a href={hashFor(entry.id)} aria-current={section === entry.id ? 'page' : undefined}>
                      {entry.label}
                    </a>
                  </li>
                ))}</ul>
              </nav>
              <span className="wc-brand-plan"><PlanBadge tier={tier} /></span>
            </div>
          )}
        </header>
        {banded && (
          <div className="wconvert-panel-heading">
            <div className="wconvert-measure wc-page-heading mx-auto w-full">
              {section === undefined ? (
                <div ref={setTarget} />
              ) : (
                <div className="wconvert-page-actions flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="wc-page-copy">
                    <h1 className="m-0 wc-page-title text-foreground">
                      {pageTitle ?? SECTIONS.find((entry) => entry.id === section)?.label}
                    </h1>
                    {!hideDescription && <Description className="wc-page-description">{descriptionFor(section)}</Description>}
                  </div>
                  {actions}
                  <div ref={setTarget} className="contents" />
                </div>
              )}
            </div>
          </div>
        )}
        <main className="wconvert-panel-main wconvert-measure mx-auto w-full">
          {hidePageHeading && section && (
            <h1 className="sr-only">{SECTIONS.find((entry) => entry.id === section)?.label}</h1>
          )}
          {children}
        </main>
        {section !== undefined && !hidePageHeading && <Footer />}
      </div>
    </PageActionSlotProvider>
  );
}
function descriptionFor(section: SectionId): string {
  switch (section) {
    case 'optins':
      return __('Your on-site forms and offers, in one place.', 'wconvert');
    case 'analytics':
      return __('How each goal is performing.', 'wconvert');
    case 'leads':
      return __('Every form submission, as it was captured.', 'wconvert');
    case 'settings':
      return __(
        'Shared setup in one place. Campaign-specific choices stay in the editor.',
        'wconvert',
      );
  }
}
