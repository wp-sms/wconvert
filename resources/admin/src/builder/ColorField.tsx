import type { CSSProperties } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { RgbaStringColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { StyleValueInput } from './StyleValueInput';
import { colorName } from './colorName';
import { useAdvanced } from './advanced';

/** Convert hex including alpha for the RGBA picker; opening never writes a value. */
export function rgbaForPicker(value: string): string | null {
  const hex = value.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (!hex) {
    const match = value.trim().match(/^rgba?\(([^()]+)\)$/i);
    const parts = match?.[1].trim().split(/[\s,/]+/) ?? [];
    if (parts.length < 3 || parts.length > 4 || parts.some(part => !/^-?(?:\d*\.)?\d+%?$/.test(part))) return null;
    const channel = (part: string, maximum: number) => Math.min(maximum, Math.max(0, parseFloat(part) * (part.endsWith('%') ? maximum / 100 : 1)));
    const [r, g, b] = parts.slice(0, 3).map(part => Math.round(channel(part, 255)));
    const a = parts[3] ? Math.round(channel(parts[3], 1) * 1000) / 1000 : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const full = hex.length < 5 ? [...hex].map(c => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  const a = full.length === 8 ? Math.round(parseInt(full.slice(6), 16) / 255 * 1000) / 1000 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function ColorField({
  label,
  fallback,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  fallback: string;
  value: string;
  /**
   * **Controlled, and the panel is what holds it** — so the effect in
   * {@see Tokens} can close it when `<Activity>` hides the tab. An uncontrolled
   * Radix popover portals to `document.body` and survives its own tab being
   * hidden, which is how a color picker came to sit over the Content tab.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  // Empty means "whatever the design says", so the swatch and the picker both
  // open on the design's own value while the STORED value stays empty.
  const shown = value === '' ? fallback : value;
  const pickerColor = rgbaForPicker(shown);
  // The plain view names the color; the hex is Advanced's (ADR 0135).
  const advanced = useAdvanced();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="wconvert-swatch">
          {/*
            The color arrives as a custom property rather than as
            `background`, because the chip paints a chequerboard underneath —
            a translucent backdrop has to READ as translucent, and the
            shorthand would wipe the pattern it shows through.
          */}
          <span
            aria-hidden="true"
            className="wconvert-swatch__chip"
            style={{ '--wconvert-chip': shown } as CSSProperties}
          />
          <span className="wconvert-swatch__text">
            <span className="wconvert-swatch__name">{label}</span>
            <span className="wconvert-swatch__value">{advanced ? shown : colorName(shown)}</span>
          </span>
          <span className="sr-only">
            {sprintf(
              /* translators: %s: what the color is for, e.g. “Background”. */
              __('Choose a color for %s', 'wconvert'),
              label,
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="left" collisionPadding={12} className="wconvert-color-popover" onEscapeKeyDown={(event) => {
        // Radix handles Escape during capture, before the input can cancel its draft.
        if (event.target instanceof HTMLInputElement && event.target.dataset.styleValuePending === 'true') event.preventDefault();
      }}>
        <div className="wconvert-color-picker">
          <strong>{label}</strong>
          {pickerColor !== null ? <RgbaStringColorPicker color={pickerColor} onChange={onChange} />
            : <p>{advanced ? __('Use a hex or RGB color to adjust it visually. Your custom value is kept below.', 'wconvert') : __('This color is set in CSS. Open Advanced to change its value.', 'wconvert')}</p>}

          {advanced && <>
          {/*
            Named for the TOKEN rather than "Value", because a popover
            announcing "Value, edit text" tells a screen-reader user the
            value of what.
          */}
          <label className="wconvert-slot__key">
            {sprintf(
              /* translators: %s: what the color is for, e.g. “Background”. */
              __('%s value', 'wconvert'),
              label,
            )}
            <StyleValueInput type="text" className="regular-text" placeholder={fallback}
              value={shown} onCommit={onChange} />
          </label>
          <p className="m-0 text-note text-muted-foreground">{__('Hex, RGB or another CSS color. Press Enter or leave the field to apply.', 'wconvert')}</p>
          </>}

          {/*
            The way back to the design's own color is {@see Reset}, in the
            row beside the swatch rather than a click deep inside the picker
            — which is what makes "what have I actually changed?" answerable
            by looking rather than by opening fifteen popovers.
          */}
        </div>
      </PopoverContent>
    </Popover>
  );
}
