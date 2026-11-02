import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatCount } from '../lib/format';

/**
 * Native one-of-N choices: one tab stop and browser-owned arrow navigation. An
 * option with an icon draws only the icon, and its label stays its name.
 */
export function OptionStrip({ label, value, options, onChange, disabled = false, className = '' }: {
  label: string; value: string; options: { value: string; label: string; icon?: LucideIcon; count?: number; disabled?: boolean }[];
  onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const name = useId();
  return <div role="group" aria-label={label} className={`wconvert-option-strip ${className}`}>
    {options.map(option => <label key={option.value} title={option.icon ? option.label : undefined}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={disabled || option.disabled}
        onChange={() => onChange(option.value)} />
      {option.icon ? <><option.icon size={16} aria-hidden="true" /><span className="sr-only">{option.label}</span></> : <span>{option.label}</span>}{option.count !== undefined && <span aria-hidden="true" className="wconvert-picker__option-count">{formatCount(option.count)}</span>}
    </label>)}
  </div>;
}
