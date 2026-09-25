import type { JourneyGraph, TemplateNode, TemplateScreen } from '@renderer/types';
import { graphTrace } from './journey-graph';
import { journeyTrace, type Answers } from './journey-rules';

export interface JourneyCapturePrefix {
  /** Visible screens through the save point, in visitor order. */
  readonly indices: readonly number[];
  /** Every question the visitor reached, including unanswered optional questions. */
  readonly questionIds: readonly string[];
  /** Answered questions from that prefix only. */
  readonly answers: Answers;
}

/** A save owns the route the visitor reached, never answers from later screens. */
export function journeyCapturePrefix(steps: readonly TemplateScreen[], graph: JourneyGraph | undefined,
  screenIndex: number, supplied: Answers): JourneyCapturePrefix | null {
  const trace = graph ? graphTrace(steps, graph, supplied) : journeyTrace(steps, supplied);
  const boundary = trace.indices.indexOf(screenIndex);
  if (boundary < 0) return null;
  const indices = trace.indices.slice(0, boundary + 1);
  const questionIds = new Set<string>();
  for (const index of indices) {
    const pending: TemplateNode[] = [steps[index].content];
    while (pending.length) {
      const node = pending.shift()!;
      if (node.type === 'question' && 'id' in node && typeof node.id === 'string') questionIds.add(node.id);
      const layout = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
      pending.push(...(layout.children ?? []), ...(layout.start ?? []), ...(layout.end ?? []));
    }
  }
  const answers: Answers = {};
  for (const id of questionIds) {
    const value = trace.answers[id];
    if (value !== undefined && value !== '' && (!Array.isArray(value) || value.length)) answers[id] = value;
  }
  return { indices, questionIds: [...questionIds], answers };
}
