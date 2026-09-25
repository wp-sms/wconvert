import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree, TemplateNode, TemplateScreen } from '@renderer/types';

export function walkNodes(node: TemplateNode, includeHidden = true): TemplateNode[] {
  if (!includeHidden && 'hidden' in node && node.hidden) return [];
  const b = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
  return [node, ...[...(b.children ?? []), ...(b.start ?? []), ...(b.end ?? [])].flatMap(child => walkNodes(child, includeHidden))];
}

/** The explicit acceptance boundary for one declared submission. */
export function submissionScreen(tree: TemplateTree, id: string | undefined): number {
  if (!id) return -1;
  return tree.steps.findIndex(s => walkNodes(s.content).some(n =>
    n.type === 'button' && 'action' in n && n.action === 'submit' && 'submission' in n && n.submission === id));
}

export function unreachableScreens(tree: TemplateTree): readonly string[] {
  const reached = new Set<string>();
  const visit = (index: number) => {
    const screen = tree.steps[index];
    if (!screen || reached.has(screen.id)) return;
    reached.add(screen.id);
    const targets = screen.paths?.map(path => path.to) ?? (tree.steps[index + 1] ? [tree.steps[index + 1].id] : []);
    targets.forEach(id => visit(tree.steps.findIndex(item => item.id === id)));
    if (screen.when && tree.steps[index + 1]) visit(index + 1);
  };
  visit(0);
  return tree.steps.filter(screen => !reached.has(screen.id)).map(screen => screen.name);
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

/** Move one signup across its result without changing question or field identities. */
export function resultAccess(tree: TemplateTree, required: boolean): TemplateTree {
  if (tree.submissions.length !== 1 || tree.steps.some(screen => screen.paths?.length)) return tree;
  const resultAt = tree.steps.findIndex(screen => screen.kind === 'result');
  const signupAt = submissionScreen(tree, tree.submissions[0].id);
  if (resultAt < 0 || signupAt < 0) return tree;
  const drop = (node: TemplateNode, action: string): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) {
      copy[key] = (copy[key] as TemplateNode[]).filter(child => !(child.type === 'button' && 'action' in child && child.action === action)).map(child => drop(child, action));
    }
    return copy as unknown as TemplateNode;
  };
  const addButton = (screen: TemplateScreen, label: string, action: 'next' | 'skip', submission?: string): TemplateScreen => ({ ...screen,
    content: { type: 'stack', children: [screen.content, { type: 'button', label, action, ...(submission ? { submission } : {}) }] },
  });
  const contactCopy = (node: TemplateNode, gate: boolean): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    if (copy.role === 'headline') copy.text = gate ? __('One last step', 'wconvert') : __('Want more guides?', 'wconvert');
    if (copy.role === 'body') copy.text = gate
      ? __('Enter your email to see your recommendation.', 'wconvert')
      : __('Your result is already available. Signup is optional.', 'wconvert');
    if (copy.type === 'consent') copy.hidden = gate || !String(copy.text ?? '').trim();
    if (copy.type === 'button' && copy.action === 'submit') copy.label = gate ? __('See my result', 'wconvert') : __('Sign up', 'wconvert');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(child => contactCopy(child, gate));
    return copy as unknown as TemplateNode;
  };
  if (required) {
    if (resultAt !== tree.steps.length - 3 || signupAt !== resultAt + 1 || tree.steps.at(-1)?.kind !== 'acknowledgement') return tree;
    const signup = { ...tree.steps[signupAt], name: __('Contact details', 'wconvert'), content: contactCopy(drop(tree.steps[signupAt].content, 'skip'), true) };
    const result = { ...tree.steps[resultAt], content: drop(tree.steps[resultAt].content, 'next') };
    return referencedJourney({ ...tree, steps: [...tree.steps.slice(0, resultAt), signup, result],
      submissions: [{ ...tree.submissions[0], required: true }] });
  }
  if (resultAt !== tree.steps.length - 1 || signupAt !== resultAt - 1) return tree;
  const result = addButton(tree.steps[resultAt], __('Optional email updates', 'wconvert'), 'next');
  const signup = addButton({ ...tree.steps[signupAt], name: __('Optional email updates', 'wconvert'), content: contactCopy(tree.steps[signupAt].content, false) }, __('No thanks', 'wconvert'), 'skip', tree.submissions[0].id);
  const acknowledgement: TemplateScreen = { id: 'received', name: __('All set', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', text: __('Thanks for visiting', 'wconvert') },
    { type: 'button', label: __('Back', 'wconvert'), action: 'back' },
  ] } };
  return referencedJourney({ ...tree, steps: [...tree.steps.slice(0, signupAt), result, signup, acknowledgement],
    submissions: [{ ...tree.submissions[0], required: false }] });
}

