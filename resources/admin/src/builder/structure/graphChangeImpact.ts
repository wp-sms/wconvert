import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { gateEndings, gateFaults } from './gateEndings';
import { unreachableScreenIds, walkNodes } from './journey';

/**
 * Where visitors could finish without a required form when they should not
 * (ADR 0142). A result reached without the form is always one. An ending
 * reached without it is allowed — an early ending, or one some visitors reach
 * both ways — while another ending comes after the form. Campaigns with a result judge their endings by the result instead
 * (`journeyBoundaryIssues`), as the server does. This is a topology review,
 * not a solver for combinations of answer rules.
 */
export function requiredSaveBypasses(tree: TemplateTree, { shared = false }: { shared?: boolean } = {}) {
  return tree.submissions.filter(item => item.required).flatMap(submission => {
    const saving = tree.steps.filter(screen => walkNodes(screen.content).some(node => node.type === 'button'
      && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submission.id));
    if (!tree.graph || saving.length !== 1) return [];
    const sides = gateEndings(tree, saving[0].id);
    const result = tree.steps.find(screen => screen.kind === 'result');
    // `shared` also names endings some visitors reach both ways: allowed, but worth a look when a change makes one.
    const flagged: { id: string; reason: 'result' | 'none-after' | 'shared' }[] = result
      ? sides.without.has(result.id) ? [{ id: result.id, reason: 'result' }] : []
      : [...gateFaults(sides).map(id => ({ id, reason: 'none-after' as const })), ...(shared ? sides.shared.map(id => ({ id, reason: 'shared' as const })) : [])];
    return flagged.map(({ id, reason }) => ({
      key: `capture-path:${submission.id}:${id}`, endingId: id, edge: sides.without.get(id), saving, reason,
    }));
  });
}

/** Only newly introduced consequences need a review; pre-existing issues stay in readiness. */
export function graphChangeImpact(before: TemplateTree, after: TemplateTree): string | null {
  if (!before.graph || !after.graph) return null;
  const name = (id: string) => after.steps.find(screen => screen.id === id)?.name ?? before.steps.find(screen => screen.id === id)?.name ?? id;
  const alreadyDisconnected = new Set(unreachableScreenIds(before));
  const disconnected = unreachableScreenIds(after).filter(id => !alreadyDisconnected.has(id));
  const messages: string[] = [];
  if (disconnected.length) messages.push(sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach them.', 'wconvert'), disconnected.map(name).join(', ')));
  // A change that newly lets some visitors skip the required form is reviewed once, though it may publish (ADR 0142).
  const previousBypasses = new Set(requiredSaveBypasses(before, { shared: true }).map(item => item.key));
  for (const bypass of requiredSaveBypasses(after, { shared: true }).filter(item => !previousBypasses.has(item.key))) {
    messages.push(sprintf(__('A line could reach %1$s without saving at %2$s. Visitors on that line would not submit those details. Check the rules and try the form before publishing.', 'wconvert'),
      `“${name(bypass.endingId)}”`, bypass.saving.map(screen => `“${screen.name}”`).join(', ')));
  }
  return messages.length ? [...messages, __('Undo restores the previous paths.', 'wconvert')].join(' ') : null;
}
