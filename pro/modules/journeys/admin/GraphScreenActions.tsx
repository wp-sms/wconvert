import { useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Disclosure } from '@/shell/Disclosure';
import type { TemplateTree } from '@renderer/types';
import { duplicateGraphScreen, duplicateGraphScreenReason, moveGraphScreen } from './structure/graphScreenActions';
import { followupGroups } from '@/builder/structure/followupGroups';
import { graphInsertionLocations } from './structure/graphInsertion';
import { Button } from '@/components/ui/button';
import { refusable } from '@/lib/refusable';

export function GraphScreenActions({ tree, step, onChange }: { tree: TemplateTree; step: number; onChange(next: TemplateTree, selected: number): void }) {
  const [target, setTarget] = useState('');
  const id = useId();
  const screen = tree.steps[step];
  const grouped = followupGroups(tree).some(group => group.screens.includes(step));
  const reason = duplicateGraphScreenReason(tree, screen.id);
  const locations = reason ? [] : graphInsertionLocations(tree).filter(location => location.id.startsWith('edge:') && moveGraphScreen(tree, screen.id, location.id.slice(5)) !== tree);
  const chosen = locations.some(location => location.id === target);
  return <Disclosure variant="inline" className="wconvert-journey-arrival" title={__('Duplicate or move', 'wconvert-pro')}>
    <Button type="button" size="sm" variant="outline" {...refusable(reason ? `${id}-duplicate` : null, () => { const next = duplicateGraphScreen(tree, screen.id); if (next !== tree) onChange(next, next.steps.length - 1); })}>{__('Duplicate after this screen', 'wconvert-pro')}</Button>
    {reason && <p id={`${id}-duplicate`}>{reason}</p>}
    {!grouped && !reason && locations.length === 0 && <p>{__('This screen can’t move to another line. Change where it goes with Then.', 'wconvert-pro')}</p>}
    {locations.length > 0 && <><label className="wconvert-journey__field">{__('Move to line', 'wconvert-pro')}<select value={target} onChange={event => setTarget(event.target.value)}><option value="">{__('Choose a line…', 'wconvert-pro')}</option>{locations.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label>
      <p>{__('Moves this screen between the selected screens and joins its old line back up. You can undo this.', 'wconvert-pro')}</p>
      {!chosen && <p id={`${id}-move`}>{__('Choose a line first.', 'wconvert-pro')}</p>}
      <Button type="button" size="sm" variant="outline" {...refusable(chosen ? null : `${id}-move`, () => { const next = moveGraphScreen(tree, screen.id, target.slice(5)); if (next !== tree) { onChange(next, step); setTarget(''); } })}>{__('Move screen', 'wconvert-pro')}</Button></>}
  </Disclosure>;
}