export function freshScreen(tree: TemplateTree, kind: 'content' | 'input'): TemplateScreen {
  let i = 1; while (tree.steps.some(s => s.id === `s${i}`)) i++;
  return { id: `s${i}`, name: kind === 'input' ? __('Questions', 'wconvert') : __('Offer', 'wconvert'), kind,
    content: { type: 'stack', children: [
      { type: 'heading', role: 'headline', text: __('Tell us more', 'wconvert') },
      ...(kind === 'input' ? [{ type: 'question', label: __('What matters most to you?', 'wconvert'), answer_type: 'single', required: false,
        options: [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }] } as TemplateNode] : []),
      { type: 'button', label: __('Continue', 'wconvert'), action: 'next' },
    ] } };
}

export function usedBy(tree: TemplateTree, questionId: string): string[] {
  return tree.steps.filter(screen => screen.when?.clauses.some(clause => clause.question === questionId)
    || screen.results?.some(result => result.when?.clauses.some(clause => clause.question === questionId))
    || screen.paths?.some(path => path.when?.clauses.some(clause => clause.question === questionId))).map(screen => screen.id);
}

export function duplicateScreen(tree: TemplateTree, index: number): TemplateScreen {
  const base = tree.steps[index];
  const clone = (node: TemplateNode): TemplateNode => {
    const n = { ...node } as Record<string, unknown>; delete n.id;
    if (n.type === 'button' && n.action === 'submit') { n.action = 'next'; n.label = __('Continue', 'wconvert'); delete n.submission; }
    for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as TemplateNode[]).map(clone);
    return n as unknown as TemplateNode;
  };
  return { ...base, paths: undefined, id: freshScreen(tree, 'input').id, name: sprintf(__('%s (copy)', 'wconvert'), base.name), content: clone(base.content) };
}

/** Keep the acknowledgement last and accepted signups in their declared order. */
export function movedScreen(tree: TemplateTree, from: number, to: number): TemplateTree {
  if (from === to || from < 0 || to < 0 || from >= tree.steps.length - 1 || to >= tree.steps.length - 1) return tree;
  const steps = [...tree.steps];
  const [screen] = steps.splice(from, 1);
  steps.splice(to, 0, screen);
  const moved = steps[to];
  if (moved.paths?.length === 1 && !moved.paths[0].when && steps.findIndex(item => item.id === moved.paths![0].to) <= to) {
    steps[to] = { ...moved, paths: undefined };
  }
  const next = { ...tree, steps };
  for (let at = 0; at < steps.length; at++) {
    const earlier = new Set(steps.slice(0, at).flatMap(s => walkNodes(s.content)).filter(n => n.type === 'question' && 'id' in n).map(n => (n as { id: string }).id));
    const through = new Set([...earlier, ...walkNodes(steps[at].content).filter(n => n.type === 'question' && 'id' in n).map(n => (n as { id: string }).id)]);
    const boundary = steps.findIndex((s, index) => index > at && (['result', 'acknowledgement'].includes(s.kind)
      || walkNodes(s.content).some(n => n.type === 'button' && 'action' in n && n.action === 'submit')));
    if (steps[at].when?.clauses.some(clause => !earlier.has(clause.question))
      || steps[at].results?.some(result => result.when?.clauses.some(clause => !earlier.has(clause.question)))
      || steps[at].paths?.some(path => path.when?.clauses.some(clause => !through.has(clause.question))
        || steps.findIndex(s => s.id === path.to) <= at
        || (boundary >= 0 && steps.findIndex(s => s.id === path.to) > boundary))) return tree;
  }
  const ends = tree.submissions.map(sub => submissionScreen(next, sub.id)).filter(index => index >= 0);
  if (ends.some((end, index) => index > 0 && end <= ends[index - 1])) return tree;
  if (unreachableScreens(next).length > 0) return tree;
  return referencedJourney(next);
}

/** Removing a signup also removes the screens collecting its declared details.
 * Content-only offers between those screens are independent and stay in place. */
export function screenRemoval(tree: TemplateTree, index: number): { screens: string[]; submission?: string } {
  const screen = tree.steps[index];
  if (!screen || ['acknowledgement', 'result'].includes(screen.kind) || tree.steps.length <= 2
    || tree.steps.some(item => item.paths?.some(path => path.to === screen.id))
    || walkNodes(screen.content).some(n => n.type === 'question' && 'id' in n && usedBy(tree, n.id as string).length > 0)) return { screens: [] };
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
