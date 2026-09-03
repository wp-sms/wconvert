import { __, sprintf } from '@wordpress/i18n';
import { renderingFor, type Rendering } from '../../goals/availability';
import { toRule } from '../presets';
import type { Rule, RuleType } from '../api';

/**
 * The add control: every type this install can run, and every legible shortcut
 * over it — plus an honest account of the ones it cannot, **in the menu.**
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
 *
 * ============================================================================
 * AND THE EXPLANATION IS IN THE DROPDOWN, WHICH IS WHERE THEY GO LOOKING.
 * ============================================================================
 * It used to be a permanent block of chips under the Add control — two
 * headings and up to six chips, drawn on every visit of every section, telling
 * a merchant who had not yet tried to add anything about the things they could
 * not add.
 *
 * ADR 0026 says a settings list EXPLAINS an absent capability rather than
 * hiding it, and that is unchanged. What was wrong is *which thing the list
 * is*: the merchant hunts through this **menu**, not through the tab. So the
 * absent types are `<optgroup disabled>` groups at the bottom of it — the same
 * explanation, at the moment it changes what they do next (ADR 0042 rule 2,
 * ADR 0054's amendment to ADR 0026).
 *
 * **A disabled `<option>` is metadata, not a control.** wp.org Guideline 9
 * fires on offering a real control the user cannot use; the premium code is
 * genuinely not in this bundle and there is nothing here to enable
 * (ADR 0015). The option carries the type's label from PHP and cannot be
 * chosen — and `bin/plugin-check.sh` on the built free ZIP is what confirms
 * that rather than this paragraph.
 *
 * **Two groups and never one.** `locked` is buyable from us and `unavailable`
 * is not. Collapsing them offers a merchant with no store a WooCommerce
 * licence we do not sell, and shows a paying Pro customer an advertisement for
 * Pro. The unavailable ones are grouped BY what they need, so an install
 * missing WooCommerce and WP SMS gets two honest lines rather than one lumped
 * *"not available on this site"* — ADR 0026's own argument applied to the
 * shape.
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
  const locked = on('upsell');
  const unavailable = on('explain');

  // ==========================================================================
  // THE CHOICES, BY KEY — NOT A TYPE AND A PRESET ID PACKED INTO ONE STRING.
  // ==========================================================================
  // An `<option value>` is a string, so a menu offering "type X with preset Y"
  // has to key the pair somehow. It was `` `${type}|${preset}` `` and a
  // `split('|')` on the way back, which is a wire format invented for one
  // control — it makes the empty preset a trailing separator, and it breaks
  // silently the day a manifest id contains the character.
  //
  // An index into a list the same render built has no format to get wrong.
  const choices = offered.flatMap((type) => [
    ...type.presets.map((preset) => ({ type, preset })),
    { type, preset: null },
  ]);

  return (
    <p>
      <label>
        {label}{' '}
        <select
          value=""
          onChange={(event) => {
            const chosen = choices[Number(event.target.value)];

            if (chosen !== undefined) {
              onAdd(toRule(chosen.type, chosen.preset, {}));
            }
          }}
        >
          <option value="">{__('Choose…', 'wconvert')}</option>

          {/*
            **A type with no shortcuts is a bare option, not a group of one.**
            An `<optgroup>` labelled *Page load* holding one option labelled
            *Page load* is the same word twice at two indent levels, and the
            targeting axis is five of those — which is what a merchant would
            have got when its two hand-rolled selects became this one.
          */}
          {choices.map((choice, at) =>
            choice.type.presets.length > 0 ? null : (
              <option key={choice.type.type} value={at}>
                {choice.type.label}
              </option>
            ),
          )}

          {offered.map((type) =>
            type.presets.length === 0 ? null : (
              <optgroup key={type.type} label={type.label}>
                {choices.map((choice, at) =>
                  choice.type !== type ? null : (
                    <option key={choice.preset?.id ?? ''} value={at}>
                      {choice.preset !== null ? choice.preset.label : __('Set it myself', 'wconvert')}
                    </option>
                  ),
                )}
              </optgroup>
            ),
          )}

          {/*
            **The heading keeps the words.** *With WConvert Pro* is what named
            this on screen before, and it is what `builder-editors.test.tsx`
            reads — the test asserts that a premium type is NAMED, and it still
            is. There is no link: the upgrade destination does not exist yet,
            and "upgrade here" beside nothing to click is worse than silence.
          */}
          {locked.length > 0 && (
            <optgroup disabled label={__('With WConvert Pro', 'wconvert')}>
              {locked.map((type) => (
                <option key={type.type} value="" disabled>
                  {type.label}
                </option>
              ))}
            </optgroup>
          )}

          {[...byDependency(unavailable)].map(([needs, types]) => (
            <optgroup
              key={needs}
              disabled
              label={sprintf(
                /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
                __('Needs %s', 'wconvert'),
                needs,
              )}
            >
              {types.map((type) => (
                <option key={type.type} value="" disabled>
                  {type.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </p>
  );
}

/**
 * The absent types, grouped by the plugin each is waiting on.
 *
 * In first-seen order, which is manifest order — so the list does not reshuffle
 * when a merchant activates one of two missing plugins.
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
