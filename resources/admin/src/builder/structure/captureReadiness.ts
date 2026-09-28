import { __, sprintf } from '@wordpress/i18n';
import type { ButtonNode, ConsentNode, FieldNode, Template } from '@renderer/types';
import { nodesOf, nodeAt } from './tree';
import { captureOwnership } from './captureOwnership';
import type { Problem } from './problems';
import type { Path } from '../panel';

/** Explain editable graph capture failures at their Design controls. */
export function captureReadiness(template: Template, primaryChannel?: string | null): Problem[] {
  const tree = template.tree;
  if (!tree.graph) return [];
  const blocks = nodesOf(tree);
  const issues: Problem[] = [];
  const missingConsentAssignments = new Set<string>();
  const add = (said: string, path: Path) => issues.push({ said, path, check: 'captures', blocksPublish: true });
  const buttons = blocks.filter(block => block.type === 'button' && !block.hidden).map(block => ({ ...block, node: nodeAt(tree, block.path) as ButtonNode }));
  for (const [index, screen] of tree.steps.entries()) {
    const here = buttons.filter(button => Number(button.path[0]) === index);
    const continues = tree.graph.edges.some(edge => edge.from === screen.id);
    const next = here.find(button => button.node.action === 'next');
    const save = here.find(button => button.node.action === 'submit');
    if (continues && !next && !save) add(sprintf(__('Add a Continue or Save button to “%s” so visitors can reach the next screen.', 'wconvert'), screen.name), [index]);
    if (next && save) add(sprintf(__('“%s” has both Continue and Save. Remove Continue so visitors cannot bypass the save.', 'wconvert'), screen.name), next.path);
    if (!continues) for (const button of here.filter(button => ['next', 'submit', 'skip'].includes(button.node.action ?? '')))
      add(sprintf(__('“%s” ends the journey. Remove this advancing button or connect a next screen in Journey.', 'wconvert'), screen.name), button.path);
  }
  for (const button of buttons.filter(button => ['submit', 'skip'].includes(button.node.action ?? ''))) {
    const save = tree.submissions.find(save => save.id === button.node.submission);
    if (!save || (button.node.action === 'skip' && save.required)) add(sprintf(__('Choose a valid save point for this button on “%s”. No thanks can only skip an optional save.', 'wconvert'), tree.steps[Number(button.path[0])].name), button.path);
  }
  for (const [index, save] of tree.submissions.entries()) {
    const submits = buttons.filter(button => button.node.action === 'submit' && button.node.submission === save.id);
    const at = submits[0]?.path[0];
    if (typeof at !== 'number') {
      const field = blocks.find(block => {
        const node = nodeAt(tree, block.path);
        return node && 'id' in node && node.id && save.fields.includes(node.id);
      });
      if (field) add(sprintf(__('The details on “%s” have no Save button. Add one and select its save point.', 'wconvert'), tree.steps[Number(field.path[0])].name), [field.path[0]]);
      continue;
    }
    const screen = tree.steps[at];
    if (submits.length > 1) add(sprintf(__('Keep one Save button for “%s”. Remove this extra button or choose its intended save point.', 'wconvert'), screen.name), submits[1].path);
    const skips = buttons.filter(button => button.node.action === 'skip' && button.node.submission === save.id);
    if (!save.required && !skips.length) add(sprintf(__('Add a No thanks button to “%s” so visitors can skip this optional signup.', 'wconvert'), screen.name), [at]);
    if (!save.required && skips.some(button => button.path[0] !== at)) add(sprintf(__('Move this No thanks button onto “%s”, beside its Save button.', 'wconvert'), screen.name), skips.find(button => button.path[0] !== at)!.path);
    if (!save.required && skips.length > 1) add(sprintf(__('Keep one No thanks button for “%s”. Remove this extra button.', 'wconvert'), screen.name), skips[1].path);
    const primary = primaryChannel === 'sms' ? 'phone' : primaryChannel;
    const channel = index === 0 ? primary : primary === 'phone' ? 'email' : primary === 'email' ? 'phone' : null;
    if (!channel) continue;
    const owned = blocks.filter(block => {
      const node = nodeAt(tree, block.path);
      return node && 'id' in node && node.id && [...save.fields, ...save.consents].includes(node.id);
    });
    const identifier = owned.find(block => block.type === 'field' && (nodeAt(tree, block.path) as FieldNode).name === (channel === 'phone' ? 'phone' : 'email'));
    if (!identifier || identifier.hidden || !(nodeAt(tree, identifier.path) as FieldNode).required)
      add(sprintf(channel === 'phone' ? __('Require a phone field for “%s” before accepting SMS consent.', 'wconvert') : __('Require an email field for “%s” before accepting email consent.', 'wconvert'), screen.name), identifier?.path ?? [at]);
    const consents = owned.filter(block => block.type === 'consent');
    if (!consents.length) {
      const existing = blocks.find(block => block.type === 'consent' && block.path[0] === at);
      if (existing) missingConsentAssignments.add(existing.path.join('.'));
      add(sprintf(existing ? __('Assign the consent checkbox to “%s” under Saved with.', 'wconvert')
        : __('Add a consent checkbox for “%s” and choose this screen under Saved with.', 'wconvert'), screen.name), existing?.path ?? [at]);
    }
  }
  for (const block of blocks.filter(block => block.type === 'consent')) {
    const node = nodeAt(tree, block.path) as ConsentNode;
    const ownership = captureOwnership(tree, block.path);
    if (!ownership) continue;
    const name = tree.steps[Number(block.path[0])].name;
    if (block.hidden) {
      if (ownership.owners.length) add(sprintf(__('Show the consent checkbox on “%s”, or remove its save assignment if it is no longer needed.', 'wconvert'), name), block.path);
      continue;
    }
    if (!node.text?.trim()) add(sprintf(__('Write the consent wording on “%s” so visitors know what they are agreeing to.', 'wconvert'), name), block.path);
    if (ownership.owners.length !== 1 && !missingConsentAssignments.has(block.path.join('.'))) add(sprintf(__('Choose one save point under Saved with for the consent checkbox on “%s”.', 'wconvert'), name), block.path);
    else {
      const choice = ownership.choices.find(choice => choice.id === ownership.owners[0]?.id);
      if (choice?.reason) add(choice.reason, block.path);
    }
  }
  return issues;
}
