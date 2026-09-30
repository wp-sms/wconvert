import { Search } from 'lucide-react';
import { Input } from '../components/ui/input';

/** One search anatomy for setup, design and pack browsing. */
export function PickerSearch({ label, value, onChange, disabled = false, placeholder = label }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string;
}) {
  return <label className="wconvert-picker__search">
    <Search size={17} aria-hidden="true" /><span className="sr-only">{label}</span>
    <Input type="search" className="ps-9" value={value} disabled={disabled} placeholder={placeholder}
      onChange={event => onChange(event.target.value)} />
  </label>;
}
