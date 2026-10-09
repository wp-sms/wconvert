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
import { Field } from '@/shell/Field';
import { InfoTip } from '@/shell/InfoTip';
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
  const position = (field: string, label: string, current: string | undefined, change: (value: string) => void) => <Field label={label} htmlFor={field}>
    <NativeSelect id={field} className="w-full" value={current ?? 'block_end_inline_end'} onChange={event => change(event.target.value)}>
      {corners.map(corner => <option key={corner} value={corner}>{physicalPlacementLabel('slide_in', corner, direction)}</option>)}
    </NativeSelect>
  </Field>;
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

  return <section className="grid gap-4 border-t pt-4">
    <div className="flex items-center gap-1">
      <CheckRow className="wconvert-reopen-toggle" label={__('Reopen button', 'wconvert')} checked={config !== null}
        onChange={event => onChange(event.target.checked ? { label: __('View offer', 'wconvert') } : null)} />
      <InfoTip label={__('About reopen buttons', 'wconvert')}>
        <p>{__('After a visitor closes this campaign, a small button lets them return to it on eligible pages in the same tab. Closing the button or completing the campaign removes it for the session.', 'wconvert')}</p>
        <p>{__('Reopening still follows targeting, schedules, consent and completion settings. Automatic view limits and closing settings don’t block a visitor’s click.', 'wconvert')}</p>
      </InfoTip>
    </div>
    {config && <>
      <Field label={__('Button text', 'wconvert')} htmlFor={`${id}-label`}>
        <Input id={`${id}-label`} value={config.label} aria-invalid={missingLabel || undefined} aria-describedby={missingLabel ? `${id}-label-error` : undefined}
          onChange={event => update({ label: [...event.target.value].slice(0, 80).join('') })} />
        {missingLabel && <p id={`${id}-label-error`} role="alert" className="m-0 text-note text-destructive">{__('Enter button text before saving.', 'wconvert')}</p>}
      </Field>
      {position(`${id}-position`, __('Position', 'wconvert'), config.placement, placement => update({ placement }))}
      <Field label={__('Distance from edges (px)', 'wconvert')} htmlFor={`${id}-gap`} hint={__('From 8 to 96.', 'wconvert')} hintId={`${id}-gap-hint`}>
        <Input id={`${id}-gap`} type="number" min={8} max={96} aria-describedby={`${id}-gap-hint`} value={config.gap ?? 16} onChange={event => update({ gap: gapOf(event.target.value) })} />
      </Field>
      <Disclosure variant="inline" title={__('Colors and mobile', 'wconvert')} bodyClassName="gap-4">
        <p className="m-0 text-note text-muted-foreground">{__('Colors follow the campaign’s design until you change them here.', 'wconvert')}</p>
        {color('background', __('Background', 'wconvert'), template.tokens.accent || '#2563eb')}
        {color('color', __('Text', 'wconvert'), template.tokens['accent-fg'] || '#ffffff')}
        <CheckRow label={__('Show on mobile', 'wconvert')} checked={config.mobile?.visible !== false} onChange={event => updateMobile({ visible: event.target.checked })} />
        {position(`${id}-mobile-position`, __('Mobile position', 'wconvert'), config.mobile?.placement ?? config.placement, placement => updateMobile({ placement }))}
        <Field label={__('Mobile distance from edges (px)', 'wconvert')} htmlFor={`${id}-mobile-gap`} hint={__('From 8 to 96.', 'wconvert')} hintId={`${id}-mobile-gap-hint`}>
          <Input id={`${id}-mobile-gap`} type="number" min={8} max={96} aria-describedby={`${id}-mobile-gap-hint`} value={config.mobile?.gap ?? config.gap ?? 16} onChange={event => updateMobile({ gap: gapOf(event.target.value) })} />
        </Field>
        <Button variant="outline" className="justify-self-start" onClick={() => update({ mobile: undefined })}>{__('Reset mobile overrides', 'wconvert')}</Button>
      </Disclosure>
    </>}
  </section>;
}
