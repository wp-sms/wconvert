import { useId, useState, type KeyboardEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ChevronDown } from 'lucide-react';
import { Button } from './components/ui/button';
import { OptionEmpty, OptionItem, OptionList, OptionListContent } from './components/ui/option-menu';
import { Popover, PopoverTrigger } from './components/ui/popover';
import { cn } from './lib/utils';
import { InfoTip } from './shell/InfoTip';

export interface Country { code: string; name: string }

/**
 * One country control; the search lives inside its list, not beside the value.
 *
 * `field` draws the label as a settings page's {@see Field} does — body size,
 * 6px above the control. Without it the label is the editor inspector's small
 * caption, which is the builder's own furniture (ADR 0066).
 */
export function PhoneCountryPicker({ label, value, countries, onChange, disabled = false, siteCountry, field = false, describedBy, tip }: {
  label: string;
  /** Help beside the label, as an InfoTip (ADR 0136). */
  tip?: string;
  value: string;
  countries: readonly Country[];
  onChange: (country: string) => void;
  disabled?: boolean;
  siteCountry?: string;
  field?: boolean;
  /** The id of a hint the trigger should announce. */
  describedBy?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = countries.find(country => country.code === value);
  const site = countries.find(country => country.code === siteCountry);
  const siteChoice = site
    ? sprintf(/* translators: %s: the site's default country, e.g. “Armenia”. */ __('Use site setting (%s)', 'wconvert'), site.name)
    : __('Use site setting', 'wconvert');
  const shown = value === 'site' ? siteChoice : chosen?.name ?? __('Choose a country', 'wconvert');
  const term = query.trim().toLocaleLowerCase();
  const matches = countries.filter(country => `${country.name} ${country.code}`.toLocaleLowerCase().includes(term));
  const showSite = siteCountry !== undefined && (!term || `${__('Use site setting', 'wconvert')} ${site?.name ?? ''} ${siteCountry}`.toLocaleLowerCase().includes(term));
  const choose = (country: string) => {
    setOpen(false);
    if (country !== value) onChange(country);
  };
  // Enter in the search takes the first match; the arrows are the list's own.
  const takeFirst = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLElement>('.wconvert-option-menu__item[data-option-nav]')?.click();
  };

  return <div className={cn('wconvert-phone-country-picker', field && 'gap-1.5')}>
    {tip ? <span className="wconvert-field-heading"><span id={`${id}-label`} className={field ? 'text-body font-medium leading-snug text-foreground' : 'wconvert-phone-country-picker__label'}>{label}</span><InfoTip label={sprintf(/* translators: %s: a field label, e.g. “Starting country”. */ __('About %s', 'wconvert'), label)}>{tip}</InfoTip></span>
      : <span id={`${id}-label`} className={field ? 'text-body font-medium leading-snug text-foreground' : 'wconvert-phone-country-picker__label'}>{label}</span>}
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button id={`${id}-trigger`} type="button" variant="outline" disabled={disabled}
          aria-labelledby={`${id}-label ${id}-trigger`} aria-describedby={describedBy} className="wconvert-phone-country-picker__trigger">
          <span className="truncate">{shown}</span><ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <OptionListContent align="start" aria-label={__('Choose a country', 'wconvert')} onKeyDown={takeFirst}>
        <OptionList search={{ value: query, onChange: setQuery, label: __('Search countries', 'wconvert'), placeholder: __('Search countries…', 'wconvert') }}>
          {showSite && <OptionItem name={siteChoice} checked={value === 'site'} onSelect={() => choose('site')} />}
          {matches.map(country => <OptionItem key={country.code} name={country.name} checked={country.code === value} onSelect={() => choose(country.code)} />)}
          {!showSite && matches.length === 0 && <OptionEmpty what={__('countries', 'wconvert')} onClear={() => setQuery('')} />}
        </OptionList>
      </OptionListContent>
    </Popover>
  </div>;
}
