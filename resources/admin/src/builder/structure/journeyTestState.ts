import type { TemplateTree } from '@renderer/types';
import { journeyTrace, type Answers } from '../../../../loader/src/journey-rules';
import { graphTrace } from '../../../../loader/src/journey-graph';
import { walkNodes } from './journey';

export interface TestCaptureSnapshot {
  readonly screens: readonly string[];
  readonly questionIds: readonly string[];
  readonly answers: Answers;
  readonly values: Readonly<Record<string, string | boolean>>;
}

/** Only questions and owned details reached by this save become immutable. */
export function testCaptureSnapshot(tree: TemplateTree, step: number, submissionId: string, answers: Answers,
  values: Readonly<Record<string, string | boolean>>): TestCaptureSnapshot | null {
  const submission = tree.submissions.find(item => item.id === submissionId);
  if (!submission) return null;
  const trace = tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers);
  const at = trace.indices.indexOf(step);
  if (at < 0) return null;
  const screens = trace.indices.slice(0, at + 1);
  const questionIds = [...new Set(screens.flatMap(index => walkNodes(tree.steps[index].content))
    .filter(node => node.type === 'question' && 'id' in node && typeof node.id === 'string')
    .map(node => (node as { id: string }).id))];
  const activeAnswers: Answers = {};
  for (const id of questionIds) if (trace.answers[id] !== undefined) activeAnswers[id] = trace.answers[id];
  const ownedValues: Record<string, string | boolean> = {};
  for (const id of [...submission.fields, ...submission.consents]) if (values[id] !== undefined) ownedValues[id] = values[id];
  return { screens: screens.map(index => tree.steps[index].id), questionIds, answers: activeAnswers, values: ownedValues };
}
