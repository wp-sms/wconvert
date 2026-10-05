import { planFrom, incompletePlan } from '@/builder/rules/plan';
import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type InlinePlacementProps } from '@/inlinePlacement';
import type { Targeting } from '@/builder/api';
import { ManualPlacement } from '@/builder/ManualPlacement';
import './placement.css';
import { commerceSupported } from '@/settings';
import LockSettings from '../../content-lock/admin/LockSettings';

export default function PlacementSettings({ optinId, published, config, vocabulary, onChange }: InlinePlacementProps) {
  const id = useId();
  const [confirm, setConfirm] = useState<'automatic' | 'lock' | false>(false);
  const manualChoice = useRef<HTMLInputElement>(null);
  const automaticChoice = useRef<HTMLInputElement>(null);
  const lockChoice = useRef<HTMLInputElement>(null);
  const placement = config.inline_placement as { position: string; paragraph?: number; fallback?: string } | null;
  const locked = config.content_lock != null;
  const plan = planFrom(config.display_rules) ?? incompletePlan();
  const compatible = plan.opening.mode === 'immediate';
  const validParagraph = Number.isInteger(placement?.paragraph) && (placement?.paragraph ?? 0) >= 1 && (placement?.paragraph ?? 0) <= 100;
  const targeting = (config.targeting ?? {}) as Targeting;
  const enable = () => {
    onChange({ inline_placement: confirm === 'lock' ? null : { position: 'after_content' }, content_lock: confirm === 'lock' ? { mode: 'hide' } : null,
      display_rules: { ...plan, opening: { mode: 'immediate' } }, rules: undefined,
      ...(confirm !== 'lock' && !targeting.include?.length ? { targeting: { ...targeting, include: [{ type: 'singular', value: 'post' }] } } : {}),
    });
    setConfirm(false);
    (confirm === 'lock' ? lockChoice : automaticChoice).current?.focus();
  };
  return <div className="wconvert-inline-placement">
    <div role="group" aria-label={__('Placement method', 'wconvert')} className="wconvert-choice-set">
      <label className="wconvert-choice"><input className="sr-only" ref={manualChoice} type="radio" name={id} checked={!placement && !locked} onChange={() => { setConfirm(false); onChange({ inline_placement: null, content_lock: null }); }} /><span className="wconvert-choice__label">{__('Manual', 'wconvert')}</span></label>
      <label className="wconvert-choice"><input className="sr-only" ref={automaticChoice} type="radio" name={id} checked={!!placement} onChange={() => setConfirm('automatic')} /><span className="wconvert-choice__label">{__('Automatic', 'wconvert')}</span></label>
      <label className="wconvert-choice"><input className="sr-only" ref={lockChoice} type="radio" name={id} checked={locked} onChange={() => setConfirm('lock')} /><span className="wconvert-choice__label">{__('Content lock', 'wconvert')}</span></label>
    </div>
    {locked && <LockSettings optinId={optinId} published={published} config={config} vocabulary={vocabulary} onChange={onChange} />}
    {!placement && !locked && <ManualPlacement optinId={optinId} published={published} />}
    {confirm && <div className="wconvert-inline-placement__confirmation" role="group" aria-label={confirm === 'lock' ? __('Enable content lock', 'wconvert') : __('Enable automatic placement', 'wconvert')}>
      <p>{confirm === 'lock' ? __('Use a content region and replace existing triggers with page load. Keep other display rules.', 'wconvert') : __('Place after content and replace existing triggers with page load. Keep other display rules.', 'wconvert')}</p>
      {confirm !== 'lock' && !targeting.include?.length && <p>{__('Start on posts only. Add pages in Display rules.', 'wconvert')}</p>}
      <Button onClick={enable}>{confirm === 'lock' ? __('Enable content lock', 'wconvert') : __('Enable automatic placement', 'wconvert')}</Button>
      <Button variant="ghost" onClick={() => { setConfirm(false); manualChoice.current?.focus(); }}>{__('Cancel', 'wconvert')}</Button>
    </div>}
    {placement && <>
      <label htmlFor={`${id}-position`}>{__('Position in content', 'wconvert')}</label>
      <select id={`${id}-position`} value={placement.position} onChange={(event) => onChange({ inline_placement: event.target.value === 'after_paragraph' ? { position: 'after_paragraph', paragraph: 3, fallback: 'after_content' } : { position: event.target.value } })}>
        <option value="before_content">{__('Before content', 'wconvert')}</option>
        <option value="after_content">{__('After content', 'wconvert')}</option>
        {(commerceSupported() || placement.position === 'after_product_summary') && <option value="after_product_summary">{__('After WooCommerce product summary (classic themes)', 'wconvert')}</option>}
        <option value="after_paragraph">{__('After a paragraph', 'wconvert')}</option>
      </select>
      {placement.position === 'after_product_summary' && <p>{__('Shows on matching product pages in classic WooCommerce themes. Include your product pages below. For block themes, use Manual and place the WConvert campaign block in the product template.', 'wconvert')}</p>}
      {placement.position === 'after_paragraph' && <>
        <label htmlFor={`${id}-paragraph`}>{__('Paragraph number', 'wconvert')}</label>
        <Input id={`${id}-paragraph`} type="number" min={1} max={100} aria-invalid={!validParagraph} value={placement.paragraph ?? ''} onChange={(event) => onChange({ inline_placement: { ...placement, paragraph: event.target.value === '' ? undefined : Number(event.target.value) } })} />
        {!validParagraph && <p role="alert">{__('Enter a whole paragraph number from 1 to 100.', 'wconvert')}</p>}
        <label htmlFor={`${id}-fallback`}>{__('If there are fewer paragraphs', 'wconvert')}</label>
        <select id={`${id}-fallback`} value={placement.fallback ?? 'after_content'} onChange={(event) => onChange({ inline_placement: { ...placement, fallback: event.target.value } })}>
          <option value="after_content">{__('Place after content', 'wconvert')}</option>
          <option value="skip">{__('Do not show on this page', 'wconvert')}</option>
        </select>
        <p>{__('Counts top-level, non-empty paragraphs only.', 'wconvert')}</p>
      </>}
      <label htmlFor={`${id}-priority`}>{__('Automatic placement priority', 'wconvert')}</label>
      <Input id={`${id}-priority`} type="number" min={0} max={100} value={Number(config.priority ?? 0)} onChange={(event) => onChange({ priority: Math.max(0, Math.min(100, Math.trunc(Number(event.target.value) || 0))) })} />
      <p>{__('One automatic Campaign per page. Higher priority wins; manual embeds take precedence.', 'wconvert')}</p>
      <p>{__('For page builders or custom layouts, use manual placement.', 'wconvert')}</p>
      {!compatible && <p role="alert">{__('Automatic placement requires page load as its only trigger. Update When it appears in Display rules, or choose manual placement.', 'wconvert')}</p>}
    </>}
  </div>;
}
