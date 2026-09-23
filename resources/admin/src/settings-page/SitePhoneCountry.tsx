import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { setPhoneSiteCountry } from '../phoneSiteCountry';
import { PhoneCountryPicker, type Country } from '../PhoneCountryPicker';

interface Response { country: string; countries: Country[] }
const path = '/wconvert/v1/optins/phone-country';

/** A single reversible site setting; selecting a country saves it immediately. */
export function SitePhoneCountry() {
  const [selected, setSelected] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch<Response>({ path }).then(value => {
      if (!active) return;
      setSelected(value.country);
      setCountries(value.countries);
      setPhoneSiteCountry(value.country);
    }).catch(() => { if (active) setError(__('Could not load phone countries.', 'wconvert')); });
    return () => { active = false; };
  }, []);
  const change = async (country: string) => {
    const before = selected;
    setSelected(country);
    setSaving(true);
    setError('');
    try {
      const result = await apiFetch<Response>({ path, method: 'POST', data: { country } });
      setSelected(result.country);
      setPhoneSiteCountry(result.country);
    } catch {
      setSelected(before);
      setError(__('Could not save the starting country.', 'wconvert'));
    } finally { setSaving(false); }
  };
  return <Region>
    <RegionHeader title={__('Phone input', 'wconvert')} description={__('Starting country for phone fields across this site.', 'wconvert')} />
    <RegionBody>
      <PhoneCountryPicker label={__('Default country', 'wconvert')} value={selected} countries={countries}
        onChange={country => void change(country)} disabled={countries.length === 0 || saving} />
      {saving && <p role="status" className="mt-2 text-note">{__('Saving…', 'wconvert')}</p>}
      <p className="mt-2 text-note text-muted-foreground">{__('Campaigns can override this. Republish campaigns using the site default to apply changes.', 'wconvert')}</p>
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
    </RegionBody>
  </Region>;
}
