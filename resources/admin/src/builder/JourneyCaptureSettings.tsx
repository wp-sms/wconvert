import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { captureName, setCaptureName } from './structure/captureDetails';

export function JourneyCaptureSettings({ tree, step, onChange, destinationSummary, onDestinations }: {
  destinationSummary?: string; onDestinations?(): void;
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
}) {
  const screen = tree.steps[step];
  const submit = walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  if (!submit || !('submission' in submit)) return null;
  const fields = walkNodes(screen.content).filter(node => node.type === 'field' && 'name' in node);
  const name = captureName(tree, screen.id);
  return <section className="wconvert-journey-settings"><h4>{__('Contact details', 'wconvert')}</h4>
    <ul className="wconvert-journey-capture-fields">{fields.map((field, index) => <li key={index}><strong>{'label' in field ? field.label : 'name' in field ? field.name : ''}</strong><span>{'required' in field && field.required ? __('Required', 'wconvert') : __('Optional', 'wconvert')}</span></li>)}</ul>
    <p>{__('Answers from this visitor’s path are included in this save. Moving to the next question does not save an enquiry.', 'wconvert')}</p>
    <label className="wconvert-journey-settings__check"><input type="checkbox" checked={!!name.node} disabled={name.customized} onChange={event => onChange(setCaptureName(tree, screen.id, event.target.checked))} />{__('Ask for a name (optional)', 'wconvert')}</label>
    {name.customized && <p>{__('The name field has custom settings or belongs to another screen. Use Edit design on that screen to change it.', 'wconvert')}</p>}
    <label className="wconvert-journey-settings__check"><input type="checkbox" checked={screen.review_answers === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, review_answers: event.target.checked } : item) })} />{__('Let visitors review earlier answers before submitting', 'wconvert')}</label>
    <label>{__('How you will use their details', 'wconvert')}<textarea rows={3} maxLength={500} value={screen.details_note ?? ''} placeholder={__('We use your details to reply to your request.', 'wconvert')}
      onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, details_note: event.target.value } : item) }, `journey:${screen.id}:details-note`)} /></label>
    <p>{__('An enquiry is not marketing permission. Use explicit consent for marketing and review it in Edit design.', 'wconvert')}</p>
    {onDestinations && <div className="wconvert-journey-handoff"><strong>{__('After submission is saved', 'wconvert')}</strong><button type="button" onClick={onDestinations}>{destinationSummary || __('Review destinations', 'wconvert')} →</button><p>{__('Delivery runs after saving and does not change the visitor’s next screen.', 'wconvert')}</p></div>}
  </section>;
}
