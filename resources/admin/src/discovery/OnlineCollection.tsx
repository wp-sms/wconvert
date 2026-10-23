import { useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ExternalLink } from 'lucide-react';
import { TemplateCard } from '../builder/TemplateCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { displayTypeLabel } from '../displayTypes';
import type { GoalEntry } from '../goals/api';
import { formatCount } from '../lib/format';
import { messageOf } from '../shell/loadable';
import { OptionStrip } from '../shell/OptionStrip';
import { installSetup } from '../templates/catalog';
import type { Collection, OnlineCollectionMember } from './api';
import { PickerSearch } from './PickerSearch';
import { matchesSearch } from './search';

/** Browse the complete collection using public metadata; only Install downloads a setup. */
export function OnlineCollection({ collection, goals, busy, onInstalled, onUse }: {
  collection: Collection; goals: GoalEntry[]; busy: boolean;
  onInstalled: () => void; onUse: (playbookId: string, goalId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('all');
  const [installed, setInstalled] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const members = collection.online ?? [];
  const shown = members.filter(({ setup, design }) => (format === 'all' || design.format === format)
    && matchesSearch(query.trim().toLocaleLowerCase(), [setup.name, design.name, goals.find(goal => goal.id === setup.goal)?.label ?? '']));
  const add = async (member: OnlineCollectionMember) => {
    if (pending.current || busy) return;
    pending.current = true; setInstalling(member.setup.id); setError(null);
    try {
      const result = await installSetup(member.setup.id, member.setup.sha256);
      if (active.current) { setInstalled(current => ({ ...current, [member.setup.id]: result.playbook_id })); onInstalled(); }
    } catch (cause) {
      if (active.current) setError({ id: member.setup.id, message: messageOf(cause) });
    } finally {
      pending.current = false;
      if (active.current) setInstalling(null);
    }
  };
  return <>
    <div className="wconvert-picker__controls wconvert-toolbar">
      <div className="wconvert-picker__search-row"><PickerSearch label={__('Search collection setups', 'wconvert')} value={query} placeholder={__('Search this collection', 'wconvert')} onChange={setQuery} /></div>
      <OptionStrip label={__('Collection format', 'wconvert')} value={format} onChange={setFormat}
        options={[{ value: 'all', label: __('All formats', 'wconvert') }, ...Array.from(new Set(members.map(member => member.design.format))).map(value => ({ value, label: displayTypeLabel(value) }))]} />
    </div>
    <p role="status" className="text-note">{sprintf(/* translators: %s: how many campaign setups in this online collection match the search and chosen format, e.g. “6”. */ _n('%s setup', '%s setups', shown.length, 'wconvert'), formatCount(shown.length))} · {__('Install a setup to add it to your library. Use it to create an unpublished draft.', 'wconvert')}</p>
    <ul className="wconvert-gallery">{shown.map(member => {
      const { setup, design } = member;
      const goal = goals.find(value => value.id === setup.goal);
      const playbookId = installed[setup.id] ?? member.playbook_id;
      const state = installed[setup.id] ? 'ready' : setup.state;
      const refusal = state === 'update_plugin' ? __('Needs a newer version of WConvert.', 'wconvert')
        : state === 'unavailable' || !goal || goal.availability !== 'ready' ? __('This site cannot use this campaign goal yet.', 'wconvert') : undefined;
      return <TemplateCard key={setup.id} id={`collection-${setup.id}`} name={setup.name} displayType={design.format}
        marks={<><Badge variant="outline">{displayTypeLabel(design.format)}</Badge><Badge variant={setup.tier === 'free' ? 'outline' : 'secondary'}>{setup.tier === 'free' ? __('Free', 'wconvert') : __('Pro', 'wconvert')}</Badge></>}
        notes={goal?.label} absent={design.thumbnail ? <img className="wconvert-gallery__thumbnail" src={design.thumbnail['1x']} srcSet={`${design.thumbnail['1x']} 1x, ${design.thumbnail['2x']} 2x`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <p>{__('Preview unavailable', 'wconvert')}</p>}
        action={describedBy => <>
          {error?.id === setup.id && <p role="alert" className="text-note">{error.message}</p>}
          {state === 'locked' ? <Button asChild variant="outline"><a href={`https://wconvert.io/templates/${encodeURIComponent(design.slug)}/?utm_source=plugin&utm_medium=picker&utm_campaign=pro-design`} target="_blank" rel="noopener noreferrer" aria-describedby={describedBy}>{__('See this design', 'wconvert')}<ExternalLink aria-hidden="true" /></a></Button>
            : refusal ? <p className="text-note">{refusal}</p>
              : playbookId && state === 'ready' ? <Button disabled={busy || installing !== null} aria-describedby={describedBy} onClick={() => onUse(playbookId, setup.goal)}>{__('Use this setup', 'wconvert')}</Button>
                : <Button variant="outline" disabled={busy || installing !== null} aria-describedby={describedBy} onClick={() => { void add(member); }}>{installing === setup.id ? __('Installing…', 'wconvert') : error?.id === setup.id ? __('Try again', 'wconvert') : __('Install setup', 'wconvert')}</Button>}
        </>} />;
    })}</ul>
    {shown.length === 0 && <p>{__('No setups match. Try another search or format.', 'wconvert')}</p>}
  </>;
}
