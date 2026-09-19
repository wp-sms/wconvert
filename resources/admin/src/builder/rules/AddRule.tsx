import { useRef, useState, type KeyboardEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { useDirection } from '../../hooks/useDirection';
import { renderingFor, tierProductName, type Rendering } from '../../goals/availability';
import { toRule } from '../presets';
import type { Rule, RuleType } from '../api';

export interface AddRuleProps {
  readonly axis: readonly RuleType[];
  readonly label: string;
  readonly onAdd: (rule: Rule) => void;
}

/** Search types and their shortcuts in one step. Unavailable capabilities remain
 * readable metadata, grouped by the product or dependency that supplies them.
 * Opening, searching and closing never edit the draft.
 */
export function AddRule({ axis, label, onAdd }: AddRuleProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const direction = useDirection();
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...text: (string | null)[]) => {
    const haystack = text.join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  };
  const on = (rendering: Rendering) => axis.filter(type => renderingFor(type.availability, 'settings_list') === rendering);
  const offered = on('offer').map(type => ({
    type,
    choices: [...type.presets, null].filter(preset => matches(type.label, type.phrase, preset?.label ?? '', preset?.phrase ?? '')),
  })).filter(group => group.choices.length > 0);
  const unavailable = [
    ...[...byTier(on('upsell'))].map(([product, types]) => ({
      // translators: %s: the product that supplies these rules.
      reason: sprintf(__('With %s', 'wconvert'), product), types,
    })),
    ...[...byDependency(on('explain'))].map(([needs, types]) => ({
      // translators: %s: the plugin the site needs.
      reason: sprintf(__('Needs %s', 'wconvert'), needs), types,
    })),
  ].map(group => ({ ...group, types: group.types.filter(type => matches(type.label, type.phrase, group.reason, ...type.presets.map(preset => preset.label))) }))
    .filter(group => group.types.length > 0);

  const navigate = (event: KeyboardEvent) => {
    const buttons = [...(results.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(event.target as HTMLButtonElement);
    if (event.target === search.current && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const next = event.key === 'ArrowDown' ? Math.min(at + 1, buttons.length - 1)
      : event.key === 'ArrowUp' ? (at < 0 ? buttons.length - 1 : at - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    if (next < 0) search.current?.focus();
    else buttons[next]?.focus();
  };

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="mt-2" aria-label={label}><Plus aria-hidden="true" />{label}</Button>
    </PopoverTrigger>
    <PopoverContent align="start" dir={direction} aria-label={__('Choose a rule', 'wconvert')}
      className="wconvert-rule-picker w-[min(360px,calc(100vw-32px))] max-h-(--radix-popover-content-available-height) overflow-hidden p-2"
      onOpenAutoFocus={event => { event.preventDefault(); search.current?.focus(); }} onKeyDown={navigate}>
      <input ref={search} type="search" value={query} aria-label={__('Find a rule', 'wconvert')}
        placeholder={__('Search rules…', 'wconvert')} onChange={event => setQuery(event.target.value)} />
      <div ref={results} className="wconvert-rule-picker__results">
        {offered.map(({ type, choices }) => <div key={type.type} role="group" aria-label={type.label} data-available="true">
          {type.presets.length > 0 && <p className="wconvert-rule-picker__heading">{type.label}</p>}
          {choices.map(preset => <button key={preset?.id ?? ''} type="button" onClick={() => {
            onAdd(toRule(type, preset, {})); setOpen(false);
          }}>{preset?.label ?? (type.presets.length > 0 ? __('Set it myself', 'wconvert') : type.label)}</button>)}
        </div>)}
        {unavailable.map(({ reason, types }) => <div key={reason} role="group" aria-label={reason} data-available="false">
          <p className="wconvert-rule-picker__heading">{reason}</p>
          {types.map(type => <p key={type.type} className="wconvert-rule-picker__unavailable">{type.label}</p>)}
        </div>)}
        {offered.length === 0 && unavailable.length === 0 && <p role="status">{__('No matching rules.', 'wconvert')}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}

/**
 * The absent types, grouped by the plugin each is waiting on.
 *
 * In first-seen order, which is manifest order — so the list does not reshuffle
 * when a merchant activates one of two missing plugins.
 */
function byTier(types: readonly RuleType[]): Map<string, RuleType[]> {
  const groups = new Map<string, RuleType[]>();

  for (const type of types) {
    const product = tierProductName(type.tier);

    groups.set(product, [...(groups.get(product) ?? []), type]);
  }

  return groups;
}

/**
 * The `unavailable` types, grouped by what the SITE is missing.
 */
function byDependency(types: readonly RuleType[]): Map<string, RuleType[]> {
  const groups = new Map<string, RuleType[]>();

  for (const type of types) {
    // `RuleCatalogue` answers with the cause or nothing, so a type here
    // without one cannot occur — but a response from an older build could
    // carry null, and a group headed "Needs null" is worse than a vague one.
    const needs = type.requires_label ?? __('another plugin', 'wconvert');
    const group = groups.get(needs);

    if (group === undefined) {
      groups.set(needs, [type]);
    } else {
      group.push(type);
    }
  }

  return groups;
}
