import { __ } from '@wordpress/i18n';
import { useId } from 'react';
import type { TemplateTree } from '@renderer/types';
import type { Path } from './panel';
import { captureOwnership, withCaptureOwner } from './structure/captureOwnership';
import { PanelField, PanelHint } from './PanelSection';
import { NativeSelect } from '../components/ui/native-select';

export function CaptureOwnership({ tree, path, onChange }: {
  tree: TemplateTree; path: Path; onChange(tree: TemplateTree): void;
}) {
  const description = useId();
  const state = captureOwnership(tree, path);
  if (!state) return null;
  // In the panel grammar (ADR 0136): the rule is the InfoTip's; what needs doing stays a line.
  return <PanelField label={__('Saved by', 'wconvert')} htmlFor={description}
    tip={state.key === 'consents'
      ? __('Accepted only on submitting this form. Each form needs its own consent.', 'wconvert')
      : __('Saved only when this form is submitted. Moving on keeps a draft.', 'wconvert')}>
    <NativeSelect id={description} value={state.owners.length === 1 ? state.owners[0].id : ''}
      onChange={event => onChange(withCaptureOwner(tree, path, event.target.value))}>
      <option value="">{__('Choose a form', 'wconvert')}</option>
      {state.choices.map(choice => <option key={choice.id} value={choice.id} disabled={!!choice.reason}>{choice.name}</option>)}
    </NativeSelect>
    {state.owners.length > 1 && <p role="status" className="wconvert-panel-warn">{__('This is in more than one form. Choose one.', 'wconvert')}</p>}
    {state.choices.filter(choice => choice.reason).map(choice => <PanelHint key={choice.id}>{choice.reason}</PanelHint>)}
    {!state.choices.length && <PanelHint>{__('Add a form before assigning this element.', 'wconvert')}</PanelHint>}
  </PanelField>;
}
