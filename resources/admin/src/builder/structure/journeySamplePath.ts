import type { QuestionNode, TemplateTree } from '@renderer/types';
import { graphTrace } from '../../../../loader/src/journey-graph';
import { journeyTrace, type Answers } from '../../../../loader/src/journey-rules';
import { walkNodes, submissionScreen } from './journey';
import { journeyTestProgress } from './journeyTestProgress';

export type SampleActions = Readonly<Record<string, 'submit' | 'skip'>>;
export const sampleQuestions = (tree: TemplateTree, index: number) => walkNodes(tree.steps[index].content)
  .filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string');

/** Stop the real evaluator's trace before an unanswered choice can select a fallback. */
export function journeySamplePath(tree: TemplateTree, answers: Answers, unanswered: readonly string[], actions: SampleActions) {
  const trace = tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers);
  const waiting = trace.indices.find(index => sampleQuestions(tree, index).some(question => {
    const value = trace.answers[question.id];
    const empty = value === undefined || (typeof value === 'string' ? !value.trim() : !value.length);
    return empty && (question.required === true || !unanswered.includes(question.id));
  }) || tree.submissions.some(sub => submissionScreen(tree, sub.id) === index && (!actions[sub.id] || sub.required && actions[sub.id] === 'skip')));
  const indices = waiting === undefined ? trace.indices : trace.indices.slice(0, trace.indices.indexOf(waiting) + 1);
  const progress = journeyTestProgress(tree, waiting ?? indices.at(-1) ?? 0, indices, trace);
  const decisions = waiting === undefined ? trace.decisions : progress.decisions;
  const questionIds = new Set(indices.flatMap(index => sampleQuestions(tree, index).map(q => q.id)));
  return { trace, indices, decisions, waiting, progress, answers: Object.fromEntries(Object.entries(trace.answers).filter(([id]) => questionIds.has(id))) };
}
