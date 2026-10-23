import { __, sprintf } from '@wordpress/i18n';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { conditionText } from './conditionText';
import { walkNodes } from './journey';
import { allOf } from '../../lib/format';

export interface JourneyChange { text: string; screenId: string; screenName: string; }

/** Suggestions to try manually, never a claim that a rule is reachable or wins. */
export function changeTestGuide(tree: TemplateTree, screenId: string): string[] {
  const screen = tree.steps.find(item => item.id === screenId);
  if (!screen) return [__('Confirm this screen no longer appears, and that visitors can still finish.', 'wconvert')];
  const cases: string[] = [];
  if (screen.when) cases.push(sprintf(/* translators: %s: the screen's rule, a question and its answers, e.g. “Skin type is Dry”. */ __('Try matching and non-matching answers for: %s.', 'wconvert'), conditionText(tree, screen.when)));
  const routes = tree.graph ? tree.graph.edges.filter(edge => edge.from === screenId && edge.kind === 'answer') : screen.paths ?? [];
  for (const route of routes) if (route.when) cases.push(sprintf(/* translators: %s: the line's rule, a question and its answers, e.g. “Skin type is Dry”. */ __('Try this answer line: %s.', 'wconvert'), conditionText(tree, route.when)));
  if (routes.some(route => route.when)) cases.push(__('Also try an answer no line names. If several lines match, confirm visitors take the top one.', 'wconvert'));
  for (const result of screen.results ?? []) if (result.when) cases.push(sprintf(/* translators: 1: a result's heading, 2: the rule that shows it, e.g. “Skin type is Dry”. */ __('Check “%1$s” with: %2$s.', 'wconvert'), result.heading, conditionText(tree, result.when)));
  if (screen.results?.length) cases.push(__('Try answers matching several results, then none. Check the order and the result for all other answers.', 'wconvert'));
  const questions = walkNodes(screen.content).filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string');
  for (const question of questions) {
    const choices = question.options?.slice(0, 2).map(option => `“${option.label}”`) ?? [];
    if (choices.length) cases.push(sprintf(question.answer_type === 'multi'
      ? /* translators: 1: a question, 2: two of its answers, each in quotes, joined by “and”. */ __('For “%1$s”, try %2$s separately and together. Check every relevant follow-up and the combined submission.', 'wconvert')
      : /* translators: 1: a question, 2: two of its answers, each in quotes, joined by “and”. */ __('For “%1$s”, try %2$s in separate visits. Check the next screen each time.', 'wconvert'), question.label, allOf(choices)));
    else cases.push(sprintf(/* translators: %s: a question. */ __('Answer “%s”, continue, then go Back and edit it. Check the updated answer before submitting.', 'wconvert'), question.label));
  }
  if (walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'skip')) cases.push(__('Try submitting this signup and skipping it in separate visits. Check which details are submitted.', 'wconvert'));
  if (!cases.length) cases.push(__('Follow the changed line and check the screen after it. Go Back once to check the way back.', 'wconvert'));
  return [...new Set(cases)];
}
