import { useId, type ReactNode } from 'react';

export interface ChoiceChip<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
}

/**
 * One-of-N as chips — native radios in a `role="group"`, the selected and
 * focus treatments on the label (GUIDELINES §7). The same control the Quick
 * picks draw, for the choices on this tab that are not picks: placement
 * method, position in the content.
 */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: {
  readonly label: string;
  readonly options: readonly ChoiceChip<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const name = useId();
  return <div role="group" aria-label={label} className="wconvert-quick-picks">
    {options.map(option => <label key={option.value} className="wconvert-quick-pick">
      <input type="radio" className="sr-only" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      {option.label}
    </label>)}
  </div>;
}
