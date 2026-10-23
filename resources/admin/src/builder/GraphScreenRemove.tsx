import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Disclosure } from '../shell/Disclosure';
import { graphRemoval, graphRemovalPlan } from './structure/graphRemoval';
import { graphChangeImpact } from './structure/graphChangeImpact';
import { followupGroups } from './structure/followupGroups';
import { conditionText } from './structure/conditionText';

/**
 * A destructive confirm, so it is the body of an `AlertDialog` the host owns
 * (§9): what visitors will see after the removal comes first, then what
 * survives, then the one red button.
 */
export function GraphScreenRemove({ tree, screenId, journeys = true, onRemove, onCancel }: {
  tree: TemplateTree; screenId: string; journeys?: boolean; onRemove(next: TemplateTree, destination: string): void; onCancel(): void;
}) {
  const id = useId();
  const plan = graphRemovalPlan(tree, screenId, journeys);
  const [destination, setDestination] = useState(plan.preferred);
  const [custom, setCustom] = useState(!plan.preferred);
  const group = followupGroups(tree).find(item => item.screens.some(at => tree.steps[at].id === screenId));
  const removal = graphRemoval(tree, screenId, destination, journeys);
  const impact = removal ? graphChangeImpact(tree, removal.next) : null;
  const name = (screen: string) => tree.steps.find(item => item.id === screen)?.name ?? __('Removed screen', 'wconvert');
  const answersFrom = (source: string) => tree.graph?.edges.filter(edge => edge.from === source && edge.kind === 'answer') ?? [];
  const refusal = plan.reason ?? (removal ? null : __('Choose where visitors continue first.', 'wconvert'));
  const choice = <>
    <label htmlFor={`${id}-destination`}>{plan.isEntry ? __('New first screen', 'wconvert') : __('Its incoming lines will go to', 'wconvert')}</label>
    <select id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)}>
      <option value="" disabled>{__('Choose a screen…', 'wconvert')}</option>
      {plan.targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </>;
  return <>
    <AlertDialogHeader>
      <AlertDialogTitle>{__('Delete this screen?', 'wconvert')}</AlertDialogTitle>
      <AlertDialogDescription>{sprintf(/* translators: %s: the name of the screen being deleted, e.g. “Your result”. */ __('“%s” and its answers are removed from the draft. Other screens and saved leads stay. Undo restores the screen and all its lines.', 'wconvert'), name(screenId))}</AlertDialogDescription>
    </AlertDialogHeader>
    <div className="wconvert-graph-insert__body wconvert-graph-remove__body">
      {plan.reason ? <p role="status">{plan.reason}</p> : <>
        {plan.needsDestination ? <>
          {destination && <div className="wconvert-graph-insert__outcome" aria-label={__('After removing', 'wconvert')}><strong>{__('After removing', 'wconvert')}</strong><p>{group && destination === plan.preferred ? sprintf(/* translators: %s: the name of the screen after the follow-ups, e.g. “Your result”. */ __('Check the remaining matching follow-ups, then continue to %s.', 'wconvert'), name(group.next)) : sprintf(/* translators: %s: the name of the screen visitors go to instead, e.g. “Your result”. */ __('Then → %s.', 'wconvert'), name(destination))}</p></div>}
          {plan.preferred ? <Disclosure variant="inline" title={__('Change where they go', 'wconvert')} open={custom} onToggle={setCustom}>{custom && choice}</Disclosure> : choice}
          {(!group || custom) && <><p>{plan.isEntry ? __('Visitors will start at the chosen screen. Its Back button will be removed.', 'wconvert')
            : __('Those lines keep their answers and order, and go to the chosen screen:', 'wconvert')}</p>
          {!!plan.incoming.length && <ul>{plan.incoming.map(edge => <li key={edge.id}>
            <strong>{name(edge.from)}</strong>{' — '}{edge.kind === 'hidden' ? __('If skipped', 'wconvert')
              : edge.kind === 'answer' && edge.when ? sprintf(/* translators: 1: the answer line's position on its screen, starting at 1, 2: its condition, e.g. “Budget is Under $50”. */ __('%1$d. %2$s', 'wconvert'), answersFrom(edge.from).findIndex(item => item.id === edge.id) + 1, conditionText(tree, edge.when))
                : answersFrom(edge.from).length ? __('All other answers', 'wconvert') : __('Then', 'wconvert')}
          </li>)}</ul>}</>}
        </> : <p>{__('No line reaches it, so nothing else changes.', 'wconvert')}</p>}
        {!!plan.outgoing.length && (!plan.preferred || custom) && <p>{sprintf(/* translators: %s: the name of the screen being deleted, e.g. “Your result”. */ __('Lines leaving “%s”, with their answers, are removed. Other screens stay in the draft.', 'wconvert'), name(screenId))}</p>}
        <div aria-live="polite">{impact && <p className="wconvert-graph-insert__summary">{impact}</p>}</div>
      </>}
    </div>
    {refusal && !plan.reason && <p id={`${id}-refusal`} className="m-0 text-note text-muted-foreground">{refusal}</p>}
    <AlertDialogFooter>
      <AlertDialogCancel onClick={onCancel}>{__('Cancel', 'wconvert')}</AlertDialogCancel>
      <Button type="button" variant="destructive" aria-disabled={refusal !== null || undefined} aria-describedby={refusal && !plan.reason ? `${id}-refusal` : undefined}
        onClick={() => { if (removal && refusal === null) onRemove(removal.next, removal.destination); }}>{__('Delete screen', 'wconvert')}</Button>
    </AlertDialogFooter>
  </>;
}
