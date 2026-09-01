import { Fragment } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Lock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
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

      <Absent locked={on('upsell')} unavailable={on('explain')} />
    </>
  );
}

/**
 * What this install cannot run, as one compact list.
 *
 * ============================================================================
 * THE REASON IS THE SAME FOR EVERY ITEM IN A GROUP, SO IT IS SAID ONCE.
 * ============================================================================
 * This was two blocks of grid cards, each card repeating the sentence its
 * neighbour had just made: *"Cart is worth at least — Needs WooCommerce on
 * this site."* beside *"Has something in their cart — Needs WooCommerce on
 * this site."* Two hundred pixels to say one thing twice, under a heading that
 * said it a third time.
 *
 * A definition list is what the content actually is: the reason is the TERM
 * and the capabilities it covers are the description. So the reason is stated
 * once, as the label of the group, and each capability is a chip.
 *
 * **And the unavailable ones are grouped BY what they need.** An install
 * missing WooCommerce and WP SMS gets two honest lines rather than one lumped
 * "not available on this site", which is ADR 0026's own argument — a merchant
 * who deactivated something should not have to guess which of their plugins
 * did it — applied to the shape rather than only to the words.
 *
 * ============================================================================
 * TWO GROUPS AND NEVER ONE.
 * ============================================================================
 * `locked` is buyable from us and `unavailable` is not. Collapsing them offers
 * a merchant with no store a WooCommerce licence we do not sell, and shows a
 * paying Pro customer an advertisement for Pro. The cascade is
 * `renderingFor`'s, shared with the goal screen and the Destinations list.
 *
 * **The heading keeps the words.** *With WConvert Pro:* is what named this on
 * screen before and it is what `builder-editors.test.tsx` reads — the test
 * asserts that a premium type is NAMED, and it still is.
 *
 * **Metadata, never a disabled control.** wp.org Guideline 9 fires on showing
 * a real control the user cannot use, and the premium code genuinely is not in
 * this bundle — there is nothing here to disable. A chip carries the type's
 * label from PHP and nothing a click could reach (ADR 0015). There is no link,
 * because the upgrade destination does not exist yet and "upgrade here" beside
 * nothing to click is worse than saying nothing.
 */
function Absent({ locked, unavailable }: { locked: readonly RuleType[]; unavailable: readonly RuleType[] }) {
  if (locked.length === 0 && unavailable.length === 0) {
    return null;
  }

  return (
    <dl className="wconvert-absent">
      {locked.length > 0 && (
        <>
          <dt className="text-micro uppercase text-muted-foreground">
            {__('With WConvert Pro:', 'wconvert')}
          </dt>
          <dd>
            {locked.map((type) => (
              <Badge key={type.type} variant="secondary">
                <Lock aria-hidden="true" />
                {type.label}
              </Badge>
            ))}
          </dd>
        </>
      )}

      {[...byDependency(unavailable)].map(([needs, types]) => (
        <Fragment key={needs}>
          <dt className="text-micro uppercase text-muted-foreground">
            {sprintf(
              /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
              __('Needs %s:', 'wconvert'),
              needs
            )}
          </dt>
          <dd>
            {types.map((type) => (
              // Amber is the meaning it already carries on the Optin list: the
              // SITE is holding this back, and it is not ours to sell
              // (ADR 0026, ADR 0037). No lock — a lock says "buy it".
              <Badge key={type.type} variant="warning">
                {type.label}
              </Badge>
            ))}
          </dd>
        </Fragment>
      ))}
    </dl>
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
