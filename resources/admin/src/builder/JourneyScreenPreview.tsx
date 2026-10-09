import { useId, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { Template } from '@renderer/types';
import { Preview } from './Preview';
import { PreviewWidth } from './PreviewWidth';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';

/**
 * A single rendered screen, deliberately separate from a routed visitor test.
 * On its own it is the body of a Large `AdminDialog` the host owns; `embedded`
 * draws it inside Preview & test, which already has a header and footer.
 */
export function JourneyScreenPreview({ template, step, onEdit, onTest, embedded = false }: {
  template: Template; step: number; onEdit(): void; onTest(): void; embedded?: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  const id = useId();
  const screen = template.tree.steps[step];
  const [resultId, setResultId] = useState(() => screen.results?.find(result => !result.when)?.id ?? '');
  const result = screen.results?.find(item => item.id === resultId);
  // A preview-only default renders the chosen variant without changing campaign rules.
  const previewTemplate = useMemo(() => result ? { ...template, tree: { ...template.tree,
    steps: template.tree.steps.map((item, at) => at === step ? { ...item, results: [{ ...result, when: undefined }] } : item),
  } } : template, [template, step, result]);
  const content = <>
    {template.tree.steps[step].review_answers && <p>{__('Try as a visitor to preview the answer summary.', 'wconvert')}</p>}
    <div className="wconvert-preview-test__toolbar">{embedded && <span>{__('Layout preview · buttons are inactive', 'wconvert')}</span>}<PreviewWidth mobile={mobile} onChange={setMobile} /></div>
    {!!screen.results?.length && <div className="wconvert-journey-screen-preview__result">
      <label htmlFor={id}>{__('Result to preview', 'wconvert')}</label>
      <select id={id} value={result?.id ?? ''} onChange={event => setResultId(event.target.value)}>
        {screen.results.map((item, index) => <option key={item.id} value={item.id}>{item.heading || sprintf(__('Result %d', 'wconvert'), index + 1)}{!item.when ? ` · ${__('Everyone else', 'wconvert')}` : ''}</option>)}
      </select>
    </div>}
    <div className="wconvert-journey-screen-preview__stage"><div data-mobile={mobile} className="wconvert-journey-screen-preview__screen" inert>
      <Preview template={previewTemplate} step={step} />
    </div></div>
  </>;
  const edit = <Button type="button" variant="outline" onClick={onEdit}>{__('Edit this screen', 'wconvert')}</Button>;
  const test = <Button type="button" onClick={onTest}>{__('Try as a visitor', 'wconvert')}</Button>;
  if (embedded) return <>{content}<div className="wconvert-preview-test__screen-actions">{edit}{test}</div></>;
  return <>
    <AdminDialogHeader title={<bdi>{screen.name}</bdi>} meta={__('Appearance only. Try as a visitor to check its conditions. Nothing is saved or sent.', 'wconvert')} />
    <AdminDialogBody className="wconvert-journey-screen-preview__body">{content}</AdminDialogBody>
    <AdminDialogFooter back={edit}>{test}</AdminDialogFooter>
  </>;
}
