import { useId, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { Opening } from '@loader/display-rules';
import type { RuleType } from '../api';
import { DisclosureCard } from './DisclosureCard';
import { GroupEditor } from './GroupEditor';
import { InfoTip } from '../../shell/InfoTip';

/**
 * When it opens, under Custom…: the whole opening, any mode.
 *
 * `heldBy` is the id of a reason another answer gives for opening right away;
 * while it is set every other mode is refused and points at it (GUIDELINES §14).
 */
export function OpeningEditor({ value, types, onChange, heldBy }: { value: Opening; types: readonly RuleType[]; onChange: (next: Opening) => void; heldBy?: string }) {
  const [saved, setSaved] = useState<Partial<Record<Opening['mode'], Opening>>>({});
  // Its own name, so two editors on one page never share a radio group.
  const radios = useId();
  const modes = [['immediate', __('Right away', 'wconvert')], ['automatic', __('After something they do', 'wconvert')], ['click', __('When they click', 'wconvert')]] as const;
  const switchMode = (mode: Opening['mode']) => {
    setSaved({ ...saved, [value.mode]: value });
    onChange(saved[mode] ?? (mode === 'immediate' ? { mode } : mode === 'click' ? { mode, rules: [] } : { mode, match: 'all', minimum_seconds: 0, rules: [] }));
  };
  const offered = types.filter(type => value.mode === 'click' ? 'selector' in type.params : type.type !== 'page_load' && !('selector' in type.params));
  return <>
    <fieldset className="wconvert-display-match wconvert-display-modes"><legend>{__('Opens', 'wconvert')}</legend>
      {modes.map(([mode, label]) => {
        const refused = heldBy !== undefined && mode !== 'immediate';
        return <label key={mode} data-refused={refused || undefined}><input type="radio" name={radios} checked={value.mode === mode}
          aria-disabled={refused || undefined} aria-describedby={refused ? heldBy : undefined} onChange={() => { if (!refused) switchMode(mode); }} />{label}</label>;
      })}
    </fieldset>
    {value.mode !== 'immediate' && <GroupEditor group={{ match: value.mode === 'automatic' ? value.match : 'any', rules: value.rules }} types={offered} offset={60}
      label={__('What opens it', 'wconvert')}
      match={value.mode === 'automatic' ? { before: __('Opens when', 'wconvert'), after: __('of these happen', 'wconvert'), label: __('Opens when any or all of these happen', 'wconvert'), order: ['any', 'all'] } : undefined}
      onChange={group => onChange(value.mode === 'click' ? { ...value, rules: group.rules } : { ...value, match: group.match, rules: group.rules })} />}
    {value.mode === 'automatic' && <DisclosureCard title={__('Minimum time on the page', 'wconvert')} open={!!value.minimum_seconds}
      current={value.minimum_seconds ? sprintf(
        /* translators: %d: a number of seconds. */
        _n('Not before %d second', 'Not before %d seconds', value.minimum_seconds, 'wconvert'), value.minimum_seconds) : __('None', 'wconvert')}>
      <label className="wconvert-display-inline-field">{__('Never open before', 'wconvert')}
        <input type="number" min={0} max={3600} value={value.minimum_seconds ?? 0} onChange={event => onChange({ ...value, minimum_seconds: Number(event.target.value) })} />
        {__('seconds on the page', 'wconvert')}</label>
      <p className="wconvert-display-hint">{__('Earlier exits and scroll-ups don’t count', 'wconvert')}
        <InfoTip label={__('About the minimum time', 'wconvert')}>{__('Early exit or scroll-up activity is ignored. The visitor must repeat it after this delay.', 'wconvert')}</InfoTip></p>
    </DisclosureCard>}
    {value.mode === 'click' && <p className="wconvert-display-hint">{__('Use an ID, class or attribute', 'wconvert')}
      <InfoTip label={__('About the selector', 'wconvert')}>{__('Point to the button or link with an ID, class, tag or attribute selector, such as #signup, .offer-button or [data-offer]. Pseudo-classes such as :hover are not supported.', 'wconvert')}</InfoTip></p>}
  </>;
}
