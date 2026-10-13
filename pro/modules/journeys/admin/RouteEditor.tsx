import { __ } from '@wordpress/i18n';
import { PanelSection } from '@/builder/PanelSection';
import type { TemplateTree } from '@renderer/types';
import { GraphRouteSettings } from './GraphRouteSettings';
import { RouteSettings } from './JourneySettings';

interface RouteEditorProps {
  tree: TemplateTree;
  step: number;
  focusPath: number | 'hidden' | null;
  /** Focus the line's Then select rather than its condition. */
  focusTarget?: boolean;
  onChange(next: TemplateTree): void;
  onSelect(step: number): void;
  /** A screen added on a graph line. */
  onInsertOnEdge(edgeId: string, kind: 'content' | 'input'): void;
  /** A screen added on a linear campaign's line, by its priority. */
  onInsertOnPath(priority: number, kind: 'content' | 'input'): void;
  onOpenInsert?(edgeId: string): void;
  onAdd?(intent: 'followup' | 'branch'): void;
  /** Drawn inside its own titled section, as the question panel shows it. */
  titled?: boolean;
}

/** "Where visitors go next": a graph's lines, or a linear campaign's ordered paths. */
export function RouteEditor({ tree, step, focusPath, focusTarget, onChange, onSelect, onInsertOnEdge, onInsertOnPath, onOpenInsert, onAdd, titled = false }: RouteEditorProps) {
  const routes = tree.graph
    ? <GraphRouteSettings tree={tree} step={step} focusPath={focusPath} focusTarget={focusTarget} onChange={onChange} onSelect={onSelect}
      onInsert={onInsertOnEdge} onOpenInsert={onOpenInsert} onAdd={onAdd} />
    : <RouteSettings tree={tree} step={step} focusPath={typeof focusPath === 'number' ? focusPath : null} onChange={onChange} onInsert={onInsertOnPath} />;

  // The question's panel names the section; elsewhere a disclosure or tab already does.
  return titled ? <PanelSection title={__('Where visitors go next', 'wconvert')} className="wconvert-question-next"
    tip={__('First match wins, top to bottom. All other answers follow the last line.', 'wconvert')}>{routes}</PanelSection> : routes;
}
