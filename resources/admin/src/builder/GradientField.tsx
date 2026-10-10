import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { ColorField } from './ColorField';
import { cssOnlyNote, useAdvanced } from './advanced';
import { StyleValueInput } from './StyleValueInput';
import { gradientOf, gradientCss, type Gradient } from './gradient';

export const DEFAULT_GRADIENT = 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 100%)';

export function GradientField({ label, shown, reset, open, onOpenChange, onChange }: {
  label: string; shown: string; reset: ReactNode; open: boolean;
  onOpenChange: (open: boolean) => void; onChange: (value: string) => void;
}) {
  const gradient = gradientOf(shown);
  const [custom, setCustom] = useState(false);
  const [color, setColor] = useState<number | null>(null);
  // Degrees, stop positions and the CSS box are exact values: Advanced (ADR 0135).
  const advanced = useAdvanced();
  const write = (next: Gradient) => onChange(gradientCss(next));
  return <fieldset className="wconvert-token min-w-0">
    <legend>{label}</legend>
    <div className="flex items-center gap-2">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-md border p-2 text-sm" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <span className="h-7 w-12 shrink-0 rounded border" style={{ backgroundImage: shown }} aria-hidden="true" />
        {__('Edit gradient', 'wconvert')}
      </button>{reset}
    </div>
    {open && <div className="mt-2 grid gap-3 rounded-md border p-3">
      {gradient !== null && (!custom || !advanced) ? <>
        {advanced && <label className="grid gap-1 text-note">{__('Direction (degrees)', 'wconvert')}
          <StyleValueInput type="number" value={String(gradient.angle)} onCommit={value => {
            if (value.trim() !== '' && Number.isFinite(Number(value))) write({ ...gradient, angle: Number(value) });
          }} />
        </label>}
        {gradient.stops.map((stop, index) => <div key={index} className="grid gap-1 rounded border p-2">
          <ColorField label={sprintf(__('Color %d', 'wconvert'), index + 1)} fallback={stop.color} value={stop.color}
            open={open && color === index} onOpenChange={value => setColor(value ? index : null)}
            onChange={value => write({ ...gradient, stops: gradient.stops.map((held, at) => at === index ? { ...held, color: value } : held) })} />
          <div className="flex items-center gap-2">
            {advanced ? <label className="flex min-w-0 flex-1 items-center gap-2 text-note">{__('Position %', 'wconvert')}
              <StyleValueInput aria-label={sprintf(__('Color %d position', 'wconvert'), index + 1)} type="number" min={index === 0 ? 0 : gradient.stops[index - 1].at} max={gradient.stops[index + 1]?.at ?? 100}
                className="min-w-0 w-16" value={String(stop.at)} onCommit={value => {
                  const at = Number(value);
                  if (value.trim() === '' || !Number.isFinite(at) || at < (gradient.stops[index - 1]?.at ?? 0) || at > (gradient.stops[index + 1]?.at ?? 100)) return;
                  write({ ...gradient, stops: gradient.stops.map((held, i) => i === index ? { ...held, at } : held) });
                }} />
            </label> : <span className="flex-1" />}
            <Button type="button" variant="ghost" size="xs" disabled={gradient.stops.length <= 2} aria-label={sprintf(__('Remove color %d', 'wconvert'), index + 1)} onClick={() => {
              setColor(null); write({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) });
            }}>{__('Remove', 'wconvert')}</Button>
          </div>
        </div>)}
        <Button type="button" variant="outline" size="xs" disabled={gradient.stops.length >= 6} onClick={() => {
          const stops = [...gradient.stops];
          let gap = 0;
          for (let i = 1; i < stops.length - 1; i++) if (stops[i + 1].at - stops[i].at > stops[gap + 1].at - stops[gap].at) gap = i;
          stops.splice(gap + 1, 0, { color: stops[gap].color, at: (stops[gap].at + stops[gap + 1].at) / 2 });
          write({ ...gradient, stops });
        }}>{__('Add color', 'wconvert')}</Button>
      </> : advanced ? <>
        <p className="m-0 text-note text-muted-foreground">{__('This value stays editable as CSS. Use a simple linear gradient for visual controls.', 'wconvert')}</p>
        <StyleValueInput aria-label={sprintf(__('%s CSS', 'wconvert'), label)} value={shown} onCommit={onChange} />
      </> : <p className="m-0 text-note text-muted-foreground">{cssOnlyNote()}</p>}
      {advanced && <Button type="button" variant="ghost" size="xs" disabled={gradient === null} onClick={() => { setColor(null); setCustom(!custom); }}>{custom ? __('Use visual controls', 'wconvert') : __('Custom CSS', 'wconvert')}</Button>}
    </div>}
  </fieldset>;
}
