import type { ReactNode } from 'react';
import { humanize } from '../lib/format';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { captureName, setCaptureName } from './structure/captureDetails';
import { nodesOf, nodeAt } from './structure/tree';
import { withValue, type Path } from './panel';
import { ScreenFact } from './ScreenPanel';

/**
 * A form screen's **Form** section (ADR 0134): its fields, each a way to that
 * field's own panel with its Required switch beside it, and what the form
 * saves. A field's words are edited on the field — once, in one place.
 */
export function JourneyCaptureSettings({ tree, step, onChange, destinationSummary, onDestinations, consentEditor, onSelectField }: {
  consentEditor?: ReactNode; destinationSummary?: string; onDestinations?(): void;
  /** Opens a field's own panel: where its label and example text are edited. */
  onSelectField?(path: Path): void;
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
}) {
  const screen = tree.steps[step];
  const submit = walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  if (!submit || !('submission' in submit)) return <>{consentEditor}</>;
  const blocks = nodesOf(tree).filter(block => block.path[0] === step);
  const fields = blocks.filter(block => block.type === 'field'
    && !blocks.some(ancestor => ancestor.hidden && ancestor.path.every((part, index) => block.path[index] === part)));
  const name = captureName(tree, screen.id);
  return <section className="wconvert-journey-settings wconvert-screen-form"><h4>{__('Form', 'wconvert')}</h4>
    <ul className="wconvert-journey-capture-fields">{fields.map(block => {
      const field = nodeAt(tree, block.path)!;
      if (field.type !== 'field' || !('name' in field)) return null;
      const label = field.label || humanize(String(field.name));
      return <li key={block.path.join('.')} className="wconvert-journey-capture-field">
        {onSelectField ? <button type="button" className="wconvert-screen-form__field" onClick={() => onSelectField(block.path)}>{label}</button> : <span>{label}</span>}
        <label className="wconvert-journey-settings__check"><input type="checkbox" checked={field.required === true}
          onChange={event => onChange(withValue(tree, block.path, 'required', event.target.checked))} />{__('Required', 'wconvert')}</label>
      </li>;
    })}</ul>
    <p>{__('Their answers are saved together when they submit this screen.', 'wconvert')}</p>
    <label className="wconvert-journey-settings__check"><input type="checkbox" checked={!!name.node} disabled={name.customized} onChange={event => onChange(setCaptureName(tree, screen.id, event.target.checked))} />{__('Ask for a name (optional)', 'wconvert')}</label>
    {name.customized && <p>{__('The name field has custom settings or belongs to another screen. Open the field on that screen to change it.', 'wconvert')}</p>}
    {tree.steps.some(item => walkNodes(item.content).some(node => node.type === 'question')) && <label className="wconvert-journey-settings__check"><input type="checkbox" checked={screen.review_answers === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, review_answers: event.target.checked } : item) })} />{__('Let visitors review earlier answers before submitting', 'wconvert')}</label>}
    <label>{__('How you will use their details', 'wconvert')}<textarea rows={3} maxLength={500} value={screen.details_note ?? ''} placeholder={__('Explain what visitors are signing up for or how you will contact them.', 'wconvert')}
      onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, details_note: event.target.value } : item) }, `journey:${screen.id}:details-note`)} /></label>

    {consentEditor}
    <p className="wconvert-screen-submits"><strong>{__('When submitted', 'wconvert')}</strong> · {__('Save the lead', 'wconvert')}</p>
    {onDestinations && <ScreenFact label={__('Where leads go', 'wconvert')} value={destinationSummary || __('Keep in WConvert only', 'wconvert')}
      action={__('Destinations', 'wconvert')} onAction={onDestinations} />}
  </section>;
}
