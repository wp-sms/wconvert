import { __ } from '@wordpress/i18n';
import { ChevronUp } from 'lucide-react';
import { adminSettings } from '../settings';
import { BrandMark, PlanBadge } from './Brand';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { HELP_URLS, HelpLinks } from './HeaderTools';

const veronaLabsLogo = new URL('../assets/branding/veronalabs.svg', import.meta.url).href;

/**
 * Product and publisher identity, with useful support destinations. The
 * resource link and Help carry the same names as everywhere else — "Visitor
 * experience" and "Help" — so one place is never three labels (ADR 0131).
 */
export function Footer() {
  const tier = adminSettings()?.installedTier ?? 'free';
  return <footer className="wconvert-service-footer">
    <div className="wconvert-measure wconvert-service-inner mx-auto w-full">
      <div className="wconvert-service-identity">
        <div className="wconvert-service-brand"><BrandMark variant="inverse" /><span>{__('WConvert', 'wconvert')}</span><PlanBadge tier={tier} /></div>
      </div>
      {/* Resources, not a fourth copy of a Settings shortcut (ADR 0132, amending 0097). */}
      <nav className="wconvert-service-resource" aria-label={__('Resources', 'wconvert')}>
        <span className="wconvert-service-label" aria-hidden="true">{__('Resources', 'wconvert')}</span>
        <ul>
          <li><a href={HELP_URLS.start} target="_blank" rel="noreferrer">{__('Getting started', 'wconvert')}</a></li>
          <li><a href={HELP_URLS.guides} target="_blank" rel="noreferrer">{__('Guides', 'wconvert')}</a></li>
          <li><a href={HELP_URLS.changes} target="_blank" rel="noreferrer">{__('What’s new', 'wconvert')}</a></li>
        </ul>
      </nav>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="wconvert-service-help">
            <span>{__('Need a hand?', 'wconvert')}</span>
            {/* It opens Help in place, so the glyph says "opens", not "goes". */}
            <strong>{__('Help', 'wconvert')}<ChevronUp aria-hidden="true" /></strong>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wconvert-header-popover"><HelpLinks /></PopoverContent>
      </Popover>
    </div>
    <div className="wconvert-measure wconvert-publisher-row mx-auto w-full">
      <div className="wconvert-publisher-credit">
        <span>{__('A product by', 'wconvert')}</span>
        <a className="wconvert-publisher" href="https://veronalabs.com/" target="_blank" rel="noopener noreferrer" aria-label={__('By VeronaLabs (opens in a new tab)', 'wconvert')}>
          <img src={veronaLabsLogo} width="132" height="21" alt="VeronaLabs" />
        </a>
      </div>
    </div>
  </footer>;
}
