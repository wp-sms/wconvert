import { planFrom, incompletePlan } from '@/builder/rules/plan';
import { useEffect, useId, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type InlinePlacementProps } from '@/inlinePlacement';
import type { Frequency, Targeting } from '@/builder/api';
import { ManualPlacement } from '@/builder/ManualPlacement';
import { ChoiceChips } from '@/builder/rules/ChoiceChips';
import { derive } from '@/builder/rules/picks';
import { whereReading } from '@/builder/rules/sentence';
import type { DisplayRulesValue } from '@/builder/rules/summaries';
import './placement.css';
import { commerceSupported } from '@/settings';
import LockSettings from '../../content-lock/admin/LockSettings';

type Method = 'manual' | 'automatic' | 'lock';
type Placement = { position: string; paragraph?: number; fallback?: string };

/**
 * How an inline Campaign gets onto the page — the Placement part of *Where
 * does it show?*. Drawn in the tab's own language: chips for the choice, a
 * settings card for what goes with it.
 *
 * Automatic placement and content lock both insert the form as the page
 * loads, so both need *When does it open?* at Right away, and automatic
 * placement starts on blog posts when no pages are chosen. Choosing one asks
 * first **only when that changes another answer**, and says which, from what,
 * to what.
 */
export default function PlacementSettings({ optinId, published, config, vocabulary, onChange }: InlinePlacementProps) {
  const id = useId();
  const [confirm, setConfirm] = useState<Exclude<Method, 'manual'> | false>(false);
  const title = useRef<HTMLParagraphElement>(null);
  const placement = config.inline_placement as Placement | null;
  const locked = config.content_lock != null;
  const method: Method = locked ? 'lock' : placement ? 'automatic' : 'manual';
  const plan = planFrom(config.display_rules) ?? incompletePlan();
  const compatible = plan.opening.mode === 'immediate';
  const targeting = (config.targeting ?? {}) as Targeting;
  const value: DisplayRulesValue = { display_rules: plan, targeting, frequency: (config.frequency ?? {}) as Frequency, schedule: {}, priority: 0 };
  const when = derive('when', value, vocabulary);

  /** What switching to `next` would change in the other questions. */
  const changesFor = (next: Exclude<Method, 'manual'>) => [
    ...(compatible ? [] : [{ question: __('When does it open?', 'wconvert'), from: when.open ? __('Custom rules', 'wconvert') : when.label(value), to: __('Right away', 'wconvert') }]),
    ...(next === 'automatic' && !targeting.include?.length ? [{ question: __('Where does it show?', 'wconvert'),
      from: whereReading(derive('where', value, vocabulary).id, targeting, vocabulary.targeting ?? []).answer.text, to: __('Blog posts only', 'wconvert') }] : []),
  ];
  const apply = (next: Exclude<Method, 'manual'>) => {
    onChange({ inline_placement: next === 'lock' ? null : { position: 'after_content' }, content_lock: next === 'lock' ? { mode: 'hide' } : null,
      display_rules: { ...plan, opening: { mode: 'immediate' } }, rules: undefined,
      ...(next === 'automatic' && !targeting.include?.length ? { targeting: { ...targeting, include: [{ type: 'singular', value: 'post' }] } } : {}),
    });
    setConfirm(false);
  };
  const choose = (next: Method) => {
    if (next === 'manual') { setConfirm(false); onChange({ inline_placement: null, content_lock: null }); return; }
    if (changesFor(next).length === 0) apply(next);
    else setConfirm(next);
  };
  useEffect(() => { if (confirm) title.current?.focus(); }, [confirm]);
  const methodName = (each: Method) => each === 'manual' ? __('Manual', 'wconvert') : each === 'automatic' ? __('Automatic', 'wconvert') : __('Content lock', 'wconvert');

  return <div className="wconvert-inline-placement">
    <ChoiceChips label={__('Placement method', 'wconvert')} value={method} onChange={choose}
      options={(['manual', 'automatic', 'lock'] as const).map(each => ({ value: each, label: methodName(each) }))} />

    {confirm && <section className="wconvert-placement-confirm" aria-labelledby={`${id}-confirm`}>
      <p id={`${id}-confirm`} ref={title} tabIndex={-1} className="wconvert-placement-confirm__title">
        {confirm === 'lock' ? __('Switch to content lock?', 'wconvert') : __('Switch to automatic placement?', 'wconvert')}</p>
      <p className="wconvert-display-hint">{confirm === 'lock'
        ? __('A content lock covers the article as the page loads, so it has to open right away. This also changes:', 'wconvert')
        : __('Automatic placement adds the form to the page as it loads, so it has to open right away. This also changes:', 'wconvert')}</p>
      <ul className="wconvert-placement-confirm__changes">
        {changesFor(confirm).map(change => <li key={change.question}>
          <span className="wconvert-placement-confirm__question">{change.question}</span>
          <span className="wconvert-placement-confirm__from">{change.from}</span>
          <ArrowRight aria-label={__('becomes', 'wconvert')} className="rtl:-scale-x-100" />
          <span className="wconvert-placement-confirm__to">{change.to}</span>
        </li>)}
      </ul>
      <div className="wconvert-placement-confirm__actions">
        <Button size="sm" onClick={() => apply(confirm)}>{confirm === 'lock' ? __('Switch to content lock', 'wconvert') : __('Switch to automatic placement', 'wconvert')}</Button>
        <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>{sprintf(
          /* translators: %s: the placement method in use, e.g. “Manual”. */
          __('Keep %s', 'wconvert'), methodName(method))}</Button>
      </div>
    </section>}

    {method === 'manual' && !confirm && <ManualPlacement optinId={optinId} published={published} />}
    {method === 'lock' && !confirm && <LockSettings optinId={optinId} published={published} config={config} vocabulary={vocabulary} onChange={onChange} />}
    {method === 'automatic' && placement && !confirm && <Automatic id={id} placement={placement} compatible={compatible} priority={Number(config.priority ?? 0)}
      onPlacement={next => onChange({ inline_placement: next })} onPriority={priority => onChange({ priority })}
      onRightAway={() => onChange({ display_rules: { ...plan, opening: { mode: 'immediate' } }, rules: undefined })} />}
  </div>;
}

