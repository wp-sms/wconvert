import { __ } from '@wordpress/i18n';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { adminSettings } from '../settings';
import { settingsHref } from '../nav';
import { BrandMark, PlanBadge } from './Brand';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { HelpLinks } from './HeaderTools';

const veronaLabsLogo = new URL('../assets/branding/veronalabs.svg', import.meta.url).href;

/** Product and publisher identity, with useful support destinations. */
export function Footer() {
  const tier = adminSettings()?.installedTier ?? 'free';
  return <footer className="wc-service-footer">
    <div className="wconvert-measure wc-service-inner mx-auto w-full">
      <div className="wc-service-identity">
        <div className="wc-service-brand"><BrandMark /><span>{__('WConvert', 'wconvert')}</span><PlanBadge tier={tier} /></div>
      </div>
      <div className="wc-service-resource">
        <span className="wc-service-label">{__('Your visitor experience', 'wconvert')}</span>
        <a href={settingsHref('experience')}>{__('Fine-tune shared settings', 'wconvert')}<ArrowUpRight aria-hidden="true" /></a>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="wc-service-help">
            <span>{__('Need a hand?', 'wconvert')}</span>
            <strong>{__('Help and resources', 'wconvert')}<ArrowRight aria-hidden="true" /></strong>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="wc-header-popover"><HelpLinks /></PopoverContent>
      </Popover>
    </div>
    <div className="wconvert-measure wc-publisher-row mx-auto w-full">
      <div className="wc-publisher-credit">
        <span>{__('A product by', 'wconvert')}</span>
        <a className="wc-publisher" href="https://veronalabs.com/" target="_blank" rel="noopener noreferrer" aria-label={__('By VeronaLabs (opens in a new tab)', 'wconvert')}>
          <img src={veronaLabsLogo} width="132" height="21" alt="VeronaLabs" />
        </a>
      </div>
    </div>
  </footer>;
}
