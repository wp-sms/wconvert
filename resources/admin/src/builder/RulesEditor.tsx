import { __ } from '@wordpress/i18n';
import { ParamControl } from './controls';
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
 * rebuilding the list from the two views. Rebuilding would silently reorder
 * the list into triggers-then-conditions on every save, and the rule list is
 * a screen they look at.
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

  const kept = on(triggers).length;

  return (
    <>
      <h3>{__('When it shows', 'wconvert')}</h3>
      <p className="description">
        {__('It fires as soon as any one of these happens.', 'wconvert')}
      </p>
      <RuleList
        rows={on(triggers)}
        types={types}
        // **Every Optin has at least one Trigger** and "shows immediately" is
        // the explicit `page_load` one, never an empty list (CONTEXT.md,
        // Trigger). The last one keeps no remove control, and the save route
        // refuses the same state — one of those is a screen and the other is
        // the guarantee.
        removable={kept > 1}
        onReplace={replace}
        onRemove={remove}
      />
      <AddRule axis={triggers} label={__('Add a trigger', 'wconvert')} onAdd={add} />

      <h3>{__('Who sees it', 'wconvert')}</h3>
      <p className="description">
        {__('Every one of these must hold at the moment it fires.', 'wconvert')}
      </p>
      <RuleList rows={on(conditions)} types={types} removable onReplace={replace} onRemove={remove} />
      <AddRule axis={conditions} label={__('Add a condition', 'wconvert')} onAdd={add} />
    </>
  );
}

interface RuleListProps {
  readonly rows: readonly (readonly [Rule, number])[];
  readonly types: readonly RuleType[];
  readonly removable: boolean;
  readonly onReplace: (at: number, rule: Rule) => void;
  readonly onRemove: (at: number) => void;
}

function RuleList({ rows, types, removable, onReplace, onRemove }: RuleListProps) {
  if (rows.length === 0) {
    return <p className="wconvert-rules__empty">{__('Nothing yet.', 'wconvert')}</p>;
  }

  return (
    <ul className="wconvert-rules">
      {rows.map(([rule, at]) => (
        <li key={at} className="wconvert-rule">
          <RuleRow
            rule={rule}
            types={types}
            onChange={(next) => onReplace(at, next)}
            onRemove={removable ? () => onRemove(at) : null}
          />
        </li>
      ))}
    </ul>
  );
}

interface RuleRowProps {
  readonly rule: Rule;
  readonly types: readonly RuleType[];
  readonly onChange: (rule: Rule) => void;
  readonly onRemove: (() => void) | null;
}

function RuleRow({ rule, types, onChange, onRemove }: RuleRowProps) {
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
        {onRemove !== null && <RemoveButton onClick={onRemove} />}
      </>
    );
  }

  const { type, preset, filled } = read;
  const editable = Object.entries(type.params).filter(([param]) => !(preset !== null && param in preset.fixed));

  return (
    <>
      <strong>{type.label}</strong>{' '}
      {type.presets.length > 0 && (
        <select
          aria-label={type.label}
          value={preset?.id ?? ''}
          onChange={(event) =>
            onChange(toRule(type, type.presets.find((each) => each.id === event.target.value) ?? null, filled))
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
        <label key={param} className="wconvert-rule__param">
          {declaration.label}{' '}
          <ParamControl
            id={`wconvert-rule-${type.type}-${param}`}
            param={declaration}
            value={filled[param]}
            onChange={(value) => onChange(toRule(type, preset, { ...filled, [param]: value }))}
          />
        </label>
      ))}
      {onRemove !== null && <RemoveButton onClick={onRemove} />}
      {/*
        Where a rule was substituted by degradation, its row carries a
        PERSISTENT inline note here — never a dismissible banner, which is
        dismissed once and leaves the Optin carrying an invisible substitution
        forever (ADR 0012). The marker that anchors it is `degraded_from`, and
        it arrives with the degradation ticket; this is the surface it renders
        on. The `locked` note below is the same shape, for the case that needs
        no marker: a rule authored with Pro and running without it.
      */}
      {type.availability === 'locked' && (
        <p className="wconvert-rule__note">{__('Needs WConvert Pro to run.', 'wconvert')}</p>
      )}
    </>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button-link button-link-delete" onClick={onClick}>
      {__('Remove', 'wconvert')}
    </button>
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