function Automatic({ id, placement, compatible, priority, onPlacement, onPriority, onRightAway }: {
  id: string; placement: Placement; compatible: boolean; priority: number;
  onPlacement: (next: Placement) => void; onPriority: (priority: number) => void; onRightAway: () => void;
}) {
  const validParagraph = Number.isInteger(placement.paragraph) && (placement.paragraph ?? 0) >= 1 && (placement.paragraph ?? 0) <= 100;
  const positions = [
    { value: 'before_content', label: __('Before the content', 'wconvert') },
    { value: 'after_content', label: __('After the content', 'wconvert') },
    { value: 'after_paragraph', label: placement.position === 'after_paragraph'
      ? <>{__('After paragraph', 'wconvert')}
        <input type="number" className="wconvert-quick-pick__number" min={1} max={100} aria-label={__('Paragraph number', 'wconvert')} aria-invalid={!validParagraph || undefined}
          value={placement.paragraph ?? ''} onChange={event => onPlacement({ ...placement, paragraph: event.target.value === '' ? undefined : Number(event.target.value) })} /></>
      : __('After a paragraph', 'wconvert') },
    ...(commerceSupported() || placement.position === 'after_product_summary' ? [{ value: 'after_product_summary', label: __('After the product summary', 'wconvert') }] : []),
  ];

  return <div className="wconvert-placement-panel">
    {!compatible && <p className="wconvert-display-hint" data-attention="true" role="alert">
      {__('Automatic placement needs “When does it open?” set to Right away.', 'wconvert')}{' '}
      <button type="button" className="wconvert-display-link" onClick={onRightAway}>{__('Set it to Right away', 'wconvert')}</button>
    </p>}
    <div className="wconvert-placement-field">
      <p className="wconvert-placement-row__title">{__('Position in the content', 'wconvert')}</p>
      <ChoiceChips label={__('Position in the content', 'wconvert')} value={placement.position} options={positions}
        onChange={next => onPlacement(next === 'after_paragraph' ? { position: 'after_paragraph', paragraph: 3, fallback: 'after_content' } : { position: next })} />
      {placement.position === 'after_paragraph' && !validParagraph && <p role="alert" className="wconvert-quick-picks__error">{__('Enter a whole paragraph number from 1 to 100.', 'wconvert')}</p>}
      {placement.position === 'after_product_summary' && <p className="wconvert-display-hint">{__('Classic WooCommerce themes only. For a block theme, choose Manual and add the block to the product template.', 'wconvert')}</p>}
    </div>
    {placement.position === 'after_paragraph' && <div className="wconvert-display-fields">
      <div><Label htmlFor={`${id}-fallback`}>{__('If there are fewer paragraphs', 'wconvert')}</Label>
        <select id={`${id}-fallback`} value={placement.fallback ?? 'after_content'} onChange={event => onPlacement({ ...placement, fallback: event.target.value })}>
          <option value="after_content">{__('Place it after the content', 'wconvert')}</option>
          <option value="skip">{__('Don’t show it on that page', 'wconvert')}</option>
        </select>
      </div>
    </div>}
    <div className="wconvert-display-settings">
      <div className="wconvert-placement-row">
        <div className="wconvert-placement-row__text">
          <Label htmlFor={`${id}-priority`} className="wconvert-placement-row__title">{__('Priority', 'wconvert')}</Label>
          <p id={`${id}-priority-help`} className="wconvert-display-hint">{__('One automatic Campaign shows per page, the highest priority first. A Campaign placed by hand always comes first.', 'wconvert')}</p>
        </div>
        <Input id={`${id}-priority`} className="w-24" type="number" min={0} max={100} value={priority} aria-describedby={`${id}-priority-help`}
          onChange={event => onPriority(Math.max(0, Math.min(100, Math.trunc(Number(event.target.value) || 0))))} />
      </div>
    </div>
    <p className="wconvert-display-hint">{__('Using a page builder or a custom layout? Choose Manual instead.', 'wconvert')}</p>
  </div>;
}
