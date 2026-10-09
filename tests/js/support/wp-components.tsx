/**
 * `@wordpress/components`, for the block's tests — see the note in
 * `wp-block-editor.tsx` for why these are aliases rather than `vi.mock()`.
 *
 * Each stub renders the semantics the real component renders, so the tests can
 * query by ROLE and stay true if the real markup shifts: `ComboboxControl` is a
 * labelled `combobox`, `Notice` is an `alert`, `Placeholder` is a region with a
 * heading.
 */
import { forwardRef, type ReactNode } from 'react';

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

/** A link when given `href`, as WordPress's is. */
export const Button = forwardRef<HTMLButtonElement, { children?: ReactNode; onClick?(): void; disabled?: boolean; 'aria-label'?: string; href?: string; target?: string; rel?: string }>(function Button({ children, onClick, disabled, 'aria-label': label, href, target, rel }, ref) {
  if (href !== undefined) return <a href={href} target={target} rel={rel} aria-label={label}>{children}</a>;
  return <button ref={ref} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
});
export function ComboboxControl({ label, value, options, onChange }: { label: string; value: string | null; options: {label: string; value: string; disabled?: boolean}[]; onChange(value: string): void }) {
  return <label>{label}<select role="combobox" value={value ?? ''} onChange={event => onChange(event.target.value)}>
    {[{ label: 'Choose', value: '' }, ...options].map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
  </select></label>;
}
