import { __, sprintf } from '@wordpress/i18n';
import { ParamField } from '../controls';
import { fromRule, toRule } from '../presets';
import type { Rule, RuleType } from '../api';

/**
 * One client rule — a [[Trigger]] or a [[Condition]] — as a row of controls.
 *
 * Extracted from `RulesEditor` unchanged except for the third note below.
 * `RuleRows.tsx` already records why this is not shared with the Targeting
 * row: a client rule is `{type, ...params}` edited through presets, a
 * Targeting rule is `{type, value}` edited through one typed control, and
 * folding them means a component that takes a discriminator and branches.
 */
export interface RuleRowProps {
  readonly rule: Rule;
  /** Its index in the flat list, which is what makes each control's id unique. */
  readonly at: number;
  readonly types: readonly RuleType[];
  readonly onChange: (rule: Rule) => void;
}

export function RuleRow({ rule, at, types, onChange }: RuleRowProps) {
  const read = fromRule(rule, types);

  if (read === null) {
    // A type this install's vocabulary does not have. The raw type is the only
    // honest thing left to show, and removing it is the only edit that can be
    // offered — drawing controls for params nothing declares would invite the
    // merchant to configure a rule nothing evaluates.
    return (
      <>
        <code>{rule.type}</code>{' '}
        <span className="wconvert-rule__note">{__('This rule is not available on this site.', 'wconvert')}</span>{' '}
      </>
    );
  }

  const { type, preset, values, filled, degradedFrom } = read;
  const editable = Object.entries(type.params).filter(([param]) => !(preset !== null && param in preset.fixed));
  // The rule this one stands in for, by its own name where this install knows
  // it. `RuleCatalogue` describes a `locked` type rather than filtering it out
  // — the rules panel explains a gap rather than hiding one (ADR 0026) — so
  // the words for "Exit intent" are here even on a free install. The raw type
  // is the fallback for a marker naming something this build has never heard
  // of, which is the only honest thing left to show.
  const substitutedFor =
    degradedFrom === null ? null : (types.find((each) => each.type === degradedFrom)?.label ?? degradedFrom);

  return (
    <>
      <strong>{type.label}</strong>{' '}
      {type.presets.length > 0 && (
        <select
          aria-label={type.label}
          value={preset?.id ?? ''}
          onChange={(event) =>
            // The rule's OWN values, not just the ones outside the old preset:
            // dropping from "came from a particular source" to the general form
            // must hand the merchant `utm_source` to edit rather than an empty
            // key and a rule that matches every visitor. A preset's fixed
            // params still win, so this changes nothing when one is chosen.
            onChange(
              toRule(type, type.presets.find((each) => each.id === event.target.value) ?? null, values, degradedFrom)
            )
          }
        >
          {type.presets.map((each) => (
            <option key={each.id} value={each.id}>
              {each.label}
            </option>
          ))}
          {/* The general form, always offered. A preset is a shortcut over the
              engine type and never a replacement for it (ADR 0005), so a
              merchant who wants their own `utm_term` is not locked out of one. */}
          <option value="">{__('Set it myself', 'wconvert')}</option>
        </select>
      )}
      {editable.map(([param, declaration]) => (
        <ParamField
          key={param}
          id={`wconvert-rule-${at}-${param}`}
          param={declaration}
          value={filled[param]}
          onChange={(value) => onChange(toRule(type, preset, { ...filled, [param]: value }, degradedFrom))}
        />
      ))}
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
      {substitutedFor !== null && (
        <p className="wconvert-rule__note text-note">
          {sprintf(
            /* translators: %s: the premium rule this one was substituted for, e.g. “Exit intent”. */
            __('Standing in for “%s”, which is available with WConvert Pro.', 'wconvert'),
            substitutedFor
          )}
        </p>
      )}
      {type.availability === 'locked' && (
        <p className="wconvert-rule__note text-note">{__('Needs WConvert Pro to run.', 'wconvert')}</p>
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
    </>
  );
}
