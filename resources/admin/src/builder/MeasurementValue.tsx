import { __, sprintf } from '@wordpress/i18n';
import { measuresOf } from './themes';
import { StyleValueInput } from './StyleValueInput';
import { NativeSelect } from '../components/ui/native-select';
import { useAdvanced } from './advanced';

const UNITS = ['px', 'rem', 'em', '%', 'ch', 'vw', 'vh'];

/** Number and unit edit one stored CSS value; changing units never guesses a conversion. */
export function MeasurementValue({ id, label, value, fallback, standard, onChange }: {
  id?: string;
  label: string;
  value: string;
  fallback: string;
  standard: string;
  onChange: (value: string) => void;
}) {
  // Changing the unit is an exact-value choice: Advanced (ADR 0135); plain shows it beside the amount.
  const advanced = useAdvanced();
  const shown = value === '' ? fallback : value;
  const parts = measuresOf(shown);
  if (parts === null) return null;
  const defaults = measuresOf(fallback);
  const declared = measuresOf(standard);
  const original = shown.trim().split(/\s+/);
  const write = (index: number, amount: string, unit: string) => {
    if (amount.trim() === '' || !Number.isFinite(Number(amount))) return;
    onChange(original.map((part, at) => at === index ? `${amount}${unit}` : part).join(' '));
  };
  return <div className="flex min-w-0 w-full flex-col gap-2">
    {parts.map((part, index) => {
      const axis = parts.length === 1 ? label : sprintf(
        /* translators: 1: the style setting. 2: which pair of edges it changes. */
        __('%1$s, %2$s', 'wconvert'), label,
        index === 0 ? __('top and bottom', 'wconvert') : __('sides', 'wconvert'),
      );
      const unit = part.unit || defaults?.[index]?.unit || declared?.[index]?.unit || declared?.[0]?.unit || '';
      return <div key={index} className="flex min-w-0 items-center gap-2">
        {parts.length > 1 && <span className="flex-1 text-note">{index === 0 ? __('Top and bottom', 'wconvert') : __('Sides', 'wconvert')}</span>}
        {/* Amount and unit read as one value, one height, joined (ADR 0132). */}
        <span className="wconvert-measure-input">
          <StyleValueInput id={index === 0 ? id : undefined} type="number" step="any"
            className="wconvert-token__exact min-w-0"
            aria-label={sprintf(__('%s amount', 'wconvert'), axis)} value={String(part.amount)}
            onCommit={(amount) => write(index, amount, unit)} />
          {!advanced ? <span className="wconvert-measure-input__unit" aria-hidden="true">{unit}</span> : <NativeSelect className="wconvert-measure-input__unit" aria-label={sprintf(__('%s unit', 'wconvert'), axis)} value={unit}
            onChange={(event) => write(index, String(part.amount), event.target.value)}>
            {unit !== '' && !UNITS.includes(unit) && <option value={unit}>{unit}</option>}
            {unit === '' && <option value="">{__('No unit', 'wconvert')}</option>}
            {UNITS.map((option) => <option key={option} value={option}>{option}</option>)}
          </NativeSelect>}
        </span>
      </div>;
    })}
  </div>;
}
