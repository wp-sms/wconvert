import { useId, type ComponentProps, type ReactNode } from 'react';

/**
 * **The one checkbox and radio row** (GUIDELINES §7, ADR 0131): an 18px native
 * input inside its `<label>`, on the first text line, 8px from the words. The
 * hint is a `note` under the label TEXT, not under the box, and is the input's
 * description rather than part of its name. The geometry is the shared rule in
 * `index.css`; this component is the markup that rule expects.
 */
export function CheckRow({
  label,
  hint,
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'children'> & { label: ReactNode; hint?: ReactNode; type?: 'checkbox' | 'radio' }) {
  const id = useId();
  return (
    <label className={className}>
      <input type="checkbox" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      <span className="min-w-0">
        {label}
        {hint && (
          <span id={`${id}-hint`} className="block text-note text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
