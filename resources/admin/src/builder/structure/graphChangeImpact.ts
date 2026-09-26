import { __, sprintf } from '@wordpress/i18n';
import type { JourneyGraphEdge, TemplateTree } from '@renderer/types';
import { unreachableScreenIds, walkNodes } from './journey';

/** Reachable result/end screens without accepting one required submission.
 * This is a topology review, not a solver for combinations of answer rules.
 * Hidden exits do not execute the screen's submit button.
 */
function withoutSave(tree: TemplateTree, submission: string): Map<string, JourneyGraphEdge | undefined> {
  const found = new Map<string, JourneyGraphEdge | undefined>();
  if (!tree.graph) return found;
  const pending: { id: string; via?: JourneyGraphEdge }[] = [{ id: tree.graph.entry }];
  const seen = new Set<string>();
  while (pending.length) {
    const { id, via } = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const screen = tree.steps.find(item => item.id === id);
    if (!screen) continue;
    const saves = walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node
      && node.action === 'submit' && 'submission' in node && node.submission === submission);
    if (!saves && (screen.kind === 'result' || screen.kind === 'acknowledgement')) found.set(id, via);
    for (const edge of tree.graph.edges.filter(item => item.from === id)) {
      if (edge.kind === 'hidden' ? screen.when : !saves) pending.push({ id: edge.to, via: edge });
    }
  }
  return found;
}

export function requiredSaveBypasses(tree: TemplateTree) {
  return tree.submissions.filter(item => item.required).flatMap(submission => {
    const saving = tree.steps.filter(screen => walkNodes(screen.content).some(node => node.type === 'button'
      && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submission.id));
    return [...withoutSave(tree, submission.id)].map(([endingId, edge]) => ({
      key: `capture-path:${submission.id}:${endingId}`, endingId, edge, saving,
    }));
  });
}

/** Only newly introduced consequences need a review; pre-existing issues stay in readiness. */
export function graphChangeImpact(before: TemplateTree, after: TemplateTree): string | null {
  if (!before.graph || !after.graph) return null;
  const name = (id: string) => before.steps.find(screen => screen.id === id)?.name ?? id;
  const alreadyDisconnected = new Set(unreachableScreenIds(before));
  const disconnected = unreachableScreenIds(after).filter(id => !alreadyDisconnected.has(id));
  const messages: string[] = [];
  if (disconnected.length) messages.push(sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach them.', 'wconvert'), disconnected.map(name).join(', ')));
  const previousBypasses = new Set(requiredSaveBypasses(before).map(item => item.key));
  for (const bypass of requiredSaveBypasses(after).filter(item => !previousBypasses.has(item.key))) {
    messages.push(sprintf(__('A connected path could reach %1$s without saving at %2$s. Visitors on that path would not submit those details. Review the rules and test the path before publishing.', 'wconvert'),
      `“${name(bypass.endingId)}”`, bypass.saving.map(screen => `“${screen.name}”`).join(', ')));
  }
  return messages.length ? [...messages, __('Undo restores the previous connections.', 'wconvert')].join(' ') : null;
}
