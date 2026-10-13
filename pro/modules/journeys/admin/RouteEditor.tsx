import { __ } from '@wordpress/i18n';
import { PanelSection } from '@/builder/PanelSection';
import type { RouteSlotProps } from '@/journeyAuthoring';
import { GraphRouteSettings } from './GraphRouteSettings';
import { RouteSettings } from './JourneySettings';

/** "Where visitors go next": a graph's lines, or a linear campaign's ordered paths. */
export function RouteEditor({ tree, step, focusPath, focusTarget, onChange, onSelect, onInsertOnEdge, onInsertOnPath, onOpenInsert, onAdd, titled = false }: RouteSlotProps) {
  const routes = tree.graph
    ? <GraphRouteSettings tree={tree} step={step} focusPath={focusPath} focusTarget={focusTarget} onChange={onChange} onSelect={onSelect}
      onInsert={onInsertOnEdge} onOpenInsert={onOpenInsert} onAdd={onAdd} />
    : <RouteSettings tree={tree} step={step} focusPath={typeof focusPath === 'number' ? focusPath : null} onChange={onChange} onInsert={onInsertOnPath} />;

  // The question's panel names the section; elsewhere a disclosure or tab already does.
  return titled ? <PanelSection title={__('Where visitors go next', 'wconvert')} className="wconvert-question-next"
    tip={__('First match wins, top to bottom. All other answers follow the last line.', 'wconvert')}>{routes}</PanelSection> : routes;
}
