import { useEffect, useId, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Region, RegionBody, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Description } from '../shell/Description';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { failed, LOADING, messageOf, ready, type Loadable } from '../shell/loadable';
import { setPhoneSiteCountry } from '../phoneSiteCountry';
import { PhoneCountryPicker, type Country } from '../PhoneCountryPicker';
import { useSettingsEditing, type SettingsEditing } from './useSettingsEditing';

interface Response {
  country: string;
  countries: Country[];
  /** Offered while no default is saved, never saved by itself: the store's country, else the site language's. */
  suggested?: string | null;
  suggested_from?: 'store' | 'language' | null;
}
const path = '/wconvert/v1/optins/phone-country';

/**
 * The country a phone field starts on, site-wide. An explicit Save like every
 * other settings section (ADR 0131): choosing a country is a draft until then.
 */
export function SitePhoneCountry({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing } = {}) {
  const id = useId();
  const [state, setState] = useState<Loadable<Response>>(LOADING);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const status = useSaveStatus();
  useEffect(() => {
    let active = true;
    setState(LOADING);
    apiFetch<Response>({ path }).then(value => {
      if (!active) return;
      setState(ready(value));
      setDraft(value.country);
      setPhoneSiteCountry(value.country);
    }).catch((cause: unknown) => { if (active) setState(failed(cause)); });
    return () => { active = false; };
  }, [retry]);
  const saved = state.status === 'ready' ? state.data.country : null;
  const dirty = saved !== null && draft !== saved;
  useSettingsEditing(dirty, saving, onEditingStateChange);
  const save = async () => {
    if (state.status !== 'ready' || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<Response>({ path, method: 'POST', data: { country: draft } });
      setState(ready({ ...state.data, ...result }));
      setDraft(result.country);
      setPhoneSiteCountry(result.country);
      status.markSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally { setSaving(false); }
  };
  const title = __('Phone input', 'wconvert');
  if (state.status === 'loading') return <RegionSkeleton label={title} lines={1} />;
  if (state.status === 'failed') return <Region>
    <RegionHeader title={title} />
    <RegionErrorState message={state.message} onRetry={() => setRetry(value => value + 1)} />
  </Region>;
  const choose = (country: string) => { setDraft(country); setError(null); status.clear(); };
  // A suggestion is offered only while nothing is saved or drafted: it is a
  // shortcut to the first choice, not a second opinion on a made one.
  const suggested = state.data.country === '' && draft === ''
    ? state.data.countries.find(country => country.code === state.data.suggested)
    : undefined;
  return <Region>
    <RegionHeader title={title} description={__('The country phone fields start on across this site.', 'wconvert')} />
    <RegionBody className="flex flex-col gap-1.5">
      <div data-setting="phone-country">
        <PhoneCountryPicker field label={__('Default country', 'wconvert')} value={draft} countries={state.data.countries}
          describedBy={`${id}-hint`} disabled={saving} onChange={choose} />
      </div>
      {suggested && <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-note">
        <span>{sprintf(
          state.data.suggested_from === 'store'
            /* translators: %s: a country name, e.g. “Germany”. */
            ? __('Suggested: %s, from your store address', 'wconvert')
            /* translators: %s: a country name, e.g. “Germany”. */
            : __('Suggested: %s, from your site language', 'wconvert'),
          suggested.name,
        )}</span>
        <Button type="button" variant="outline" disabled={saving} onClick={() => choose(suggested.code)}>
          {/* translators: %s: a country name, e.g. “Germany”. */ sprintf(__('Use %s', 'wconvert'), suggested.name)}
        </Button>
      </p>}
      <Description id={`${id}-hint`}>{draft === ''
        ? __('Phone fields start with no country selected. Campaigns can choose their own.', 'wconvert')
        : __('Campaigns can choose their own. A published campaign keeps the country it was published with, so republish it to use a new default.', 'wconvert')}</Description>
    </RegionBody>
    <RegionFooter className="flex flex-wrap items-center justify-end gap-3">
      {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
      <SaveStatus saved={status.saved} />
      {dirty && <Button type="button" variant="outline" disabled={saving} onClick={() => { setDraft(state.data.country); setError(null); }}>{__('Cancel changes', 'wconvert')}</Button>}
      <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? __('Saving…', 'wconvert') : __('Save phone country', 'wconvert')}</Button>
    </RegionFooter>
  </Region>;
}
