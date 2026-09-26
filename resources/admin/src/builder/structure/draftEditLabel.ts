import { __, sprintf } from '@wordpress/i18n';
import type { Template, TemplateTree } from '@renderer/types';
import { walkNodes } from './journey';
import type { History } from './history';

export interface DraftSnapshot {
  readonly name: string;
  readonly config: Record<string, unknown>;
}
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Describe the actual snapshots Undo/Redo restores, including coalesced typing
 * and server-normalized saves. This is explanatory text, never an inverse edit.
 */
export function draftEditLabel(before: DraftSnapshot, after: DraftSnapshot): string {
  if (before.name !== after.name) return __('Rename campaign', 'wconvert');
  const changed = [...new Set([...Object.keys(before.config), ...Object.keys(after.config)])]
    .filter(key => !same(before.config[key], after.config[key]));
  if (changed.includes('template_id')) return __('Change design', 'wconvert');
  if (changed.length && changed.every(key => ['destinations', 'capture_mode'].includes(key))) return __('Change lead storage or destinations', 'wconvert');
  if (changed.length && changed.every(key => ['display_rules', 'rules', 'trigger', 'frequency', 'starts_at', 'ends_at'].includes(key))) return __('Change display rules', 'wconvert');
  if (changed.length !== 1 || changed[0] !== 'template') return __('Edit campaign settings', 'wconvert');
  const from = before.config.template as Template | undefined;
  const to = after.config.template as Template | undefined;
  if (!from?.tree || !to?.tree) return __('Change design', 'wconvert');
  if (same(from.tree, to.tree)) return __('Change design styles', 'wconvert');
  return journeyEditLabel(from.tree, to.tree);
}

function journeyEditLabel(before: TemplateTree, after: TemplateTree): string {
  const added = after.steps.filter(screen => !before.steps.some(item => item.id === screen.id));
  const removed = before.steps.filter(screen => !after.steps.some(item => item.id === screen.id));
  if (added.length === 1 && !removed.length) return sprintf(__('Add screen “%s”', 'wconvert'), added[0].name);
  if (removed.length === 1 && !added.length) return sprintf(__('Remove screen “%s”', 'wconvert'), removed[0].name);
  if (added.length || removed.length) return __('Change journey screens', 'wconvert');
  const changed = after.steps.filter(screen => !same(screen, before.steps.find(item => item.id === screen.id)));
  if (changed.length === 1) {
    const screen = changed[0];
    const previous = before.steps.find(item => item.id === screen.id)!;
    if (previous.name !== screen.name) return sprintf(__('Rename screen “%s”', 'wconvert'), previous.name);
    if (!same(previous.when, screen.when)) return sprintf(__('Change when “%s” appears', 'wconvert'), screen.name);
    if (!same(previous.results, screen.results)) return sprintf(__('Change results on “%s”', 'wconvert'), screen.name);
    if (!same(previous.paths, screen.paths)) return sprintf(__('Change paths from “%s”', 'wconvert'), screen.name);
    if (!same(previous.content, screen.content)) {
      const questions = (tree: typeof screen) => walkNodes(tree.content).filter(node => node.type === 'question');
      return sprintf(!same(questions(previous), questions(screen)) ? __('Edit questions on “%s”', 'wconvert') : __('Edit content on “%s”', 'wconvert'), screen.name);
    }
  }
  if (!same(before.submissions, after.submissions)) return __('Change journey saves', 'wconvert');
  if (before.graph && after.graph) {
    if (before.graph.entry !== after.graph.entry) return __('Change the first screen', 'wconvert');
    const routes = (tree: TemplateTree, id: string) => ['answer', 'default', 'hidden'].flatMap(kind =>
      tree.graph!.edges.filter(edge => edge.from === id && edge.kind === kind));
    const sources = after.steps.filter(screen => !same(routes(before, screen.id), routes(after, screen.id)));
    if (sources.length === 1) {
      const id = sources[0].id;
      const oldEdges = before.graph.edges.filter(edge => edge.from === id);
      const newEdges = after.graph.edges.filter(edge => edge.from === id);
      const orderingOnly = oldEdges.length === newEdges.length && oldEdges.every(edge => same(edge, newEdges.find(item => item.id === edge.id)));
      return sprintf(orderingOnly ? __('Reorder paths from “%s”', 'wconvert') : __('Change paths from “%s”', 'wconvert'), sources[0].name);
    }
  }
  if (!same(before.steps.map(screen => screen.id), after.steps.map(screen => screen.id))) return __('Reorder screens', 'wconvert');
  return __('Edit journey', 'wconvert');
}

export function draftHistoryLabels(history: History<DraftSnapshot> | null): { undo: string; redo: string } {
  const previous = history?.past.at(-1);
  const next = history?.future[0];
  return {
    undo: previous && history ? sprintf(__('Undo: %s', 'wconvert'), draftEditLabel(previous, history.present)) : __('Undo draft edit', 'wconvert'),
    redo: next && history ? sprintf(__('Redo: %s', 'wconvert'), draftEditLabel(history.present, next)) : __('Redo draft edit', 'wconvert'),
  };
}
