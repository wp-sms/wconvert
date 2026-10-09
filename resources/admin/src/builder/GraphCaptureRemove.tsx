import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { graphCaptureRemovalPlan, removeGraphCapture } from './structure/graphCaptureRemoval';
import { graphChangeImpact } from './structure/graphChangeImpact';

/** A destructive confirm: the body of an `AlertDialog` the host owns (§9). */
export function GraphCaptureRemove({ tree, submissionId, onRemove, onCancel }: {
  tree: TemplateTree; submissionId: string; onRemove(next: TemplateTree, destination: string): void; onCancel(): void;
}) {
  const id = useId();
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const plan = graphCaptureRemovalPlan(tree, submissionId);
  const removal = removeGraphCapture(tree, submissionId, destinations);
  const impact = removal ? graphChangeImpact(tree, removal.next) : null;
  const name = (screenId: string) => tree.steps.find(screen => screen.id === screenId)?.name ?? __('Removed screen', 'wconvert');
  const refusal = plan.reason ?? (removal ? null : __('Choose where visitors continue first.', 'wconvert'));
  return <>
    <AlertDialogHeader>
      <AlertDialogTitle>{__('Remove this optional signup?', 'wconvert')}</AlertDialogTitle>
      <AlertDialogDescription>{__('Removes the screens collecting this signup, with their contact fields, consent and save or skip buttons. Other screens and saved leads stay. Undo restores this draft edit.', 'wconvert')}</AlertDialogDescription>
    </AlertDialogHeader>
    <div className="wconvert-graph-insert__body wconvert-graph-remove__body">
      {plan.reason ? <p role="status">{plan.reason}</p> : plan.routes.map((route, index) => <div className="wconvert-graph-insert__summary" key={route.from}>
        {route.preferred ? <p><strong>{sprintf(__('After removing: continue to %s.', 'wconvert'), name(route.preferred))}</strong></p> : <label htmlFor={`${id}-${index}`}>{route.from === tree.graph?.entry ? __('New first screen', 'wconvert')
          : sprintf(__('Paths entering “%s” continue at', 'wconvert'), name(route.from))}</label>}
        {route.incoming.length > 0 && <p>{sprintf(__('From: %s. Incoming conditions and priority stay the same.', 'wconvert'), [...new Set(route.incoming.map(edge => name(edge.from)))].join(', '))}</p>}
        {!route.preferred && <select id={`${id}-${index}`} value={destinations[route.from] ?? route.preferred} onChange={event => setDestinations({ ...destinations, [route.from]: event.target.value })}>
          <option value="" disabled>{__('Choose a continuation…', 'wconvert')}</option>
          {route.targets.map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
        </select>}
      </div>)}
      {!plan.reason && !plan.routes.length && <p>{__('No incoming paths need to change.', 'wconvert')}</p>}
      <strong>{__('Screens to remove', 'wconvert')}</strong><ul>{plan.screens.map(screen => <li key={screen.id}><bdi>{screen.name}</bdi></li>)}</ul>
      <p>{__('Questions and other content on these screens are removed too. Review any wording that invites visitors to this signup.', 'wconvert')}</p>
      <div aria-live="polite">{impact && <p className="wconvert-graph-insert__summary">{impact}</p>}</div>
    </div>
    {refusal && !plan.reason && <p id={`${id}-refusal`} className="m-0 text-note text-muted-foreground">{refusal}</p>}
    <AlertDialogFooter>
      <AlertDialogCancel onClick={onCancel}>{__('Cancel', 'wconvert')}</AlertDialogCancel>
      <Button type="button" variant="destructive" aria-disabled={refusal !== null || undefined} aria-describedby={refusal && !plan.reason ? `${id}-refusal` : undefined}
        onClick={() => { if (removal && refusal === null) onRemove(removal.next, removal.destination); }}>{__('Remove signup', 'wconvert')}</Button>
    </AlertDialogFooter>
  </>;
}
