import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree, TemplateNode, TemplateScreen } from '@renderer/types';
import { graphEdgeId, graphReaches } from './graph';

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
  return unreachableScreenIds(tree).map(id => tree.steps.find(screen => screen.id === id)?.name ?? id);
}

export function unreachableScreenIds(tree: TemplateTree): readonly string[] {
  if (tree.graph) return tree.steps.filter(screen => !graphReaches(tree.graph!, tree.graph!.entry, screen.id)).map(screen => screen.id);
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
  return tree.steps.filter(screen => !reached.has(screen.id)).map(screen => screen.id);
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
  // Graph submissions have explicit ownership. Inferring it from storage order
  // would quietly change the capture payload when a merchant moves a card.
  if (tree.graph) return { ...tree, steps };
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
  if (tree.graph) return graphResultAccess(tree, required);
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
    content: { type: 'stack', children: [screen.content, { type: 'button', label, action, ...(submission ? { submission } : {}), ...(action === 'skip' ? { tokens: { accent: 'transparent', 'accent-fg': 'fg' } } : {}) }] },
  });
  const contactCopy = (node: TemplateNode, gate: boolean): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    if (copy.role === 'headline') copy.text = gate ? __('One last step', 'wconvert') : __('Want more guides?', 'wconvert');
    if (copy.role === 'body') copy.text = gate
      ? __('Enter your email to see your recommendation.', 'wconvert')
      : __('Your result is already available. Signup is optional.', 'wconvert');
    if (copy.type === 'consent') copy.hidden = gate || !String(copy.text ?? '').trim();
    if (copy.type === 'button' && copy.action === 'submit') copy.label = gate ? __('See my result', 'wconvert') : __('Sign up', 'wconvert');
    if (gate && copy.type === 'button' && copy.action === 'back'
      && (copy.label === __('Back to guide', 'wconvert') || copy.label === __('Back to result', 'wconvert')))
      copy.label = __('Back', 'wconvert');
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
    { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
  return referencedJourney({ ...tree, steps: [...tree.steps.slice(0, signupAt), result, signup, acknowledgement],
    submissions: [{ ...tree.submissions[0], required: false }] });
}

/** Existing result/ending topology where a new optional signup can be inserted. */
export function graphResultSignupTarget(tree: TemplateTree) {
  if (!tree.graph || tree.submissions.length) return null;
  const result = tree.steps.find(screen => screen.kind === 'result');
  if (!result) return null;
  const outgoing = tree.graph.edges.filter(edge => edge.from === result.id);
  const ending = outgoing.length === 1 && outgoing[0].kind === 'default'
    ? tree.steps.find(screen => screen.id === outgoing[0].to && screen.kind === 'acknowledgement') : undefined;
  if (outgoing.length && !ending || ending && tree.graph.edges.some(edge => edge.from === ending.id)) return null;
  if (!ending && (tree.steps.some(screen => screen.kind === 'acknowledgement')
    || walkNodes(result.content).some(node => node.type === 'button' && 'action' in node && node.action === 'next'))) return null;
  return { result, ending, edge: outgoing[0] };
}

