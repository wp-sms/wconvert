import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { RuleRows, type Row } from '../RuleRows';
import { AddRule } from './AddRule';
import { RuleRow } from './RuleRow';
import { IMMEDIATELY, idleTriggers, repeatable } from './sentence';
import type { Entry } from './axis';
import type { Rule, RuleType } from '../api';

/**
 * *When* it fires — the [[Trigger]] axis, as the When section's body.
 *
 * ============================================================================
 * "SHOWS IMMEDIATELY" IS A MODE, NOT A MEMBER OF THE LIST.
 * ============================================================================
 * This section was a flat list with an add control, which let a merchant
 * choose *shows immediately* AND *after a few seconds* and told them nothing.
 * That combination is not a preference, it is a mistake: `page_load`'s module
 * is `holds: () => true`, Triggers are ORed, so the Optin fires the instant its
 * Conditions hold and **no other Trigger can ever be the reason**. The five
 * seconds decides nothing, and the screen agreed with them.
 *
 * So the first thing this section asks is the question the model is actually
 * asking: **do you want it to wait?** One answer is `page_load` and the other
 * is a list. Nothing about the rule model changes — it is still one flat,
 * ORed axis, and `page_load` is still the explicit Trigger that keeps "fires
 * at once" and "can never fire" different values (CONTEXT.md, Trigger).
 *
 * ============================================================================
 * NEITHER ANSWER DELETES A RULE, AND AN EXISTING MISTAKE IS SHOWN RATHER THAN
 * HIDDEN.
 * ============================================================================
 * Choosing *immediately* adds `page_load`; choosing *wait* removes only
 * `page_load`. So flipping between them is free, and a merchant experimenting
 * loses nothing.
 *
 * An Optin that already carries both — saved before this screen existed, or
 * prefilled by a [[Playbook]] — still lists every Trigger it has, each with a
 * note saying it never runs. Hiding them would be the failure the Unknown
 * section exists to prevent: a rule still in `config`, still saved back, with
 * nothing on screen to act on.
 *
 * ============================================================================
 * IT IS HANDED ENTRIES AND THREE CALLBACKS. IT NEVER SEES A FILTERED COPY.
 * ============================================================================
 * The rules are stored FLAT and in the merchant's own order, and every edit
 * lands at the rule's own index. Splitting the screen into four files is
 * exactly where that invariant would quietly be lost, so it is made
 * structural: this component is given `[rule, index]` pairs and has no array
 * of its own to rebuild.
 */
export interface WhenProps {
  readonly types: readonly RuleType[];
  readonly entries: readonly Entry[];
  readonly replace: (at: number, rule: Rule) => void;
  readonly remove: (at: number) => void;
  readonly add: (rule: Rule) => void;
  /** Every type on every axis, so a row can name what its rule stands in for. */
  readonly all: readonly RuleType[];
}

