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

export function RuleRows({ rows, empty, attention = false }: { rows: readonly Row[]; empty: string; attention?: boolean }) {
  if (rows.length === 0) {
    // A description by role — *"Nowhere is excluded."* explains the list it
    // stands in for, and at body size it read as content rather than as the
    // absence of it (ADR 0037's `note`).
    return <p className="wconvert-rules__empty text-note" data-attention={attention || undefined}>{empty}</p>;
  }

  return (
    <ul className="wconvert-rules">
      {rows.map((row) => (
        <li key={row.key} className="wconvert-rule">
          {row.content}
          {/*
            ================================================================
            NOT `button-link-delete`, AND THE RED WAS DOING REAL DAMAGE.
            ================================================================
            WordPress's delete red is right for a control that destroys stored
            data — the Optin list's Delete earns it. Taking a rule out of a
            draft list does not: nothing is destroyed, the change is not saved
            until the merchant saves, and the rule can be added back from the
            control directly below.

            What it cost was the one thing red is for. Measured on the built
            screen, `Remove` was the loudest element in every row and sat
            immediately under the amber caution on a section that needed
            attention — so the row read as an error state and the sentence
            that WAS the warning had to compete with it. A quiet control puts
            the emphasis back on the thing that earned it.
          */}
          {row.onRemove !== null && (
            <button type="button" className="button-link wconvert-rule__remove" onClick={row.onRemove}>
              {__('Remove', 'wconvert')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