/** Add a result-first, optional email capture to an anonymous graph quiz. */
export function addGraphResultSignup(tree: TemplateTree): TemplateTree {
  const target = graphResultSignupTarget(tree);
  if (!target || !tree.graph) return tree;
  const { result, ending, edge } = target;
  const signupId = freshScreen(tree, 'input').id;
  const acknowledgementId = ending?.id ?? freshScreen({ ...tree, steps: [...tree.steps, { ...result, id: signupId }] }, 'content').id;
  const submissionId = 'email-signup';
  const signup: TemplateScreen = { id: signupId, name: __('Optional email signup', 'wconvert'), kind: 'input', content: { type: 'stack', children: [
    { type: 'heading', text: __('Want more guides?', 'wconvert'), role: 'headline' },
    { type: 'text', text: __('Your result is already available. Signup is optional.', 'wconvert'), role: 'body' },
    { type: 'field', name: 'email', required: true, label: __('Email address', 'wconvert') },
    { type: 'consent', text: __('Send me email updates. %s', 'wconvert'), link: { label: __('Privacy Policy', 'wconvert') }, hidden: false, role: 'consent_text' },
    { type: 'button', label: __('Sign up', 'wconvert'), action: 'submit', submission: submissionId },
    { type: 'button', label: __('No thanks', 'wconvert'), action: 'skip', submission: submissionId, tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
  const acknowledgement: TemplateScreen = { id: acknowledgementId, name: __('All set', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', text: __('Thanks for visiting', 'wconvert'), role: 'success_headline' },
    { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
  const firstEdge = edge?.id ?? graphEdgeId(tree.graph);
  const secondEdge = graphEdgeId({ ...tree.graph, edges: [...tree.graph.edges, { id: firstEdge, from: result.id, to: signupId, kind: 'default' }] });
  const restoreInvitation = (node: TemplateNode): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    if (copy.type === 'button' && copy.action === 'next' && copy.label === __('Finish', 'wconvert')) copy.label = __('Optional email updates', 'wconvert');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(restoreInvitation);
    return copy as unknown as TemplateNode;
  };
  const withIds = referencedJourney({ ...tree, steps: [...tree.steps.map(screen => screen.id !== result.id ? screen
    : walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'next')
      ? { ...screen, content: restoreInvitation(screen.content) }
      : { ...screen, content: { type: 'stack', children: [screen.content,
        { type: 'button', label: __('Optional email updates', 'wconvert'), action: 'next' } as TemplateNode] } as TemplateNode }), signup, ...(ending ? [] : [acknowledgement])], graph: { ...tree.graph, edges: [...tree.graph.edges.filter(item => item.id !== edge?.id),
    { id: firstEdge, from: result.id, to: signupId, kind: 'default' },
    { id: secondEdge, from: signupId, to: acknowledgementId, kind: 'default' }] },
    submissions: [] });
  const owned = withIds.steps.find(screen => screen.id === signupId)!;
  return { ...withIds, submissions: [{ id: submissionId, required: false,
    fields: walkNodes(owned.content).filter(node => node.type === 'field' && 'id' in node && node.id).map(node => (node as { id: string }).id),
    consents: walkNodes(owned.content).filter(node => node.type === 'consent' && 'id' in node && node.id).map(node => (node as { id: string }).id) }] };
}

/** Explain the exact preparation needed before swapping result and capture. */
export function graphResultAccessIssue(tree: TemplateTree, required: boolean): { message: string; screenId?: string; section: 'content' | 'paths' } | null {
  const graph = tree.graph;
  if (!graph || tree.submissions.length !== 1) return { message: __('Keep one signup to choose when contact details are requested.', 'wconvert'), section: 'content' };
  const submission = tree.submissions[0];
  if (submission.required === required) return null;
  const result = tree.steps.find(screen => screen.kind === 'result');
  const signup = tree.steps[submissionScreen(tree, submission.id)];
  if (!result || !signup) return { message: __('Choose the screen that saves this signup before changing result access.', 'wconvert'), section: 'content' };
  const issue = (message: string, screenId: string, section: 'content' | 'paths' = 'paths') => ({ message, screenId, section });
  if (result.id === graph.entry || signup.id === graph.entry)
    return issue(__('Start with a question screen before the result and signup.', 'wconvert'), graph.entry);
  if (signup.when) return issue(__('Show the signup to everyone on this path before changing result access.', 'wconvert'), signup.id, 'content');
  if (!walkNodes(signup.content).some(node => node.type === 'field' && 'id' in node && submission.fields.includes(node.id ?? '')
    && 'name' in node && node.name === 'email' && 'required' in node && node.required))
    return issue(__('Place the required email field on the signup screen before changing result access.', 'wconvert'), signup.id, 'content');
  const first = required ? result : signup, second = required ? signup : result;
  const outgoing = graph.edges.filter(edge => edge.from === first.id);
  if (outgoing.length !== 1 || outgoing[0].kind !== 'default' || outgoing[0].to !== second.id)
    return issue(sprintf(__('Connect “%1$s” directly to “%2$s” with one Everyone else path. Move any answer branches after both screens first.', 'wconvert'), first.name, second.name), first.id);
  const otherIncoming = graph.edges.find(edge => edge.to === second.id && edge.id !== outgoing[0].id);
  if (otherIncoming) return issue(sprintf(__('The path from “%1$s” enters “%2$s” separately. Connect it to “%3$s” first so both screens move together.', 'wconvert'),
    tree.steps.find(screen => screen.id === otherIncoming.from)?.name ?? otherIncoming.from, second.name, first.name), otherIncoming.from);
  if (!required) {
    const questions = new Set(walkNodes(signup.content).filter(node => node.type === 'question' && 'id' in node).map(node => 'id' in node ? node.id : ''));
    if (result.results?.some(variant => variant.when?.clauses.some(clause => questions.has(clause.question))))
      return issue(__('This result uses an answer collected on the signup screen. Move that question to an earlier screen before showing the result first.', 'wconvert'), signup.id, 'content');
    if (walkNodes(result.content, false).some(node => node.type === 'followup'))
      return issue(__('This result contains a signup reward. Move the reward after the signup before showing the result first.', 'wconvert'), result.id, 'content');
  }
  return null;
}

/** Move the one quiz signup across the result while preserving upstream route identities. */
function graphResultAccess(tree: TemplateTree, required: boolean): TemplateTree {
  const graph = tree.graph;
  if (!graph || tree.submissions.length !== 1 || tree.submissions[0].required === required || graphResultAccessIssue(tree, required)) return tree;
  const submission = tree.submissions[0];
  const result = tree.steps.find(screen => screen.kind === 'result');
  const signup = tree.steps[submissionScreen(tree, submission.id)];
  if (!result || !signup) return tree;
  const generatedConsent = (node: Record<string, unknown>) => node.type === 'consent'
    && [__('Send me email updates. %s', 'wconvert'), __('Send me email guides and updates. %s', 'wconvert')].some(text => text === node.text);
  const generatedConsentIds = walkNodes(signup.content).filter(node => generatedConsent(node as unknown as Record<string, unknown>) && 'id' in node)
    .map(node => (node as { id: string }).id);
  const consents = required ? submission.consents.filter(id => !generatedConsentIds.includes(id))
    : [...new Set([...submission.consents, ...generatedConsentIds])];
  const continuationFrom = required ? signup.id : result.id;
  const gateNextLabel = graph.edges.filter(edge => edge.from === continuationFrom).every(edge => tree.steps.find(screen => screen.id === edge.to)?.kind === 'acknowledgement')
    ? __('Finish', 'wconvert') : __('Continue', 'wconvert');
  const rewrite = (node: TemplateNode, gate: boolean): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    // Preserve merchant-written copy. Only generated wording changes with the gate.
    if (generatedConsent(copy)) copy.hidden = gate;
    if (copy.role === 'headline' && copy.text === (gate ? __('Want more guides?', 'wconvert') : __('One last step', 'wconvert')))
      copy.text = gate ? __('One last step', 'wconvert') : __('Want more guides?', 'wconvert');
    if (copy.role === 'body' && copy.text === (gate ? __('Your result is already available. Signup is optional.', 'wconvert')
      : __('Enter your email to see your recommendation.', 'wconvert')))
      copy.text = gate ? __('Enter your email to see your recommendation.', 'wconvert') : __('Your result is already available. Signup is optional.', 'wconvert');
    if (copy.type === 'button' && copy.action === 'submit' && copy.label === (gate ? __('Sign up', 'wconvert') : __('See my result', 'wconvert')))
      copy.label = gate ? __('See my result', 'wconvert') : __('Sign up', 'wconvert');
    if (gate && copy.type === 'button' && copy.action === 'back'
      && (copy.label === __('Back to result', 'wconvert') || copy.label === __('Back to guide', 'wconvert')))
      copy.label = __('Back', 'wconvert');
    if (copy.type === 'button' && copy.action === 'next' && copy.label === (gate ? __('Optional email updates', 'wconvert') : gateNextLabel))
      copy.label = gate ? gateNextLabel : __('Optional email updates', 'wconvert');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(child => rewrite(child, gate));
    return copy as unknown as TemplateNode;
  };
  const withoutAction = (node: TemplateNode, action: string): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[])
      .filter(child => !(child.type === 'button' && 'action' in child && child.action === action)).map(child => withoutAction(child, action));
    return copy as unknown as TemplateNode;
  };
  const first = required ? result : signup, second = required ? signup : result;
  const crossed = graph.edges.find(edge => edge.from === first.id)!;
  const continuations = graph.edges.filter(edge => edge.from === second.id);
  // Move the adjacent pair together. Downstream branches keep their rule,
  // priority and destination; shared endings keep every unrelated incoming edge.
  const edges = graph.edges.map(edge => edge.id === crossed.id ? { ...edge, from: second.id, to: first.id }
    : edge.from === second.id ? { ...edge, from: first.id }
    : edge.to === first.id ? { ...edge, to: second.id } : edge);
  const newEnding: TemplateScreen[] = [];
  if (!required && !continuations.length) {
    const acknowledgementId = freshScreen(tree, 'content').id;
    newEnding.push({ id: acknowledgementId, name: __('All set', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
      { type: 'heading', text: __('Thanks for visiting', 'wconvert'), role: 'success_headline' },
      { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    ] } });
    edges.push({ id: graphEdgeId({ ...graph, edges }), from: signup.id, to: acknowledgementId, kind: 'default' });
  }
  return referencedJourney({ ...tree, steps: [...tree.steps.map(screen => {
    if (screen.id === result.id) {
      let content = rewrite(screen.content, required);
      if (!required && !walkNodes(content).some(node => node.type === 'button' && 'action' in node && node.action === 'next'))
        content = { type: 'stack', children: [content, { type: 'button', label: __('Optional email updates', 'wconvert'), action: 'next' }] };
      return { ...screen, content };
    }
    if (screen.id !== signup.id) return screen;
    const content = rewrite(withoutAction(screen.content, 'skip'), required);
    return { ...screen, name: required && [__('Optional email signup', 'wconvert'), __('Optional email updates', 'wconvert')].some(name => name === screen.name)
      ? __('Contact details', 'wconvert') : !required && screen.name === __('Contact details', 'wconvert') ? __('Optional email signup', 'wconvert') : screen.name,
    content: required ? content : { type: 'stack', children: [content,
      { type: 'button', label: __('No thanks', 'wconvert'), action: 'skip', submission: submission.id, tokens: { accent: 'transparent', 'accent-fg': 'fg' } } as TemplateNode] } as TemplateNode };
  }), ...newEnding], graph: { ...graph, edges }, submissions: [{ ...submission, required, consents }] });
}

export function withBackButton(screen: TemplateScreen): TemplateScreen {
  if (walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'back')) return screen;
  return { ...screen, content: { type: 'stack', children: [screen.content,
    { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
}

export function withoutBackButtons(node: TemplateNode): TemplateNode {
  if (node.type === 'button' && 'action' in node && node.action === 'back') return { type: 'stack', children: [] };
  const copy = { ...node } as Record<string, unknown>;
  for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[])
    .filter(child => !(child.type === 'button' && 'action' in child && child.action === 'back')).map(withoutBackButtons);
  return copy as unknown as TemplateNode;
}

export function freshScreen(tree: TemplateTree, kind: 'content' | 'input', canGoBack = true): TemplateScreen {
  let i = 1; while (tree.steps.some(s => s.id === `s${i}`)) i++;
  const screen: TemplateScreen = { id: `s${i}`, name: kind === 'input' ? __('Questions', 'wconvert') : __('Offer', 'wconvert'), kind,
    content: { type: 'stack', children: [
      { type: 'heading', role: 'headline', text: kind === 'input' ? __('Tell us more', 'wconvert') : __('A helpful message', 'wconvert') },
      ...(kind === 'input' ? [{ type: 'question', label: __('What matters most to you?', 'wconvert'), answer_type: 'single', required: false,
        options: [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }] } as TemplateNode] : [{ type: 'text', role: 'body', text: __('Add the information visitors need before continuing.', 'wconvert') } as TemplateNode]),
      { type: 'button', label: __('Continue', 'wconvert'), action: 'next' },
    ] } };
  return canGoBack ? withBackButton(screen) : screen;
}

export function usedBy(tree: TemplateTree, questionId: string): string[] {
  return tree.steps.filter(screen => screen.when?.clauses.some(clause => clause.question === questionId)
    || screen.results?.some(result => result.when?.clauses.some(clause => clause.question === questionId))
    || screen.paths?.some(path => path.when?.clauses.some(clause => clause.question === questionId))
    || tree.graph?.edges.some(edge => edge.from === screen.id && edge.when?.clauses.some(clause => clause.question === questionId))).map(screen => screen.id);
}

/** Replace a referenced choice everywhere in one undoable draft edit. IDs and rule order stay stable. */
export function replaceAnswer(tree: TemplateTree, questionId: string, removed: string, replacement: string): TemplateTree {
  if (!replacement || replacement === removed) return tree;
  const question = tree.steps.flatMap(screen => walkNodes(screen.content)).find(node => node.type === 'question' && 'id' in node && node.id === questionId);
  if (!question || !('options' in question) || !question.options?.some(option => option.value === removed)
    || !question.options.some(option => option.value === replacement) || question.options.length <= 2) return tree;
  const condition = (value?: QuestionCondition): QuestionCondition | undefined => value && ({ ...value, clauses: value.clauses.map(clause => clause.question === questionId
    ? { ...clause, values: [...new Set(clause.values.map(item => item === removed ? replacement : item))] } : clause) });
  const content = (node: TemplateNode): TemplateNode => {
    if (node.type === 'question' && 'id' in node && node.id === questionId) return { ...node, options: node.options?.filter(option => option.value !== removed) };
    const copy = { ...node } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(content);
    return copy as TemplateNode;
  };
  return { ...tree, graph: tree.graph && { ...tree.graph, edges: tree.graph.edges.map(edge => ({ ...edge, when: condition(edge.when) })) },
    steps: tree.steps.map(screen => ({ ...screen, content: content(screen.content), when: condition(screen.when),
    paths: screen.paths?.map(path => ({ ...path, when: condition(path.when) })),
    results: screen.results?.map(result => ({ ...result, when: condition(result.when) })) })) };
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
  if (steps[0].id !== tree.steps[0].id) {
    steps[0] = { ...steps[0], content: withoutBackButtons(steps[0].content) };
    const previousEntry = steps.findIndex(item => item.id === tree.steps[0].id);
    if (previousEntry > 0) steps[previousEntry] = withBackButton(steps[previousEntry]);
  }
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
