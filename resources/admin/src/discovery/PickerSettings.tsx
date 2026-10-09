import { newAuthoringId } from '../authoringId';
import { useRef, useEffect, useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { PhoneCountryPicker as CountryPicker, type Country } from '../PhoneCountryPicker';
import { ArrowLeft, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { CheckRow } from '../shell/CheckRow';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Description } from '../shell/Description';
import { Field } from '../shell/Field';
import { RegionError, RegionErrorState, TryAgain } from '../shell/Region';
import { SaveStatus, useSaveStatus } from '../shell/SaveStatus';
import { formatRange, siteLocale } from '../lib/format';
import { zoneName } from './model';
import type { Occasion } from './api';
import type { usePicker } from './usePicker';

const MAX_OCCASIONS = 50;

/**
 * Picker preferences and site occasions as a dialog view (ADR 0131): header,
 * one scrolling body, a footer with the way back.
 *
 * Creation opens it as its own Medium dialog. The design library is already a
 * dialog and never stacks another, so there it opens in place (`nested`) with
 * a plain heading instead of a second dialog title.
 *
 * Recommendation choices save as they are made, like the star on a card: they
 * are one person's sorting preferences, not a site setting. Occasions are
 * shared and have their own explicit Save.
 */
export function PickerSettings({ picker, onBack, onPlan, context = 'creation', nested = false, backLabel }: {
  picker: ReturnType<typeof usePicker>; onBack: () => void; onPlan?: (id: string) => void;
  context?: 'creation' | 'replacement'; nested?: boolean; backLabel?: string;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryError, setCountryError] = useState(false);
  const [countryAttempt, setCountryAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCountryError(false);
    void apiFetch<{ countries: Country[] }>({ path: '/wconvert/v1/optins/phone-country' }).then(result => {
      if (active) setCountries(result.countries);
    }).catch(() => { if (active) setCountryError(true); });
    return () => { active = false; };
  }, [countryAttempt]);
  const heading = useRef<HTMLHeadingElement>(null);
  const sections = useId();
  useEffect(() => { if (nested) heading.current?.focus({ preventScroll: true }); }, [nested]);
  const data = picker.data;
  const title = context === 'creation' ? __('Occasions & preferences', 'wconvert') : __('Preferences', 'wconvert');
  const meta = context === 'creation'
    ? __('Recommendations are yours alone. Occasions are shared with this site’s campaign managers.', 'wconvert')
    : __('Personal to your account on this site.', 'wconvert');
  const suggestion = data?.country_suggestion;
  const suggestedCountry = suggestion && !data?.preferences.markets.length && data?.preferences.country_suggestion_dismissed !== suggestion.timezone
    ? countries.find(country => country.code.toUpperCase() === suggestion.code) : undefined;
  // A market the country list has not named yet is still a country, never a code.
  const regions = (() => { try { return new Intl.DisplayNames(siteLocale(), { type: 'region' }); } catch { return null; } })();
  const countryName = (code: string) => countries.find(country => country.code.toUpperCase() === code)?.name ?? regions?.of(code) ?? __('Unknown country', 'wconvert');

  return <>
    {nested
      ? <div className="wconvert-design-detail__header"><h3 ref={heading} tabIndex={-1}>{title}</h3></div>
      : <AdminDialogHeader title={title} meta={meta} />}
    <AdminDialogBody className="wconvert-picker-settings">
      {nested && <p className="m-0 text-note text-muted-foreground">{meta}</p>}
      {!data ? picker.error
        ? <RegionErrorState message={picker.error} onRetry={() => { void picker.reload(); }} />
        : <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading preferences…', 'wconvert')}</p>
        : <>
          <section className="wconvert-picker-settings__section" aria-labelledby={`${sections}-recommendations`}>
            <h3 id={`${sections}-recommendations`}>{__('Personal recommendations', 'wconvert')}</h3>
            <CheckRow label={__('Show featured collections', 'wconvert')} checked={data.preferences.show_featured !== false} disabled={picker.saving}
              onChange={event => { void picker.preferences({ ...data.preferences, show_featured: event.target.checked }); }} />
            <fieldset>
              <legend>{__('Businesses to recommend first', 'wconvert')}</legend>
              <div className="wconvert-picker-settings__choices">{[['stores', __('Stores', 'wconvert')], ['services', __('Services', 'wconvert')], ['publishers', __('Publishers', 'wconvert')]].map(([id, label]) =>
                <CheckRow key={id} label={label} disabled={picker.saving} checked={data.preferences.businesses.includes(id)}
                  onChange={event => { void picker.preferences({ ...data.preferences, businesses: event.target.checked ? [...data.preferences.businesses, id] : data.preferences.businesses.filter(value => value !== id) }); }} />)}</div>
              <Description>{__('Matching collections are listed first. Nothing is removed from the library.', 'wconvert')}</Description>
            </fieldset>
            {suggestedCountry && suggestion && <div className="wconvert-picker-settings__suggestion">
              <p className="m-0">{sprintf(__('Suggested country: %s', 'wconvert'), suggestedCountry.name)}</p>
              <Description>{__('Based on this site’s time zone. Choose the countries your business serves.', 'wconvert')}</Description>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, markets: [suggestion.code] }); }}>{sprintf(__('Add %s', 'wconvert'), suggestedCountry.name)}</Button>
                <Button variant="ghost" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, country_suggestion_dismissed: suggestion.timezone }); }}>{__('Dismiss country suggestion', 'wconvert')}</Button>
              </div>
            </div>}
            <div className="wconvert-picker-settings__markets">
              <CountryPicker label={__('Countries you serve', 'wconvert')} value="" countries={countries.filter(country => !data.preferences.markets.includes(country.code.toUpperCase()))}
                disabled={picker.saving || countries.length === 0} onChange={code => { void picker.preferences({ ...data.preferences, markets: [...data.preferences.markets, code.toUpperCase()] }); }} />
              {!countryError && countries.length === 0 && <p role="status" className="m-0 text-note text-muted-foreground">{__('Loading countries…', 'wconvert')}</p>}
              <div className="wconvert-picker-settings__countries">{data.preferences.markets.map(code => {
                const name = countryName(code);
                return <Button key={code} variant="outline" disabled={picker.saving} aria-label={sprintf(__('Remove %s', 'wconvert'), name)} onClick={() => { void picker.preferences({ ...data.preferences, markets: data.preferences.markets.filter(value => value !== code) }); }}><bdi>{name}</bdi><X aria-hidden="true" /></Button>;
              })}</div>
              <Description>{__('Regional collections use these countries.', 'wconvert')}</Description>
            </div>
            {countryError && <RegionError message={__('Countries could not be loaded.', 'wconvert')} onRetry={() => setCountryAttempt(value => value + 1)} />}
            {(data.preferences.hidden.length > 0 || data.preferences.events.length > 0) && <div className="flex flex-wrap gap-2">
              {data.preferences.hidden.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, hidden: [] }); }}>{__('Restore hidden collections', 'wconvert')}</Button>}
              {data.preferences.events.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, events: [] }); }}>{__('Restore seasonal recommendations', 'wconvert')}</Button>}
            </div>}
          </section>
          {data.preferences.saved.length > 0 && <section className="wconvert-picker-settings__section" aria-labelledby={`${sections}-saved`}>
            <h3 id={`${sections}-saved`}>{__('Saved designs', 'wconvert')}</h3>
            <ul className="wconvert-occasion-list">{data.preferences.saved.map(key => {
              const entry = data.saved_designs?.find(value => value.key === key);
              const name = entry?.name || __('Unnamed design', 'wconvert');
              return <li key={key}><div><strong><bdi>{name}</bdi></strong>{entry?.retired && <span>{__('No longer in the library', 'wconvert')}</span>}</div>
                <Button variant="ghost" disabled={picker.saving} aria-label={sprintf(__('Remove %s from saved designs', 'wconvert'), name)} onClick={() => picker.toggleSaved(key)}>{__('Remove', 'wconvert')}</Button></li>;
            })}</ul>
          </section>}
          {context === 'creation' && <Occasions picker={picker} items={data.occasions.items} timezone={data.timezone} onPlan={onPlan} />}
        </>}
    </AdminDialogBody>
    <AdminDialogFooter
      back={<Button className="wconvert-picker__back" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{backLabel ?? __('Back to library', 'wconvert')}</Button>}
      note={<span role="status">{picker.saving ? __('Saving…', 'wconvert') : ''}</span>}
      error={data ? picker.error : null}>
      {data && picker.error && <TryAgain busy={picker.saving} onClick={() => { void picker.reload(); }} />}
    </AdminDialogFooter>
  </>;
}

