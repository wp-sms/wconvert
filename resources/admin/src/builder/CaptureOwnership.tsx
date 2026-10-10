import { __ } from '@wordpress/i18n';
import { useId } from 'react';
import type { TemplateTree } from '@renderer/types';
import type { Path } from './panel';
import { captureOwnership, withCaptureOwner } from './structure/captureOwnership';
import { PanelField, PanelHint } from './PanelSection';

export function CaptureOwnership({ tree, path, onChange }: {
  tree: TemplateTree; path: Path; onChange(tree: TemplateTree): void;
}) {
  const description = useId();
  const state = captureOwnership(tree, path);
  if (!state) return null;
  // In the panel grammar (ADR 0136): the rule is the InfoTip's; what needs doing stays a line.
  return <PanelField label={__('Saved by', 'wconvert')} htmlFor={description}
    tip={state.key === 'consents'
      ? __('This checkbox is accepted only when the visitor submits this form. Each signup needs its own consent.', 'wconvert')
      : __('This detail is saved only when the visitor submits this form. Continuing to another screen keeps it as a draft.', 'wconvert')}>
    <select id={description} value={state.owners.length === 1 ? state.owners[0].id : ''}
      onChange={event => onChange(withCaptureOwner(tree, path, event.target.value))}>
      <option value="">{__('Choose a form', 'wconvert')}</option>
      {state.choices.map(choice => <option key={choice.id} value={choice.id} disabled={!!choice.reason}>{choice.name}</option>)}
    </select>
    {state.owners.length > 1 && <p role="status" className="wconvert-panel-warn">{__('This element belongs to more than one save. Choose the one that should accept it.', 'wconvert')}</p>}
    {state.choices.filter(choice => choice.reason).map(choice => <PanelHint key={choice.id}>{choice.reason}</PanelHint>)}
    {!state.choices.length && <PanelHint>{__('Add a signup screen before assigning this element.', 'wconvert')}</PanelHint>}
  </PanelField>;
}
