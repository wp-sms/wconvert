import { useEffect, useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { RotateCcw } from 'lucide-react';
import type { ReopenProps } from '@/reopenControls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ColorField } from '@/builder/ColorField';
import { physicalPlacementLabel } from '@/builder/PlacementControl';
import { useDirection } from '@/hooks/useDirection';
import { CheckRow } from '@/shell/CheckRow';
import { Disclosure } from '@/shell/Disclosure';
import { PanelField, PanelSection } from '@/builder/PanelSection';
import { type Teaser } from '../loader/reminder';

const corners = ['block_start_inline_start', 'block_start_inline_end', 'block_end_inline_start', 'block_end_inline_end'];
const gapOf = (value: string) => Math.max(8, Math.min(96, Number(value)));

export default function ReopenSettings({ value, template, onChange }: ReopenProps) {
  const id = useId();
  const direction = useDirection();
  // Which color popover is open. Held here, and closed when this unmounts or
  // its tab is hidden, so a picker never outlives the panel it belongs to.
  const [openColor, setOpenColor] = useState<'background' | 'color' | null>(null);
  useEffect(() => () => setOpenColor(null), []);
  const config = value && typeof value === 'object' && 'label' in value ? value as Teaser : null;
  const update = (changes: Partial<Teaser>) => onChange({ ...config, ...changes });
  const updateMobile = (changes: Partial<NonNullable<Teaser['mobile']>>) => update({ mobile: { ...config?.mobile, ...changes } });
  const position = (field: string, label: string, current: string | undefined, change: (value: string) => void) => <PanelField label={label} htmlFor={field}>
    <NativeSelect id={field} className="w-full" value={current ?? 'block_end_inline_end'} onChange={event => change(event.target.value)}>
      {corners.map(corner => <option key={corner} value={corner}>{physicalPlacementLabel('slide_in', corner, direction)}</option>)}
    </NativeSelect>
  </PanelField>;
  // The input refuses anything outside 8–96, so no line under it says so (ADR 0136).
  const distance = (field: string, label: string, current: number, change: (gap: number) => void) => <PanelField label={label} htmlFor={field}>
    <Input id={field} type="number" min={8} max={96} value={current} onChange={event => change(gapOf(event.target.value))} />
  </PanelField>;
  const color = (key: 'background' | 'color', label: string, fallback: string) => {
    const held = config?.[key] ?? '';
    return <div className="wconvert-token wconvert-token--color">
      <ColorField label={label} fallback={fallback} value={held} open={openColor === key}
        onOpenChange={open => setOpenColor(open ? key : null)} onChange={next => update({ [key]: next || undefined })} />
      {held !== '' && <Button type="button" variant="ghost" size="icon-xs" className="wconvert-token__reset" onClick={() => { setOpenColor(null); update({ [key]: undefined }); }}>
        <RotateCcw aria-hidden="true" />
        <span className="sr-only">{sprintf(
          /* translators: %s: what the color is for, e.g. “Background”. */
          __('Put %s back to the campaign’s own', 'wconvert'), label)}</span>
      </Button>}
    </div>;
  };
  const missingLabel = config !== null && !config.label.trim();
  const ownColors = config?.background || config?.color;
  const summary = [ownColors ? __('Own colors', 'wconvert') : __('Design colors', 'wconvert'),
    config?.mobile?.visible === false ? __('Hidden on mobile', 'wconvert') : __('Shown on mobile', 'wconvert')].join(' · ');

  return <PanelSection title={__('Reopen button', 'wconvert')} tipLabel={__('About reopen buttons', 'wconvert')}
    tip={__('After closing, visitors can bring it back from a small button on the page.', 'wconvert')}>
    <CheckRow className="wconvert-check wconvert-reopen-toggle" label={__('Show a reopen button', 'wconvert')} checked={config !== null}
      onChange={event => onChange(event.target.checked ? { label: __('View offer', 'wconvert') } : null)} />
    {config && <>
      <PanelField label={__('Button text', 'wconvert')} htmlFor={`${id}-label`}>
        <Input id={`${id}-label`} value={config.label} aria-invalid={missingLabel || undefined} aria-describedby={missingLabel ? `${id}-label-error` : undefined}
          onChange={event => update({ label: [...event.target.value].slice(0, 80).join('') })} />
        {missingLabel && <p id={`${id}-label-error`} role="alert" className="m-0 text-note text-destructive">{__('Enter button text before saving.', 'wconvert')}</p>}
      </PanelField>
      <div className="wconvert-panel-pair">
        {position(`${id}-position`, __('Position', 'wconvert'), config.placement, placement => update({ placement }))}
        {distance(`${id}-gap`, __('Distance (px)', 'wconvert'), config.gap ?? 16, gap => update({ gap }))}
      </div>
      <Disclosure variant="inline" title={__('Colors and mobile', 'wconvert')} summary={summary}>
        <div className="wconvert-palette">
          {color('background', __('Background', 'wconvert'), template.tokens.accent || '#2563eb')}
          {color('color', __('Text', 'wconvert'), template.tokens['accent-fg'] || '#ffffff')}
        </div>
        <CheckRow className="wconvert-check" label={__('Show on mobile', 'wconvert')} checked={config.mobile?.visible !== false} onChange={event => updateMobile({ visible: event.target.checked })} />
        <div className="wconvert-panel-pair">
          {position(`${id}-mobile-position`, __('Mobile position', 'wconvert'), config.mobile?.placement ?? config.placement, placement => updateMobile({ placement }))}
          {distance(`${id}-mobile-gap`, __('Mobile distance (px)', 'wconvert'), config.mobile?.gap ?? config.gap ?? 16, gap => updateMobile({ gap }))}
        </div>
        <Button variant="outline" size="sm" className="justify-self-start" disabled={config.mobile === undefined} onClick={() => update({ mobile: undefined })}>{__('Reset mobile', 'wconvert')}</Button>
      </Disclosure>
    </>}
  </PanelSection>;
}
