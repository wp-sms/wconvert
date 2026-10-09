import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import type { JourneyRepair } from './journeyReadiness';

/** Keep every use addressable, including several rules on the same screen. */
export function answerReferences(tree: TemplateTree, questionId: string, value?: string) {
  const references: { key: string; label: string; detail: string; repair: JourneyRepair }[] = [];
  const matches = (condition?: QuestionCondition) => condition?.clauses.some(clause =>
    clause.question === questionId && (value === undefined || clause.values.includes(value)));
  for (const screen of tree.steps) {
    if (matches(screen.when)) references.push({ key: `show:${screen.id}`, label: screen.name,
      detail: __('Show condition', 'wconvert'), repair: { screenId: screen.id, section: 'content' } });
    screen.results?.forEach(result => {
      if (matches(result.when)) references.push({ key: `result:${screen.id}:${result.id}`, label: result.heading,
        detail: sprintf(__('Result in %s', 'wconvert'), screen.name), repair: { screenId: screen.id, section: 'content', resultId: result.id } });
    });
    const paths = tree.graph ? tree.graph.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer') : screen.paths ?? [];
    paths.forEach((path, priority) => {
      if (matches(path.when)) references.push({ key: `path:${screen.id}:${priority}`, label: screen.name,
        detail: sprintf(__('Path %1$d to %2$s', 'wconvert'), priority + 1, tree.steps.find(item => item.id === path.to)?.name ?? __('Removed screen', 'wconvert')),
        repair: { screenId: screen.id, section: 'paths', pathPriority: priority, ...('id' in path && typeof path.id === 'string' ? { edgeId: path.id } : {}) } });
    });
  }
  return references;
}
