import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { setPhoneSiteCountry } from '../phoneSiteCountry';

interface Country { code: string; name: string }
interface Response { country: string; countries: Country[] }
const path = '/wconvert/v1/optins/phone-country';

/** A single reversible site setting; selecting a country saves it immediately. */
export function SitePhoneCountry() {
  const [selected, setSelected] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [query, setQuery] = useState('');
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
    setQuery('');
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
  const match = query.trim().toLocaleLowerCase();
  const matching = match ? countries.filter(country => `${country.name} ${country.code}`.toLocaleLowerCase().includes(match)) : countries;
  const current = countries.find(country => country.code === selected);
  const choices = current && !matching.some(country => country.code === selected) ? [current, ...matching] : matching;
  return <Region>
    <RegionHeader title={__('Phone input', 'wconvert')} description={__('Starting country for phone fields across this site.', 'wconvert')} />
    <RegionBody>
      <label className="block">
        <span className="block font-medium">{__('Default country', 'wconvert')}</span>
        <input className="mt-2 block w-full max-w-sm rounded-md border p-2" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={__('Search countries', 'wconvert')} aria-label={__('Search countries', 'wconvert')} />
        <select className="mt-2 w-full max-w-sm rounded-md border p-2" value={selected} onChange={event => void change(event.target.value)} disabled={countries.length === 0 || saving}>
          <option value="" disabled>{__('Choose a country', 'wconvert')}</option>
          {choices.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>
      {match && matching.length === 0 && <p className="mt-2 text-note" role="status">{__('No countries match your search.', 'wconvert')}</p>}
      {saving && <p role="status" className="mt-2 text-note">{__('Saving…', 'wconvert')}</p>}
      <p className="mt-2 text-note text-muted-foreground">{__('Campaigns can override this. Published campaigns keep their current country until you publish them again.', 'wconvert')}</p>
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
    </RegionBody>
  </Region>;
}
