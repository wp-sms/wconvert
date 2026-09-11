import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ColorField } from './ColorField';
import { StyleValueInput } from './StyleValueInput';
import { nameOf, type TemplateLabels } from '../templates/api';

export interface Shadow { x: number; y: number; blur: number; spread: number; color: string; inset: boolean }

/** Edit single pixel shadows; preserve layered, variable and other-unit CSS verbatim. */
export function parseShadow(value: string): Shadow | null {
  const parts: string[] = value.trim().match(/(?:rgba?|hsla?)\([^)]*\)|[^\s]+/g) ?? [];
  const inset = parts.includes('inset');
  const rest = parts.filter(part => part !== 'inset');
  const lengths: number[] = [];
  while (rest.length && /^-?(?:\d*\.)?\d+(?:px)?$/.test(rest[0])) {
    const part = rest.shift()!;
    if (!part.endsWith('px') && Number(part) !== 0) return null;
    lengths.push(parseFloat(part));
  }
  if (lengths.length < 2 || lengths.length > 4 || rest.length !== 1 || /,(?![^()]*\))/.test(rest[0])) return null;
  const color = rest[0];
  if (!/^(?:#[\da-f]{3,8}|rgba?\([^)]*\))$/i.test(color)) return null;
  const [x, y, blur = 0, spread = 0] = lengths;
  if (blur < 0) return null;
  return { x, y, blur, spread, color, inset };
}

export function shadowValue(shadow: Shadow): string {
  return `${shadow.inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`;
}

export function ShadowField({ label, shown, value, fallback, offered, labels, token, reset, open, onOpenChange, onChange }: {
  label: string; shown: string; value: string; fallback: string; offered: readonly string[];
  labels: TemplateLabels; token: string; reset: ReactNode; open: boolean; onOpenChange: (open: boolean) => void; onChange: (value: string) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const shadow = parseShadow(shown);
  const edit = (patch: Partial<Shadow>) => shadow && onChange(shadowValue({ ...shadow, ...patch }));
  return <div className="wconvert-token">
    <span id={id}>{label}</span>
    <div className="wconvert-token__row">
      <div className="wconvert-shadow-presets" role="group" aria-labelledby={id}>
        {offered.map(choice => <label key={choice} className="wconvert-shadow-preset">
          <input type="radio" className="sr-only" name={id} checked={!custom && shown === choice} onChange={() => { setCustom(false); onChange(choice); }} />
          <span><span className="wconvert-shadow-sample" aria-hidden="true"><span style={{ boxShadow: choice }} /></span>{nameOf(labels.tokenValues, `${token}.${choice}`)}</span>
        </label>)}
        <label className="wconvert-shadow-preset"><input type="radio" className="sr-only" name={id} checked={custom || !offered.includes(shown)} onChange={() => setCustom(true)} onClick={() => setCustom(true)} /><span>{__('Custom', 'wconvert')}</span></label>
      </div>{reset}
    </div>
    {shadow && <details className="wconvert-shadow-adjust"><summary>{__('Adjust shadow', 'wconvert')}</summary>
      <div className="wconvert-shadow-values">{(['x', 'y', 'blur', 'spread'] as const).map(key => <label key={key}>
        {{ x: __('Horizontal', 'wconvert'), y: __('Vertical', 'wconvert'), blur: __('Blur', 'wconvert'), spread: __('Spread', 'wconvert') }[key]}
        <span><StyleValueInput type="number" min={key === 'blur' ? 0 : undefined} value={String(shadow[key])} onCommit={next => {
          const n = Number(next);
          if (next.trim() && Number.isFinite(n) && (key !== 'blur' || n >= 0)) edit({ [key]: n });
        }} /><span>px</span></span>
      </label>)}</div>
      <ColorField label={__('Shadow color', 'wconvert')} value={shadow.color} fallback={shadow.color} open={open} onOpenChange={onOpenChange} onChange={color => edit({ color })} />
      <label className="wconvert-shadow-inset"><input type="checkbox" checked={shadow.inset} onChange={e => edit({ inset: e.target.checked })} />{__('Inner shadow', 'wconvert')}</label>
    </details>}
    {((!shadow && shown !== 'none') || custom) && <div className="wconvert-shadow-css">
      <StyleValueInput aria-label={sprintf(__('%s value', 'wconvert'), label)} className="wconvert-token__typed" value={value} placeholder={fallback} onCommit={onChange} />
    </div>}
  </div>;
}
