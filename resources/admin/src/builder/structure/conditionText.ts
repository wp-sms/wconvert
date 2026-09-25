import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, ResultVariant, TemplateTree } from '@renderer/types';
import { walkNodes } from './journey';

/** Explain a saved rule with the question and choice labels the merchant knows. */
export function conditionText(tree: TemplateTree, condition: QuestionCondition): string {
  const questions = tree.steps.flatMap(screen => walkNodes(screen.content))
    .filter(node => node.type === 'question' && 'id' in node);
  const parts = condition.clauses.map(clause => {
    const question = questions.find(node => 'id' in node && node.id === clause.question);
    const label = question && 'label' in question ? String(question.label) : clause.question;
    const options = question && 'options' in question ? question.options : [];
    const answer = clause.values.map(value => value === '' ? __('choose an answer', 'wconvert') : options?.find(option => option.value === value)?.label ?? value).join(', ');
    const operator = clause.operator === 'is' ? __('is', 'wconvert')
      : clause.operator === 'is_not' ? __('is not', 'wconvert')
        : clause.operator === 'includes_any' ? __('includes', 'wconvert') : __('does not include', 'wconvert');
    return sprintf(__('%1$s %2$s %3$s', 'wconvert'), label, operator, answer);
  });
  return parts.join(` ${condition.match === 'any' ? __('or', 'wconvert') : __('and', 'wconvert')} `);
}

/** Warn only when two ordered results are not clearly exclusive. */
export function resultsMayOverlap(tree: TemplateTree, first: ResultVariant, second: ResultVariant): boolean {
  if (!first.when || !second.when) return false;
  if (first.when.match !== 'all' || second.when.match !== 'all') return true;
  const singleChoiceIds = new Set(tree.steps.flatMap(screen => walkNodes(screen.content))
    .filter(node => node.type === 'question' && 'id' in node && 'answer_type' in node && node.answer_type === 'single')
    .map(node => 'id' in node ? node.id : ''));
  for (const left of first.when.clauses) for (const right of second.when.clauses) {
    if (left.question !== right.question || !singleChoiceIds.has(left.question)) continue;
    const a = left.values[0]; const b = right.values[0];
    if (left.operator === 'is' && right.operator === 'is' && a !== b) return false;
    if (left.operator === 'is' && right.operator === 'is_not' && a === b) return false;
    if (left.operator === 'is_not' && right.operator === 'is' && a === b) return false;
  }
  return true;
}
