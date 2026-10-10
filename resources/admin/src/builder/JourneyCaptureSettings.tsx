import type { ReactNode } from 'react';
import { humanize } from '../lib/format';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Disclosure } from '../shell/Disclosure';
import { CheckRow } from '../shell/CheckRow';
import { walkNodes } from './structure/journey';
import { captureName, setCaptureName } from './structure/captureDetails';
import { nodesOf, nodeAt } from './structure/tree';
import { withValue, type Path } from './panel';
import { PanelHint, PanelSection } from './PanelSection';

/**
 * A form screen's **Form** section (ADR 0134, 0136): its fields as one compact
 * list, each a way to that field's own panel with its Required switch beside
 * it; whether to ask for a name; and two closed disclosures whose summaries say
 * what is set. What the form saves and where leads go are facts, at the top
 * of the panel.
 */
export function JourneyCaptureSettings({ tree, step, onChange, consentEditor, onSelectField }: {
  /** The screen's consent wording, drawn inside the "Consent" disclosure. */
  consentEditor?: ReactNode;
  /** Opens a field's own panel: where its label and example text are edited. */
  onSelectField?(path: Path): void;
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
}) {
  const screen = tree.steps[step];
  const submit = walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const consent = nodesOf(tree).filter(block => block.path[0] === step && block.type === 'consent');
  const consentSummary = consent.length === 0 ? '' : consent.every(block => block.hidden) ? __('Hidden', 'wconvert') : __('Shown', 'wconvert');
  const consentSection = consentEditor && consent.length > 0 && <Disclosure variant="inline" className="wconvert-journey-consent-settings" title={__('Consent', 'wconvert')} summary={consentSummary}>{consentEditor}</Disclosure>;
  if (!submit || !('submission' in submit)) return consentSection ? <PanelSection>{consentSection}</PanelSection> : null;
  const blocks = nodesOf(tree).filter(block => block.path[0] === step);
  const fields = blocks.filter(block => block.type === 'field'
    && !blocks.some(ancestor => ancestor.hidden && ancestor.path.every((part, index) => block.path[index] === part)));
  const name = captureName(tree, screen.id);
  const note = screen.details_note ?? '';
  return <PanelSection title={__('Form', 'wconvert')} className="wconvert-screen-form">
    <ul className="wconvert-journey-capture-fields">{fields.map(block => {
      const field = nodeAt(tree, block.path)!;
      if (field.type !== 'field' || !('name' in field)) return null;
      const label = field.label || humanize(String(field.name));
      return <li key={block.path.join('.')} className="wconvert-journey-capture-field">
        {onSelectField ? <button type="button" className="wconvert-screen-form__field" onClick={() => onSelectField(block.path)}>{label}</button> : <span>{label}</span>}
        <CheckRow className="wconvert-check" label={__('Required', 'wconvert')} checked={field.required === true}
          onChange={event => onChange(withValue(tree, block.path, 'required', event.target.checked))} />
      </li>;
    })}</ul>
    <CheckRow className="wconvert-check" label={__('Ask for their name', 'wconvert')} checked={!!name.node} disabled={name.customized}
      hint={name.customized ? __('The name field has its own settings. Change it on its own panel.', 'wconvert') : undefined}
      onChange={event => onChange(setCaptureName(tree, screen.id, event.target.checked))} />
    {tree.steps.some(item => walkNodes(item.content).some(node => node.type === 'question')) && <CheckRow className="wconvert-check" label={__('Let visitors review earlier answers', 'wconvert')}
      checked={screen.review_answers === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, review_answers: event.target.checked } : item) })} />}
    <div>
      <Disclosure variant="inline" title={__('How you’ll use their details', 'wconvert')} summary={note.trim() ? __('Set', 'wconvert') : __('Not set', 'wconvert')}>
        <textarea aria-label={__('How you’ll use their details', 'wconvert')} rows={2} maxLength={500} value={note} placeholder={__('What visitors sign up for, or how you will contact them', 'wconvert')}
          onChange={event => onChange({ ...tree, steps: tree.steps.map((item, index) => index === step ? { ...item, details_note: event.target.value } : item) }, `journey:${screen.id}:details-note`)} />
        <PanelHint>{__('Shown under the headline.', 'wconvert')}</PanelHint>
      </Disclosure>
      {consentSection}
    </div>
  </PanelSection>;
}
