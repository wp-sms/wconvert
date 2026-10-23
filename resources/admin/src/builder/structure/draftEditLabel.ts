import { __, sprintf } from '@wordpress/i18n';
import type { Template, TemplateTree } from '@renderer/types';
import { walkNodes } from './journey';
import type { History } from './history';
import { captureState } from './captureConversion';

export interface DraftSnapshot {
  readonly name: string;
  readonly config: Record<string, unknown>;
  /** Restored with the design, so adding or removing the form undoes as one (ADR 0163). */
  readonly goal: string | null;
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
  const form = captureLabel(before, after);
  if (form) return form;
  if (before.goal !== after.goal) return __('Change goal', 'wconvert');
  if (changed.length && changed.every(key => ['destinations', 'capture_mode'].includes(key))) return __('Change lead storage or destinations', 'wconvert');
  if (changed.length && changed.every(key => ['display_rules', 'rules', 'trigger', 'frequency', 'starts_at', 'ends_at'].includes(key))) return __('Change display rules', 'wconvert');
  if (!changed.includes('template') || changed.some(key => !['template', 'submission_settings'].includes(key))) return __('Edit campaign settings', 'wconvert');
  const from = before.config.template as Template | undefined;
  const to = after.config.template as Template | undefined;
  if (!from?.tree || !to?.tree) return __('Change design', 'wconvert');
  if (same(from.tree, to.tree)) return __('Change design styles', 'wconvert');
  return journeyEditLabel(from.tree, to.tree);
}

/** The form switch's three edits, named as its buttons are. */
function captureLabel(before: DraftSnapshot, after: DraftSnapshot): string | null {
  const from = (before.config.template as Template | undefined)?.tree;
  const to = (after.config.template as Template | undefined)?.tree;
  if (!from || !to) return null;
  const was = captureState(from), now = captureState(to);
  if (was === now || was === 'other' || now === 'other') return null;
  if (now === 'none') return __('Remove form', 'wconvert');
  if (was === 'none') return now === 'email' ? __('Add email form', 'wconvert') : __('Add phone form', 'wconvert');
  return now === 'phone' ? __('Ask for phone', 'wconvert') : __('Ask for email', 'wconvert');
}

function journeyEditLabel(before: TemplateTree, after: TemplateTree): string {
  if (before.graph && after.graph) {
    const removedSaves = before.submissions.filter(sub => !after.submissions.some(item => item.id === sub.id));
    const addedSaves = after.submissions.filter(sub => !before.submissions.some(item => item.id === sub.id));
    if (removedSaves.length === 1 && !removedSaves[0].required && !addedSaves.length) return __('Remove optional signup', 'wconvert');
    if (addedSaves.length === 1 && !addedSaves[0].required && !removedSaves.length) return __('Add optional signup', 'wconvert');
  }
  const added = after.steps.filter(screen => !before.steps.some(item => item.id === screen.id));
  const removed = before.steps.filter(screen => !after.steps.some(item => item.id === screen.id));
  if (added.length === 1 && !removed.length) return sprintf(/* translators: %s: the added screen's name, e.g. “Thank you”. */ __('Add screen “%s”', 'wconvert'), added[0].name);
  if (removed.length === 1 && !added.length) return sprintf(/* translators: %s: the removed screen's name, e.g. “Thank you”. */ __('Remove screen “%s”', 'wconvert'), removed[0].name);
  if (added.length || removed.length) return __('Change screens', 'wconvert');
  const changed = after.steps.filter(screen => !same(screen, before.steps.find(item => item.id === screen.id)));
  if (changed.length === 1) {
    const screen = changed[0];
    const previous = before.steps.find(item => item.id === screen.id)!;
    if (previous.name !== screen.name) return sprintf(/* translators: %s: the screen's old name, e.g. “Skin type”. */ __('Rename screen “%s”', 'wconvert'), previous.name);
    if (!same(previous.when, screen.when)) return sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Change when “%s” appears', 'wconvert'), screen.name);
    if (!same(previous.results, screen.results)) return sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Change results on “%s”', 'wconvert'), screen.name);
    if (!same(previous.paths, screen.paths)) return sprintf(/* translators: %s: a screen's name, e.g. “Skin type”. */ __('Change lines from “%s”', 'wconvert'), screen.name);
    if (!same(previous.content, screen.content)) {
      const questions = (tree: typeof screen) => walkNodes(tree.content).filter(node => node.type === 'question');
      return sprintf(!same(questions(previous), questions(screen)) ? /* translators: %s: a screen's name, e.g. “Skin type”. */ __('Edit questions on “%s”', 'wconvert') : /* translators: %s: a screen's name, e.g. “Skin type”. */ __('Edit content on “%s”', 'wconvert'), screen.name);
    }
  }
  if (!same(before.submissions, after.submissions)) return __('Change forms', 'wconvert');
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
      return sprintf(orderingOnly ? /* translators: %s: a screen's name, e.g. “Skin type”. */ __('Reorder lines from “%s”', 'wconvert') : /* translators: %s: a screen's name, e.g. “Skin type”. */ __('Change lines from “%s”', 'wconvert'), sources[0].name);
    }
  }
  if (!same(before.steps.map(screen => screen.id), after.steps.map(screen => screen.id))) return __('Reorder screens', 'wconvert');
  return __('Edit screens', 'wconvert');
}

export function draftHistoryLabels(history: History<DraftSnapshot> | null): { undo: string; redo: string } {
  const previous = history?.past.at(-1);
  const next = history?.future[0];
  return {
    undo: previous && history ? sprintf(/* translators: %s: the edit Undo reverses, e.g. “Change design”. */ __('Undo: %s', 'wconvert'), draftEditLabel(previous, history.present)) : __('Undo draft edit', 'wconvert'),
    redo: next && history ? sprintf(/* translators: %s: the edit Redo repeats, e.g. “Change display rules”. */ __('Redo: %s', 'wconvert'), draftEditLabel(history.present, next)) : __('Redo draft edit', 'wconvert'),
  };
}
