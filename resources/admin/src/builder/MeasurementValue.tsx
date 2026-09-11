import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { __, sprintf } from '@wordpress/i18n';
import { measuresOf } from './themes';
import { StyleValueInput } from './StyleValueInput';

const UNITS = ['px', 'rem', 'em', '%', 'ch', 'vw', 'vh'];

/** Number and unit edit one stored CSS value; changing units never guesses a conversion. */
export function MeasurementValue({ id, label, rawLabel, value, fallback, standard, onChange }: {
  id?: string;
  label: string;
  rawLabel: string;
  value: string;
  fallback: string;
  standard: string;
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(false);
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
  if (custom) return <div className="flex min-w-0 items-center gap-2">
    <StyleValueInput type="text" className="regular-text min-w-0 flex-1" aria-label={rawLabel}
      placeholder={fallback} value={shown} onCommit={next => { if (next === '') setCustom(false); onChange(next); }} />
    <Button variant="ghost" size="icon-xs" aria-label={__('Use number and unit', 'wconvert')} onClick={() => setCustom(false)}><ArrowLeft aria-hidden="true" /></Button>
  </div>;
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
        <StyleValueInput id={index === 0 ? id : undefined} type="number" step="any"
          className="wconvert-token__exact min-w-0 flex-1"
          aria-label={sprintf(__('%s amount', 'wconvert'), axis)} value={String(part.amount)}
          onCommit={(amount) => write(index, amount, unit)} />
        <select className="w-auto h-6 min-h-6 py-0 text-xs" aria-label={sprintf(__('%s unit', 'wconvert'), axis)} value={unit}
          onChange={(event) => event.target.value === 'custom' ? setCustom(true) : write(index, String(part.amount), event.target.value)}>
          {unit === '' && <option value="">{__('No unit', 'wconvert')}</option>}
          {UNITS.map((option) => <option key={option} value={option}>{option}</option>)}
          <option value="custom">{__('Custom…', 'wconvert')}</option>
        </select>
      </div>;
    })}
  </div>;
}
