import { __, sprintf } from '@wordpress/i18n';
import type { Refusal } from '../../components/ui/option-menu';
import type { QuestionCondition, QuestionNode, TemplateTree, TemplateNode, TemplateScreen } from '@renderer/types';
import { graphReaches } from './graph';

export function walkNodes(node: TemplateNode, includeHidden = true): TemplateNode[] {
  if (!includeHidden && 'hidden' in node && node.hidden) return [];
  const b = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
  return [node, ...[...(b.children ?? []), ...(b.start ?? []), ...(b.end ?? [])].flatMap(child => walkNodes(child, includeHidden))];
}

/** The questions under a node that a rule can name (they have an id), in content order. */
export function questionsIn(node: TemplateNode): (QuestionNode & { id: string })[] {
  return walkNodes(node).filter((item): item is QuestionNode & { id: string } => item.type === 'question' && 'id' in item && typeof item.id === 'string');
}

/**
 * Whether a tree uses question-journey structure — the TypeScript spelling of
 * `CaptureJourney::requiresPremium()`, and it has to agree with it: a graph, a
 * screen condition, an answer path, a result screen or a question node.
 *
 * The builder asks it on an install whose Pro `journeys` module is absent, to
 * say once that the draft holds something this site cannot display rather than
 * offering controls the publish route would refuse (ADR 0116).
 */
export function usesJourneyElements(tree: TemplateTree): boolean {
  if (tree.graph) return true;
  return tree.steps.some(screen => !!screen.when || !!screen.paths || screen.kind === 'result'
    || walkNodes(screen.content).some(node => node.type === 'question'));
}

/**
 * How many results show a link button with nowhere to send it yet. Pro quiz
 * setups ship them that way on purpose — the merchant picks each destination
 * (ADRs 0081, 0082, 0106) — so the chooser says so before one is picked rather
 * than leaving it to Publish.
 */
export function resultLinksToChoose(tree: TemplateTree): number {
  return tree.steps.reduce((count, screen) =>
    count + (screen.results ?? []).filter(result => !!result.link_label?.trim() && !result.href?.trim()).length, 0);
}

/** The explicit acceptance boundary for one declared submission. */
export function submissionScreen(tree: TemplateTree, id: string | undefined): number {
  if (!id) return -1;
  return tree.steps.findIndex(s => walkNodes(s.content).some(n =>
    n.type === 'button' && 'action' in n && n.action === 'submit' && 'submission' in n && n.submission === id));
}

/**
 * Whether a code or resource link on this screen reaches only visitors who sign up, though the
 * signup before it is optional. `HeldReward::heldSteps()`'s rule (ADR 0164):
 * every route to the screen passes the main signup's screen.
 */
export function onlyForSignups(tree: TemplateTree, step: number): boolean {
  const primary = tree.submissions[0];
  const at = submissionScreen(tree, primary?.id);
  if (!primary || primary.required || at < 0 || step === at || !tree.steps[step]) return false;
  if (!tree.graph) return step > at;
  const pending = [tree.graph.entry];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === tree.steps[at].id || seen.has(id)) continue;
    if (id === tree.steps[step].id) return false;
    seen.add(id);
    for (const edge of tree.graph.edges) if (edge.from === id) pending.push(edge.to);
  }
  return true;
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

/**
 * The tree with every rule clause on these questions removed. A condition left
 * with no clause goes; so does an answer line, which has nothing else to match.
 */
