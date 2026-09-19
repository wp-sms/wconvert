import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usesPageLoadOnly, type InlinePlacementProps } from '@/inlinePlacement';
import type { Rule, Targeting } from '@/builder/api';
import './placement.css';

export default function PlacementSettings({ config, vocabulary, onChange }: InlinePlacementProps) {
  const id = useId();
  const [confirm, setConfirm] = useState(false);
  const manualChoice = useRef<HTMLInputElement>(null);
  const automaticChoice = useRef<HTMLInputElement>(null);
  const placement = config.inline_placement as { position: string; paragraph?: number; fallback?: string } | null;
  const rules = (config.rules ?? []) as Rule[];
  const triggerNames = new Set(vocabulary.triggers.map((rule) => rule.type));
  const compatible = usesPageLoadOnly(rules, vocabulary);
  const validParagraph = Number.isInteger(placement?.paragraph) && (placement?.paragraph ?? 0) >= 1 && (placement?.paragraph ?? 0) <= 100;
  const targeting = (config.targeting ?? {}) as Targeting;
  const enable = () => {
    onChange({ inline_placement: { position: 'after_content' },
      rules: [...rules.filter((rule) => !triggerNames.has(rule.type)), { type: 'page_load' }],
      ...(!targeting.include?.length ? { targeting: { ...targeting, include: [{ type: 'singular', value: 'post' }] } } : {}),
    });
    setConfirm(false);
    automaticChoice.current?.focus();
  };
  return <fieldset className="wconvert-overlay-placement wconvert-inline-placement">
    <legend>{__('Inline placement', 'wconvert')}</legend>
    <label><input ref={manualChoice} type="radio" name={id} checked={!placement} onChange={() => { setConfirm(false); onChange({ inline_placement: null }); }} /> {__('Manual — block or shortcode', 'wconvert')}</label>
    <label><input ref={automaticChoice} type="radio" name={id} checked={!!placement} onChange={() => setConfirm(true)} /> {__('Automatic', 'wconvert')}</label>
    {confirm && <div role="group" aria-label={__('Enable automatic placement', 'wconvert')}>
      <p>{__('Automatic placement starts after content. It uses page load instead of other triggers; audience, schedule and frequency settings stay in place.', 'wconvert')}</p>
      {!targeting.include?.length && <p>{__('Your Pages setting will start with posts only. You can add pages under Display rules.', 'wconvert')}</p>}
      <Button onClick={enable}>{__('Enable automatic placement', 'wconvert')}</Button>
      <Button variant="ghost" onClick={() => { setConfirm(false); manualChoice.current?.focus(); }}>{__('Cancel', 'wconvert')}</Button>
    </div>}
    {placement && <>
      <label htmlFor={`${id}-position`}>{__('Position in content', 'wconvert')}</label>
      <select id={`${id}-position`} value={placement.position} onChange={(event) => onChange({ inline_placement: event.target.value === 'after_paragraph' ? { position: 'after_paragraph', paragraph: 3, fallback: 'after_content' } : { position: event.target.value } })}>
        <option value="before_content">{__('Before content', 'wconvert')}</option>
        <option value="after_content">{__('After content', 'wconvert')}</option>
        <option value="after_paragraph">{__('After a paragraph', 'wconvert')}</option>
      </select>
      {placement.position === 'after_paragraph' && <>
        <label htmlFor={`${id}-paragraph`}>{__('Paragraph number', 'wconvert')}</label>
        <Input id={`${id}-paragraph`} type="number" min={1} max={100} aria-invalid={!validParagraph} value={placement.paragraph ?? ''} onChange={(event) => onChange({ inline_placement: { ...placement, paragraph: event.target.value === '' ? undefined : Number(event.target.value) } })} />
        {!validParagraph && <p role="alert">{__('Enter a whole paragraph number from 1 to 100.', 'wconvert')}</p>}
        <label htmlFor={`${id}-fallback`}>{__('If there are fewer paragraphs', 'wconvert')}</label>
        <select id={`${id}-fallback`} value={placement.fallback ?? 'after_content'} onChange={(event) => onChange({ inline_placement: { ...placement, fallback: event.target.value } })}>
          <option value="after_content">{__('Place after content', 'wconvert')}</option>
          <option value="skip">{__('Do not show on this page', 'wconvert')}</option>
        </select>
        <p>{__('Counts non-empty paragraphs directly in the article, not paragraphs inside groups, columns, quotes, lists or tables.', 'wconvert')}</p>
      </>}
      <label htmlFor={`${id}-priority`}>{__('Automatic placement priority', 'wconvert')}</label>
      <Input id={`${id}-priority`} type="number" min={0} max={100} value={Number(config.priority ?? 0)} onChange={(event) => onChange({ priority: Math.max(0, Math.min(100, Math.trunc(Number(event.target.value) || 0))) })} />
      <p>{__('Only one eligible automatic Campaign appears per page; higher priority wins. A manual block or shortcode for this Campaign takes precedence.', 'wconvert')}</p>
      <p>{__('Works in standard WordPress post and page content. For page builders and custom layouts, use manual placement. Check the published page on mobile too.', 'wconvert')}</p>
      {!compatible && <p role="alert">{__('Automatic placement requires page load as its only trigger. Update When it appears in Display rules, or choose manual placement.', 'wconvert')}</p>}
    </>}
  </fieldset>;
}
