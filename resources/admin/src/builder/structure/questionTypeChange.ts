import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { nodeAt, nodesOf } from './tree';
import { withValue } from '../panel';

/** Choice labels/IDs and rule priority survive a reviewed answer-type change. */
export function questionTypeChange(tree: TemplateTree, id: string, type: QuestionNode['answer_type']): TemplateTree | null {
  const block = nodesOf(tree).find(item => { const node = nodeAt(tree, item.path); return item.type === 'question' && node && 'id' in node && node.id === id; });
  if (!block) return null;
  const source = nodeAt(tree, block.path) as QuestionNode;
  const conditions = tree.steps.flatMap(screen => [screen.when, ...(screen.paths?.map(path => path.when) ?? []), ...(screen.results?.map(result => result.when) ?? [])]).concat(tree.graph?.edges.map(edge => edge.when) ?? []);
  const clauses = conditions.flatMap(condition => condition?.clauses ?? []).filter(clause => clause.question === id);
  // A text answer cannot preserve a choice rule. Multi-value comparisons need
  // explicit repair before converting to the single-value condition contract.
  if (clauses.length && (type === 'text' || type === 'single' && clauses.some(clause => clause.values.length !== 1))) return null;
  const condition = (value?: QuestionCondition): QuestionCondition | undefined => value && ({ ...value, clauses: value.clauses.map(clause => {
    if (clause.question !== id) return clause;
    const negative = clause.operator === 'is_not' || clause.operator === 'includes_none';
    return { ...clause, operator: type === 'multi' ? negative ? 'includes_none' : 'includes_any' : negative ? 'is_not' : 'is' };
  }) });
  let next = withValue(tree, block.path, 'answer_type', type);
  if (type === 'text') next = withValue(next, block.path, 'options', []);
  else if (!source.options?.length) return null; // New choices belong to the caller's localized defaults.
  return { ...next, steps: next.steps.map(screen => ({ ...screen, when: condition(screen.when),
    ...(screen.paths ? { paths: screen.paths.map(path => ({ ...path, when: condition(path.when) })) } : {}),
    ...(screen.results ? { results: screen.results.map(result => ({ ...result, when: condition(result.when) })) } : {}),
  })), ...(next.graph ? { graph: { ...next.graph, edges: next.graph.edges.map(edge => ({ ...edge, when: condition(edge.when) })) } } : {}) };
}
