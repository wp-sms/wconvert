import { useEffect, useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { ReopenProps } from '@/reopenControls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { physicalPlacementLabel } from '@/builder/PlacementControl';
import { useDirection } from '@/hooks/useDirection';
import { Preview } from '@/builder/Preview';
import { reminder, type Teaser } from '../loader/reminder';

const corners = ['block_start_inline_start', 'block_start_inline_end', 'block_end_inline_start', 'block_end_inline_end'];

export default function ReopenSettings({ value, template, onChange }: ReopenProps) {
  const id = useId();
  const direction = useDirection();
  const config = value && typeof value === 'object' && 'label' in value ? value as Teaser : null;
  const [mode, setMode] = useState('reminder');
  const [mobile, setMobile] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const update = (changes: Partial<Teaser>) => onChange({ ...config, ...changes });
  const updateMobile = (changes: Partial<NonNullable<Teaser['mobile']>>) => update({ mobile: { ...config?.mobile, ...changes } });
  useEffect(() => {
    const parent = container.current;
    if (!parent || !config || mode !== 'reminder') return;
    const view = reminder(config, template.tokens);
    view.host.removeAttribute('popover');
    const visible = view.layout(mobile);
    view.host.style.setProperty('position', 'absolute', 'important');
    view.button.disabled = true; view.close.disabled = true;
    if (visible) parent.appendChild(view.host);
    return () => view.host.remove();
  }, [config, template, mode, mobile, direction]);
  const position = (value: string | undefined, change: (value: string) => void, name: string) => <label className="block">{name}<select className="w-full" value={value ?? 'block_end_inline_end'} onChange={event => change(event.target.value)}>{corners.map(corner => <option key={corner} value={corner}>{physicalPlacementLabel('slide_in', corner, direction)}</option>)}</select></label>;
  return <section className="space-y-3 border-t pt-4">
    <label className="flex items-center gap-2"><input type="checkbox" checked={config !== null} onChange={event => onChange(event.target.checked ? { label: __('View offer', 'wconvert') } : null)} />{__('Reopen button', 'wconvert')}</label>
    <p>{__('After visitors close this Campaign, show a small button so they can return to it. It follows eligible pages in this browser tab. Closing the button or completing the Campaign stops it for this session.', 'wconvert')}</p>
    {config && <>
      <label htmlFor={`${id}-label`}>{__('Button text', 'wconvert')}</label>
      <Input id={`${id}-label`} value={config.label} onChange={event => update({ label: [...event.target.value].slice(0, 80).join('') })} aria-invalid={!config.label.trim()} />
      {!config.label.trim() && <p role="alert">{__('Enter button text before saving.', 'wconvert')}</p>}
      {position(config.placement, placement => update({ placement }), __('Position', 'wconvert'))}
      <label className="block">{__('Distance from edges (8–96 px)', 'wconvert')}<Input type="number" min={8} max={96} value={config.gap ?? 16} onChange={event => update({ gap: Math.max(8, Math.min(96, Number(event.target.value))) })} /></label>
      <details><summary>{__('Colors and mobile', 'wconvert')}</summary><div className="space-y-3 pt-3">
        <p>{__('Colors and font inherit from the Campaign unless overridden.', 'wconvert')}</p>
        <label className="block">{__('Background color', 'wconvert')}<Input value={config.background ?? ''} placeholder={template.tokens.accent ?? '#2563eb'} onChange={event => update({ background: event.target.value || undefined })} /></label>
        <label className="block">{__('Text color', 'wconvert')}<Input value={config.color ?? ''} placeholder={template.tokens['accent-fg'] ?? '#ffffff'} onChange={event => update({ color: event.target.value || undefined })} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={config.mobile?.visible !== false} onChange={event => updateMobile({ visible: event.target.checked })} />{__('Show on mobile', 'wconvert')}</label>
        {position(config.mobile?.placement ?? config.placement, placement => updateMobile({ placement }), __('Mobile position', 'wconvert'))}
        <label className="block">{__('Mobile distance from edges', 'wconvert')}<Input type="number" min={8} max={96} value={config.mobile?.gap ?? config.gap ?? 16} onChange={event => updateMobile({ gap: Math.max(8, Math.min(96, Number(event.target.value))) })} /></label>
        <Button variant="outline" onClick={() => update({ mobile: undefined })}>{__('Reset mobile overrides', 'wconvert')}</Button>
      </div></details>
      <p>{__('Reopening respects targeting, schedules, consent and completion settings. Automatic view limits and dismissal settings do not block a visitor’s click. Check its position beside cookie notices, chat and sticky checkout controls.', 'wconvert')}</p>
      <label className="block">{__('Preview', 'wconvert')}<select value={mode} onChange={event => setMode(event.target.value)}><option value="campaign">{__('Campaign', 'wconvert')}</option><option value="reminder">{__('Reopen button', 'wconvert')}</option><option value="success">{__('Success', 'wconvert')}</option></select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={mobile} onChange={event => setMobile(event.target.checked)} />{__('Mobile preview', 'wconvert')}</label>
      {mode === 'reminder' ? <div ref={container} className="relative h-64 rounded border bg-muted" style={{ maxWidth: mobile ? '24rem' : undefined }}>{mobile && config.mobile?.visible === false && <p>{__('Hidden on mobile', 'wconvert')}</p>}</div> : <Preview template={template} step={mode === 'success' ? template.tree.steps.length - 1 : 0} />}
    </>}
  </section>;
}
