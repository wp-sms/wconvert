import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Popover, PopoverTrigger } from '../../components/ui/popover';
import { OptionEmpty, OptionGroup, OptionItem, OptionList, OptionListContent } from '../../components/ui/option-menu';
import { renderingFor, tierProductName, type Rendering } from '../../goals/availability';
import { ruleCategory, ruleHelp, ruleHint } from './ruleHelp';
import { ruleIcon } from './ruleIcon';
import { toRule } from '../presets';
import type { Rule, RuleType } from '../api';

export interface AddRuleProps {
  readonly axis: readonly RuleType[];
  readonly label: string;
  readonly onAdd: (rule: Rule) => void;
}

/** Search types and their shortcuts in one step, on the shared option menu.
 * Unavailable capabilities remain readable metadata, grouped by the product or
 * dependency that supplies them. Opening, searching and closing never edit the
 * draft.
 */
export function AddRule({ axis, label, onAdd }: AddRuleProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...text: (string | null)[]) => {
    const haystack = text.join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  };
  const on = (rendering: Rendering) => axis.filter(type => renderingFor(type.availability, 'settings_list') === rendering);
  const offered = on('offer').map(type => ({
    type,
    choices: [...type.presets, null].filter(preset => matches(type.label, type.phrase, ruleHint(type.type), ruleCategory(type.type), preset?.label ?? '', preset?.phrase ?? '')),
  })).filter(group => group.choices.length > 0);
  // Sections in the order each first appears, so the manifest's order still leads.
  const sections = new Map<string, typeof offered>();
  for (const group of offered) {
    const section = ruleCategory(group.type.type) ?? '';
    sections.set(section, [...(sections.get(section) ?? []), group]);
  }
  const unavailable = [
    ...[...byTier(on('upsell'))].map(([product, types]) => ({
      // translators: %s: the product that supplies these rules.
      reason: sprintf(__('With %s', 'wconvert'), product), types, locked: true,
      tip: __('Your plan does not include these rules. Upgrade to add them.', 'wconvert'),
    })),
    ...[...byDependency(on('explain'))].map(([needs, types]) => ({
      // translators: %s: the plugin the site needs.
      reason: sprintf(__('Needs %s', 'wconvert'), needs), types, locked: false,
      // translators: %s: the plugin the site needs, e.g. "WooCommerce".
      tip: sprintf(__('Activate %s on this site to add these rules.', 'wconvert'), needs),
    })),
  ].map(group => ({ ...group, types: group.types.filter(type => matches(type.label, type.phrase, ruleHint(type.type), group.reason, ...type.presets.map(preset => preset.label))) }))
    .filter(group => group.types.length > 0);
  const add = (rule: Rule) => { onAdd(rule); setOpen(false); };

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="mt-2" aria-label={label}><Plus aria-hidden="true" />{label}</Button>
    </PopoverTrigger>
    <OptionListContent align="start" aria-label={__('Choose a rule', 'wconvert')}>
      <OptionList search={{ value: query, onChange: setQuery, label: __('Find a rule', 'wconvert'), placeholder: __('Search rules…', 'wconvert') }}>
        {[...sections].map(([category, groups]) => <OptionGroup key={category} heading={category || null}>
          {groups.map(({ type, choices }) => <OptionItem key={type.type} icon={ruleIcon(type.type)} name={type.label}
            hint={ruleHint(type.type)} tip={ruleHelp(type.type)}
            onSelect={type.presets.length === 0 ? () => add(toRule(type, null, {})) : undefined}
            chips={type.presets.length === 0 ? undefined : choices.map(preset => ({
              label: preset?.label ?? __('Custom…', 'wconvert'),
              custom: preset === null,
              ariaLabel: preset ? undefined : sprintf(
                /* translators: %s: a rule, e.g. “Time delay”. */
                __('%s with your own values', 'wconvert'), type.label),
              onSelect: () => add(toRule(type, preset, {})),
            }))} />)}
        </OptionGroup>)}
        {unavailable.map(({ reason, types, locked, tip }) => <OptionGroup key={reason} heading={reason} icon={locked ? 'lock' : 'plug'}
          tone={locked ? undefined : 'dependency'} tip={tip}>
          {types.map(type => <OptionItem key={type.type} icon={ruleIcon(type.type)} name={type.label} />)}
        </OptionGroup>)}
        {offered.length === 0 && unavailable.length === 0 && <OptionEmpty what={__('rules', 'wconvert')} onClear={() => setQuery('')} />}
      </OptionList>
    </OptionListContent>
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
