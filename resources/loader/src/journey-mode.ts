import type { TemplateTree } from '@renderer/types';
import { journeyNodes } from './journey-nodes';
import { graphReaches } from './journey-graph';

export function isResultFirst(tree: TemplateTree | null | undefined): boolean {
  if (!tree) return false;
  const result = tree.steps.findIndex(step => step.kind === 'result');
  if (result < 0) return false;
  const submit = tree.steps.findIndex(step => journeyNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  return submit < 0 || (tree.graph ? graphReaches(tree.graph, tree.steps[result].id, tree.steps[submit].id) : result < submit);
}
