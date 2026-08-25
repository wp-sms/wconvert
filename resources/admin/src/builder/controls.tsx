import { __ } from '@wordpress/i18n';
import type { RuleParam } from './api';

/**
 * One control per param kind — the whole of what the rules UI can draw.
 *
 * ============================================================================
 * THE REAL OR CASES ARE SET-VALUED SCALARS. THERE IS NO GROUPING UI.
 * ============================================================================
 * "Mobile or tablet", "from Google or Bing" — one rule carrying several
 * values, never two rules under an `or` (ADR 0005). So the two set controls
 * here take a LIST on one rule and there is nowhere in this file to nest a
 * condition inside another: no group, no bracket, no `any of / all of`. The
 * nesting ceiling is recorded as permanent rather than "not in v1" precisely
 * because "we'll add OR later" is the path by which an expression language
 * arrives, and a builder that drew the brackets would be that path.
 *
 * The kinds are spelled here as well as in the rule manifest, which is the
 * same duplicate `goals/availability.ts` carries: there is nothing else about
 * a control to declare, so a file between the two would have one column.
 * `tests/js/builder-controls.test.tsx` is what stops them drifting — it asks
 * this component for every kind the manifest names and looks at what came
 * back.
 */

export interface ParamControlProps {
  readonly id: string;
  readonly param: RuleParam;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}

export function ParamControl({ id, param, value, onChange }: ParamControlProps) {
  switch (param.control) {
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );

    case 'seconds':
    case 'percent':
      return (
        <input
          id={id}
          type="number"
          className="small-text"
          min={0}
          max={param.control === 'percent' ? 100 : undefined}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      );

    case 'post_id':
    case 'term_id':
      return (
        <input
          id={id}
          type="number"
          className="small-text"
          min={1}
          // Held as a string, because that is what a Targeting rule stores:
          // `TargetingRule` casts its scalar to one on the way in, and a
          // number here would round-trip to a different value than the one
          // that was saved.
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'post_type':
      return (
        <select id={id} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">{__('Choose…', 'wconvert')}</option>
          {param.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'device_set':
      return <OptionSet id={id} param={param} value={value} onChange={onChange} />;

    case 'text_set':
      return <ValueList id={id} value={value} onChange={onChange} />;

    default:
      return (
        <input
          id={id}
          type="text"
          className="regular-text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        />
      );
  }
}

/** A set drawn from a closed list — several values on ONE rule (ADR 0005). */
function OptionSet({ id, param, value, onChange }: ParamControlProps) {
  const chosen = Array.isArray(value) ? (value as unknown[]) : [];

  return (
    <fieldset id={id} className="wconvert-option-set">
      {param.options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={chosen.includes(option.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? // Rebuilt in the option order rather than appended, so two
                    // rules choosing the same buckets in a different order are
                    // the same rule. Otherwise the panel would draw one preset
                    // for one of them and "custom" for the other.
                    param.options.map((each) => each.value).filter((each) => each === option.value || chosen.includes(each))
                  : chosen.filter((each) => each !== option.value),
              )
            }
          />{' '}
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/** A set the merchant types — one value per row, and no way to nest one. */
function ValueList({ id, value, onChange }: Omit<ParamControlProps, 'param'>) {
  const values = (Array.isArray(value) ? (value as unknown[]) : []).map((each) => String(each));
  // Always one empty row at the end, so adding a value is typing rather than
  // finding a button first.
  const rows = [...values, ''];

  const write = (at: number, next: string) =>
    onChange(rows.map((row, index) => (index === at ? next : row)).filter((row) => row !== ''));

  return (
    <span className="wconvert-value-list" id={id}>
      {rows.map((row, index) => (
        <span key={index}>
          <input
            type="text"
            className="regular-text"
            value={row}
            onChange={(event) => write(index, event.target.value)}
          />
          {row !== '' && (
            <button type="button" className="button-link" onClick={() => write(index, '')}>
              {__('Remove', 'wconvert')}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
