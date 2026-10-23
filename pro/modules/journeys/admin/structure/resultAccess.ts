import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree, TemplateNode, TemplateScreen } from '@renderer/types';
import { graphEdgeId } from '@/builder/structure/graph';
import { contactWording, privacyLink } from '@/builder/structure/captureWording';
import { freshScreen, referencedJourney, submissionScreen, walkNodes } from '@/builder/structure/journey';

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
    if (copy.role === 'headline') copy.text = gate ? __('One last step', 'wconvert-pro') : __('Want more guides?', 'wconvert-pro');
    if (copy.role === 'body') copy.text = gate
      ? __('Enter your email to see your recommendation.', 'wconvert-pro')
      : __('Your result is already available. Signup is optional.', 'wconvert-pro');
    if (copy.type === 'consent') copy.hidden = gate || !String(copy.text ?? '').trim();
    if (copy.type === 'button' && copy.action === 'submit') copy.label = gate ? __('See my result', 'wconvert-pro') : __('Sign up', 'wconvert-pro');
    if (gate && copy.type === 'button' && copy.action === 'back'
      && (copy.label === __('Back to guide', 'wconvert-pro') || copy.label === __('Back to result', 'wconvert-pro')))
      copy.label = __('Back', 'wconvert-pro');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(child => contactCopy(child, gate));
    return copy as unknown as TemplateNode;
  };
  if (required) {
    if (resultAt !== tree.steps.length - 3 || signupAt !== resultAt + 1 || tree.steps.at(-1)?.kind !== 'acknowledgement') return tree;
    const signup = { ...tree.steps[signupAt], name: __('Contact details', 'wconvert-pro'), content: contactCopy(drop(tree.steps[signupAt].content, 'skip'), true) };
    const result = { ...tree.steps[resultAt], content: drop(tree.steps[resultAt].content, 'next') };
    return referencedJourney({ ...tree, steps: [...tree.steps.slice(0, resultAt), signup, result],
      submissions: [{ ...tree.submissions[0], required: true }] });
  }
  if (resultAt !== tree.steps.length - 1 || signupAt !== resultAt - 1) return tree;
  const result = addButton(tree.steps[resultAt], __('Optional email updates', 'wconvert-pro'), 'next');
  const signup = addButton({ ...tree.steps[signupAt], name: __('Optional email updates', 'wconvert-pro'), content: contactCopy(tree.steps[signupAt].content, false) }, __('No thanks', 'wconvert-pro'), 'skip', tree.submissions[0].id);
  const acknowledgement: TemplateScreen = { id: 'received', name: __('All set', 'wconvert-pro'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', text: __('Thanks for visiting', 'wconvert-pro') },
    { type: 'button', label: __('Back', 'wconvert-pro'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
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
  const signup: TemplateScreen = { id: signupId, name: __('Optional email signup', 'wconvert-pro'), kind: 'input', content: { type: 'stack', children: [
    { type: 'heading', text: __('Want more guides?', 'wconvert-pro'), role: 'headline' },
    { type: 'text', text: __('Your result is already available. Signup is optional.', 'wconvert-pro'), role: 'body' },
    { type: 'field', name: 'email', required: true, label: contactWording('email').label },
    { type: 'consent', text: contactWording('email').optionalConsent, link: privacyLink(), hidden: false, role: 'consent_text' },
    { type: 'button', label: __('Sign up', 'wconvert-pro'), action: 'submit', submission: submissionId },
    { type: 'button', label: __('No thanks', 'wconvert-pro'), action: 'skip', submission: submissionId, tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    { type: 'button', label: __('Back', 'wconvert-pro'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
  const acknowledgement: TemplateScreen = { id: acknowledgementId, name: __('All set', 'wconvert-pro'), kind: 'acknowledgement', content: { type: 'stack', children: [
    { type: 'heading', text: __('Thanks for visiting', 'wconvert-pro'), role: 'success_headline' },
    { type: 'button', label: __('Back', 'wconvert-pro'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
  ] } };
  const firstEdge = edge?.id ?? graphEdgeId(tree.graph);
  const secondEdge = graphEdgeId({ ...tree.graph, edges: [...tree.graph.edges, { id: firstEdge, from: result.id, to: signupId, kind: 'default' }] });
  const restoreInvitation = (node: TemplateNode): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    if (copy.type === 'button' && copy.action === 'next' && copy.label === __('Finish', 'wconvert-pro')) copy.label = __('Optional email updates', 'wconvert-pro');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(restoreInvitation);
    return copy as unknown as TemplateNode;
  };
  const withIds = referencedJourney({ ...tree, steps: [...tree.steps.map(screen => screen.id !== result.id ? screen
    : walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'next')
      ? { ...screen, content: restoreInvitation(screen.content) }
      : { ...screen, content: { type: 'stack', children: [screen.content,
        { type: 'button', label: __('Optional email updates', 'wconvert-pro'), action: 'next' } as TemplateNode] } as TemplateNode }), signup, ...(ending ? [] : [acknowledgement])], graph: { ...tree.graph, edges: [...tree.graph.edges.filter(item => item.id !== edge?.id),
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
  if (!graph || tree.submissions.length !== 1) return { message: __('Keep one signup to choose when contact details are requested.', 'wconvert-pro'), section: 'content' };
  const submission = tree.submissions[0];
  if (submission.required === required) return null;
  const result = tree.steps.find(screen => screen.kind === 'result');
  const signup = tree.steps[submissionScreen(tree, submission.id)];
  if (!result || !signup) return { message: __('Choose the screen that saves this signup before changing result access.', 'wconvert-pro'), section: 'content' };
  const issue = (message: string, screenId: string, section: 'content' | 'paths' = 'paths') => ({ message, screenId, section });
  if (result.id === graph.entry || signup.id === graph.entry)
    return issue(__('Start with a question screen before the result and signup.', 'wconvert-pro'), graph.entry);
  if (signup.when) return issue(__('Show the signup to everyone on this line before changing result access.', 'wconvert-pro'), signup.id, 'content');
  if (!walkNodes(signup.content).some(node => node.type === 'field' && 'id' in node && submission.fields.includes(node.id ?? '')
    && 'name' in node && node.name === 'email' && 'required' in node && node.required))
    return issue(__('Place the required email field on the signup screen before changing result access.', 'wconvert-pro'), signup.id, 'content');
  const first = required ? result : signup, second = required ? signup : result;
  const outgoing = graph.edges.filter(edge => edge.from === first.id);
  if (outgoing.length !== 1 || outgoing[0].kind !== 'default' || outgoing[0].to !== second.id)
    return issue(sprintf(/* translators: 1: the screen that comes first, 2: the screen that should follow it; both are screen names. */ __('Connect “%1$s” directly to “%2$s” with one line for all answers. Move any answer lines after both screens first.', 'wconvert-pro'), first.name, second.name), first.id);
  const otherIncoming = graph.edges.find(edge => edge.to === second.id && edge.id !== outgoing[0].id);
  if (otherIncoming) return issue(sprintf(/* translators: 1: the screen a line starts from, 2: the screen that line enters, 3: the screen it should connect to instead; all are screen names. */ __('The line from “%1$s” enters “%2$s” separately. Connect it to “%3$s” first so both screens move together.', 'wconvert-pro'),
    tree.steps.find(screen => screen.id === otherIncoming.from)?.name ?? otherIncoming.from, second.name, first.name), otherIncoming.from);
  if (!required) {
    const questions = new Set(walkNodes(signup.content).filter(node => node.type === 'question' && 'id' in node).map(node => 'id' in node ? node.id : ''));
    if (result.results?.some(variant => variant.when?.clauses.some(clause => questions.has(clause.question))))
      return issue(__('This result uses an answer collected on the signup screen. Move that question to an earlier screen before showing the result first.', 'wconvert-pro'), signup.id, 'content');
    if (walkNodes(result.content, false).some(node => node.type === 'followup'))
      return issue(__('This result contains a signup reward. Move the reward after the signup before showing the result first.', 'wconvert-pro'), result.id, 'content');
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
    && [/* translators: %s: a link to the site's privacy policy. */ __('Send me email updates. %s', 'wconvert-pro'), /* translators: %s: a link to the site's privacy policy. */ __('Send me email guides and updates. %s', 'wconvert-pro')].some(text => text === node.text);
  const generatedConsentIds = walkNodes(signup.content).filter(node => generatedConsent(node as unknown as Record<string, unknown>) && 'id' in node)
    .map(node => (node as { id: string }).id);
  const consents = required ? submission.consents.filter(id => !generatedConsentIds.includes(id))
    : [...new Set([...submission.consents, ...generatedConsentIds])];
  const continuationFrom = required ? signup.id : result.id;
  const gateNextLabel = graph.edges.filter(edge => edge.from === continuationFrom).every(edge => tree.steps.find(screen => screen.id === edge.to)?.kind === 'acknowledgement')
    ? __('Finish', 'wconvert-pro') : __('Continue', 'wconvert-pro');
  const rewrite = (node: TemplateNode, gate: boolean): TemplateNode => {
    const copy = { ...node } as Record<string, unknown>;
    // Preserve merchant-written copy. Only generated wording changes with the gate.
    if (generatedConsent(copy)) copy.hidden = gate;
    if (copy.role === 'headline' && copy.text === (gate ? __('Want more guides?', 'wconvert-pro') : __('One last step', 'wconvert-pro')))
      copy.text = gate ? __('One last step', 'wconvert-pro') : __('Want more guides?', 'wconvert-pro');
    if (copy.role === 'body' && copy.text === (gate ? __('Your result is already available. Signup is optional.', 'wconvert-pro')
      : __('Enter your email to see your recommendation.', 'wconvert-pro')))
      copy.text = gate ? __('Enter your email to see your recommendation.', 'wconvert-pro') : __('Your result is already available. Signup is optional.', 'wconvert-pro');
    if (copy.type === 'button' && copy.action === 'submit' && copy.label === (gate ? __('Sign up', 'wconvert-pro') : __('See my result', 'wconvert-pro')))
      copy.label = gate ? __('See my result', 'wconvert-pro') : __('Sign up', 'wconvert-pro');
    if (gate && copy.type === 'button' && copy.action === 'back'
      && (copy.label === __('Back to result', 'wconvert-pro') || copy.label === __('Back to guide', 'wconvert-pro')))
      copy.label = __('Back', 'wconvert-pro');
    if (copy.type === 'button' && copy.action === 'next' && copy.label === (gate ? __('Optional email updates', 'wconvert-pro') : gateNextLabel))
      copy.label = gate ? gateNextLabel : __('Optional email updates', 'wconvert-pro');
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
    newEnding.push({ id: acknowledgementId, name: __('All set', 'wconvert-pro'), kind: 'acknowledgement', content: { type: 'stack', children: [
      { type: 'heading', text: __('Thanks for visiting', 'wconvert-pro'), role: 'success_headline' },
      { type: 'button', label: __('Back', 'wconvert-pro'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    ] } });
    edges.push({ id: graphEdgeId({ ...graph, edges }), from: signup.id, to: acknowledgementId, kind: 'default' });
  }
  return referencedJourney({ ...tree, steps: [...tree.steps.map(screen => {
    if (screen.id === result.id) {
      let content = rewrite(screen.content, required);
      if (!required && !walkNodes(content).some(node => node.type === 'button' && 'action' in node && node.action === 'next'))
        content = { type: 'stack', children: [content, { type: 'button', label: __('Optional email updates', 'wconvert-pro'), action: 'next' }] };
      return { ...screen, content };
    }
    if (screen.id !== signup.id) return screen;
    const content = rewrite(withoutAction(screen.content, 'skip'), required);
    return { ...screen, name: required && [__('Optional email signup', 'wconvert-pro'), __('Optional email updates', 'wconvert-pro')].some(name => name === screen.name)
      ? __('Contact details', 'wconvert-pro') : !required && screen.name === __('Contact details', 'wconvert-pro') ? __('Optional email signup', 'wconvert-pro') : screen.name,
    content: required ? content : { type: 'stack', children: [content,
      { type: 'button', label: __('No thanks', 'wconvert-pro'), action: 'skip', submission: submission.id, tokens: { accent: 'transparent', 'accent-fg': 'fg' } } as TemplateNode] } as TemplateNode };
  }), ...newEnding], graph: { ...graph, edges }, submissions: [{ ...submission, required, consents }] });
}
