import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CodeXml, Link, Unlink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { MeasurementValue } from './MeasurementValue';
import { cssOnlyNote, useAdvanced } from './advanced';
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
  // The CSS box is an exact value: Advanced (ADR 0135).
  const advanced = useAdvanced();
  const linked = sides !== null && sides.every(side => side === sides[0]) && !separate;
  const names = [__('Top', 'wconvert'), __('Right', 'wconvert'), __('Bottom', 'wconvert'), __('Left', 'wconvert')];
  return <fieldset className="wconvert-token min-w-0">
    <legend className="sr-only">{label}</legend>
    <div className="wconvert-field-heading">
      <span aria-hidden="true">{label}</span>
      <span className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-xs" disabled={sides === null || custom}
          aria-label={linked ? __('All sides together', 'wconvert') : __('Link all sides', 'wconvert')}
          title={linked ? __('Edit sides separately', 'wconvert') : __('Link all sides using the top value', 'wconvert')}
          aria-pressed={linked} onClick={() => {
            if (linked) setSeparate(true);
            else { setSeparate(false); onChange(sides![0]); }
          }}>
          {linked ? <Link aria-hidden="true" /> : <Unlink aria-hidden="true" />}
        </Button>
        {advanced && sides !== null && <Button type="button" variant="ghost" size="icon-xs" aria-pressed={custom}
          aria-label={custom ? __('Use side controls', 'wconvert') : __('Custom CSS', 'wconvert')}
          title={custom ? __('Use side controls', 'wconvert') : __('Custom CSS', 'wconvert')}
          onClick={() => setCustom(!custom)}><CodeXml aria-hidden="true" /></Button>}
        {reset}
      </span>
    </div>
    {!advanced && sides === null ? <p className="m-0 text-note text-muted-foreground">{cssOnlyNote()}</p>
      : (advanced && custom) || sides === null ? <StyleValueInput type="text" className="regular-text" aria-label={sprintf(__('%s custom value', 'wconvert'), label)} value={shown} placeholder={fallback} onCommit={onChange} />
      : <div className={linked ? "grid gap-2" : "wconvert-fields"}>
        {(linked ? sides.slice(0, 1) : sides).map((side, index) => <div key={index} className="wconvert-fields__item grid min-w-0 gap-1" data-compact={!linked || undefined}>
          {!linked && <span className="text-note">{names[index]}</span>}
          <MeasurementValue label={linked ? label : `${label}, ${names[index]}`}
            value={side} fallback={side} standard={standard} onChange={value => {
              if (spacingSides(value)?.length !== 4 || value.trim().split(/\s+/).length !== 1) return;
              onChange(linked ? value : sides.map((held, at) => at === index ? value : held).join(' '));
            }} />
        </div>)}
      </div>}

  </fieldset>;
}
