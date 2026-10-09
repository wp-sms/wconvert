import { useId } from 'react';
import { formatCount } from '../lib/format';

/** Native one-of-N choices: one tab stop and browser-owned arrow navigation. */
export function OptionStrip({ label, value, options, onChange, disabled = false, className = '' }: {
  label: string; value: string; options: { value: string; label: string; count?: number; disabled?: boolean }[];
  onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const name = useId();
  return <div role="group" aria-label={label} className={`wconvert-option-strip ${className}`}>
    {options.map(option => <label key={option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={disabled || option.disabled}
        onChange={() => onChange(option.value)} />
      <span>{option.label}</span>{option.count !== undefined && <span aria-hidden="true" className="wconvert-picker__option-count">{formatCount(option.count)}</span>}
    </label>)}
  </div>;
}
