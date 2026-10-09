import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { duplicateScreen, referencedJourney, walkNodes, withBackButton } from './journey';
import { insertOnGraphEdge } from './graph';
import { graphInsertionLocations, insertionUnavailable } from './graphInsertion';
import { journeyReadinessIssues } from './journeyReadiness';
import { journeyBoundaryIssues } from './journeyBoundaryReadiness';

export function duplicateGraphScreenReason(tree: TemplateTree, id: string): string | null {
  const screen = tree.steps.find(item => item.id === id);
  if (!tree.graph || !screen) return __('Choose a screen.', 'wconvert');
  if (['result', 'acknowledgement'].includes(screen.kind) || walkNodes(screen.content).some(node => ['field', 'consent'].includes(node.type) || node.type === 'button' && 'action' in node && node.action === 'submit'))
    return __('For results, endings or contact collection, add a screen with its own paths and form settings.', 'wconvert');
  if (tree.graph.edges.some(edge => edge.from === id && edge.kind === 'answer') || !tree.graph.edges.some(edge => edge.from === id && edge.kind === 'default'))
    return __('For screens with several paths, add a new screen and choose its paths.', 'wconvert');
  return null;
}
export function duplicateGraphScreen(tree: TemplateTree, id: string): TemplateTree {
  if (duplicateGraphScreenReason(tree, id)) return tree;
  const at = tree.steps.findIndex(screen => screen.id === id);
  const edge = tree.graph!.edges.find(item => item.from === id && item.kind === 'default')!;
  return referencedJourney(insertOnGraphEdge(tree, edge.id, withBackButton(duplicateScreen(tree, at))));
}

/** Move a simple sequence screen as one edit. Branches, conditional screens and
 * saves require explicit connection edits, with their existing impact review. */
export function moveGraphScreen(tree: TemplateTree, id: string, edgeId: string): TemplateTree {
  if (!tree.graph || duplicateGraphScreenReason(tree, id)) return tree;
  const screen = tree.steps.find(item => item.id === id)!;
  const incoming = tree.graph.edges.filter(edge => edge.to === id);
  const outgoing = tree.graph.edges.filter(edge => edge.from === id);
  const target = tree.graph.edges.find(edge => edge.id === edgeId);
  if (screen.when || tree.graph.entry === id || incoming.length !== 1 || outgoing.length !== 1 || !target
    || target.from === id || target.to === id || target.kind === 'hidden') return tree;
  const hasQuestions = walkNodes(screen.content).some(node => node.type === 'question');
  const location = graphInsertionLocations(tree).find(item => item.id === `edge:${edgeId}`);
  if (!location || insertionUnavailable(location, hasQuestions ? 'input' : 'content')) return tree;
  const next: TemplateTree = { ...tree, graph: { ...tree.graph, edges: tree.graph.edges.map(edge => edge.id === incoming[0].id
    ? { ...edge, to: outgoing[0].to } : edge.id === target.id ? { ...edge, to: id } : edge.id === outgoing[0].id ? { ...edge, to: target.to } : edge) } };
  const issues = (value: TemplateTree) => [...journeyReadinessIssues(value), ...journeyBoundaryIssues(value, value.steps.some(item => item.kind === 'result') ? 'match' : 'submit')];
  const existing = new Set(issues(tree).map(issue => issue.key));
  if (issues(next).some(issue => !existing.has(issue.key))) return tree;
  return next;
}
