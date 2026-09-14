import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Link, Unlink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { MeasurementValue } from './MeasurementValue';
import { StyleValueInput } from './StyleValueInput';
import { measuresOf } from './themes';

/** Expand CSS padding without trying to reinterpret expressions or logical sides. */
export function spacingSides(value: string): string[] | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 4 || parts.some(part => {
    const parsed = measuresOf(part);
    return parsed === null || parsed[0].amount < 0;
  })) return null;
  const [top, right = top, bottom = top, left = right] = parts;
  return [top, right, bottom, left];
}

export function SpacingField({ label, shown, fallback, standard, reset, onChange }: {
  label: string; shown: string; fallback: string; standard: string; reset: ReactNode;
  onChange: (value: string) => void;
}) {
  const sides = spacingSides(shown);
  const [separate, setSeparate] = useState(false);
  const [custom, setCustom] = useState(false);
  const linked = sides !== null && sides.every(side => side === sides[0]) && !separate;
  const names = [__('Top', 'wconvert'), __('Right', 'wconvert'), __('Bottom', 'wconvert'), __('Left', 'wconvert')];
  return <fieldset className="wconvert-token min-w-0">
    <legend>{label}</legend>
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="xs" disabled={sides === null || custom}
        aria-pressed={linked} onClick={() => {
          if (linked) setSeparate(true);
          else { setSeparate(false); onChange(sides![0]); }
        }}>
        {linked ? <Link aria-hidden="true" /> : <Unlink aria-hidden="true" />}
        {linked ? __('All sides together', 'wconvert') : __('Link all sides', 'wconvert')}
      </Button>
      {reset}
    </div>
    {!linked && sides !== null && !custom && <p className="m-0 mb-2 text-note text-muted-foreground">{__('Linking uses the top value for every side.', 'wconvert')}</p>}
    {custom || sides === null ? <StyleValueInput type="text" className="regular-text" aria-label={sprintf(__('%s custom value', 'wconvert'), label)} value={shown} placeholder={fallback} onCommit={onChange} />
      : <div className="grid gap-2">
        {(linked ? sides.slice(0, 1) : sides).map((side, index) => <div key={index} className="flex min-w-0 items-center gap-2">
          {!linked && <span className="w-12 shrink-0 text-note">{names[index]}</span>}
          <MeasurementValue allowCustom={false} label={linked ? label : `${label}, ${names[index]}`} rawLabel={`${label}, ${names[index]}`}
            value={side} fallback={side} standard={standard} onChange={value => {
              if (spacingSides(value)?.length !== 4 || value.trim().split(/\s+/).length !== 1) return;
              onChange(linked ? value : sides.map((held, at) => at === index ? value : held).join(' '));
            }} />
        </div>)}
      </div>}
    {sides !== null && <Button type="button" variant="ghost" size="xs" className="mt-1"
      onClick={() => setCustom(!custom)}>{custom ? __('Use side controls', 'wconvert') : __('Custom CSS', 'wconvert')}</Button>}
  </fieldset>;
}
