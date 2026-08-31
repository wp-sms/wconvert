import { __, sprintf } from '@wordpress/i18n';
import { Lock } from 'lucide-react';
import { renderingFor, type Rendering } from '../../goals/availability';
import { toRule } from '../presets';
import type { Rule, RuleType } from '../api';

/**
 * The add control: every type this install can run, and every legible shortcut
 * over it — plus an honest account of the ones it cannot.
 *
 * One `<select>` with a group per type rather than a type picker followed by a
 * preset picker, because "after a few seconds" is one decision and asking for
 * it in two steps makes the merchant learn that it is `time_on_page`
 * underneath — which is exactly what a preset exists to spare them.
 *
 * ============================================================================
 * IT BRANCHES ON `renderingFor`, NOT ON TWO STRING LITERALS.
 * ============================================================================
 * `RulesEditor` tested `availability === 'ready'` and `=== 'locked'` and had no
 * third arm, so an `unavailable` type — a cart Condition on a site with no
 * store — was **silently absent**: not offered, not explained, not mentioned.
 * That is the one rendering ADR 0026 forbids on a settings list, and the Optin
 * list was already telling the same merchant about the same rule.
 *
 * The cascade is `goals/availability.ts`'s, shared with the goal screen and
 * the Destinations list rather than written out a third time. It has four
 * arms and this file handles three; `hide` is structurally unreachable from a
 * settings list, which is what makes the exhaustive branch honest rather than
 * defensive.
 */
export interface AddRuleProps {
  readonly axis: readonly RuleType[];
  readonly label: string;
  readonly onAdd: (rule: Rule) => void;
}

export function AddRule({ axis, label, onAdd }: AddRuleProps) {
  const on = (rendering: Rendering): readonly RuleType[] =>
    axis.filter((type) => renderingFor(type.availability, 'settings_list') === rendering);

  const offered = on('offer');

  return (
    <>
      <p>
        <label>
          {label}{' '}
          <select
            value=""
            onChange={(event) => {
              const [type, presetId] = event.target.value.split('|');
              const chosen = offered.find((each) => each.type === type);

              if (chosen !== undefined) {
                onAdd(toRule(chosen, chosen.presets.find((each) => each.id === presetId) ?? null, {}));
              }
            }}
          >
            <option value="">{__('Choose…', 'wconvert')}</option>
            {offered.map((type) => (
              <optgroup key={type.type} label={type.label}>
                {type.presets.map((preset) => (
                  <option key={preset.id} value={`${type.type}|${preset.id}`}>
                    {preset.label}
                  </option>
                ))}
                <option value={`${type.type}|`}>
                  {type.presets.length === 0 ? type.label : __('Set it myself', 'wconvert')}
                </option>
              </optgroup>
            ))}
          </select>
        </label>
      </p>

      <LockedTypes types={on('upsell')} />
      <UnavailableTypes types={on('explain')} />
    </>
  );
}

/**
 * The premium rule types this install cannot run, as **cards from the
 * manifest**.
 *
 * ============================================================================
 * A RUN-ON SENTENCE IS NOT WHAT ADR 0015 SPECIFIED.
 * ============================================================================
 * What shipped was *"With WConvert Pro: Clicks an element, About to leave,
 * Scrolls back up"* appended to the paragraph holding the add control — three
 * distinct capabilities as a comma list in a sentence about something else,
 * which is drift from ADR 0015's *"free's admin renders the `locked` card from
 * the shared manifest"* ([#72](https://github.com/navidkashani/wconvert/issues/72)).
 *
 * **The heading keeps the words.** *With WConvert Pro:* is what named this on
 * screen before and it is what `builder-editors.test.tsx` reads, so the phrase
 * survives the change of shape — the test is asserting that a premium type is
 * NAMED, and it still is.
 *
 * **Metadata, never a disabled control.** wp.org Guideline 9 fires on showing a
 * real control the user cannot use, and the premium code genuinely is not in
 * this bundle — there is nothing here to disable. A card carries the type's
 * label from PHP and nothing a click could reach, which is what makes the
 * upsell honest rather than trialware (ADR 0015).
 *
 * **Named rather than hidden**, which is the other half: a settings list the
 * merchant went hunting through explains the gap, where the creation flow's
 * front door hides one (ADR 0026). There is no link, because the upgrade
 * destination does not exist yet and "upgrade here" beside nothing to click is
 * worse than saying nothing.
 */
function LockedTypes({ types }: { types: readonly RuleType[] }) {
  if (types.length === 0) {
    return null;
  }

  return (
    <div className="wconvert-locked">
      <p className="wconvert-locked__heading">{__('With WConvert Pro:', 'wconvert')}</p>
      <ul className="wconvert-locked__list">
        {types.map((type) => (
          <li key={type.type} className="wconvert-locked__card">
            <Lock aria-hidden="true" className="wconvert-locked__icon" />
            <span className="wconvert-locked__label">{type.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The rule types this SITE cannot serve — a sibling card, and **never an
 * upsell**.
 *
 * ============================================================================
 * THE HOLE THIS CLOSES WAS LIVE AND THE TWO SCREENS DISAGREED ACROSS IT.
 * ============================================================================
 * `RulesEditor` had two branches, `ready` and `locked`, so a cart Condition on
 * a store-less site appeared in neither the offered list nor the Pro card and
 * was simply gone. Meanwhile `Suspension::reason()` told that same merchant,
 * on the Optin list, exactly which plugin their Optin needed.
 *
 * It is a card of its own rather than a second row in the Pro list, because
 * merging them is the failure ADR 0026 is about: `locked` is buyable from us
 * and `unavailable` is not, and one list would offer a merchant a WooCommerce
 * licence we do not have. **It names the plugin** for the same reason the
 * Optin list does — "not available on this site" leaves them guessing which of
 * their plugins did it — and the words are `RuleCatalogue`'s, which resolves
 * the cause or nothing.
 *
 * Worded to match `destinations/Destinations.tsx`, which reached the same
 * cascade first.
 */
function UnavailableTypes({ types }: { types: readonly RuleType[] }) {
  if (types.length === 0) {
    return null;
  }

  return (
    <div className="wconvert-locked wconvert-locked--site">
      <p className="wconvert-locked__heading">{__('Not available on this site:', 'wconvert')}</p>
      <ul className="wconvert-locked__list">
        {types.map((type) => (
          <li key={type.type} className="wconvert-locked__card">
            <span className="wconvert-locked__label">{type.label}</span>{' '}
            <span className="wconvert-locked__reason">
              {sprintf(
                /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
                __('Needs %s on this site.', 'wconvert'),
                type.requires_label ?? __('something this site does not have', 'wconvert')
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
