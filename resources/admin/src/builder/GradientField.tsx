import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { ColorField } from './ColorField';
import { cssOnlyNote, useAdvanced } from './advanced';
import { StyleValueInput } from './StyleValueInput';
import { FieldHeading, PanelHint } from './PanelSection';
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
  const id = useId();
  const directions: readonly (readonly [number, string])[] = [[90, __('Left to right', 'wconvert')], [180, __('Top to bottom', 'wconvert')], [135, __('Diagonal', 'wconvert')]];
  return <div className="wconvert-token min-w-0" role="group" aria-labelledby={`${id}-label`}>
    <FieldHeading as="span" label={label} labelId={`${id}-label`}>{reset}</FieldHeading>
    <button type="button" className="wconvert-gradient-trigger" aria-expanded={open} onClick={() => onOpenChange(!open)}>
      <span className="wconvert-gradient-trigger__bar" style={{ backgroundImage: shown }} aria-hidden="true" />
      {__('Edit gradient', 'wconvert')}
    </button>
    {open && <div className="wconvert-gradient-editor">
      {gradient !== null && (!custom || !advanced) ? <>
        {advanced ? <label className="wconvert-slot__key">{__('Direction (degrees)', 'wconvert')}
          <StyleValueInput type="number" value={String(gradient.angle)} onCommit={value => {
            if (value.trim() !== '' && Number.isFinite(Number(value))) write({ ...gradient, angle: Number(value) });
          }} />
        </label> : <label className="wconvert-slot__key">{__('Direction', 'wconvert')}
          <select value={String(gradient.angle)} onChange={event => write({ ...gradient, angle: Number(event.target.value) })}>
            {!directions.some(([angle]) => angle === gradient.angle) && <option value={String(gradient.angle)}>{sprintf(/* translators: %s: an angle in degrees, e.g. “45”. */ __('Custom (%s°)', 'wconvert'), String(gradient.angle))}</option>}
            {directions.map(([angle, name]) => <option key={angle} value={String(angle)}>{name}</option>)}
          </select>
        </label>}
        {gradient.stops.map((stop, index) => <div key={index} className="wconvert-gradient-stop">
          <ColorField label={sprintf(__('Color %d', 'wconvert'), index + 1)} fallback={stop.color} value={stop.color}
            open={open && color === index} onOpenChange={value => setColor(value ? index : null)}
            onChange={value => write({ ...gradient, stops: gradient.stops.map((held, at) => at === index ? { ...held, color: value } : held) })} />
          <div className="wconvert-gradient-stop__row">
            {advanced ? <label className="wconvert-gradient-stop__at">{__('Position %', 'wconvert')}
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
        <button type="button" className="wconvert-panel-link" disabled={gradient.stops.length >= 6} onClick={() => {
          const stops = [...gradient.stops];
          let gap = 0;
          for (let i = 1; i < stops.length - 1; i++) if (stops[i + 1].at - stops[i].at > stops[gap + 1].at - stops[gap].at) gap = i;
          stops.splice(gap + 1, 0, { color: stops[gap].color, at: (stops[gap].at + stops[gap + 1].at) / 2 });
          write({ ...gradient, stops });
        }}>{__('Add color', 'wconvert')}</button>
      </> : advanced ? <StyleValueInput aria-label={sprintf(__('%s CSS', 'wconvert'), label)} value={shown} onCommit={onChange} />
        : <PanelHint>{cssOnlyNote()}</PanelHint>}
      {advanced && <button type="button" className="wconvert-panel-link" disabled={gradient === null} onClick={() => { setColor(null); setCustom(!custom); }}>{custom ? __('Use visual controls', 'wconvert') : __('Custom CSS', 'wconvert')}</button>}
    </div>}
  </div>;
}
