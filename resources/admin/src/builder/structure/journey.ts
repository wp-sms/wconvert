import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree, TemplateNode, TemplateScreen } from '@renderer/types';

export function walkNodes(node: TemplateNode): TemplateNode[] {
  const b = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
  return [node, ...[...(b.children ?? []), ...(b.start ?? []), ...(b.end ?? [])].flatMap(walkNodes)];
}

/** The explicit acceptance boundary for one declared submission. */
export function submissionScreen(tree: TemplateTree, id: string | undefined): number {
  if (!id) return -1;
  return tree.steps.findIndex(s => walkNodes(s.content).some(n =>
    n.type === 'button' && 'action' in n && n.action === 'submit' && 'submission' in n && n.submission === id));
}

/** New draft nodes need identities before submission references can name them. */
export function referencedJourney(tree: TemplateTree): TemplateTree {
  const taken = new Set(tree.steps.flatMap(s => walkNodes(s.content)).map(n => 'id' in n ? n.id : undefined));
  let next = 1;
  const identify = (node: TemplateNode): TemplateNode => {
    const n = { ...node } as Record<string, unknown>;
    if (n.type === 'button') n.role = ['next', 'back', 'skip', 'close'].includes(String(n.action)) ? `${n.action}_label` : 'cta_label';
    const keys = ['children', 'start', 'end'].filter(k => Array.isArray(n[k]));
    if (keys.length === 0 && !n.id) { while (taken.has(`n${next}`)) next++; n.id = `n${next++}`; taken.add(String(n.id)); }
    for (const key of keys) n[key] = (n[key] as TemplateNode[]).map(identify);
    return n as unknown as TemplateNode;
  };
  const steps = tree.steps.map(s => ({ ...s, content: identify(s.content) }));
  let start = 0;
  const submissions = tree.submissions.map(sub => {
    const end = steps.findIndex(s => walkNodes(s.content).some(n => n.type === 'button' && 'action' in n && n.action === 'submit' && 'submission' in n && n.submission === sub.id));
    if (end < start) return sub;
    const nodes = steps.slice(start, end + 1).flatMap(s => walkNodes(s.content));
    start = end + 1;
    const ids = (type: string) => nodes.filter(n => n.type === type && 'id' in n).map(n => (n as { id: string }).id);
    return { ...sub, fields: ids('field'), consents: ids('consent') };
  });
  return { ...tree, steps, submissions };
}

export function freshScreen(tree: TemplateTree, kind: 'content' | 'input'): TemplateScreen {
  let i = 1; while (tree.steps.some(s => s.id === `s${i}`)) i++;
  return { id: `s${i}`, name: kind === 'input' ? __('Questions', 'wconvert') : __('Offer', 'wconvert'), kind,
    content: { type: 'stack', children: [
      { type: 'heading', role: 'headline', text: __('Tell us more', 'wconvert') },
      { type: 'button', label: __('Continue', 'wconvert'), action: 'next' },
    ] } };
}

export function duplicateScreen(tree: TemplateTree, index: number): TemplateScreen {
  const base = tree.steps[index];
  const clone = (node: TemplateNode): TemplateNode => {
    const n = { ...node } as Record<string, unknown>; delete n.id;
    if (n.type === 'button' && n.action === 'submit') { n.action = 'next'; n.label = __('Continue', 'wconvert'); delete n.submission; }
    for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as TemplateNode[]).map(clone);
    return n as unknown as TemplateNode;
  };
  return { ...base, id: freshScreen(tree, 'input').id, name: sprintf(__('%s (copy)', 'wconvert'), base.name), content: clone(base.content) };
}

/** Keep the acknowledgement last and accepted signups in their declared order. */
export function movedScreen(tree: TemplateTree, from: number, to: number): TemplateTree {
  if (from === to || from < 0 || to < 0 || from >= tree.steps.length - 1 || to >= tree.steps.length - 1) return tree;
  const steps = [...tree.steps];
  const [screen] = steps.splice(from, 1);
  steps.splice(to, 0, screen);
  const next = { ...tree, steps };
  const ends = tree.submissions.map(sub => submissionScreen(next, sub.id)).filter(index => index >= 0);
  if (ends.some((end, index) => index > 0 && end <= ends[index - 1])) return tree;
  return referencedJourney(next);
}
