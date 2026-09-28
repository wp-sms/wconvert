import { __ } from '@wordpress/i18n';
import type { QuestionCondition, TemplateNode, TemplateTree } from '@renderer/types';
import { walkNodes, unreachableScreenIds } from './journey';
import { graphRemoval, graphRemovalPlan } from './graphRemoval';
import { journeyReadinessIssues } from './journeyReadiness';
import { journeyBoundaryIssues } from './journeyBoundaryReadiness';

/** Stage a complete retirement. Mixed rules and shared/dependent content need explicit repair. */
export function retireAnswerPlan(tree: TemplateTree, questionId: string, value: string): { next?: TemplateTree; removed: string[]; reason?: string } {
  const removed: string[] = [];
  const blocked = (reason: string) => ({ removed, reason });
  const question = tree.steps.flatMap(screen => walkNodes(screen.content)).find(node => node.type === 'question' && 'id' in node && node.id === questionId);
  if (!tree.graph || !question || question.type !== 'question' || !('options' in question)) return blocked(__('Edit the listed rules individually for this journey.', 'wconvert'));
  if ((question.options?.length ?? 0) <= 2) return blocked(__('Keep at least two choices. Add another choice before removing this one.', 'wconvert'));
  const uses = (when?: QuestionCondition) => when?.clauses.some(clause => clause.question === questionId && clause.values.includes(value));
  const only = (when?: QuestionCondition) => when?.clauses.length === 1 && when.clauses[0].question === questionId
    && ['is', 'includes_any'].includes(when.clauses[0].operator) && when.clauses[0].values.length === 1 && when.clauses[0].values[0] === value;
  const conditions = [...tree.steps.flatMap(screen => [screen.when, ...(screen.results?.map(result => result.when) ?? [])]), ...tree.graph.edges.map(edge => edge.when)];
  if (conditions.some(when => uses(when) && !only(when))) return blocked(__('Some rules combine this answer with other choices or comparisons. Edit those rules below first so other visitors keep the intended behavior.', 'wconvert'));
  let next: TemplateTree = { ...tree, steps: tree.steps.map(screen => ({ ...screen, ...(screen.results ? { results: screen.results.filter(result => {
    if (!uses(result.when)) return true;
    removed.push(result.heading); return false;
  }) } : {}) })), graph: { ...tree.graph, edges: tree.graph.edges.filter(edge => {
    if (!uses(edge.when)) return true;
    removed.push(`${tree.steps.find(screen => screen.id === edge.from)?.name} → ${tree.steps.find(screen => screen.id === edge.to)?.name}`); return false;
  }) } };
  for (const screen of tree.steps.filter(screen => uses(screen.when))) {
    const plan = graphRemovalPlan(next, screen.id);
    if (plan.reason || !plan.preferred) return blocked(plan.reason ?? __('A follow-up has different continuations. Choose its remaining path before retiring this answer.', 'wconvert'));
    const removal = graphRemoval(next, screen.id, plan.preferred);
    if (!removal) return blocked(__('Review the affected follow-up before removing it.', 'wconvert'));
    removed.push(screen.name); next = removal.next;
  }
  const alreadyDisconnected = new Set(unreachableScreenIds(tree));
  const abandoned = unreachableScreenIds(next).filter(id => !alreadyDisconnected.has(id));
  // Only remove ordinary screens that were exclusively owned by a removed path.
  // Captures, endings, results and answers referenced elsewhere stay protected.
  for (const id of abandoned) {
    const plan = graphRemovalPlan(next, id);
    const screen = next.steps.find(item => item.id === id)!;
    if (plan.reason) return blocked(plan.reason);
    const removal = graphRemoval(next, id, plan.preferred || plan.targets[0]?.id);
    if (!removal) return blocked(__('A disconnected screen needs a continuation. Review its paths first.', 'wconvert'));
    removed.push(screen.name); next = removal.next;
  }
  const removeChoice = (node: TemplateNode): TemplateNode => {
    if (node.type === 'question' && 'id' in node && node.id === questionId) return { ...node, options: node.options?.filter(option => option.value !== value) };
    const copy = { ...node } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(removeChoice);
    return copy as TemplateNode;
  };
  next = { ...next, steps: next.steps.map(screen => ({ ...screen, content: removeChoice(screen.content) })) };
  const issues = (candidate: TemplateTree) => [...journeyReadinessIssues(candidate), ...journeyBoundaryIssues(candidate, tree.steps.some(screen => screen.kind === 'result') ? 'match' : 'submit')];
  const before = new Set(issues(tree).map(issue => issue.key));
  const issue = issues(next).find(issue => !before.has(issue.key));
  if (issue) return blocked(issue.said);
  return { next, removed };
}