export function When({ types, entries, replace, remove, add, all }: WhenProps) {
  const immediate = entries.find(([rule]) => rule.type === IMMEDIATELY);
  const waiting = entries.filter(([rule]) => rule.type !== IMMEDIATELY);
  // Which of them can never be the reason it fired. `page_load` makes every
  // other one idle; so does a lower threshold of the same type — *"after 8
  // seconds or after 20 seconds"* is *"after 8 seconds"*.
  const idle = idleTriggers(entries, all);

  // The vocabulary's own words for it — "Shows immediately" is `RuleLabels`',
  // where `make-pot` can see it, so this option is not a second spelling of a
  // rule name in TypeScript.
  const immediately = types.find((type) => type.type === IMMEDIATELY);

  // **Every Optin has at least one Trigger** and the save route refuses the
  // same state (CONTEXT.md, Trigger). The last one in the list keeps no remove
  // control — unless `page_load` is carrying the Optin, in which case every
  // row in this list is removable BECAUSE none of them does anything.
  const removable = immediate !== undefined || waiting.length > 1;

  const rows: Row[] = waiting.map(([rule, at]) => ({
    key: String(at),
    content: (
      <>
        <RuleRow rule={rule} at={at} types={all} onChange={(next) => replace(at, next)} />
        {/*
          Not a warning about a broken rule — the rule is fine. It is a rule
          that cannot be the reason anything happened, and saying so on its own
          row is what stops the merchant tuning a number that decides nothing.

          Two sentences rather than one, because the merchant's next move
          differs: an Optin that shows immediately is fixed by the radio above,
          and a trigger behind an earlier one of its own kind is fixed by
          changing either number.
        */}
        {idle.has(at) && (
          <p className="wconvert-rule__note text-note">
            {immediate !== undefined
              ? __('This never runs — the Campaign already shows as soon as the page loads.', 'wconvert')
              : __('This never runs — a trigger of the same kind always fires before it.', 'wconvert')}
          </p>
        )}
      </>
    ),
    onRemove: removable ? () => remove(at) : null,
  }));

  return (
    <>
      {/*
        `wconvert-wait`, not `wconvert-choice` — that class is already the
        segmented control in `Tokens` and `BlockInspector`, and a second
        component wearing it inherits a border, a hover and a checked state
        written for something else. Measured on the built screen before it was
        renamed.
      */}
      <fieldset className="wconvert-wait">
        {/*
          The section's own label already says "When", so this legend names the
          decision rather than repeating it. It is a real `<legend>` because
          two radios with no group name are two unrelated controls to anything
          not looking at the screen.
        */}
        <legend className="wconvert-wait__legend text-micro uppercase text-muted-foreground">
          {__('Choose the moment', 'wconvert')}
        </legend>

        <div className="wconvert-wait__options">
          <label className="wconvert-wait__option text-body">
            <input
              type="radio"
              name="wconvert-when"
              checked={immediate !== undefined}
              onChange={() => immediate === undefined && add({ type: IMMEDIATELY })}
            />{' '}
            {immediately?.label ?? __('Shows immediately', 'wconvert')}
          </label>

          <label className="wconvert-wait__option text-body">
            <input
              type="radio"
              name="wconvert-when"
              checked={immediate === undefined}
              // Removes ONLY `page_load`. The merchant's other Triggers are
              // theirs, and this is a question about waiting rather than a
              // clear-and-start-again.
              onChange={() => immediate !== undefined && remove(immediate[1])}
            />{' '}
            {__('Wait for one of these actions', 'wconvert')}
          </label>
        </div>
      </fieldset>

      {immediate === undefined && (
        <Description className="mb-1">{__('Any one of these can show the Campaign, when the page, audience and limits allow.', 'wconvert')}</Description>
      )}

      <RuleRows
        rows={rows}
        empty={
          immediate === undefined
            ? __('Choose an action below so this Campaign has a moment to appear.', 'wconvert')
            : ''
        }
      />

      {/*
        No add control while `page_load` is carrying the Optin: anything added
        here would be a rule that never runs, offered by us. `page_load` itself
        is never in the list either — it is the radio above, and offering it
        twice is two controls for one decision.
      */}
      {immediate === undefined && (
        <AddRule
          axis={types.filter(
            (type) =>
              // `page_load` is the radio above, and one decision gets one
              // control.
              type.type !== IMMEDIATELY &&
              // ==================================================================
              // AND A TYPE THAT CAN ONLY BE SET ONCE IS OFFERED ONCE.
              // ==================================================================
              // A second *Time on the page* is never what anyone wants: the
              // lower threshold always fires and the other is dead. A second
              // *About to leave* is the same rule written twice. Only a type
              // whose params say WHICH thing — a selector — is two triggers
              // when there are two of it.
              //
              // Offered and then explained was the shape before this: the
              // merchant could make the mistake and got a notice about it. Not
              // offering it is the better screen, and the notice stays only for
              // rules that were already stored.
              (repeatable(type) || !waiting.some(([rule]) => rule.type === type.type)),
          )}
          label={__('Add a trigger', 'wconvert')}
          onAdd={add}
        />
      )}
    </>
  );
}
