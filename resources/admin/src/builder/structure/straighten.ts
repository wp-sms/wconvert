import { __ } from '@wordpress/i18n';
import type { TemplateNode, TemplateScreen, TemplateTree } from '@renderer/types';
import type { Refusal } from '../../components/ui/option-menu';
import { graphDisplayOrder } from './graph';
import { walkNodes, withoutBackButtons } from './journey';

/**
 * "Make it a straight campaign" (ADR 0147): a journey draft on a site without
 * Pro's editors, as one screen after another with nothing this site can't
 * display — no graph, no answer lines, no "Only if…", no result screens and
 * no questions. One undoable edit; whatever else the draft needs before it
 * can publish, the readiness list says, as it does for any draft.
 *
 * Screens keep the order the Flow map shows. A screen that asked a question
 * goes with it, unless it also collects contact details: what is left of it
 * would be a heading about a question nobody is asked.
 */
export function straightenedJourney(tree: TemplateTree): TemplateTree | Refusal {
  const order = tree.graph ? graphDisplayOrder(tree) : tree.steps.map((_, index) => index);
  const steps = order.map(index => tree.steps[index])
    .filter(screen => screen.kind !== 'result' && (!asks(screen) || collects(screen)))
    .map(plainScreen);
  if (steps.length === 0) {
    return { short: __('Nothing would be left', 'wconvert'), reason: __('Every screen in this design asks a question or shows a result. Start from another design instead.', 'wconvert') };
  }
  if (steps.length > 7) {
    return { short: __('Up to 7 screens', 'wconvert'), reason: __('A straight campaign holds up to 7 screens. Delete screens until 7 are left, then try again.', 'wconvert') };
  }
  steps[0] = { ...steps[0], content: withoutBackButtons(steps[0].content) };
  // The first signup becomes the required one, so it loses the "No thanks" a result-first quiz gave it.
  const first = tree.submissions[0]?.id;
  if (first) for (let at = 0; at < steps.length; at++) steps[at] = { ...steps[at], content: without(steps[at].content, node => node.type === 'button' && 'action' in node && node.action === 'skip' && 'submission' in node && node.submission === first) };
  // A straight campaign is a v2 tree, and with no result before it the first signup is the required one.
  const straight: TemplateTree = { ...tree, v: 2, steps, submissions: tree.submissions.map((submission, index) => ({ ...submission, required: index === 0 })) };
  delete (straight as { graph?: unknown }).graph;
  return straight;
}

export const isRefusal = (value: TemplateTree | Refusal): value is Refusal => 'reason' in value;

function plainScreen(screen: TemplateScreen): TemplateScreen {
  const plain = { ...screen, content: withoutQuestions(screen.content) } as TemplateScreen & Record<string, unknown>;
  for (const key of ['when', 'paths', 'results', 'products_required']) delete plain[key];
  return plain;
}

const withoutQuestions = (node: TemplateNode) => without(node, child => child.type === 'question');

function without(node: TemplateNode, drop: (child: TemplateNode) => boolean): TemplateNode {
  const copy = { ...node } as Record<string, unknown>;
  for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) {
    copy[key] = (copy[key] as TemplateNode[]).filter(child => !drop(child)).map(child => without(child, drop));
  }
  return copy as unknown as TemplateNode;
}

const asks = (screen: TemplateScreen) => walkNodes(screen.content).some(node => node.type === 'question');

/** It saves something: a field, a consent, or the button that submits them. */
const collects = (screen: TemplateScreen) => walkNodes(screen.content).some(node => node.type === 'field' || node.type === 'consent'
  || (node.type === 'button' && 'action' in node && (node.action === 'submit' || node.action === 'skip')));
