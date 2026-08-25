import { __ } from '@wordpress/i18n';
import { ParamField } from './controls';
import { RuleRows, type Row } from './RuleRows';
import { fromRule, toRule } from './presets';
import type { Rule, RuleType } from './api';

/**
 * *When* an Optin fires, and *whether* this visitor is eligible.
 *
 * ============================================================================
 * TWO LISTS, BECAUSE A RULE TYPE IS ONE OR THE OTHER AND NEVER BOTH.
 * ============================================================================
 * `scroll_depth` means "when they reach half way", and there is no second
 * spelling meaning "if they already had" (CONTEXT.md, Condition). The split is
 * load-bearing and fixed per type, so it is two lists on screen rather than
 * one list with a kind column — a column would read as a choice the merchant
 * makes.
 *
 * **One list underneath.** The rules are stored flat and in the merchant's
 * order, and every edit here lands at the rule's own index rather than
 * rebuilding the list from the views. Rebuilding would silently reorder the
 * list into triggers-then-conditions on every save, and the rule list is a
 * screen they look at.
 *
 * **Every rule reaches a row**, including one whose type this build has never
 * heard of. Filtering the flat list down to the two known axes would leave
 * such a rule invisible AND unremovable — still in `config`, still saved back,
 * with nothing on screen to act on. It gets a third list and a way out.
 *
 * **A premium type is named, never drawn disabled.** wp.org Guideline 9 fires
 * on showing a real control the user cannot use, and ADR 0012 answers it the
 * same way at prefill: a free user is given a working rule they can configure,
 * not a locked one they cannot. So `locked` types are a sentence under the
 * list — which is also what a settings list owes a merchant who went hunting
 * for exit intent (ADR 0026).
 */

export interface RulesEditorProps {
  readonly triggers: readonly RuleType[];
  readonly conditions: readonly RuleType[];
  readonly rules: readonly Rule[];
  readonly onChange: (rules: Rule[]) => void;
}

export function RulesEditor({ triggers, conditions, rules, onChange }: RulesEditorProps) {
  const types = [...triggers, ...conditions];

  const replace = (at: number, rule: Rule) => onChange(rules.map((each, index) => (index === at ? rule : each)));
  const remove = (at: number) => onChange(rules.filter((_each, index) => index !== at));
  const add = (rule: Rule) => onChange([...rules, rule]);

  /** The rules of one axis, as `[rule, its index in the flat list]`. */
  const on = (axis: readonly RuleType[]) =>
    rules
      .map((rule, index) => [rule, index] as const)
      .filter(([rule]) => axis.some((type) => type.type === rule.type));

  const unknown = rules
    .map((rule, index) => [rule, index] as const)
    .filter(([rule]) => !types.some((type) => type.type === rule.type));

  const row = ([rule, at]: readonly [Rule, number], removable: boolean): Row => ({
    key: String(at),
    content: <RuleRow rule={rule} at={at} types={types} onChange={(next) => replace(at, next)} />,
    onRemove: removable ? () => remove(at) : null,
  });

  const kept = on(triggers);

  return (
    <>
      <h3>{__('When it shows', 'wconvert')}</h3>
      <p className="description">{__('It fires as soon as any one of these happens.', 'wconvert')}</p>
      {/*
        **Every Optin has at least one Trigger** and "shows immediately" is the
        explicit `page_load` one, never an empty list (CONTEXT.md, Trigger). The
        last one keeps no remove control, and the save route refuses the same
        state — one of those is a screen and the other is the guarantee.
      */}
      <RuleRows rows={kept.map((entry) => row(entry, kept.length > 1))} empty={__('Nothing yet.', 'wconvert')} />
      <AddRule axis={triggers} label={__('Add a trigger', 'wconvert')} onAdd={add} />

      <h3>{__('Who sees it', 'wconvert')}</h3>
      <p className="description">{__('Every one of these must hold at the moment it fires.', 'wconvert')}</p>
      <RuleRows
        rows={on(conditions).map((entry) => row(entry, true))}
        empty={__('Nothing yet.', 'wconvert')}
      />
      <AddRule axis={conditions} label={__('Add a condition', 'wconvert')} onAdd={add} />

      {unknown.length > 0 && (
        <>
          <h3>{__('Not available on this site', 'wconvert')}</h3>
          <p className="description">
            {__('These rules are still saved with the Optin. Remove one if you no longer want it.', 'wconvert')}
          </p>
          <RuleRows rows={unknown.map((entry) => row(entry, true))} empty="" />
        </>
      )}
    </>
  );
}

interface RuleRowProps {
  readonly rule: Rule;
  /** Its index in the flat list, which is what makes each control's id unique. */
  readonly at: number;
  readonly types: readonly RuleType[];
  readonly onChange: (rule: Rule) => void;
}

function RuleRow({ rule, at, types, onChange }: RuleRowProps) {
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

  const { type, preset, values, filled } = read;
  const editable = Object.entries(type.params).filter(([param]) => !(preset !== null && param in preset.fixed));

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
            onChange(toRule(type, type.presets.find((each) => each.id === event.target.value) ?? null, values))
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
          onChange={(value) => onChange(toRule(type, preset, { ...filled, [param]: value }))}
        />
      ))}
      {/*
        Where a rule was substituted by degradation, its row carries a
        PERSISTENT inline note here — never a dismissible banner, which is
        dismissed once and leaves the Optin carrying an invisible substitution
        forever (ADR 0012). The marker that anchors it is `degraded_from`, and
        it arrives with the degradation ticket; note that
        `RuleVocabulary::normalize()` keeps only params the manifest declares,
        so the marker has to be declared there or it will not survive a save.
        The `locked` note below is the same surface, for the case that needs no
        marker: a rule authored with Pro and running without it.
      */}
      {type.availability === 'locked' && (
        <p className="wconvert-rule__note">{__('Needs WConvert Pro to run.', 'wconvert')}</p>
      )}
    </>
  );
}

/**
 * The add control: every type this install can run, and every legible shortcut
 * over it.
 *
 * One `<select>` with a group per type rather than a type picker followed by a
 * preset picker, because "after a few seconds" is one decision and asking for
 * it in two steps makes the merchant learn that it is `time_on_page`
 * underneath — which is exactly what a preset exists to spare them.
 */
function AddRule({
  axis,
  label,
  onAdd,
}: {
  axis: readonly RuleType[];
  label: string;
  onAdd: (rule: Rule) => void;
}) {
  const ready = axis.filter((type) => type.availability === 'ready');
  const locked = axis.filter((type) => type.availability === 'locked');

  return (
    <p>
      <label>
        {label}{' '}
        <select
          value=""
          onChange={(event) => {
            const [type, presetId] = event.target.value.split('|');
            const chosen = ready.find((each) => each.type === type);

            if (chosen !== undefined) {
              onAdd(toRule(chosen, chosen.presets.find((each) => each.id === presetId) ?? null, {}));
            }
          }}
        >
          <option value="">{__('Choose…', 'wconvert')}</option>
          {ready.map((type) => (
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
      {locked.length > 0 && (
        // Named rather than drawn disabled (Guideline 9), and named rather
        // than hidden: a settings list the merchant went hunting through
        // explains the gap, where the creation flow's front door hides one
        // (ADR 0026).
        <span className="wconvert-upsell">
          {' '}
          {__('With WConvert Pro:', 'wconvert')} {locked.map((type) => type.label).join(', ')}
        </span>
      )}
    </p>
  );
}