export function withoutAnswersFrom(tree: TemplateTree, questions: ReadonlySet<string>): TemplateTree {
  const trim = (when?: QuestionCondition): QuestionCondition | undefined => {
    if (!when) return when;
    const clauses = when.clauses.filter(clause => !questions.has(clause.question));
    return clauses.length ? { ...when, clauses } : undefined;
  };
  const steps = tree.steps.map(screen => {
    const next = { ...screen };
    if (screen.when) { const when = trim(screen.when); if (when) next.when = when; else delete next.when; }
    if (screen.results) next.results = screen.results.map(result => { const when = trim(result.when); const copy = { ...result }; if (when) copy.when = when; else delete copy.when; return copy; });
    if (screen.paths) next.paths = screen.paths.filter(path => !path.when || trim(path.when)).map(path => path.when ? { ...path, when: trim(path.when) } : path);
    return next;
  });
  const graph = tree.graph && { ...tree.graph, edges: tree.graph.edges.filter(edge => !edge.when || trim(edge.when))
    .map(edge => edge.when ? { ...edge, when: trim(edge.when) } : edge) };
  return { ...tree, steps, ...(graph ? { graph } : {}) };
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
  return { ...base, paths: undefined, id: freshScreen(tree, 'input').id, name: sprintf(/* translators: %s: the name of the screen being duplicated, e.g. “Your result”. */ __('%s (copy)', 'wconvert'), base.name), content: clone(base.content) };
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

/**
 * Why a screen stays where it is, in two lengths for a menu row: a few words on
 * screen and the sentence in ⓘ (ADR 0139). Null where {@link movedScreen}
 * would move it. Asked of the move itself, so the menu and the move cannot
 * disagree.
 */
export function screenMoveRefusal(tree: TemplateTree, from: number, to: number): Refusal | null {
  if (movedScreen(tree, from, to) !== tree) return null;
  if (to < 0) return { short: __('Already first', 'wconvert'), reason: __('This is the first screen.', 'wconvert') };
  if (from >= tree.steps.length - 1 || to >= tree.steps.length - 1) {
    return { short: __('The last screen stays last', 'wconvert'), reason: __('The last screen is where visitors finish, so it stays at the end.', 'wconvert') };
  }
  return {
    short: __('Would break the screen order', 'wconvert'),
    reason: __('Questions come before the screens that use their answers, the main signup before the optional one, and the thank-you screen last.', 'wconvert'),
  };
}

/** Removing a signup also removes the screens collecting its declared details.
 * Content-only offers between those screens are independent and stay in place. */
export function screenRemoval(tree: TemplateTree, index: number, journeys = true): { screens: string[]; submission?: string } {
  const screen = tree.steps[index];
  if (!screen || whyScreenStays(tree, index, journeys) !== null) return { screens: [] };
  const submission = tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
  if (!submission) return { screens: [screen.id] };
  const owned = new Set([...submission.fields, ...submission.consents]);
  return { submission: submission.id, screens: tree.steps.filter(s => s.id === screen.id || walkNodes(s.content).some(n => 'id' in n && owned.has(n.id as string))).map(s => s.id) };
}

/**
 * Why {@link screenRemoval} keeps this screen, in two lengths for a menu row
 * (ADR 0139), or null where it may go.
 *
 * `journeys` false is a site without Pro's journey editors (ADR 0147). There a
 * result and the answers rules use cannot be edited, so they cannot be what
 * keeps a screen: removing it is the only way to "Remove them to publish".
 */
export function whyScreenStays(tree: TemplateTree, index: number, journeys = true): Refusal | null {
  const screen = tree.steps[index];
  if (!screen) return null;
  if (screen.kind === 'result' && journeys) return { short: __('Keeps the result', 'wconvert'), reason: __('Keep this result screen. Edit its results or content instead.', 'wconvert') };
  if (screen.kind === 'acknowledgement') return { short: __('Keeps the ending', 'wconvert'), reason: __('Keep this ending so visitors have somewhere to finish.', 'wconvert') };
  if (tree.steps.length <= 2) return { short: __('Needs two screens', 'wconvert'), reason: __('A campaign keeps at least two screens.', 'wconvert') };
  if (tree.steps.some(item => item.paths?.some(path => path.to === screen.id))) {
    return { short: __('A line leads here', 'wconvert'), reason: __('Another screen’s line leads here. Change that line first.', 'wconvert') };
  }
  if (journeys && walkNodes(screen.content).some(n => n.type === 'question' && 'id' in n && usedBy(tree, n.id as string).length > 0)) {
    return { short: __('Other screens use its answers', 'wconvert'), reason: __('Answers on this screen are used by rules on other screens. Update those rules first.', 'wconvert') };
  }
  if (tree.submissions.find(sub => submissionScreen(tree, sub.id) === index)?.required) {
    return { short: __('Saves the main signup', 'wconvert'), reason: __('This screen saves the campaign’s main signup, so it stays.', 'wconvert') };
  }
  return null;
}

export function removedScreen(tree: TemplateTree, index: number, journeys = true): TemplateTree {
  const removal = screenRemoval(tree, index, journeys);
  if (!removal.screens.length) return tree;
  // Only reachable without the journey editors: rules on the removed questions go with them.
  const gone = new Set(tree.steps.filter(s => removal.screens.includes(s.id)).flatMap(s => walkNodes(s.content))
    .filter(n => n.type === 'question' && 'id' in n && typeof n.id === 'string').map(n => (n as { id: string }).id));
  if (gone.size) tree = withoutAnswersFrom(tree, gone);
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

