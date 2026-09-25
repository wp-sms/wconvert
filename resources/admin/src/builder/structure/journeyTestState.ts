import type { TemplateTree } from '@renderer/types';
import type { Answers } from '../../../../loader/src/journey-rules';
import { journeyCapturePrefix } from '../../../../loader/src/journey-capture';

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
  const prefix = journeyCapturePrefix(tree.steps, tree.graph, step, answers);
  if (!prefix) return null;
  const ownedValues: Record<string, string | boolean> = {};
  for (const id of [...submission.fields, ...submission.consents]) if (values[id] !== undefined) ownedValues[id] = values[id];
  return { screens: prefix.indices.map(index => tree.steps[index].id), questionIds: prefix.questionIds,
    answers: prefix.answers, values: ownedValues };
}
