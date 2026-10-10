import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import { CodeXml } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ColorField } from './ColorField';
import { cssOnlyNote, useAdvanced } from './advanced';
import { StyleValueInput } from './StyleValueInput';
import { CheckRow } from '../shell/CheckRow';
import { FieldHeading, PanelHint } from './PanelSection';
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
  // Pixel offsets and the CSS box are exact values: Advanced (ADR 0135).
  const advanced = useAdvanced();
  const shadow = parseShadow(shown);
  const edit = (patch: Partial<Shadow>) => shadow && onChange(shadowValue({ ...shadow, ...patch }));
  return <div className="wconvert-token">
    <FieldHeading as="span" label={label} labelId={`${id}-label`}>
      {advanced && <Button type="button" variant="ghost" size="icon-xs" aria-label={__('Edit shadow CSS', 'wconvert')} title={__('Edit shadow CSS', 'wconvert')} aria-pressed={custom} onClick={() => setCustom(!custom)}><CodeXml aria-hidden="true" /></Button>}{reset}
    </FieldHeading>
    {/*
      **Drawn, not named** (ADR 0136): a shadow is judged by looking, so each
      choice is a small card wearing it. The words stay as each choice's name.
    */}
    <span role="radiogroup" aria-labelledby={`${id}-label`} className="wconvert-shadow-choices">
      {offered.map(choice => <label key={choice} className="wconvert-shadow-choice">
        <input type="radio" className="sr-only" name={id} checked={!custom && shown === choice} onChange={() => { setCustom(false); onChange(choice); }} />
        <span className="wconvert-shadow-choice__card"><span aria-hidden="true" style={{ boxShadow: choice === 'none' ? 'none' : choice }} />{nameOf(labels.tokenValues, `${token}.${choice}`)}</span>
      </label>)}
    </span>
    {!offered.includes(shown) && shown !== 'none' && !advanced && <PanelHint>{shadow ? __('A custom shadow. Open Advanced to adjust it.', 'wconvert') : cssOnlyNote()}</PanelHint>}
    {advanced && shadow && <Disclosure variant="inline" className="wconvert-shadow-adjust" title={__('Adjust shadow', 'wconvert')} summary={shadowValue(shadow)}>
      <div className="wconvert-shadow-values">{(['x', 'y', 'blur', 'spread'] as const).map(key => <label key={key}>
        {{ x: __('Horizontal', 'wconvert'), y: __('Vertical', 'wconvert'), blur: __('Blur', 'wconvert'), spread: __('Spread', 'wconvert') }[key]}
        <span><StyleValueInput type="number" min={key === 'blur' ? 0 : undefined} value={String(shadow[key])} onCommit={next => {
          const n = Number(next);
          if (next.trim() && Number.isFinite(n) && (key !== 'blur' || n >= 0)) edit({ [key]: n });
        }} /><span>px</span></span>
      </label>)}</div>
      <ColorField label={__('Shadow color', 'wconvert')} value={shadow.color} fallback={shadow.color} open={open} onOpenChange={onOpenChange} onChange={color => edit({ color })} />
      <CheckRow className="wconvert-check" label={__('Inner shadow', 'wconvert')} checked={shadow.inset} onChange={e => edit({ inset: e.target.checked })} />
    </Disclosure>}
    {advanced && ((!shadow && shown !== 'none' && !offered.includes(shown)) || custom) && <div className="wconvert-shadow-css">
      <StyleValueInput aria-label={sprintf(__('%s value', 'wconvert'), label)} className="wconvert-token__typed" value={value} placeholder={fallback} onFocus={() => setCustom(true)} onCommit={onChange} />
    </div>}
  </div>;
}
