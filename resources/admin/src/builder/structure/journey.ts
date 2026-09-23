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

/** Removing a signup also removes the screens collecting its declared details.
 * Content-only offers between those screens are independent and stay in place. */
export function screenRemoval(tree: TemplateTree, index: number): { screens: string[]; submission?: string } {
  const screen = tree.steps[index];
  if (!screen || screen.kind === 'acknowledgement' || tree.steps.length <= 2) return { screens: [] };
  const submission = tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
  if (submission?.required) return { screens: [] };
  if (!submission) return { screens: [screen.id] };
  const owned = new Set([...submission.fields, ...submission.consents]);
  return { submission: submission.id, screens: tree.steps.filter(s => s.id === screen.id || walkNodes(s.content).some(n => 'id' in n && owned.has(n.id as string))).map(s => s.id) };
}

export function removedScreen(tree: TemplateTree, index: number): TemplateTree {
  const removal = screenRemoval(tree, index);
  if (!removal.screens.length) return tree;
  const clean = (node: TemplateNode, first: boolean): TemplateNode => {
    const n = { ...node } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) {
      n[key] = (n[key] as TemplateNode[]).filter(child => !(child.type === 'button' && 'action' in child && ((first && child.action === 'back') || (child.action === 'skip' && 'submission' in child && child.submission === removal.submission)))).map(child => clean(child, first));
    }
    return n as unknown as TemplateNode;
  };
  return referencedJourney({ ...tree,
    steps: tree.steps.filter(s => !removal.screens.includes(s.id)).map((s, at) => ({ ...s, content: clean(s.content, at === 0) })),
    submissions: tree.submissions.filter(sub => sub.id !== removal.submission),
  });
}
