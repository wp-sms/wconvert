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
    const labels = clause.values.map(value => value === '' ? __('choose an answer', 'wconvert') : options?.find(option => option.value === value)?.label ?? value);
    const answer = labels.length ? labels.join(` ${__('or', 'wconvert')} `) : __('choose an answer', 'wconvert');
    const operator = clause.operator === 'is' ? __('is', 'wconvert')
      : clause.operator === 'is_not' ? __('is not', 'wconvert')
        : clause.operator === 'includes_any' ? __('includes', 'wconvert') : __('without', 'wconvert');
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
    // One answer is picked: compare every value of "is any of", not just the first.
    const a = new Set(left.values), b = new Set(right.values);
    const shared = [...a].some(value => b.has(value));
    if (left.operator === 'is' && right.operator === 'is' && !shared) return false;
    if (left.operator === 'is' && right.operator === 'is_not' && [...a].every(value => b.has(value))) return false;
    if (left.operator === 'is_not' && right.operator === 'is' && [...b].every(value => a.has(value))) return false;
  }
  return true;
}

/**
 * The first pair of answer lines one visitor can match both of, with an
 * answer from each. First match wins, so the later line never sees them.
 * Only plain positive rules on one question are judged; anything else is
 * left to the merchant rather than guessed at.
 */
export function answerLinesOverlap(tree: TemplateTree, lines: readonly { readonly when?: QuestionCondition }[]): { first: number; second: number; answers: readonly [string, string] } | null {
  const questions = tree.steps.flatMap(screen => walkNodes(screen.content)).filter(node => node.type === 'question' && 'id' in node);
  const label = (question: string, value: string) => {
    const node = questions.find(item => 'id' in item && item.id === question);
    return (node && 'options' in node ? node.options?.find(option => option.value === value)?.label : undefined) ?? value;
  };
  const plain = (when?: QuestionCondition) => when?.clauses.length === 1 && ['is', 'includes_any'].includes(when.clauses[0].operator)
    && when.clauses[0].values.some(Boolean) ? when.clauses[0] : undefined;
  for (let first = 0; first < lines.length; first++) for (let second = first + 1; second < lines.length; second++) {
    const a = plain(lines[first].when), b = plain(lines[second].when);
    if (!a || !b || a.question !== b.question || a.operator !== b.operator) continue;
    const left = a.values.filter(Boolean), right = b.values.filter(Boolean);
    if (a.operator === 'is') {
      const shared = left.find(value => right.includes(value));
      if (shared) return { first, second, answers: [label(a.question, shared), label(a.question, shared)] };
      continue;
    }
    // Choose several: a visitor may tick one answer from each line.
    const one = left.find(value => !right.includes(value)) ?? left[0];
    const other = right.find(value => value !== one) ?? right[0];
    return { first, second, answers: [label(a.question, one), label(b.question, other)] };
  }
  return null;
}
