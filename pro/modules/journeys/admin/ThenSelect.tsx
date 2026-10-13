import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { FactRow, PanelHint } from '@/builder/PanelSection';
import { addGraphConnection, canAddGraphConnection, canTargetGraphScreen, reconnectGraphEdge } from '@/builder/structure/graphConnections';
import { upgradeToGraph, graphDisplayOrder, skipEdge } from '@/builder/structure/graph';
import { conditionText } from '@/builder/structure/conditionText';
import { followupGroups } from '@/builder/structure/followupGroups';

/** "Then": the select that chooses where a screen with no answer lines goes next. */
export function ThenSelect({ tree, step, onChange, onUpgrade, onBranch }: {
  tree: TemplateTree; step: number;
  onChange(next: TemplateTree): void;
  /** A linear journey becomes a graph the moment one screen chooses its own next. */
  onUpgrade?(next: TemplateTree): void;
  /** A choice question with no answer lines yet: start one (ADR 0142). */
  onBranch?(): void;
}) {
  const id = useId();
  const screen = tree.steps[step];
  const graph = tree.graph;
  const fallback = graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'default');
  const nextId = graph ? fallback?.to : screen.paths?.[0]?.to ?? tree.steps[step + 1]?.id;
  const next = tree.steps.find(item => item.id === nextId);
  const order = graphDisplayOrder(tree).filter(index => index !== step);
  // A graph screen with no path out yet gets one, unless nothing may follow it (a final result).
  if (graph && !fallback && !order.some(index => canAddGraphConnection(tree, screen.id, tree.steps[index].id))) {
    return <FactRow label={__('Then', 'wconvert')}>{__('The campaign ends here', 'wconvert')}</FactRow>;
  }
  const reachable = (target: string) => graph ? canTargetGraphScreen(tree, screen.id, target) : tree.steps.findIndex(item => item.id === target) > step;
  const choose = (target: string) => {
    if (graph) { onChange(fallback ? reconnectGraphEdge(tree, fallback.id, target) : addGraphConnection(tree, screen.id, target)); return; }
    // A straight journey choosing its own next screen becomes a graph first.
    const upgraded = upgradeToGraph(tree);
    const edge = upgraded.graph?.edges.find(item => item.from === screen.id && item.kind === 'default');
    if (edge) (onUpgrade ?? onChange)(reconnectGraphEdge(upgraded, edge.id, target));
  };
  const box = next ? followupGroups(tree).find(group => tree.steps[group.screens[0]].id === next.id) : undefined;
  // When the next screen has "Only if…", say who sees it and where everyone else goes (the prototype's panel, ADR 0142).
  const skipTo = graph && next?.when ? skipEdge(graph, next.id)?.to : undefined;
  return <>
    <FactRow label={__('Then', 'wconvert')} htmlFor={`${id}-then`}>
      <select id={`${id}-then`} data-then value={nextId ?? ''} onChange={event => choose(event.target.value)}>
        {nextId === undefined && <option value="">{__('Choose a screen', 'wconvert')}</option>}
        {order.map(index => <option key={tree.steps[index].id} value={tree.steps[index].id} disabled={!reachable(tree.steps[index].id)}>{tree.steps[index].name}</option>)}
      </select>
    </FactRow>
    {box ? <PanelHint>{sprintf(/* translators: %s: a screen's name. */ __('Visitors with any matching answer go through the follow-ups. The rest go straight to “%s”.', 'wconvert'), tree.steps.find(item => item.id === box.next)?.name ?? '')}</PanelHint>
      : next?.when && skipTo && <PanelHint>{sprintf(/* translators: 1: a rule. 2, 3: screen names. */ __('Only visitors with %1$s see “%2$s”. All other answers go to “%3$s”.', 'wconvert'),
        conditionText(tree, next.when), next.name, tree.steps.find(item => item.id === skipTo)?.name ?? '')}</PanelHint>}
    {onBranch && <button type="button" className="wconvert-panel-link" onClick={onBranch}>{__('Send some answers to a different screen', 'wconvert')}</button>}
  </>;
}
