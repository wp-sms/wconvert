import type { TemplateNode, TemplateTree } from '@renderer/types';

function nodes(node: TemplateNode): TemplateNode[] {
  const branch = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [node, ...[...(branch.children ?? []), ...(branch.start ?? []), ...(branch.end ?? [])].flatMap(nodes)];
}

export function isResultFirst(tree: TemplateTree | null | undefined): boolean {
  if (!tree) return false;
  const result = tree.steps.findIndex(step => step.kind === 'result');
  if (result < 0) return false;
  const submit = tree.steps.findIndex(step => nodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  return submit < 0 || result < submit;
}
