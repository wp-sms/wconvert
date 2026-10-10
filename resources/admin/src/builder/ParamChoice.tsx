import { __, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import { isChoiceHeld, valueOfChoice } from './panel';
import { CheckRow } from '../shell/CheckRow';
import { FieldHeading } from './PanelSection';

/** One manifest setting: checkbox for booleans, select for words, radios for pictures.
 * Preserve unlisted stored values and use the manifest default only when absent.
 * Every explicit selection passes through valueOfChoice so numbers and flags keep
 * the types expected by the renderer and capture endpoint.
 */
export function ParamChoice({
  id,
  label,
  offered,
  held,
  fallback,
  nameOfValue,
  renderChoice,
  columns,
  compact = false,
  onChange,
}: {
  /** A stable key for the radio group — never a translated string. */
  readonly id: string;
  readonly label: string;
  readonly offered: readonly string[];
  /** What the node holds, which may be absent and may be off the list. */
  readonly held: unknown;
  /**
   * What the renderer draws where it holds nothing — the manifest's declared
   * default, never a guess made here.
   */
  readonly fallback?: string;
  readonly nameOfValue: (choice: string) => string;
  /**
   * A picture for a value, where the values ARE pictures.
   *
   * Whatever it returns sits above the word rather than instead of it: the word
   * is the accessible name, it is already translated, and `TemplateLabels`'s
   * `icon.name.*` entries carry translator notes saying what each one is FOR.
   * The picture is `aria-hidden` for the same reason it is in the renderer —
   * *"check, Free shipping"* is noise.
   */
  readonly renderChoice?: (choice: string) => ReactNode;
  /** Wider previews get equal-sized tiles; ordinary choices remain compact chips. */
  readonly columns?: 2 | 3;
  /** Icon-only choices retain accessible names and hover titles. */
  readonly compact?: boolean;
  readonly onChange: (value: unknown) => void;
}) {
  if (offered.length === 0) {
    return null;
  }

  const selected = offered.find(choice => isChoiceHeld(held, choice, fallback));
  if (renderChoice === undefined) {
    if (offered.length === 2 && offered.includes('true') && offered.includes('false') && selected !== undefined) {
      return <CheckRow className="wconvert-check" label={label} checked={selected === 'true'} onChange={event => onChange(event.target.checked)} />;
    }
    return <div className="wconvert-token">
      <FieldHeading label={label} htmlFor={`wconvert-param-${id}`} />
      <select id={`wconvert-param-${id}`} value={selected ?? '__current'} onChange={event => onChange(valueOfChoice(event.target.value))}>
        {selected === undefined && <option value="__current" disabled>{held === undefined && fallback === undefined
          ? __('Choose…', 'wconvert') : sprintf(__('Current: %s', 'wconvert'), String(held ?? fallback))}</option>}
        {offered.map(choice => <option key={choice} value={choice}>{nameOfValue(choice)}</option>)}
      </select>
    </div>;
  }

  return (
    <div className="wconvert-token">
      <FieldHeading as="span" label={label} labelId={`wconvert-param-${id}`} />
      {/*
        **A group with a name, because a set of radios is one control.** Without
        it a screen reader announces four unrelated buttons and never the
        question they answer — and the question is the whole of what
        distinguishes *Required* from *Optional*.
      */}
      <span role="group" aria-labelledby={`wconvert-param-${id}`} className={compact ? 'wconvert-choice-set wconvert-choice-set--icons' : columns ? 'wconvert-choice-set wconvert-choice-set--tiles' : 'wconvert-choice-set'} style={!compact && columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {offered.map((choice) => (
          <label key={choice} className="wconvert-choice" title={compact ? nameOfValue(choice) : undefined}>
            <input
              type="radio"
              className="sr-only"
              name={`wconvert-param-${id}`}
              value={choice}
              checked={isChoiceHeld(held, choice, fallback)}
              onChange={() => onChange(valueOfChoice(choice))}
            />
            <span
              className={
                renderChoice === undefined
                  ? 'wconvert-choice__label'
                  : 'wconvert-choice__label wconvert-choice__label--pictured'
              }
            >
              {renderChoice?.(choice)}
              <span className={compact ? "sr-only" : undefined}>{nameOfValue(choice)}</span>
            </span>
          </label>
        ))}
      </span>
    </div>
  );
}
