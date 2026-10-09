import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { nodeAt } from './tree';
import { submissionScreen } from './journey';
import { graphRequiresScreen } from './graph';
import type { Path } from '../panel';

/** Explicit graph ownership; storage order never chooses the save boundary. */
export function captureOwnership(tree: TemplateTree, path: Path) {
  const node = nodeAt(tree, path);
  if (!tree.graph || !node || !['field', 'consent'].includes(node.type) || !('id' in node) || !node.id) return null;
  const id = node.id;
  const key: 'consents' | 'fields' = node.type === 'consent' ? 'consents' : 'fields';
  const source = tree.steps[Number(path[0])];
  const owners = tree.submissions.filter(save => save[key].includes(id));
  const choices = tree.submissions.map(save => {
    const at = submissionScreen(tree, save.id);
    const name = tree.steps[at]?.name ?? save.id;
    const reason = at < 0 ? __('Add a Save button for this save point first.', 'wconvert')
      : source.kind !== 'input' || source.when || !graphRequiresScreen(tree.graph!, source.id, tree.steps[at].id)
        ? sprintf(__('Every path to “%s” must include this input screen. Move this element onto that screen or reconnect the paths.', 'wconvert'), name)
        : key === 'consents' && save.consents.some(other => other !== id)
          ? sprintf(__('“%s” already has a consent checkbox. Use that checkbox or remove it first.', 'wconvert'), name)
          : null;
    return { id: save.id, name, reason };
  });
  return { id, key, owners, choices };
}

export function withCaptureOwner(tree: TemplateTree, path: Path, owner: string): TemplateTree {
  const state = captureOwnership(tree, path);
  if (!state || (owner !== '' && !state.choices.some(choice => choice.id === owner && !choice.reason))) return tree;
  return { ...tree, submissions: tree.submissions.map(save => ({ ...save,
    [state.key]: [...save[state.key].filter(id => id !== state.id), ...(save.id === owner ? [state.id] : [])],
  })) };
}
