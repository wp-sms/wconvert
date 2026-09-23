import type { TemplateNode, TemplateTree, TemplateScreen } from '@renderer/types';

/** Explicit fixture factory: tests supply node roots and receive the current contract. */
export function treeFixture(tree: { readonly steps: readonly unknown[]; readonly v?: number }): TemplateTree {
  const roots = tree.steps.map(root => root && typeof root === 'object' && 'content' in root ? root.content : root) as TemplateNode[];
  const used = new Set<string>(); let next = 1;
  const nodesOf = (node: TemplateNode): TemplateNode[] => {
    const b = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
    return [node, ...[...(b.children ?? []), ...(b.start ?? []), ...(b.end ?? [])].flatMap(nodesOf)];
  };
  for (const root of roots) for (const node of nodesOf(root)) if ('id' in node && typeof node.id === 'string') used.add(node.id);
  const identify = (node: TemplateNode): TemplateNode => {
    const n = { ...node } as Record<string, unknown>;
    if (!['stack','row','split','grid','panel','media'].includes(node.type) && !n.id) {
      while (used.has(`n${next}`)) next++; n.id = `n${next++}`; used.add(String(n.id));
    }
    if (n.type === 'button' && (n.action ?? 'submit') === 'submit') { n.action = 'submit'; n.submission = 'primary'; }
    for (const key of ['children','start','end']) if (Array.isArray(n[key])) n[key] = (n[key] as TemplateNode[]).map(identify);
    return n as unknown as TemplateNode;
  };
  const steps: TemplateScreen[] = roots.map((root, i) => {
    const content = identify(root); const nodes = nodesOf(content);
    const input = nodes.some(n => n.type === 'field' || (n.type === 'button' && 'action' in n && n.action === 'submit'));
    return { id: `s${i + 1}`, name: `Screen ${i + 1}`, kind: input ? 'input' : i > 0 && i === tree.steps.length - 1 ? 'acknowledgement' : 'content', content };
  });
  const submissions = steps.flatMap(step => {
    const nodes = nodesOf(step.content);
    if (!nodes.some(n => n.type === 'button' && 'action' in n && n.action === 'submit')) return [];
    const ids = (type: string) => nodes.filter(n => n.type === type && 'id' in n).map(n => (n as { id: string }).id);
    return [{ id: 'primary', required: true, fields: ids('field'), consents: ids('consent') }];
  });
  return { v: 2, ...tree, steps, submissions };
}
