import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Opening } from '@loader/display-rules';
import type { RuleType } from '../api';
import { GroupEditor } from './GroupEditor';

export function OpeningEditor({ value, types, onChange }: { value: Opening; types: readonly RuleType[]; onChange: (next: Opening) => void }) {
  const [saved, setSaved] = useState<Partial<Record<Opening['mode'], Opening>>>({});
  const modes = [ ['immediate', __('Immediately', 'wconvert')], ['automatic', __('When requirements are met', 'wconvert')], ['click', __('When someone clicks', 'wconvert')] ] as const;
  const switchMode = (mode: Opening['mode']) => {
    setSaved({ ...saved, [value.mode]: value });
    onChange(saved[mode] ?? (mode === 'immediate' ? { mode } : mode === 'click' ? { mode, rules: [] } : { mode, match: 'all', minimum_seconds: 0, rules: [] }));
  };
  const offered = types.filter(type => value.mode === 'click' ? 'selector' in type.params : type.type !== 'page_load' && !('selector' in type.params));
  return <>
    <p>{__('Choose the moment it opens after pages, audience, schedule and limits allow.', 'wconvert')}</p>
    <fieldset className="wconvert-display-choices"><legend>{__('Opening mode', 'wconvert')}</legend>
      {modes.map(([mode, label]) => <label key={mode}><input type="radio" name="display-opening" checked={value.mode === mode} onChange={() => switchMode(mode)} />{label}</label>)}
    </fieldset>
    {value.mode !== 'immediate' && <GroupEditor group={{ match: value.mode === 'automatic' ? value.match : 'any', rules: value.rules }} types={offered} offset={60} operator={value.mode === 'automatic'} onChange={group => onChange(value.mode === 'click' ? { ...value, rules: group.rules } : { ...value, match: group.match, rules: group.rules })} />}
    {value.mode === 'automatic' && <div className="mt-4"><label>{__('Never open before', 'wconvert')}{' '}
      <input type="number" min={0} max={3600} value={value.minimum_seconds ?? 0} onChange={event => onChange({ ...value, minimum_seconds: Number(event.target.value) })} />{' '}{__('seconds on the page', 'wconvert')}</label>
      <p className="text-note text-muted-foreground">{__('Exit and scroll-back-up must happen after this time. An earlier gesture is never replayed.', 'wconvert')}</p>
    </div>}
    {value.mode === 'click' && <p className="text-note text-muted-foreground">{__('Use an ID, class, tag or attribute selector, such as #signup, .offer-button or [data-offer]. Descendants, combinators and comma-separated alternatives are supported. CSS pseudo-classes and escaped names are not supported.', 'wconvert')}</p>}
    {value.mode === 'click' && <p className="text-note text-muted-foreground">{__('Any matching button can open it. Visitor requests skip automatic view limits and closing restrictions, but still respect completion, audience and schedule. Another open popup keeps its place.', 'wconvert')}</p>}
  </>;
}
