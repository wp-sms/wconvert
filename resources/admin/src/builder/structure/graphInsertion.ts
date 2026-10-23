import { matches } from '../../../../loader/src/journey-rules';
import type { TemplateTree } from '@renderer/types';
import { graphChoiceSources } from './graphConnections';

/** Only choose automatically when this answer alone determines the outgoing path. */
export function answerInsertionEdge(tree: TemplateTree, source: string, questionId: string, value: string) {
  const outgoing = tree.graph?.edges.filter(edge => edge.from === source) ?? [];
  const branches = outgoing.filter(edge => edge.kind === 'answer');
  const question = graphChoiceSources(tree, source).find(item => item.id === questionId);
  if (branches.length && (question?.answer_type !== 'single' || branches.some(edge =>
    !edge.when || edge.when.clauses.some(clause => clause.question !== questionId)))) return undefined;
  return branches.find(edge => matches(edge.when, { [questionId]: value })) ?? outgoing.find(edge => edge.kind === 'default');
}
