import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ParamControl, ParamField } from '../controls';
import { Popover } from '../../components/ui/popover';
import { PILL_MENU, PillTrigger, ValuePill } from './ValuePill';
import { OptionItem, OptionList, OptionListContent, OptionSeparator } from '../../components/ui/option-menu';
import { fromRule, toRule } from '../presets';
import type { Rule, RuleParam, RulePreset, RuleType } from '../api';
import { isFreeInstall, tierProductName } from '../../goals/availability';
import { ruleIcon } from './ruleIcon';
import { valueText } from './sentence';

/**
 * One client rule — a [[Trigger]] or a [[Condition]] — as ONE SENTENCE of
 * pills (ADR 0139): *[icon Device] [Phone ▾]*, *[icon Products in the cart]
 * [any of ▾] [2 products ▾]*. A value with presets or a set opens a menu; a
 * closed choice of two or three words is a native select drawn as a word; a
 * rule with no params is its name alone. Help is the row's ⓘ, drawn by
 * `RuleRows` beside its ✕; status notes stay under the row.
 *
 * `RuleRows.tsx` records why this is not shared with the Targeting row: a
 * client rule is `{type, ...params}` edited through presets, a Targeting rule
 * is `{type, value}` edited through one typed control.
 */
export interface RuleRowProps {
  readonly rule: Rule;
  /** Its index in the flat list, which is what makes each control's id unique. */
  readonly at: number;
  readonly types: readonly RuleType[];
  readonly onChange: (rule: Rule) => void;
}

/** The yes/no words a row says instead of Yes and No, where it has some. */
const booleanWords = (type: string, param: string): readonly [string, string] | undefined =>
  type === 'logged_in' && param === 'value' ? [__('Signed in', 'wconvert'), __('Signed out', 'wconvert')] : undefined;

/**
 * What a word select is called: the rule's own name where the word is its only
 * param ("Ad blocker [Detected ▾]"), else the param's ("operator").
 */
const wordLabel = (type: RuleType, param: string): string =>
  Object.keys(type.params).length === 1 ? type.label : type.params[param].label;

/** Controls drawn inline as a word rather than behind a pill. */
const isWord = (param: RuleParam): boolean => param.control === 'enum' || param.control === 'boolean';

