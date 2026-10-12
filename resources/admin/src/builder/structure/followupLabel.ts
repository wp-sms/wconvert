import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { conditionText } from './conditionText';
import { walkNodes } from './journey';

/** Short answer labels only when they express the entire visibility rule. */
export function followupLabel(tree: TemplateTree, condition: QuestionCondition) {
  if (condition.clauses.length === 1) {
    const clause = condition.clauses[0];
    if (['is', 'includes_any'].includes(clause.operator) && clause.values.length > 0) {
      const question = tree.steps.flatMap(screen => walkNodes(screen.content)).find(node => node.type === 'question' && 'id' in node && node.id === clause.question);
      const labels = clause.values.map(value => question && 'options' in question ? question.options?.find(item => item.value === value)?.label : undefined);
      // "is any of" reads "My home or My flat" (ADR 0142).
      if (labels.every(Boolean)) return sprintf(/* translators: %s: one or more answers. */ __('If %s is selected', 'wconvert'), labels.map(label => `“${label}”`).join(` ${__('or', 'wconvert')} `));
    }
  }
  return conditionText(tree, condition);
}
