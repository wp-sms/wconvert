import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { duplicateGraphScreen, duplicateGraphScreenReason, moveGraphScreen } from './structure/graphScreenActions';
import { graphInsertionLocations } from './structure/graphInsertion';
import { Button } from '../components/ui/button';

export function GraphScreenActions({ tree, step, onChange }: { tree: TemplateTree; step: number; onChange(next: TemplateTree, selected: number): void }) {
  const [target, setTarget] = useState('');
  const screen = tree.steps[step];
  const reason = duplicateGraphScreenReason(tree, screen.id);
  const locations = reason ? [] : graphInsertionLocations(tree).filter(location => location.id.startsWith('edge:') && moveGraphScreen(tree, screen.id, location.id.slice(5)) !== tree);
  return <details className="wconvert-journey-arrival"><summary>{__('More screen actions', 'wconvert')}</summary>
    <Button type="button" size="sm" variant="outline" disabled={!!reason} onClick={() => { const next = duplicateGraphScreen(tree, screen.id); if (next !== tree) onChange(next, next.steps.length - 1); }}>{__('Duplicate after this screen', 'wconvert')}</Button>
    {reason && <p>{reason}</p>}
    {!reason && locations.length === 0 && <p>{__('No safe move is available. First screens, conditional screens and shared branches keep their position; use Next screen to edit their connections.', 'wconvert')}</p>}
    {locations.length > 0 && <><label className="wconvert-journey__field">{__('Move to connection', 'wconvert')}<select value={target} onChange={event => setTarget(event.target.value)}><option value="">{__('Choose a connection…', 'wconvert')}</option>{locations.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label>
      <p>{__('Its previous path will continue to the next screen. The chosen connection will visit this screen first. Undo restores both connections.', 'wconvert')}</p>
      <Button type="button" size="sm" variant="outline" disabled={!locations.some(location => location.id === target)} onClick={() => { const next = moveGraphScreen(tree, screen.id, target.slice(5)); if (next !== tree) { onChange(next, step); setTarget(''); } }}>{__('Move screen', 'wconvert')}</Button></>}
  </details>;
}
