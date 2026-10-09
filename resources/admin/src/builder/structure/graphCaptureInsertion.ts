import { __ } from '@wordpress/i18n';
import type { TemplateNode, TemplateTree } from '@renderer/types';
import { graphEdgeId } from './graph';
import { graphInsertionLocations } from './graphInsertion';
import { freshScreen, referencedJourney, walkNodes } from './journey';

/** Check acceptance, including hidden exits, rather than just passing a card. */
function acceptedBeforeEdge(tree: TemplateTree, submission: string, target: string): boolean {
  if (!tree.graph) return false;
  const queue = [{ id: tree.graph.entry, accepted: false }], seen = new Set<string>();
  let reached = false;
  while (queue.length) {
    const current = queue.pop()!;
    const key = `${current.id}:${current.accepted}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const screen = tree.steps.find(item => item.id === current.id);
    const saves = screen && walkNodes(screen.content, false).some(node => node.type === 'button' && 'action' in node
      && node.action === 'submit' && 'submission' in node && node.submission === submission);
    for (const edge of tree.graph.edges.filter(item => item.from === current.id)) {
      const accepted = current.accepted || !!saves && edge.kind !== 'hidden';
      if (edge.id === target) { if (!accepted) return false; reached = true; }
      queue.push({ id: edge.to, accepted });
    }
  }
  return reached;
}

export function graphCaptureInsertion(tree: TemplateTree, primaryChannel: string | null | undefined) {
  const channel = (primaryChannel === 'sms' || primaryChannel === 'phone') ? 'email' : 'phone';
  const reason = !tree.graph || !['email', 'phone', 'sms'].includes(primaryChannel ?? '')
    ? __('Optional second signups are available for email or SMS list campaigns.', 'wconvert')
    : tree.submissions.length !== 1 || !tree.submissions[0].required
      ? __('Keep one required primary signup before adding an optional second signup.', 'wconvert')
      : tree.steps.flatMap(screen => walkNodes(screen.content)).some(node => node.type === 'field' && 'name' in node && node.name === channel)
        ? __('This journey already collects that contact channel. Review its existing fields before adding another signup.', 'wconvert') : null;
  const locations = reason ? [] : graphInsertionLocations(tree).filter(location => location.id.startsWith('edge:')
    && acceptedBeforeEdge(tree, tree.submissions[0].id, location.id.slice(5)));
  return { channel, locations, reason: reason ?? (!locations.length
    ? __('Connect a path after the primary save first. Visitors must complete that signup before reaching the optional one.', 'wconvert') : null) };
}

export function addGraphCapture(tree: TemplateTree, primaryChannel: string | null | undefined, locationId: string): TemplateTree {
  const plan = graphCaptureInsertion(tree, primaryChannel);
  const location = plan.locations.find(item => item.id === locationId);
  if (plan.reason || !location || !tree.graph) return tree;
  const edge = tree.graph.edges.find(item => item.id === locationId.slice(5))!;
  const channel = plan.channel;
  let submissionId = channel === 'email' ? 'email-signup' : 'sms-signup';
  if (tree.submissions.some(sub => sub.id === submissionId)) {
    let serial = 2; while (tree.submissions.some(sub => sub.id === `${submissionId}-${serial}`)) serial++;
    submissionId = `${submissionId}-${serial}`;
  }
  const end = tree.steps.find(screen => screen.id === edge.to);
  const rewards = end?.kind === 'acknowledgement' ? walkNodes(end.content, false).filter(node => ['code', 'followup'].includes(node.type))
    .map(node => { const copy = { ...node } as Record<string, unknown>; delete copy.id; return copy as unknown as TemplateNode; }) : [];
  const screen = { ...freshScreen(tree, 'input'), name: channel === 'email' ? __('Optional email signup', 'wconvert') : __('Optional SMS signup', 'wconvert'),
    content: { type: 'stack' as const, children: [
      { type: 'heading', text: __('Your signup was received', 'wconvert'), role: 'headline' }, ...rewards,
      { type: 'text', text: channel === 'email' ? __('Would you also like email updates?', 'wconvert') : __('Would you also like text updates?', 'wconvert'), role: 'body' },
      { type: 'field', name: channel, required: true, label: channel === 'email' ? __('Email address', 'wconvert') : __('Phone number', 'wconvert') },
      { type: 'consent', text: channel === 'email' ? __('Send me email updates. %s', 'wconvert') : __('Send me text updates. %s', 'wconvert'), link: { label: __('Privacy Policy', 'wconvert') }, hidden: false, role: 'consent_text' },
      { type: 'button', label: channel === 'email' ? __('Sign up for email', 'wconvert') : __('Sign up for SMS', 'wconvert'), action: 'submit', submission: submissionId },
      { type: 'button', label: __('No thanks', 'wconvert'), action: 'skip', submission: submissionId, tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
      { type: 'button', label: __('Back', 'wconvert'), action: 'back', tokens: { accent: 'transparent', 'accent-fg': 'fg' } },
    ] as TemplateNode[] } };
  const next = referencedJourney({ ...tree, steps: [...tree.steps, screen], graph: { ...tree.graph,
    // Insert only on the chosen connection. A hidden exit is a separate choice.
    edges: [...tree.graph.edges.map(item => item.id === edge.id ? { ...item, to: screen.id } : item),
      { id: graphEdgeId(tree.graph), from: screen.id, to: edge.to, kind: 'default' }] } });
  const nodes = walkNodes(next.steps.at(-1)!.content);
  return { ...next, submissions: [...tree.submissions, { id: submissionId, required: false,
    fields: nodes.filter(node => node.type === 'field' && 'id' in node).map(node => (node as { id: string }).id),
    consents: nodes.filter(node => node.type === 'consent' && 'id' in node).map(node => (node as { id: string }).id) }] };
}
