import type { FieldNode, TemplateTree } from '@renderer/types';
import type { Answers } from '../../../../loader/src/journey-rules';
import { walkNodes } from './journey';
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
  const screenNodes = walkNodes(tree.steps[step].content, false);
  if (!screenNodes.some(node => node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submissionId)) return null;
  const visibleNodes = prefix.indices.flatMap(index => walkNodes(tree.steps[index].content, false));
  let identifier = false;
  const owned = [...submission.fields, ...submission.consents];
  if (new Set(owned).size !== owned.length) return null;
  for (const id of owned) {
    const matching = visibleNodes.filter(node => 'id' in node && node.id === id);
    if (matching.length !== 1) return null;
    const node = matching[0], value = values[id];
    const type = submission.fields.includes(id) ? 'field' : 'consent';
    if (node.type !== type) return null;
    if (node.type === 'field') {
      const field = node as FieldNode;
      if (value !== undefined && typeof value !== 'string') return null;
      if (field.required && (typeof value !== 'string' || !value.trim())) return null;
      if (field.required && ['email', 'phone'].includes(field.name ?? '')) identifier = true;
    } else if (value !== true) return null;
  }
  if (!identifier || visibleNodes.some(node => node.type === 'question' && 'required' in node && node.required && 'id' in node && typeof node.id === 'string'
    && !prefix.answers[node.id]?.length)) return null;
  const ownedValues: Record<string, string | boolean> = {};
  for (const id of [...submission.fields, ...submission.consents]) if (values[id] !== undefined) ownedValues[id] = values[id];
  return { screens: prefix.indices.map(index => tree.steps[index].id), questionIds: prefix.questionIds,
    answers: prefix.answers, values: ownedValues };
}
