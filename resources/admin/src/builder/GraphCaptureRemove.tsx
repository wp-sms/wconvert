import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { graphCaptureRemovalPlan, removeGraphCapture } from './structure/graphCaptureRemoval';
import { graphChangeImpact } from './structure/graphChangeImpact';

export function GraphCaptureRemove({ tree, submissionId, onRemove, onCancel }: {
  tree: TemplateTree; submissionId: string; onRemove(next: TemplateTree, destination: string): void; onCancel(): void;
}) {
  const id = useId();
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const plan = graphCaptureRemovalPlan(tree, submissionId);
  const removal = removeGraphCapture(tree, submissionId, destinations);
  const impact = removal ? graphChangeImpact(tree, removal.next) : null;
  const name = (screenId: string) => tree.steps.find(screen => screen.id === screenId)?.name ?? screenId;
  return <>
    <DialogTitle>{__('Remove this optional signup?', 'wconvert')}</DialogTitle>
    <DialogDescription>{__('Remove the screens collecting this signup, its contact fields, consent and save/skip actions together. Previously saved Leads are unchanged. Undo restores this draft edit.', 'wconvert')}</DialogDescription>
    <div className="wconvert-graph-insert__body">
      <strong>{__('Screens to remove', 'wconvert')}</strong><ul>{plan.screens.map(screen => <li key={screen.id}>{screen.name}</li>)}</ul>
      <p>{__('Questions and other content on these screens are also removed. Other screens stay in the draft; review any wording that invites visitors to this signup.', 'wconvert')}</p>
      {plan.reason ? <p role="status">{plan.reason}</p> : plan.routes.map((route, index) => <div className="wconvert-graph-insert__summary" key={route.from}>
        <label htmlFor={`${id}-${index}`}>{route.from === tree.graph?.entry ? __('New first screen', 'wconvert')
          : sprintf(__('Paths entering “%s” continue at', 'wconvert'), name(route.from))}</label>
        {route.incoming.length > 0 && <p>{sprintf(__('From: %s. Incoming conditions and priority stay the same.', 'wconvert'), [...new Set(route.incoming.map(edge => name(edge.from)))].join(', '))}</p>}
        <select id={`${id}-${index}`} value={destinations[route.from] ?? route.preferred} onChange={event => setDestinations({ ...destinations, [route.from]: event.target.value })}>
          <option value="" disabled>{__('Choose a continuation…', 'wconvert')}</option>
          {route.targets.map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
        </select>
      </div>)}
      {!plan.reason && !plan.routes.length && <p>{__('No incoming paths need to change.', 'wconvert')}</p>}
      <div aria-live="polite">{impact && <p className="wconvert-graph-insert__summary">{impact}</p>}</div>
    </div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>
      <Button type="button" variant="destructive" disabled={!removal} onClick={() => { if (removal) onRemove(removal.next, removal.destination); }}>{__('Remove signup', 'wconvert')}</Button></div>
  </>;
}
