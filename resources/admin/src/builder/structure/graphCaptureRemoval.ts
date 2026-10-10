import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateNode, TemplateTree } from '@renderer/types';
import { graphDisplayOrder } from './graph';
import { walkNodes, withoutBackButtons } from './journey';

export function captureOnScreen(tree: TemplateTree, screenId: string) {
  const screen = tree.steps.find(item => item.id === screenId);
  const nodes = screen ? walkNodes(screen.content) : [];
  return tree.submissions.find(sub => nodes.some(node => 'id' in node && [...sub.fields, ...sub.consents].includes(node.id ?? '')
    || node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === sub.id));
}

/** Remove one optional acceptance boundary together with all screens owning its data. */
export function graphCaptureRemovalPlan(tree: TemplateTree, submissionId: string) {
  const sub = tree.submissions.find(item => item.id === submissionId);
  const owned = new Set([...(sub?.fields ?? []), ...(sub?.consents ?? [])]);
  const screens = graphDisplayOrder(tree).map(index => tree.steps[index]).filter(screen => walkNodes(screen.content).some(node =>
    'id' in node && owned.has(node.id ?? '') || node.type === 'button' && 'action' in node && node.action === 'submit'
      && 'submission' in node && node.submission === submissionId));
  const removed = new Set(screens.map(screen => screen.id));
  const questions = new Set(screens.flatMap(screen => walkNodes(screen.content)).flatMap(node => node.type === 'question' && 'id' in node ? [node.id] : []));
  const references = (when?: QuestionCondition) => when?.clauses.some(clause => questions.has(clause.question));
  const dependents = tree.steps.filter(screen => !removed.has(screen.id) && (
    [screen.when, ...(screen.results?.map(result => result.when) ?? [])].some(references)
    || tree.graph?.edges.some(edge => edge.from === screen.id && references(edge.when))));
  const shared = screens.filter(screen => walkNodes(screen.content).some(node =>
    (node.type === 'field' || node.type === 'consent') && (!('id' in node) || !owned.has(node.id ?? ''))
    || node.type === 'button' && 'action' in node && node.action === 'submit' && (!('submission' in node) || node.submission !== submissionId)));
  const incoming = tree.graph?.edges.filter(edge => !removed.has(edge.from) && removed.has(edge.to)) ?? [];
  const entries = [...new Set([...incoming.map(edge => edge.to), ...(tree.graph && removed.has(tree.graph.entry) ? [tree.graph.entry] : [])])];
  const routes = entries.map(from => {
    const pending = [from], seen = new Set<string>(), exits = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of tree.graph?.edges.filter(item => item.from === id) ?? []) {
        if (removed.has(edge.to)) pending.push(edge.to); else exits.add(edge.to);
      }
    }
    const targets = graphDisplayOrder(tree).map(index => tree.steps[index]).filter(screen => exits.has(screen.id)
      && (from !== tree.graph?.entry || !screen.when));
    return { from, incoming: incoming.filter(edge => edge.to === from), targets, preferred: targets.length === 1 ? targets[0].id : '' };
  });
  // Each refusal in two lengths: a few words for the menu row, the sentence for its ⓘ (ADR 0139).
  const refusal = !tree.graph || !sub || !screens.length ? [__('No longer in the journey', 'wconvert'), __('This signup is no longer in the journey.', 'wconvert')]
    : sub.required ? [__('This signup is required', 'wconvert'), __('This signup is required. Change the campaign’s capture requirement before removing it.', 'wconvert')]
      : tree.submissions.length === 1 && !tree.steps.some(screen => screen.kind === 'result')
        ? [__('The only signup', 'wconvert'), __('This is the campaign’s only signup. Keep a capture point for this campaign, or use a result journey that can finish without contact details.', 'wconvert')]
        : screens.some(screen => screen.kind === 'result' || screen.kind === 'acknowledgement')
          ? [__('Shares a result or ending', 'wconvert'), __('This signup shares a result or ending screen. Move its contact fields and save action to a separate screen before removing it.', 'wconvert')]
          : shared.length || tree.submissions.some(other => other.id !== sub.id && [...other.fields, ...other.consents].some(id => owned.has(id)))
            ? [__('Shared with another signup', 'wconvert'), __('These screens also collect details for another signup. Separate those fields and save actions before removing this signup.', 'wconvert')]
            : dependents.length ? [__('Other screens use its answers', 'wconvert'), sprintf(/* translators: %s: screen names, already joined. */ __('Answers on these screens are used by rules on: %s. Update those rules before removing this signup.', 'wconvert'), dependents.map(screen => screen.name).join(', '))]
              : routes.some(route => !route.targets.length) ? [__('Nowhere to continue', 'wconvert'), __('A removed screen has no suitable continuation. Connect it to a remaining screen before removing this signup.', 'wconvert')] : null;
  const reason = refusal?.[1] ?? null;
  const short = refusal?.[0] ?? null;
  return { reason, short, screens, routes, submission: sub };
}

export function removeGraphCapture(tree: TemplateTree, submissionId: string, destinations: Record<string, string> = {}): { next: TemplateTree; destination: string } | null {
  const plan = graphCaptureRemovalPlan(tree, submissionId);
  if (plan.reason || !tree.graph) return null;
  const removed = new Set(plan.screens.map(screen => screen.id));
  const target = (id: string) => destinations[id] ?? plan.routes.find(route => route.from === id)?.preferred ?? '';
  if (plan.routes.some(route => !route.targets.some(screen => screen.id === target(route.from)))) return null;
  const entry = removed.has(tree.graph.entry) ? target(tree.graph.entry) : tree.graph.entry;
  const clean = (node: TemplateNode, result: boolean): TemplateNode | null => {
    if (node.type === 'button' && 'action' in node && node.action === 'skip' && 'submission' in node && node.submission === submissionId) return null;
    const copy = { ...node } as Record<string, unknown>;
    if (result && copy.type === 'button' && copy.action === 'next' && copy.label === __('Optional email updates', 'wconvert')) copy.label = __('Finish', 'wconvert');
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).flatMap(child => {
      const next = clean(child, result); return next ? [next] : [];
    });
    return copy as unknown as TemplateNode;
  };
  return { destination: plan.routes.length ? target(plan.routes[0].from) : entry, next: { ...tree,
    submissions: tree.submissions.filter(sub => sub.id !== submissionId),
    steps: tree.steps.filter(screen => !removed.has(screen.id)).map(screen => {
      const content = clean(screen.content, screen.kind === 'result' && tree.graph!.edges.some(edge => edge.from === screen.id && removed.has(edge.to))) ?? { type: 'stack' as const, children: [] };
      return { ...screen, content: screen.id === entry ? withoutBackButtons(content) : content };
    }),
    graph: { ...tree.graph, entry, edges: tree.graph.edges.filter(edge => !removed.has(edge.from))
      .map(edge => removed.has(edge.to) ? { ...edge, to: target(edge.to) } : edge) },
  } };
}
