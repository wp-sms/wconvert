import { __ } from '@wordpress/i18n';
import { useId } from 'react';
import type { TemplateTree } from '@renderer/types';
import type { Path } from './panel';
import { captureOwnership, withCaptureOwner } from './structure/captureOwnership';

export function CaptureOwnership({ tree, path, onChange }: {
  tree: TemplateTree; path: Path; onChange(tree: TemplateTree): void;
}) {
  const description = useId();
  const state = captureOwnership(tree, path);
  if (!state) return null;
  return <section className="wconvert-group">
    <label className="wconvert-slot__key">{__('Saved with', 'wconvert')}
      <select aria-describedby={description} value={state.owners.length === 1 ? state.owners[0].id : ''}
        onChange={event => onChange(withCaptureOwner(tree, path, event.target.value))}>
        <option value="">{__('Choose a save point', 'wconvert')}</option>
        {state.choices.map(choice => <option key={choice.id} value={choice.id} disabled={!!choice.reason}>{choice.name}</option>)}
      </select>
    </label>
    <p id={description} className="description">{state.key === 'consents'
      ? __('This checkbox is accepted only when the visitor submits this save point. Each signup needs its own consent.', 'wconvert')
      : __('This detail is saved only when the visitor submits this save point. Continuing to another screen keeps it as a draft.', 'wconvert')}</p>
    {state.owners.length > 1 && <p role="status">{__('This element belongs to more than one save. Choose the one that should accept it.', 'wconvert')}</p>}
    {state.choices.filter(choice => choice.reason).map(choice => <p key={choice.id} className="description">{choice.reason}</p>)}
    {!state.choices.length && <p>{__('Add a signup screen in Screens before assigning this element.', 'wconvert')}</p>}
  </section>;
}
