import { useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { graphCaptureInsertion } from './structure/graphCaptureInsertion';

export function GraphCaptureInsert({ tree, primaryChannel, source, onInsert, onCancel }: {
  tree: TemplateTree; primaryChannel?: string | null; source: string; onInsert(location: string): void; onCancel(): void;
}) {
  const id = useId();
  const plan = graphCaptureInsertion(tree, primaryChannel);
  const preferred = plan.locations.find(location => location.id === `edge:${tree.graph?.edges.find(edge => edge.from === source && edge.kind === 'default')?.id}`) ?? (plan.locations.length === 1 ? plan.locations[0] : undefined);
  const [locationId, setLocationId] = useState(preferred?.id ?? '');
  const selected = plan.locations.find(location => location.id === locationId);
  return <>
    <DialogTitle>{plan.channel === 'email' ? __('Add optional email signup', 'wconvert') : __('Add optional SMS signup', 'wconvert')}</DialogTitle>
    <DialogDescription>{__('The primary signup is saved first. This separate, optional signup adds contact details and consent to the same Lead only when the visitor submits it.', 'wconvert')}</DialogDescription>
    <div className="wconvert-graph-insert__body">
      {plan.reason ? <p role="status">{plan.reason}</p> : <>
        <label htmlFor={`${id}-location`}>{__('Insert after primary signup', 'wconvert')}</label>
        <select id={`${id}-location`} value={locationId} onChange={event => setLocationId(event.target.value)}>
          <option value="" disabled>{__('Choose a connection…', 'wconvert')}</option>
          {plan.locations.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}
        </select>
        {selected && <div className="wconvert-graph-insert__summary"><strong>{selected.label}</strong><p>{selected.detail}</p></div>}
        <p>{__('Only visitors on this connection see the optional signup. Both submitting and “No thanks” continue to its current destination. Other paths stay the same.', 'wconvert')}</p>
        <p>{__('Review the new consent text and where this signup is stored or sent in Destinations. The primary signup is not submitted again.', 'wconvert')}</p>
      </>}
    </div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>
      <Button type="button" disabled={!!plan.reason || !selected} onClick={() => onInsert(locationId)}>{__('Add signup', 'wconvert')}</Button></div>
  </>;
}