/**
 * Shared planning dates. A row has two actions behind its first: Find ideas
 * stays visible; Edit and Delete go in its ⋯ menu (§10).
 */
function Occasions({ picker, items, timezone, onPlan }: {
  picker: ReturnType<typeof usePicker>; items: Occasion[]; timezone: string; onPlan?: (id: string) => void;
}) {
  const [name, setName] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Occasion | null>(null);
  const menu = useRef<HTMLButtonElement | null>(null);
  const status = useSaveStatus();
  const id = useId();
  const full = !editing && items.length >= MAX_OCCASIONS;
  const zone = zoneName(timezone, siteLocale());
  const reset = () => { setEditing(null); setName(''); setStart(''); setEnd(''); };
  const edit = (change: () => void) => { status.clear(); change(); };

  return <section className="wconvert-picker-settings__section" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{__('Site occasions', 'wconvert')}</h3>
    <Description>{zone
      ? sprintf(/* translators: %s: the site's time zone, e.g. “Central European Time”. */ __('A sale or launch you are planning. Days follow this site’s time zone, %s. Saving one never schedules a campaign.', 'wconvert'), zone)
      : __('A sale or launch you are planning. Saving one never schedules a campaign.', 'wconvert')}</Description>
    {items.length === 0 && <p className="m-0 text-note text-muted-foreground">{__('No occasions yet. Add one to find campaign ideas for it.', 'wconvert')}</p>}
    {items.length > 0 && <ul className="wconvert-occasion-list">{items.map(item => <li key={item.id}>
      <div><strong><bdi>{item.name}</bdi></strong><span>{formatRange(item.start, item.end)}</span></div>
      {onPlan && <Button variant="outline" onClick={() => onPlan(item.id)}>{__('Find ideas', 'wconvert')}</Button>}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={picker.saving} aria-label={sprintf(/* translators: %s: an occasion's name. */ __('Actions for %s', 'wconvert'), item.name)}
            onPointerDown={event => { menu.current = event.currentTarget; }} onKeyDown={event => { menu.current = event.currentTarget; }}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={5}>
          <DropdownMenuItem onSelect={() => edit(() => { setEditing(item.id); setName(item.name); setStart(item.start); setEnd(item.end); })}>
            <Pencil aria-hidden="true" />{__('Edit', 'wconvert')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeleting(item)}>
            <Trash2 aria-hidden="true" />{__('Delete', 'wconvert')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>)}</ul>}
    <h4 className="m-0 text-body font-semibold">{editing ? __('Edit occasion', 'wconvert') : __('Add an occasion', 'wconvert')}</h4>
    <form className="wconvert-occasion-form" onSubmit={event => {
      event.preventDefault();
      if (full) return;
      const fields = new FormData(event.currentTarget);
      const item = { id: editing ?? `occasion-${newAuthoringId()}`, name: String(fields.get('name') ?? '').trim(), start: String(fields.get('start') ?? ''), end: String(fields.get('end') ?? '') };
      setStart(item.start); setEnd(item.end);
      void picker.occasions(editing ? items.map(value => value.id === editing ? item : value) : [...items, item]).then(saved => { if (saved) { reset(); status.markSaved(); } });
    }}>
      <Field label={__('Occasion name', 'wconvert')} htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} name="name" required maxLength={120} value={name} placeholder={__('Anniversary sale', 'wconvert')} onChange={event => edit(() => setName(event.target.value))} />
      </Field>
      <Field label={__('First day', 'wconvert')} htmlFor={`${id}-start`}>
        <Input id={`${id}-start`} name="start" required type="date" value={start} onChange={event => edit(() => setStart(event.target.value))} />
      </Field>
      <Field label={__('Last day', 'wconvert')} htmlFor={`${id}-end`}>
        <Input id={`${id}-end`} name="end" required type="date" min={start || undefined} value={end} onChange={event => edit(() => setEnd(event.target.value))} />
      </Field>
      <div className="wconvert-occasion-form__actions">
        {editing && <Button type="button" variant="outline" onClick={reset}>{__('Cancel', 'wconvert')}</Button>}
        <Button type="submit" disabled={picker.saving} aria-disabled={full || undefined} aria-describedby={full ? `${id}-full` : undefined}>
          {picker.saving ? __('Saving…', 'wconvert') : editing ? __('Save occasion', 'wconvert') : __('Add occasion', 'wconvert')}
        </Button>
        <SaveStatus saved={status.saved} />
        {full && <span id={`${id}-full`} className="text-note text-muted-foreground">{sprintf(__('You can keep up to %s occasions. Delete one to add another.', 'wconvert'), String(MAX_OCCASIONS))}</span>}
      </div>
    </form>
    <ConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }} variant="destructive" returnFocusTo={menu}
      title={sprintf(/* translators: %s: an occasion's name. */ __('Delete “%s”?', 'wconvert'), deleting?.name ?? '')}
      description={__('Only the occasion goes. Campaigns and collections stay as they are.', 'wconvert')}
      confirmLabel={__('Delete occasion', 'wconvert')}
      onConfirm={() => { if (deleting) void picker.occasions(items.filter(value => value.id !== deleting.id)); setDeleting(null); }} />
  </section>;
}
