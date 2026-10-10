import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from './components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { useDirection } from './hooks/useDirection';
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
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const direction = useDirection();
  const chosen = countries.find(country => country.code === value);
  const site = countries.find(country => country.code === siteCountry);
  const siteChoice = site
    /* translators: %s: the site's default country, e.g. “Armenia”. */
    ? sprintf(__('Use site setting (%s)', 'wconvert'), site.name)
    : __('Use site setting', 'wconvert');
  const shown = value === 'site' ? siteChoice : chosen?.name ?? __('Choose a country', 'wconvert');
  const term = query.trim().toLocaleLowerCase();
  const matches = countries.filter(country => `${country.name} ${country.code}`.toLocaleLowerCase().includes(term));
  const showSite = siteCountry !== undefined && (!term || `${__('Use site setting', 'wconvert')} ${site?.name ?? ''} ${siteCountry}`.toLocaleLowerCase().includes(term));
  const choose = (country: string) => {
    setOpen(false);
    if (country !== value) onChange(country);
  };
  const navigate = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) return;
    if (event.target === search.current && ['Home', 'End'].includes(event.key)) return;
    const buttons = [...(results.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'Enter') {
      if (event.target !== search.current) return;
      event.preventDefault();
      buttons[0].click();
      return;
    }
    const next = event.key === 'ArrowDown' ? Math.min(at + 1, buttons.length - 1)
      : event.key === 'ArrowUp' ? at <= 0 ? -1 : at - 1
        : event.key === 'Home' ? 0 : buttons.length - 1;
    event.preventDefault();
    if (next < 0) search.current?.focus();
    else buttons[next]?.focus();
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
      <PopoverContent align="start" dir={direction} aria-label={__('Choose a country', 'wconvert')}
        className="wconvert-phone-country-picker__popup"
        onOpenAutoFocus={event => { event.preventDefault(); search.current?.focus(); }} onKeyDown={navigate}>
        <input ref={search} type="search" value={query} aria-label={__('Search countries', 'wconvert')}
          placeholder={__('Search countries…', 'wconvert')} onChange={event => setQuery(event.target.value)} />
        <div ref={results} className="wconvert-phone-country-picker__results">
          {showSite && <button type="button" onClick={() => choose('site')}>
            <span>{siteChoice}</span>{value === 'site' && <Check aria-hidden="true" />}
          </button>}
          {matches.map(country => <button type="button" key={country.code} onClick={() => choose(country.code)}>
            <span>{country.name}</span>{country.code === value && <Check aria-hidden="true" />}
          </button>)}
          {!showSite && matches.length === 0 && <p role="status">{__('No countries match your search.', 'wconvert')}</p>}
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