export function RuleRow({ rule, at, types, onChange }: RuleRowProps) {
  // ==========================================================================
  // "SET IT MYSELF" IS A CHOICE THE ROW REMEMBERS, BECAUSE IT CANNOT BE READ
  // BACK OFF THE RULE.
  // ==========================================================================
  // Which preset a row is wearing is DERIVED from the rule's values
  // ({@link fromRule}), and that is right — it is what stops a preset becoming
  // a second engine type (ADR 0005). But it leaves no way to spell "none of
  // them, I am setting this myself" when the values happen to match one: the
  // general form re-emitted the same values, the same preset matched them
  // again, and the select snapped back with no controls drawn.
  //
  // Every `device`, `time_on_page` and `scroll_depth` preset fixes all of its
  // params, so this was a menu item that could never do anything on any rule
  // type. A merchant who wants their own combination is not locked out of one
  // — "a preset is a shortcut over the engine type and never a replacement for
  // it" — so the row holds the choice.
  //
  // **Component state and not a stored key.** It is a fact about what this
  // merchant is looking at, not about the Optin: nothing here changes the rule,
  // and `DEGRADED_FROM` stays the only key a rule carries that is not a param
  // of its type. Reopening the builder shows the preset again, which is the
  // honest answer — the rule IS that preset's values.
  const [custom, setCustom] = useState(false);

  const read = fromRule(rule, types);

  if (read === null) {
    // A type this install's vocabulary does not have. Removing it is the only
    // edit that can be offered — drawing controls for params nothing declares
    // would invite the merchant to configure a rule nothing evaluates. Its key
    // is not shown (ADR 0131: no raw keys on screen); the sentence says enough.
    return <div className="wconvert-rule-row">
      <span className="wconvert-rule-row__name">{__('A rule that is not available on this site.', 'wconvert')}</span>
    </div>;
  }

  const { type, preset: matched, values, filled, degradedFrom } = read;
  const preset = custom ? null : matched;
  // What the controls are given: with a preset on, the params it leaves open;
  // without one, everything the rule holds — so dropping to the general form
  // hands the merchant the preset's own values to edit rather than a blank.
  const shown = preset === null ? values : filled;
  const idOf = (param: string) => `wconvert-rule-${at}-${param}`;
  const write = (param: string, value: unknown) => {
    // Keep a custom form open when its values happen to match a shortcut, so
    // editing device boxes cannot make them disappear. A shortcut's editable
    // fields (e.g. UTM values) do not change its fixed key and must not turn
    // it into the custom form.
    if (preset === null) setCustom(true);
    onChange(toRule(type, preset, { ...shown, [param]: value }, degradedFrom));
  };
  const choose = (chosen: RulePreset | null) => {
    // Choosing Custom… IS the choice, and it is the only way the row can know
    // it was made. The rule's OWN values travel, not just the ones outside the
    // old preset: dropping from "came from a particular source" to the general
    // form must hand the merchant `utm_source` to edit rather than an empty key.
    setCustom(chosen === null);
    onChange(toRule(type, chosen, values, degradedFrom));
  };
  const field = (param: string) => <ParamField key={param} id={idOf(param)} param={type.params[param]} value={shown[param]} onChange={value => write(param, value)} />;
  const params = Object.keys(type.params);
  const fixedByPreset = (param: string) => preset !== null && param in preset.fixed;
  const textOf = (names: readonly string[]) => {
    const parts = names.map(param => valueText(type.params[param], shown[param]));
    return parts.every(part => part !== null) && parts.length > 0 ? parts.join(' · ') : null;
  };
  const parts: ReactNode[] = [];

  if (type.presets.length > 0) {
    // `query_param` keeps its key and its values apart: the key is the preset's
    // question ("Source", "Campaign"), the values are the answer.
    const keyed = type.type === 'query_param';
    const presetParams = keyed ? ['key'] : params.filter(param => !isWord(type.params[param]));
    const words = params.filter(param => isWord(type.params[param]));
    words.forEach(param => parts.push(<ParamControl key={param} id={idOf(param)} param={type.params[param]} value={shown[param]}
      variant="pill" label={wordLabel(type, param)} words={booleanWords(type.type, param)} onChange={value => write(param, value)} />));
    parts.push(<PresetPill key="preset" label={keyed ? type.params.key?.label ?? type.label : type.label} presets={type.presets} chosen={preset}
      text={preset?.label ?? textOf(presetParams.filter(param => !fixedByPreset(param)))} onChoose={choose}
      controls={presetParams.filter(param => !fixedByPreset(param)).map(field)} />);
    if (keyed && type.params.value) {
      parts.push(<ValuePill key="value" label={type.params.value.label} text={valueText(type.params.value, shown.value) ?? __('any value', 'wconvert')}
        >{field('value')}</ValuePill>);
    }
  } else {
    // Words first, so "Products in the cart [any of ▾] [2 products ▾]" reads in order.
    const ordered = [...params.filter(param => isWord(type.params[param])), ...params.filter(param => !isWord(type.params[param]))];
    for (const param of ordered) {
      const declared = type.params[param];
      if (isWord(declared)) {
        // A yes/no that qualifies a set (cart categories' subcategories) lives in that set's menu.
        if (declared.control === 'boolean' && params.some(other => ['product_set', 'category_set'].includes(type.params[other].control))) continue;
        parts.push(<ParamControl key={param} id={idOf(param)} param={declared} value={shown[param]} variant="pill"
          label={wordLabel(type, param)} words={booleanWords(type.type, param)} onChange={value => write(param, value)} />);
        continue;
      }
      const qualifier = ['product_set', 'category_set'].includes(declared.control)
        ? params.find(other => type.params[other].control === 'boolean') : undefined;
      parts.push(<ValuePill key={param} label={declared.label} text={valueText(declared, shown[param])}>
        {field(param)}
        {qualifier !== undefined && <label className="wconvert-rule-row__check">
          {/* Unticked is unset, as the old Yes/No field left it, not a stored false. */}
          <input type="checkbox" checked={shown[qualifier] === true} onChange={event => write(qualifier, event.target.checked || undefined)} />
          {type.params[qualifier].label}
        </label>}
      </ValuePill>);
    }
  }

  // The rule this one stands in for, by its own name where this install knows
  // it. `RuleCatalogue` describes a `locked` type rather than filtering it out
  // — the rules panel explains a gap rather than hiding one (ADR 0026) — so
  // the words for "Exit intent" are here even on a free install. The raw type
  // is the fallback for a marker naming something this build has never heard
  // of, which is the only honest thing left to show.
  const substitutedFor =
    degradedFrom === null ? null : (types.find((each) => each.type === degradedFrom)?.label ?? degradedFrom);

  return (
    <div className="wconvert-rule-row">
      <div className="wconvert-rule-row__sentence">
        <span className="wconvert-rule-row__name">
          <RuleIcon type={type.type} />
          {type.label}
        </span>
        {parts}
      </div>
      {/*
        THE TWO HALVES OF ADR 0012'S ON-SCREEN SURFACE, ON ONE ROW.

        The MARKER is for an Optin prefilled on an install without Pro: the
        Playbook asked for exit intent, prefill wrote time-on-page instead, and
        this is the sentence that says so. It is what an upgrade offer will be
        anchored to, which is why an upgrade never silently re-upgrades a
        running Optin — changing a live popup's behaviour with no human in the
        loop is the surprise ADR 0012 refuses. Prose rather than a link, like
        every other upsell in this bundle: the upgrade DESTINATION is #14's and
        does not exist yet, and a sentence that says "upgrade here" beside
        nothing to click is worse than one that does not.

        The LOCKED note is the case that needs no marker: a rule authored WITH
        Pro and running without it. The premium rule is still in `config` at
        its own tier, so the type says everything the marker would.

        Both are persistent `<p>`s and neither has a dismiss control.
      */}
      {/*
        A free install names no product (ADR 0116). These notes stay sales
        copy only where Pro is installed and a rung is what is missing.
      */}
      {substitutedFor !== null && (
        <p className="wconvert-rule__note text-note">
          {isFreeInstall() ? sprintf(
            /* translators: %s: the rule this one was substituted for, e.g. “Exit intent”. */
            __('Standing in for “%s”, which isn’t available on this site.', 'wconvert'),
            substitutedFor
          ) : sprintf(
            /* translators: 1: the premium rule this one was substituted for, e.g. “Exit intent”. 2: the product that supplies it, e.g. “WConvert Pro”. */
            __('Standing in for “%1$s”, which is available with %2$s.', 'wconvert'),
            substitutedFor,
            tierProductName(type.tier)
          )}
        </p>
      )}
      {type.availability === 'locked' && (
        <p className="wconvert-rule__note text-note">
          {isFreeInstall() ? __('This rule isn’t available on this site.', 'wconvert') : sprintf(
            /* translators: %s: the product that supplies the rule, e.g. “WConvert Pro”. */
            __('Needs %s to run.', 'wconvert'),
            tierProductName(type.tier)
          )}
        </p>
      )}
      {/*
        ====================================================================
        THE MIRROR OF `Suspension::reason()`, SO THE TWO SCREENS AGREE.
        ====================================================================
        A cart Condition on a site with no store is `unavailable`, and the
        Optin list already tells this merchant *"Suspended — the “Has
        something in their cart” rule needs WooCommerce, which is not active
        on this site"*. Until now the panel HOLDING that rule said nothing at
        all: `RulesEditor` branched on `ready`/`locked` and let every other
        state fall through to silence.

        **It names the plugin**, for the reason ADR 0026 gives on the list:
        "not available on this site" leaves a merchant who deactivated
        WooCommerce to guess which of their plugins did it. The words come
        from `RuleCatalogue`, which resolves the cause or nothing — so there
        is no branch here for an `unavailable` rule with nothing to name.

        **And it is never an upsell.** A rule the SITE cannot serve is not
        something we can sell.
      */}
      {type.availability === 'unavailable' && (
        <p className="wconvert-rule__note text-note">
          {sprintf(
            /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
            __('Needs %s on this site, which is not active.', 'wconvert'),
            type.requires_label ?? __('something this site does not have', 'wconvert')
          )}
        </p>
      )}
    </div>
  );
}

