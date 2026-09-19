import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CodeXml } from 'lucide-react';
import { Button } from '../components/ui/button';
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
    <span className="wconvert-field-heading"><label htmlFor={id}>{label}</label><span className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon-xs" aria-label={__('Edit shadow CSS', 'wconvert')} title={__('Edit shadow CSS', 'wconvert')} aria-pressed={custom} onClick={() => setCustom(!custom)}><CodeXml aria-hidden="true" /></Button>{reset}
    </span></span>
    <select id={id} value={custom || !offered.includes(shown) ? '__custom' : shown} onChange={event => {
      setCustom(false); onChange(event.target.value);
    }}>
      {offered.map(choice => <option key={choice} value={choice}>{nameOf(labels.tokenValues, `${token}.${choice}`)}</option>)}
      {(custom || !offered.includes(shown)) && <option value="__custom" disabled>{__('Custom', 'wconvert')}</option>}
    </select>
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
    {((!shadow && shown !== 'none' && !offered.includes(shown)) || custom) && <div className="wconvert-shadow-css">
      <StyleValueInput aria-label={sprintf(__('%s value', 'wconvert'), label)} className="wconvert-token__typed" value={value} placeholder={fallback} onCommit={onChange} />
    </div>}
  </div>;
}
