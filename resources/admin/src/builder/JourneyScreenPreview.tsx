import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';
import { Preview } from './Preview';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';

/** A single rendered screen, deliberately separate from a routed visitor test. */
export function JourneyScreenPreview({ template, step, onEdit, onTest }: {
  template: Template; step: number; onEdit(): void; onTest(): void;
}) {
  const [mobile, setMobile] = useState(false);
  return <>
    <DialogTitle>{__('Preview screen', 'wconvert')}: <bdi>{template.tree.steps[step].name}</bdi></DialogTitle>
    <DialogDescription>{__('Appearance only. Use Test journey to check answers, routes and saving. Nothing is submitted here.', 'wconvert')}</DialogDescription>
    {template.tree.steps[step].review_answers && <p>{__('The answer summary is filled during a visit. Use Test journey to try it with answers.', 'wconvert')}</p>}
    <div role="group" aria-label={__('Preview width', 'wconvert')} className="wconvert-journey-pane__tabs">
      <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>{__('Desktop', 'wconvert')}</button>
      <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>{__('Mobile', 'wconvert')}</button>
    </div>
    <div className="wconvert-journey-screen-preview__stage"><div data-mobile={mobile} className="wconvert-journey-screen-preview__screen" inert>
      <Preview template={template} step={step} />
    </div></div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onEdit}>{__('Edit this screen', 'wconvert')}</Button><Button type="button" onClick={onTest}>{__('Test journey', 'wconvert')}</Button></div>
  </>;
}
