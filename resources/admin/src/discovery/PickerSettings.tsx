import { useId, useRef, useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Region, RegionHeader, RegionBody, PageError } from '../shell/Region';
import type { usePicker } from './usePicker';

export function PickerSettings({ picker, onBack, onPlan }: {
  picker: ReturnType<typeof usePicker>; onBack: () => void; onPlan?: (id: string) => void;
}) {
  const [name, setName] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [editing, setEditing] = useState<string | null>(null);
  const [markets, setMarkets] = useState(picker.data?.preferences.markets.join(', ') ?? '');
  const title = useRef<HTMLHeadingElement>(null); const id = useId();
  useEffect(() => { title.current?.focus({preventScroll:true}); }, []);
  const data = picker.data;
  if (!data) return <div className="p-6"><p>{__('Preferences could not be loaded. The library is still available.', 'wconvert')}</p><Button onClick={() => { void picker.reload(); }}>{__('Reload preferences', 'wconvert')}</Button><Button variant="ghost" onClick={onBack}>{__('Back to library', 'wconvert')}</Button></div>;
  return <section className="wconvert-picker-settings">
    <header className="wconvert-picker-settings__header"><Button variant="ghost" onClick={onBack}>{__('Back to library', 'wconvert')}</Button><h2 ref={title} tabIndex={-1}>{__('Your preferences & occasions', 'wconvert')}</h2><p>{__('Stars and recommendations are personal to your WordPress account on this site. Occasion dates are shared with this site’s campaign managers.', 'wconvert')}</p></header>
    {picker.error && <div><PageError message={picker.error} /><Button variant="outline" disabled={picker.saving} onClick={() => {void picker.reload();}}>{__('Reload preferences','wconvert')}</Button></div>}
    <span role="status" className="sr-only">{picker.saving ? __('Saving changes…','wconvert') : ''}</span>
    <Region><RegionHeader level={3} title={__('Personal recommendations', 'wconvert')} description={__('Only your WordPress account on this site uses these choices.','wconvert')} /><RegionBody className="wconvert-picker-settings__body">
      <label className="wconvert-picker-settings__check"><input type="checkbox" checked={data.preferences.show_featured !== false} disabled={picker.saving} onChange={event => { void picker.preferences({ ...data.preferences, show_featured: event.target.checked }); }} />{__('Show featured collections', 'wconvert')}</label>
      <p className="text-note">{__('You can always browse collections, even with the featured shelf hidden.', 'wconvert')}</p>
      <fieldset><legend>{__('Businesses to recommend first', 'wconvert')}</legend><div className="flex flex-wrap gap-4">{[['stores', __('Stores', 'wconvert')], ['services', __('Services', 'wconvert')], ['publishers', __('Publishers', 'wconvert')]].map(([id, label]) => <label key={id} className="wconvert-picker-settings__check"><input type="checkbox" disabled={picker.saving} checked={data.preferences.businesses.includes(id)} onChange={event => { void picker.preferences({ ...data.preferences, businesses: event.target.checked ? [...data.preferences.businesses, id] : data.preferences.businesses.filter(value => value !== id) }); }} />{label}</label>)}</div></fieldset>
      <p className="text-note">{__('This orders matching collections first; it does not remove other businesses from the library.', 'wconvert')}</p>
      <form className="wconvert-picker-settings__markets" onSubmit={event=>{event.preventDefault(); void picker.preferences({ ...data.preferences, markets:[...new Set(markets.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean))] });}}><label htmlFor={`${id}-markets`}>{__('Countries you serve','wconvert')}<Input id={`${id}-markets`} value={markets} pattern="\s*([A-Za-z]{2}\s*(,\s*[A-Za-z]{2}\s*)*)?" placeholder="GB, US, AE" aria-describedby={`${id}-markets-help`} onChange={event=>setMarkets(event.target.value)} /></label><Button type="submit" variant="outline" disabled={picker.saving}>{__('Save markets','wconvert')}</Button></form><p id={`${id}-markets-help`} className="text-note text-muted-foreground">{__('Enter two-letter codes, for example GB for the United Kingdom, US for the United States, or AE for the UAE. Separate them with commas.','wconvert')}</p>
      {data.preferences.hidden.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, hidden: [] }); }}>{__('Restore hidden collections', 'wconvert')}</Button>}
      {data.preferences.events.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, events: [] }); }}>{__('Restore seasonal recommendations', 'wconvert')}</Button>}
      <p className="text-note text-muted-foreground">{__('Regional occasions appear only for selected markets. Shared occasions need no country selection. Nothing is inferred from your location.', 'wconvert')}</p>
    </RegionBody></Region>
    {data.preferences.saved.length > 0 && <Region><RegionHeader level={3} title={__('Saved designs', 'wconvert')} /><RegionBody className="wconvert-picker-settings__body"><p>{__('A saved design may belong to another goal or format. Retired entries stay here until you remove them.', 'wconvert')}</p><ul className="wconvert-occasion-list">{data.preferences.saved.map(key => {
      const entry = data.saved_designs?.find(value => value.key === key);
      return <li key={key}><div><strong>{entry?.name ?? __('Saved design', 'wconvert')}</strong>{entry?.retired && <span>{__('Not in the current library', 'wconvert')}</span>}</div><Button variant="ghost" disabled={picker.saving} onClick={() => picker.toggleSaved(key)}>{__('Remove saved design', 'wconvert')}</Button></li>;
    })}</ul></RegionBody></Region>}
    <Region><RegionHeader level={3} title={__('Site occasions', 'wconvert')} description={__('Shared with this site’s campaign managers.','wconvert')} /><RegionBody className="wconvert-picker-settings__body"><p>{sprintf(__('For example, an anniversary sale or a new service launch. Dates use %s. Saving or changing them never schedules a campaign.', 'wconvert'), data.timezone || 'UTC')}</p>
      {data.occasions.items.length === 0 && <p className="text-note text-muted-foreground">{__('No occasions yet. Add a launch or sale to find useful campaign ideas.','wconvert')}</p>}
      <ul className="wconvert-occasion-list">{data.occasions.items.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>{item.start} – {item.end}</span></div>
        {onPlan && <Button variant="outline" onClick={() => onPlan(item.id)}>{__('Find ideas', 'wconvert')}</Button>}
        <Button variant="ghost" disabled={picker.saving} onClick={() => { setEditing(item.id); setName(item.name); setStart(item.start); setEnd(item.end); }}>{__('Edit', 'wconvert')}</Button>
        <Button variant="destructive" disabled={picker.saving} onClick={() => { void picker.occasions(data.occasions.items.filter(value => value.id !== item.id)); }}>{__('Delete occasion', 'wconvert')}</Button>
      </li>)}</ul>
      <h4 className="m-0 text-heading font-semibold">{editing ? __('Edit occasion','wconvert') : __('Add an occasion','wconvert')}</h4>
      <form className="wconvert-occasion-form" onSubmit={event => {
        event.preventDefault();
        const item = { id: editing ?? `occasion-${crypto.randomUUID()}`, name: name.trim(), start, end };
        void picker.occasions(editing ? data.occasions.items.map(value => value.id === editing ? item : value) : [...data.occasions.items, item]).then(saved => { if (saved) { setEditing(null); setName(''); setStart(''); setEnd(''); } });
      }}><label>{__('Occasion name', 'wconvert')}<Input required maxLength={120} value={name} placeholder={__('Anniversary sale', 'wconvert')} onChange={event => setName(event.target.value)} /></label>
        <label>{__('Start date', 'wconvert')}<Input required type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>{__('End date (included)', 'wconvert')}<Input required type="date" min={start || undefined} value={end} onChange={event => setEnd(event.target.value)} /></label>
        <Button type="submit" disabled={picker.saving || (!editing && data.occasions.items.length >= 50)}>{editing ? __('Save occasion changes', 'wconvert') : __('Add occasion', 'wconvert')}</Button>
        {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setName(''); setStart(''); setEnd(''); }}>{__('Cancel editing', 'wconvert')}</Button>}
      </form>
    </RegionBody></Region>
  </section>;
}
