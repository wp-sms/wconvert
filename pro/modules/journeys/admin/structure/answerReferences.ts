import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import type { JourneyRepair } from '@/builder/structure/journeyReadiness';

/** Keep every use addressable, including several rules on the same screen. */
export function answerReferences(tree: TemplateTree, questionId: string, value?: string) {
  const references: { key: string; label: string; detail: string; repair: JourneyRepair }[] = [];
  const matches = (condition?: QuestionCondition) => condition?.clauses.some(clause =>
    clause.question === questionId && (value === undefined || clause.values.includes(value)));
  for (const screen of tree.steps) {
    if (matches(screen.when)) references.push({ key: `show:${screen.id}`, label: screen.name,
      detail: __('Show condition', 'wconvert-pro'), repair: { screenId: screen.id, section: 'content' } });
    screen.results?.forEach(result => {
      if (matches(result.when)) references.push({ key: `result:${screen.id}:${result.id}`, label: result.heading,
        detail: sprintf(/* translators: %s: a screen's name. */ __('Result in %s', 'wconvert-pro'), screen.name), repair: { screenId: screen.id, section: 'content', resultId: result.id } });
    });
    const paths = tree.graph ? tree.graph.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer') : screen.paths ?? [];
    paths.forEach((path, priority) => {
      if (matches(path.when)) references.push({ key: `path:${screen.id}:${priority}`, label: screen.name,
        detail: sprintf(/* translators: 1: the answer line's number on its screen, 2: the name of the screen it leads to, or “Removed screen”. */ __('Line %1$d to %2$s', 'wconvert-pro'), priority + 1, tree.steps.find(item => item.id === path.to)?.name ?? __('Removed screen', 'wconvert-pro')),
        repair: { screenId: screen.id, section: 'paths', pathPriority: priority, ...('id' in path && typeof path.id === 'string' ? { edgeId: path.id } : {}) } });
    });
  }
  return references;
}
