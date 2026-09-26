import type { TemplateNode } from '@renderer/types';

/** One visitor-side walk for layout children, including both split panes. */
export function journeyNodes(node: TemplateNode): TemplateNode[] {
  const branch = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [node, ...[...(branch.children ?? []), ...(branch.start ?? []), ...(branch.end ?? [])].flatMap(journeyNodes)];
}
