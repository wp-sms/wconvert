/**
 * `@wordpress/components`, for the block's tests — see the note in
 * `wp-block-editor.tsx` for why these are aliases rather than `vi.mock()`.
 *
 * Each stub renders the semantics the real component renders, so the tests can
 * query by ROLE and stay true if the real markup shifts: `SelectControl` is a
 * labelled `<select>` (a `combobox`), `Notice` is an `alert`, `Placeholder` is
 * a region with a heading.
 */
import type { ReactNode } from 'react';

export function Placeholder({
  label,
  instructions,
  children,
}: {
  label?: string;
  instructions?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-label={label}>
      <h2>{label}</h2>
      <p>{instructions}</p>
      {children}
    </section>
  );
}

export function Notice({ status, children }: { status?: string; children?: ReactNode }) {
  return (
    <div role="alert" data-status={status}>
      {children}
    </div>
  );
}

export function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value?: string;
  options: { label: string; value: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