function RuleIcon({ type }: { type: string }) {
  const Icon = ruleIcon(type);

  return <Icon aria-hidden="true" />;
}

/**
 * A preset rule's value: its presets with a check, then Custom…, which keeps
 * the menu open and draws the params under the list. Picking a preset closes it.
 */
function PresetPill({ label, presets, chosen, text, onChoose, controls }: {
  label: string; presets: readonly RulePreset[]; chosen: RulePreset | null; text: string | null;
  onChoose: (preset: RulePreset | null) => void; controls: ReactNode[];
}) {
  const [open, setOpen] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
  const [focusFields, setFocusFields] = useState(false);
  const custom = chosen === null;

  // Custom… keeps the menu open and moves focus to the first control it drew.
  useEffect(() => {
    if (!focusFields) return;
    fields.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    setFocusFields(false);
  }, [focusFields]);

  return <Popover open={open} onOpenChange={setOpen}>
    <PillTrigger label={label} text={text} />
    <OptionListContent align="start" className={PILL_MENU} aria-label={label}>
      <OptionList footer={custom && controls.length > 0 ? <div ref={fields} className="wconvert-option-menu__control">
        {controls}
        <button type="button" className="wconvert-option-menu__done" onClick={() => setOpen(false)}>{__('Done', 'wconvert')}</button>
      </div> : null}>
        {presets.map(preset => <OptionItem key={preset.id} name={preset.label} checked={chosen?.id === preset.id}
          onSelect={() => { onChoose(preset); setOpen(false); }} />)}
        <OptionSeparator />
        <OptionItem name={__('Custom…', 'wconvert')} checked={custom}
          onSelect={() => { onChoose(null); setFocusFields(true); }} />
      </OptionList>
    </OptionListContent>
  </Popover>;
}
