import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { usePicker } from './usePicker';

export function PickerSettings({ picker, onBack, onPlan }: {
  picker: ReturnType<typeof usePicker>; onBack: () => void; onPlan: (id: string) => void;
}) {
  const [name, setName] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [editing, setEditing] = useState<string | null>(null);
  const [markets, setMarkets] = useState(picker.data?.preferences.markets.join(', ') ?? '');
  const data = picker.data;
  if (!data) return <div className="p-6"><p>{__('Preferences could not be loaded. The library is still available.', 'wconvert')}</p><Button onClick={() => { void picker.reload(); }}>{__('Reload preferences', 'wconvert')}</Button><Button variant="ghost" onClick={onBack}>{__('Back to library', 'wconvert')}</Button></div>;
  return <section className="wconvert-picker-settings">
    <div><Button variant="ghost" onClick={onBack}>{__('Back to library', 'wconvert')}</Button><h2>{__('Your preferences & occasions', 'wconvert')}</h2><p>{__('Stars and recommendations are personal to your WordPress account on this site. Occasion dates are shared with this site’s campaign managers.', 'wconvert')}</p></div>
    <section><h3>{__('Recommendations', 'wconvert')}</h3><label>{__('Markets you serve (two-letter country codes, separated by commas)', 'wconvert')}<Input value={markets} placeholder="GB, US, AE" onChange={event => setMarkets(event.target.value)} /></label>
      <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, markets: markets.split(',').map(value => value.trim().toUpperCase()).filter(Boolean) }); }}>{__('Save markets', 'wconvert')}</Button>
      {data.preferences.hidden.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, hidden: [] }); }}>{__('Restore hidden collections', 'wconvert')}</Button>}
      {data.preferences.events.length > 0 && <Button variant="outline" disabled={picker.saving} onClick={() => { void picker.preferences({ ...data.preferences, events: [] }); }}>{__('Restore seasonal recommendations', 'wconvert')}</Button>}
      <p className="text-note text-muted-foreground">{__('Regional occasions appear only for selected markets. Shared occasions need no country selection. Nothing is inferred from your location.', 'wconvert')}</p>
    </section>
    {data.preferences.saved.length > 0 && <section><h3>{__('Saved designs', 'wconvert')}</h3><p>{__('A saved design may belong to another goal or format. Retired entries stay here until you remove them.', 'wconvert')}</p><ul className="wconvert-occasion-list">{data.preferences.saved.map(key => {
      const entry = data.saved_designs?.find(value => value.key === key);
      return <li key={key}><div><strong>{entry?.name ?? __('Saved design', 'wconvert')}</strong>{entry?.retired && <span>{__('Not in the current library', 'wconvert')}</span>}</div><Button variant="ghost" size="sm" disabled={picker.saving} onClick={() => picker.toggleSaved(key)}>{__('Remove saved design', 'wconvert')}</Button></li>;
    })}</ul></section>}
    <section><h3>{__('Site occasions', 'wconvert')}</h3><p>{sprintf(__('For example, an anniversary sale or a new service launch. Dates use %s. Saving or changing them never schedules a campaign.', 'wconvert'), data.timezone || 'UTC')}</p>
      <ul className="wconvert-occasion-list">{data.occasions.items.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>{item.start} – {item.end}</span></div>
        <Button variant="outline" size="sm" onClick={() => onPlan(item.id)}>{__('Find ideas', 'wconvert')}</Button>
        <Button variant="ghost" size="sm" disabled={picker.saving} onClick={() => { setEditing(item.id); setName(item.name); setStart(item.start); setEnd(item.end); }}>{__('Edit', 'wconvert')}</Button>
        <Button variant="ghost" size="sm" disabled={picker.saving} onClick={() => { void picker.occasions(data.occasions.items.filter(value => value.id !== item.id)); }}>{__('Delete occasion', 'wconvert')}</Button>
      </li>)}</ul>
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
    </section>
  </section>;
}
