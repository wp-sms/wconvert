import { commerceSupported } from '../../settings';
import { tierProductName, unlessFree } from '../../goals/availability';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { unreachableScreenIds, walkNodes } from './journey';
import { graphDisplayOrder, graphReaches } from './graph';
import { MAX_PATH_QUESTIONS, questionPath } from './questionBudget';
import { requiredSaveBypasses } from './graphChangeImpact';

export interface JourneyRepair {
  readonly screenId: string;
  readonly section: 'content' | 'paths';
  readonly edgeId?: string;
  readonly pathPriority?: number;
  readonly resultId?: string;
  readonly questionId?: string;
  readonly choiceIndex?: number;
  readonly focus?: 'questions' | 'hidden-route' | 'route-target' | 'result-link' | 'result-heading' | 'products-required' | 'screen-name';
}

export interface JourneyReadinessIssue {
  readonly key: string;
  readonly said: string;
  readonly repair: JourneyRepair;
}

/** Name the incomplete authoring controls we can locate before the server's final validation. */
export function journeyReadinessIssues(tree: TemplateTree): JourneyReadinessIssue[] {
  const issues: JourneyReadinessIssue[] = [];
  const order = graphDisplayOrder(tree);
  for (const bypass of requiredSaveBypasses(tree)) {
    if (!bypass.edge || !bypass.saving.length) continue;
    const ending = tree.steps.find(screen => screen.id === bypass.endingId)?.name ?? bypass.endingId;
    issues.push({ key: bypass.key,
      said: sprintf(__('A path reaches “%1$s” without the required save at %2$s. Reconnect this path through the save screen.', 'wconvert'),
        ending, bypass.saving.map(screen => `“${screen.name}”`).join(', ')),
      repair: { screenId: bypass.edge.from, section: 'paths', edgeId: bypass.edge.id,
        ...(bypass.edge.kind === 'hidden' ? { focus: 'hidden-route' as const } : {}) } });
  }
  const budget = questionPath(tree);
  if (budget && budget.count > MAX_PATH_QUESTIONS) {
    const screenId = budget.screens[budget.screens.length - 1];
    const names = budget.screens.map(id => tree.steps.find(screen => screen.id === id)?.name ?? id).join(' → ');
    issues.push({ key: 'question-path-limit',
      said: sprintf(__('This connected route contains %1$d questions; the limit is ten: %2$s. Remove questions or move them to a separate branch.', 'wconvert'), budget.count, names),
      repair: { screenId, section: 'content', focus: 'questions' } });
  }
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
    if (!screen.name.trim() || screen.name.length > 120) issues.push({ key: `name:${screen.id}`,
      said: sprintf(__('Give screen %d a name of 1 to 120 characters.', 'wconvert'), order.indexOf(tree.steps.indexOf(screen)) + 1),
      repair: { screenId: screen.id, section: 'content', focus: 'screen-name' } });
    const screenQuestions = [...questions.entries()].filter(([, question]) => question.screen === screen.id);
    screenQuestions.forEach(([id, { node }], index) => {
      const name = node.label?.trim() || sprintf(__('Question %d', 'wconvert'), index + 1);
      if (!node.label?.trim() || node.label.length > 200) issues.push({ key: `question-label:${id}`,
        said: sprintf(__('Give question %1$d on “%2$s” text of 1 to 200 characters.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'content', focus: 'questions', questionId: id } });
      if (node.answer_type !== 'text') {
        if ((node.options?.length ?? 0) < 2 || (node.options?.length ?? 0) > 12) issues.push({ key: `question-choices:${id}`,
          said: sprintf(__('“%1$s” on “%2$s” needs 2 to 12 answer choices.', 'wconvert'), name, screen.name),
          repair: { screenId: screen.id, section: 'content', focus: 'questions', questionId: id, choiceIndex: 0 } });
        node.options?.forEach((option, choiceIndex) => {
          if (!option.label.trim()) issues.push({ key: `choice-label:${id}:${choiceIndex}`,
            said: sprintf(__('Name answer %1$d for “%2$s” on “%3$s”.', 'wconvert'), choiceIndex + 1, name, screen.name),
            repair: { screenId: screen.id, section: 'content', focus: 'questions', questionId: id, choiceIndex } });
        });
      }
    });
    if (screen.when && incomplete(screen.when)) issues.push({ key: `show:${screen.id}`,
      said: sprintf(__('Choose an answer for when “%s” appears.', 'wconvert'), screen.name),
      repair: { screenId: screen.id, section: 'content' } });
    else if (screen.when) {
      const reason = invalid(screen.when, screen.id, false);
      if (reason) issues.push({ key: `show:${screen.id}`, said: sprintf(__('Review when “%1$s” appears: %2$s', 'wconvert'), screen.name, reason), repair: { screenId: screen.id, section: 'content' } });
    }
    screen.results?.forEach((result, index) => {
      if (!result.heading.trim()) issues.push({ key: `result-heading:${screen.id}:${result.id}`,
        said: sprintf(__('Give result %1$d on “%2$s” a heading.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'content', resultId: result.id, focus: 'result-heading' } });
      if (result.product_action === 'add_to_cart' && (!commerceSupported() || (!result.product_ids?.length && !result.product_filter))) issues.push({
        key: `result-cart:${screen.id}:${result.id}`, said: !commerceSupported() ? unlessFree(sprintf(
          /* translators: %s: the product that includes cart buttons, e.g. “WConvert Pro”. */
          __('Quiz cart buttons are included with %s and need WooCommerce on this site.', 'wconvert'), tierProductName('pro'))) : sprintf(__('Choose products for “%s” or use View product.', 'wconvert'), result.heading),
        repair: { screenId: screen.id, section: 'content', resultId: result.id },
      });
      if (result.product_filter && (!result.product_filter.category_id || result.product_filter.attributes.some(item => !item.taxonomy || !item.term_id)
        || new Set(result.product_filter.attributes.map(item => item.taxonomy)).size !== result.product_filter.attributes.length)) issues.push({
        key: `result-products:${screen.id}:${result.id}`, said: sprintf(__('Complete the category and filters for “%s”.', 'wconvert'), result.heading),
        repair: { screenId: screen.id, section: 'content', resultId: result.id },
      });
      const hasLink = !!result.href?.trim();
      const hasLabel = !!result.link_label?.trim();
      // A result's link is optional: with no address its button is hidden
      // (ADR 0133). An address with no words would be a blank button.
      if (hasLink && !hasLabel) {
        issues.push({ key: `result-link:${screen.id}:${result.id}`,
          said: sprintf(__('Add words for the link button on “%1$s” (“%2$s”), or remove its address.', 'wconvert'), result.heading, screen.name),
          repair: { screenId: screen.id, section: 'content', resultId: result.id, focus: 'result-link' } });
      }
      if (!result.when) {
        if (index < (screen.results?.length ?? 0) - 1) issues.push({ key: `result:${screen.id}:${index}`,
          said: sprintf(__('Choose a condition for result %1$d on “%2$s”. Only Everyone else is unconditional.', 'wconvert'), index + 1, screen.name),
          repair: { screenId: screen.id, section: 'content', resultId: result.id } });
        return;
      }
      const reason = incomplete(result.when) ? null : invalid(result.when, screen.id, false);
      if (!incomplete(result.when) && !reason) return;
      issues.push({ key: `result:${screen.id}:${index}`,
        said: reason ? sprintf(__('Review result %1$d on “%2$s”: %3$s', 'wconvert'), index + 1, screen.name, reason)
          : sprintf(__('Choose an answer for result %1$d on “%2$s”.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'content', resultId: result.id } });
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
