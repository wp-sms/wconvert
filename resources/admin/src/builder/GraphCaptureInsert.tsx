import { useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { graphCaptureInsertion } from './structure/graphCaptureInsertion';

/** The body of a Small `AdminDialog`; the host owns the dialog and its focus. */
export function GraphCaptureInsert({ tree, primaryChannel, source, onInsert, onCancel }: {
  tree: TemplateTree; primaryChannel?: string | null; source: string; onInsert(location: string): void; onCancel(): void;
}) {
  const id = useId();
  const plan = graphCaptureInsertion(tree, primaryChannel);
  const preferred = plan.locations.find(location => location.id === `edge:${tree.graph?.edges.find(edge => edge.from === source && edge.kind === 'default')?.id}`) ?? (plan.locations.length === 1 ? plan.locations[0] : undefined);
  const [locationId, setLocationId] = useState(preferred?.id ?? '');
  const selected = plan.locations.find(location => location.id === locationId);
  const refusal = plan.reason ?? (selected ? null : __('Choose where the signup goes.', 'wconvert'));
  return <>
    <AdminDialogHeader title={plan.channel === 'email' ? __('Add optional email signup', 'wconvert') : __('Add optional SMS signup', 'wconvert')}
      meta={__('The main signup is saved first. This optional one adds contact details and consent to the same lead only when the visitor submits it.', 'wconvert')} />
    <AdminDialogBody className="wconvert-graph-insert__body">
      {plan.reason ? <p role="status">{plan.reason}</p> : <>
        {/* The visitor's outcome first, then the control that changes it (§22). */}
        {selected && <div className="wconvert-graph-insert__summary"><strong>{selected.label}</strong><p>{selected.detail}</p></div>}
        <label htmlFor={`${id}-location`}>{__('Insert after the main signup', 'wconvert')}</label>
        <select id={`${id}-location`} value={locationId} onChange={event => setLocationId(event.target.value)}>
          <option value="" disabled>{__('Choose a connection…', 'wconvert')}</option>
          {plan.locations.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}
        </select>
        <p>{__('Only visitors on this connection see it. Signing up and “No thanks” both continue to the same next screen, and the main signup is not sent again. Check its consent text and Destinations afterwards.', 'wconvert')}</p>
      </>}
    </AdminDialogBody>
    <AdminDialogFooter back={<Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>}
      note={refusal && !plan.reason && <span id={`${id}-refusal`}>{refusal}</span>}>
      <Button type="button" aria-disabled={refusal !== null || undefined} aria-describedby={refusal && !plan.reason ? `${id}-refusal` : undefined}
        onClick={() => { if (refusal === null) onInsert(locationId); }}>{__('Add signup', 'wconvert')}</Button>
    </AdminDialogFooter>
  </>;
}
