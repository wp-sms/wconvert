import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { humanize } from '../lib/format';
import { __ } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { captureName, setCaptureName } from './structure/captureDetails';
import { nodesOf, nodeAt } from './structure/tree';
import { withValue } from './panel';

export function JourneyCaptureSettings({ tree, step, onChange, destinationSummary, onDestinations, consentEditor }: {
  consentEditor?: ReactNode; destinationSummary?: string; onDestinations?(): void;
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
}) {
  const screen = tree.steps[step];
  const submit = walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  if (!submit || !('submission' in submit)) return <>{consentEditor}</>;
  const blocks = nodesOf(tree).filter(block => block.path[0] === step);
  const fields = blocks.filter(block => block.type === 'field'
    && !blocks.some(ancestor => ancestor.hidden && ancestor.path.every((part, index) => block.path[index] === part)));
  const name = captureName(tree, screen.id);
  return <section className="wconvert-journey-settings"><h4>{__('Contact details', 'wconvert')}</h4>
    <div className="wconvert-journey-capture-fields">{fields.map(block => {
      const field = nodeAt(tree, block.path)!;
      if (field.type !== 'field' || !('name' in field)) return null;
      return <Disclosure key={block.path.join('.')} className="wconvert-journey-capture-field" title={field.label || humanize(String(field.name))} summary={field.required ? __('Required', 'wconvert') : __('Optional', 'wconvert')}>
        <label>{__('Field label', 'wconvert')}<input value={field.label ?? ''} maxLength={200} onChange={event => onChange(withValue(tree, block.path, 'label', event.target.value), `journey:${screen.id}:field:${block.path.join('.')}:label`)} /></label>
        <label>{__('Placeholder', 'wconvert')}<input value={field.placeholder ?? ''} maxLength={200} onChange={event => onChange(withValue(tree, block.path, 'placeholder', event.target.value), `journey:${screen.id}:field:${block.path.join('.')}:placeholder`)} /></label>

      </Disclosure>;
    })}</div>
    <p>{__('Their answers are saved together when they submit this screen.', 'wconvert')}</p>
    <label className="wconvert-journey-settings__check"><input type="checkbox" checked={!!name.node} disabled={name.customized} onChange={event => onChange(setCaptureName(tree, screen.id, event.target.checked))} />{__('Ask for a name (optional)', 'wconvert')}</label>
    {name.customized && <p>{__('The name field has custom settings or belongs to another screen. Use Design on that screen to change it.', 'wconvert')}</p>}
    {tree.steps.some(item => walkNodes(item.content).some(node => node.type === 'question')) && <label className="wconvert-journey-settings__check"><input type="checkbox" checked={screen.review_answers === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, review_answers: event.target.checked } : item) })} />{__('Let visitors review earlier answers before submitting', 'wconvert')}</label>}
    <label>{__('How you will use their details', 'wconvert')}<textarea rows={3} maxLength={500} value={screen.details_note ?? ''} placeholder={__('Explain what visitors are signing up for or how you will contact them.', 'wconvert')}
      onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, details_note: event.target.value } : item) }, `journey:${screen.id}:details-note`)} /></label>

    {consentEditor}
    {onDestinations && <div className="wconvert-journey-handoff"><strong>{__('After submission is saved', 'wconvert')}</strong><button type="button" onClick={onDestinations}>{destinationSummary || __('Review destinations', 'wconvert')} <ArrowRight aria-hidden="true" className="inline size-3 rtl:-scale-x-100" /></button><p>{__('Delivery runs after saving and does not change the visitor’s next screen.', 'wconvert')}</p></div>}
  </section>;
}
