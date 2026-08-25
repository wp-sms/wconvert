import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';

/**
 * The list shell all three rule lists share — Triggers, Conditions, and each
 * half of the Targeting picker.
 *
 * **What is shared is the shell, not the row.** A client rule is `{type,
 * ...params}` edited through presets; a Targeting rule is `{type, value}`
 * edited through one typed control. Folding those into one row component would
 * mean a component that takes a discriminator and branches, which is the
 * matrix each editor exists to avoid. What genuinely repeats is the frame — an
 * empty state, a list, and a way out of each row — so that is what lives here.
 *
 * The add controls stay with their editors for the same reason: one offers a
 * group per type with a preset in each, the other a flat list of five page
 * rules, and they are the same shape only in the sense that both are
 * `<select>`s.
 */

export interface Row {
  /** Stable across a re-render — the rule's index in the flat list it is stored in. */
  readonly key: string;
  readonly content: ReactNode;
  /** Null where this row may not be removed, which is not the same as a disabled button. */
  readonly onRemove: (() => void) | null;
}

export function RuleRows({ rows, empty }: { rows: readonly Row[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="wconvert-rules__empty">{empty}</p>;
  }

  return (
    <ul className="wconvert-rules">
      {rows.map((row) => (
        <li key={row.key} className="wconvert-rule">
          {row.content}
          {row.onRemove !== null && (
            <button type="button" className="button-link button-link-delete" onClick={row.onRemove}>
              {__('Remove', 'wconvert')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
