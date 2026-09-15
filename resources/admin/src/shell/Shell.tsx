import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { SECTIONS, hashFor, type SectionId } from '../nav';
import { adminSettings } from '../settings';
import { Description } from './Description';
import { PageActionSlotProvider } from './PageActions';
import { HeaderTools } from './HeaderTools';

/** Shared 56px masthead, page heading and aligned content measure (ADR 0092). */
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
        <div className="wconvert-panel-nav">
          <div className="wconvert-measure wc-masthead mx-auto w-full">
            <div className="wc-brand">
              <span className="wc-brand-mark" aria-hidden="true">
                w
              </span>
              <span>{__('WConvert', 'wconvert')}</span>
              <span className="wc-brand-plan">
                {tier === 'free'
                  ? __('Free', 'wconvert')
                  : (adminSettings()?.tiers?.[tier]?.name ?? __('Pro', 'wconvert'))}
              </span>
            </div>
            {section !== undefined && (
              <>
                <nav className="wc-section-nav" aria-label={__('WConvert sections', 'wconvert')}>
                  <ul>
                    {SECTIONS.map((entry) => (
                      <li key={entry.id}>
                        <a
                          href={hashFor(entry.id)}
                          aria-current={section === entry.id ? 'page' : undefined}
                        >
                          {entry.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                <HeaderTools />
              </>
            )}
          </div>
        </div>
        {banded && (
          <div className="wconvert-panel-heading">
            <div className="wconvert-measure mx-auto w-full px-4 py-4 sm:px-6">
              {section === undefined ? (
                <div ref={setTarget} />
              ) : (
                <>
                  <div className="wconvert-page-actions flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="m-0 me-auto text-title font-semibold leading-tight tracking-tight text-foreground">
                      {pageTitle ?? SECTIONS.find((entry) => entry.id === section)?.label}
                    </h1>
                    {actions}
                    <div ref={setTarget} className="contents" />
                  </div>
                  {!hideDescription && (
                    <Description className="mt-1">{descriptionFor(section)}</Description>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <main className="wconvert-panel-main wconvert-measure mx-auto w-full px-4 py-5 sm:px-6">
          {hidePageHeading && section && (
            <h1 className="sr-only">{SECTIONS.find((entry) => entry.id === section)?.label}</h1>
          )}
          {children}
        </main>
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
