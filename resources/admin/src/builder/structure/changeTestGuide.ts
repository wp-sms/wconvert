import { __, sprintf } from '@wordpress/i18n';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { conditionText } from './conditionText';
import { walkNodes } from './journey';

export interface JourneyChange { text: string; screenId: string; screenName: string; }

/** Suggestions to try manually, never a claim that a rule is reachable or wins. */
export function changeTestGuide(tree: TemplateTree, screenId: string): string[] {
  const screen = tree.steps.find(item => item.id === screenId);
  if (!screen) return [__('Confirm this screen no longer appears, and that visitors can still finish the remaining path.', 'wconvert')];
  const cases: string[] = [];
  if (screen.when) cases.push(sprintf(__('Try matching and non-matching answers for: %s.', 'wconvert'), conditionText(tree, screen.when)));
  const routes = tree.graph ? tree.graph.edges.filter(edge => edge.from === screenId && edge.kind === 'answer') : screen.paths ?? [];
  for (const route of routes) if (route.when) cases.push(sprintf(__('Try this answer path: %s.', 'wconvert'), conditionText(tree, route.when)));
  if (routes.some(route => route.when)) cases.push(__('Also try Everyone else. If several paths match, confirm the first one wins.', 'wconvert'));
  for (const result of screen.results ?? []) if (result.when) cases.push(sprintf(__('Check “%1$s” with: %2$s.', 'wconvert'), result.heading, conditionText(tree, result.when)));
  if (screen.results?.length) cases.push(__('Try answers matching several results, then none. Check priority and the Everyone else result.', 'wconvert'));
  const questions = walkNodes(screen.content).filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string');
  for (const question of questions) {
    const choices = question.options?.slice(0, 2).map(option => `“${option.label}”`) ?? [];
    if (choices.length) cases.push(sprintf(question.answer_type === 'multi'
      ? __('For “%1$s”, try %2$s separately and together. Check every relevant follow-up and the combined submission.', 'wconvert')
      : __('For “%1$s”, try %2$s in separate visits. Check the next screen each time.', 'wconvert'), question.label, choices.join(` ${__('and', 'wconvert')} `)));
    else cases.push(sprintf(__('Answer “%s”, continue, then go Back and edit it. Check the updated answer before submitting.', 'wconvert'), question.label));
  }
  if (walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'skip')) cases.push(__('Try submitting this signup and skipping it in separate visits. Check which details are submitted.', 'wconvert'));
  if (!cases.length) cases.push(__('Follow the affected path and check the next screen. Go Back once to check the return journey.', 'wconvert'));
  return [...new Set(cases)];
}
