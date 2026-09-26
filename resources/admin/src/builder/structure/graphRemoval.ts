import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { graphDisplayOrder, graphReaches } from './graph';
import { walkNodes, withoutBackButtons } from './journey';

/** Plan first: deleting a branch point must never silently pick one of its exits. */
export function graphRemovalPlan(tree: TemplateTree, screenId: string) {
  const graph = tree.graph;
  const screen = tree.steps.find(item => item.id === screenId);
  const incoming = graph?.edges.filter(edge => edge.to === screenId && edge.from !== screenId) ?? [];
  const outgoing = graph?.edges.filter(edge => edge.from === screenId) ?? [];
  const isEntry = graph?.entry === screenId;
  const remaining = graph && { ...graph, edges: graph.edges.filter(edge => edge.from !== screenId && edge.to !== screenId) };
  const targets = graphDisplayOrder(tree).map(index => tree.steps[index]).filter(item => item.id !== screenId && remaining
    && (!isEntry || !item.when)
    && incoming.every(edge => !graphReaches(remaining, item.id, edge.from)));
  const destinations = new Set(outgoing.map(edge => edge.to));
  const preferred = destinations.size === 1 && targets.some(item => destinations.has(item.id)) ? outgoing[0].to : '';
  const nodes = screen ? walkNodes(screen.content) : [];
  const questions = new Set(nodes.flatMap(node => node.type === 'question' && 'id' in node ? [node.id] : []));
  const references = (condition?: QuestionCondition) => condition?.clauses.some(clause => questions.has(clause.question));
  const dependents = tree.steps.filter(item => item.id !== screenId && (
    [item.when, ...(item.paths?.map(path => path.when) ?? []), ...(item.results?.map(result => result.when) ?? [])].some(references)
    || graph?.edges.some(edge => edge.from === item.id && references(edge.when))));
  const reason = !graph || !screen ? __('This screen is no longer in the journey.', 'wconvert')
    : screen.kind === 'result' || screen.kind === 'acknowledgement'
      ? __('Keep this ending so visitors have somewhere to finish. You can edit its content and incoming paths.', 'wconvert')
      : nodes.some(node => node.type === 'field' || node.type === 'consent' || node.type === 'button' && 'action' in node && node.action === 'submit')
        ? __('This screen collects or saves contact details. Its fields, consent and save settings must stay together; it cannot be deleted here.', 'wconvert')
        : dependents.length ? sprintf(__('Answers on this screen are used by rules on: %s. Update those rules before deleting it.', 'wconvert'), dependents.map(item => item.name).join(', '))
          : (isEntry || incoming.length > 0) && !targets.length
            ? __('There is no suitable continuation. Add a screen or update the paths before deleting this one.', 'wconvert') : null;
  return { reason, incoming, outgoing, isEntry, targets, preferred, needsDestination: isEntry || incoming.length > 0 };
}

/** One immutable edit preserves incoming rules/priority and leaves detached work in the draft. */
export function graphRemoval(tree: TemplateTree, screenId: string, destination?: string): { next: TemplateTree; destination: string; incoming: number } | null {
  const plan = graphRemovalPlan(tree, screenId);
  if (plan.reason || !tree.graph) return null;
  const target = plan.needsDestination ? destination ?? plan.preferred : tree.graph.entry;
  if (plan.needsDestination && !plan.targets.some(item => item.id === target)) return null;
  return { destination: target, incoming: plan.incoming.length, next: { ...tree,
    steps: tree.steps.filter(item => item.id !== screenId).map(item => plan.isEntry && item.id === target
      ? { ...item, content: withoutBackButtons(item.content) } : item),
    graph: { ...tree.graph, entry: plan.isEntry ? target : tree.graph.entry,
      edges: tree.graph.edges.filter(edge => edge.from !== screenId).map(edge => edge.to === screenId ? { ...edge, to: target } : edge) },
  } };
}
