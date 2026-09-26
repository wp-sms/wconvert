import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { unreachableScreenIds, walkNodes } from './journey';
import { graphReaches } from './graph';

export interface JourneyRepair {
  readonly screenId: string;
  readonly section: 'content' | 'paths';
  readonly edgeId?: string;
  readonly pathPriority?: number;
}

export interface JourneyReadinessIssue {
  readonly key: string;
  readonly said: string;
  readonly repair: JourneyRepair;
}

/** Name the incomplete authoring controls we can locate before the server's final validation. */
export function journeyReadinessIssues(tree: TemplateTree): JourneyReadinessIssue[] {
  const issues: JourneyReadinessIssue[] = [];
  const incomplete = (condition: QuestionCondition | undefined) => !condition || !condition.clauses.length
    || condition.clauses.some(clause => !clause.question || !clause.values.length || clause.values.some(value => !value));
  const questions = new Map<string, { screen: string; index: number; node: QuestionNode }>();
  tree.steps.forEach((screen, index) => walkNodes(screen.content).forEach(node => {
    if (node.type === 'question' && 'id' in node && typeof node.id === 'string') questions.set(node.id, { screen: screen.id, index, node: node as QuestionNode });
  }));
  const invalid = (condition: QuestionCondition, target: string, allowCurrent: boolean): string | null => {
    for (const clause of condition.clauses) {
      const source = questions.get(clause.question);
      if (!source) return __('The rule refers to a question that no longer exists. Choose another question.', 'wconvert');
      const available = source.screen === target ? allowCurrent : tree.graph
        ? graphReaches(tree.graph, source.screen, target) : source.index < tree.steps.findIndex(screen => screen.id === target);
      if (!available) return sprintf(__('“%s” cannot be answered before this rule. Reconnect its screen or choose an earlier question.', 'wconvert'), source.node.label);
      if (source.node.answer_type === 'text') return sprintf(__('“%s” is a text question. Choose a question with answer choices for this rule.', 'wconvert'), source.node.label);
      const operators = source.node.answer_type === 'multi' ? ['includes_any', 'includes_none'] : ['is', 'is_not'];
      if (!operators.includes(clause.operator)) return sprintf(__('Choose a comparison that matches the answer type of “%s”.', 'wconvert'), source.node.label);
      if (clause.values.some(value => !source.node.options?.some(option => option.value === value)))
        return sprintf(__('An answer used by this rule is no longer available in “%s”. Choose an available answer.', 'wconvert'), source.node.label);
    }
    return null;
  };
  for (const screen of tree.steps) {
    if (screen.when && incomplete(screen.when)) issues.push({ key: `show:${screen.id}`,
      said: sprintf(__('Choose an answer for when “%s” appears.', 'wconvert'), screen.name),
      repair: { screenId: screen.id, section: 'content' } });
    else if (screen.when) {
      const reason = invalid(screen.when, screen.id, false);
      if (reason) issues.push({ key: `show:${screen.id}`, said: sprintf(__('Review when “%1$s” appears: %2$s', 'wconvert'), screen.name, reason), repair: { screenId: screen.id, section: 'content' } });
    }
    screen.results?.forEach((result, index) => {
      if (!result.when) return;
      const reason = incomplete(result.when) ? null : invalid(result.when, screen.id, false);
      if (!incomplete(result.when) && !reason) return;
      issues.push({ key: `result:${screen.id}:${index}`,
        said: reason ? sprintf(__('Review result %1$d on “%2$s”: %3$s', 'wconvert'), index + 1, screen.name, reason)
          : sprintf(__('Choose an answer for result %1$d on “%2$s”.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'content' } });
    });
    screen.paths?.forEach((path, index) => {
      if (!path.when) return;
      const reason = incomplete(path.when) ? null : invalid(path.when, screen.id, true);
      if (!incomplete(path.when) && !reason) return;
      issues.push({ key: `path:${screen.id}:${index}`,
        said: reason ? sprintf(__('Review path %1$d from “%2$s”: %3$s', 'wconvert'), index + 1, screen.name, reason)
          : sprintf(__('Choose an answer for path %1$d from “%2$s”.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'paths', pathPriority: index } });
    });
  }
  if (tree.graph) for (const edge of tree.graph.edges) {
    if (edge.kind !== 'answer') continue;
    const reason = incomplete(edge.when) ? null : invalid(edge.when!, edge.from, true);
    if (!incomplete(edge.when) && !reason) continue;
    const source = tree.steps.find(screen => screen.id === edge.from)?.name ?? edge.from;
    const target = tree.steps.find(screen => screen.id === edge.to)?.name ?? edge.to;
    issues.push({ key: `edge:${edge.id}`,
      said: reason ? sprintf(__('Review the path from “%1$s” to “%2$s”: %3$s', 'wconvert'), source, target, reason)
        : sprintf(__('Choose an answer for the path from “%1$s” to “%2$s”.', 'wconvert'), source, target),
      repair: { screenId: edge.from, section: 'paths', edgeId: edge.id } });
  }
  if (tree.graph) for (const screen of tree.steps) {
    const outgoing = tree.graph.edges.filter(edge => edge.from === screen.id);
    if (!outgoing.some(edge => edge.kind === 'default') && (outgoing.length > 0 || ['input', 'content'].includes(screen.kind)))
      issues.push({ key: `continue:${screen.id}`, said: sprintf(__('Choose where visitors continue after “%s”.', 'wconvert'), screen.name),
        repair: { screenId: screen.id, section: 'paths', pathPriority: outgoing.filter(edge => edge.kind === 'answer').length } });
    if (screen.when && !outgoing.some(edge => edge.kind === 'hidden'))
      issues.push({ key: `hidden:${screen.id}`, said: sprintf(__('Choose where visitors go when “%s” is hidden.', 'wconvert'), screen.name),
        repair: { screenId: screen.id, section: 'paths' } });
  }
  for (const id of unreachableScreenIds(tree)) {
    const name = tree.steps.find(screen => screen.id === id)?.name ?? id;
    issues.push({ key: `unreachable:${id}`,
      said: sprintf(__('No journey path reaches “%s”. Connect or remove this screen.', 'wconvert'), name),
      repair: { screenId: id, section: 'content' } });
  }
  return issues;
}
