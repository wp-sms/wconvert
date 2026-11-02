import type { ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../components/ui/input';

/**
 * **One search anatomy, one word** (§11): a magnifier in the field, the label
 * for a screen reader, and "Search …" as its name. Campaigns, Settings, the
 * report's campaigns and the gallery filter a list they hold, so they apply as
 * typed. Leads applies on Enter, because each apply is a server query.
 *
 * The rest of the props are the input's: an `id` for a focus return, or Enter
 * opening Settings' first result.
 */
export function PickerSearch({ label, value, onChange, disabled = false, placeholder = label, ...input }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'disabled' | 'placeholder' | 'type' | 'className'>) {
  return <label className="wconvert-picker__search">
    <Search size={17} aria-hidden="true" /><span className="sr-only">{label}</span>
    <Input {...input} type="search" className="ps-9" value={value} disabled={disabled} placeholder={placeholder}
      onChange={event => onChange(event.target.value)} />
  </label>;
}
