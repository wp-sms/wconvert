import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Opening } from '@loader/display-rules';
import type { RuleType } from '../api';
import { GroupEditor } from './GroupEditor';

export function OpeningEditor({ value, types, onChange }: { value: Opening; types: readonly RuleType[]; onChange: (next: Opening) => void }) {
  const [saved, setSaved] = useState<Partial<Record<Opening['mode'], Opening>>>({});
  const modes = [ ['immediate', __('Immediately', 'wconvert')], ['automatic', __('After a delay or visitor activity', 'wconvert')], ['click', __('When someone clicks', 'wconvert')] ] as const;
  const switchMode = (mode: Opening['mode']) => {
    setSaved({ ...saved, [value.mode]: value });
    onChange(saved[mode] ?? (mode === 'immediate' ? { mode } : mode === 'click' ? { mode, rules: [] } : { mode, match: 'all', minimum_seconds: 0, rules: [] }));
  };
  const offered = types.filter(type => value.mode === 'click' ? 'selector' in type.params : type.type !== 'page_load' && !('selector' in type.params));
  return <>
    <fieldset className="wconvert-display-choices"><legend>{__('Opening mode', 'wconvert')}</legend>
      {modes.map(([mode, label]) => <label key={mode}><input type="radio" name="display-opening" checked={value.mode === mode} onChange={() => switchMode(mode)} />{label}</label>)}
    </fieldset>
    {value.mode !== 'immediate' && <GroupEditor group={{ match: value.mode === 'automatic' ? value.match : 'any', rules: value.rules }} types={offered} offset={60} operator={value.mode === 'automatic'} onChange={group => onChange(value.mode === 'click' ? { ...value, rules: group.rules } : { ...value, match: group.match, rules: group.rules })} />}
    {value.mode === 'automatic' && <details className="wconvert-rule-advanced mt-4" open={!!value.minimum_seconds || undefined}>
      <summary>{__('Minimum time on the page', 'wconvert')}</summary>
      <div className="wconvert-display-disclosure-body"><label className="wconvert-display-dwell">{__('Never open before', 'wconvert')}{' '}
      <input type="number" min={0} max={3600} value={value.minimum_seconds ?? 0} onChange={event => onChange({ ...value, minimum_seconds: Number(event.target.value) })} />{' '}{__('seconds on the page', 'wconvert')}</label>
      <p className="text-note text-muted-foreground">{__('If someone tries to leave or scrolls back up before this time, the campaign waits for them to do it again.', 'wconvert')}</p>
      </div>
    </details>}
    {value.mode === 'immediate' && <p className="wconvert-display-rule-help">{__('Opens as soon as the page, audience and schedule allow it. Repeat limits still apply.', 'wconvert')}</p>}
    {value.mode === 'click' && <details className="wconvert-rule-advanced mt-4"><summary>{__('How to choose a button or link', 'wconvert')}</summary><p className="wconvert-display-disclosure-body text-note text-muted-foreground">{__('Use an ID, class, tag or attribute selector, such as #signup, .offer-button or [data-offer]. Descendants, combinators and comma-separated alternatives are supported. CSS pseudo-classes and escaped names are not supported.', 'wconvert')}</p></details>}
    {value.mode === 'click' && <p className="text-note text-muted-foreground">{__('A matching click can reopen a closed campaign, even during a waiting period. Your stop-after-completion setting still applies. Pages, audience, schedule and other open popups still apply.', 'wconvert')}</p>}
  </>;
}
