import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import { StyleValueInput } from './StyleValueInput';
import { useAdvanced } from './advanced';

/** Only interpret positions we can round-trip; expressions stay editable as CSS. */
export function positionPoint(value: string): [number, number] | null {
  const keywords: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
  if (value === 'center') return [50, 50];
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  if (/^(left|center|right)$/.test(parts[0]) && /^(top|center|bottom)$/.test(parts[1])) {
    return [keywords[parts[0]], keywords[parts[1]]];
  }
  if (!parts.every(part => /^\d+(?:\.\d+)?%$/.test(part))) return null;
  const [x, y] = parts.map(parseFloat);
  return x <= 100 && y <= 100 ? [x, y] : null;
}

export function PositionField({ label, shown, offered, nameOfValue, reset, onChange }: {
  label: string;
  shown: string;
  offered: readonly string[];
  nameOfValue: (value: string) => string;
  reset: ReactNode;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [adjusting, setAdjusting] = useState(false);
  // Percentages and the CSS box are exact values: Advanced (ADR 0135). The grid is the plain control.
  const advanced = useAdvanced();
  const point = positionPoint(shown);
  const selected = offered.find(value => {
    const candidate = positionPoint(value);
    return point !== null && candidate !== null && candidate[0] === point[0] && candidate[1] === point[1];
  });
  const expanded = advanced && (adjusting || selected === undefined);
  const summary = selected !== undefined ? nameOfValue(selected) : point && advanced
    ? sprintf(__('%1$s%% across, %2$s%% down', 'wconvert'), String(point[0]), String(point[1]))
    : __('Custom position', 'wconvert');

  return <div className="wconvert-token wconvert-position">
    <div className="wconvert-position__heading"><span id={`${id}-label`}>{label}</span>{reset}</div>
    <div className="wconvert-position__row">
      <div className="wconvert-position__grid" role="group" aria-labelledby={`${id}-label`}>
        {offered.map(choice => {
          const target = positionPoint(choice);
          if (target === null) return null;
          return <label className="wconvert-position__target" key={choice}
            style={{ gridColumn: target[0] / 50 + 1, gridRow: target[1] / 50 + 1 }}>
            <input type="radio" className="sr-only" name={id} aria-label={nameOfValue(choice)}
              checked={selected === choice} onChange={() => { setAdjusting(false); onChange(choice); }} />
            <span aria-hidden="true"><span /></span>
          </label>;
        })}
      </div>
      <div className="wconvert-position__summary">
        <span role="status">{summary}</span>
        {advanced && selected !== undefined && <button type="button" className="wconvert-linkish" aria-expanded={expanded} aria-controls={`${id}-adjust`}
          onClick={() => setAdjusting(!adjusting)}>
          {expanded ? __('Hide adjustments', 'wconvert') : __('Adjust precisely…', 'wconvert')}
        </button>}
      </div>
    </div>
    {expanded && <div id={`${id}-adjust`} className="wconvert-position__adjust">
      {point !== null && <div className="wconvert-position__coordinates">
        {([__('Horizontal %', 'wconvert'), __('Vertical %', 'wconvert')] as const).map((axis, index) =>
          <label key={axis}>{axis}
            <StyleValueInput type="number" min={0} max={100} step="any" value={String(point[index])}
              onCommit={value => {
                const number = Number(value);
                if (value.trim() === '' || !Number.isFinite(number) || number < 0 || number > 100) return;
                const next = [...point];
                next[index] = number;
                onChange(`${next[0]}% ${next[1]}%`);
              }} />
          </label>)}
      </div>}
      <Disclosure variant="inline" className="wconvert-position__css" open={point === null ? true : undefined} title={__('Custom CSS', 'wconvert')}>
        <StyleValueInput aria-label={sprintf(__('%s value', 'wconvert'), label)} value={shown} onCommit={onChange} />
      </Disclosure>
    </div>}
  </div>;
}
