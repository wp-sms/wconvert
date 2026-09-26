import { __ } from '@wordpress/i18n';
import type { TemplateNode, TemplateTree } from '@renderer/types';
import { referencedJourney, walkNodes } from './journey';

export function captureName(tree: TemplateTree, screenId: string) {
  const screen = tree.steps.find(item => item.id === screenId);
  const submit = screen && walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node);
  const submission = tree.submissions.find(item => item.id === (submit && 'submission' in submit ? submit.submission : ''));
  const owner = tree.steps.find(item => walkNodes(item.content).some(node => node.type === 'field' && 'name' in node && node.name === 'name' && 'id' in node && submission?.fields.includes(String(node.id))));
  const node = owner && walkNodes(owner.content).find(node => node.type === 'field' && 'name' in node && node.name === 'name' && 'id' in node && submission?.fields.includes(String(node.id)));
  return { node, submission, customized: !!node && (owner?.id !== screenId || 'required' in node && node.required === true) };
}
export function setCaptureName(tree: TemplateTree, screenId: string, enabled: boolean): TemplateTree {
  const { node, submission, customized } = captureName(tree, screenId);
  if (!submission || customized || enabled === !!node) return tree;
  const taken = new Set(tree.steps.flatMap(screen => walkNodes(screen.content)).flatMap(item => 'id' in item ? [item.id] : []));
  let n = 1; while (taken.has(`n${n}`)) n++;
  const field: TemplateNode = { type: 'field', id: `n${n}`, name: 'name', label: __('Your name (optional)', 'wconvert'), required: false };
  let inserted = false;
  const update = (item: TemplateNode): TemplateNode => {
    if (!enabled && node && 'id' in node && 'id' in item && item.id === node.id) return { type: 'stack', children: [] };
    if (enabled && !inserted && (item.type === 'field' && 'id' in item && submission.fields.includes(String(item.id))
      || item.type === 'button' && 'action' in item && item.action === 'submit' && 'submission' in item && item.submission === submission.id)) {
      inserted = true; return { type: 'stack', children: [field, item] };
    }
    const copy = { ...item } as Record<string, unknown>;
    for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).filter(child => enabled || !node || !('id' in node) || !('id' in child) || child.id !== node.id).map(update);
    return copy as unknown as TemplateNode;
  };
  const steps = tree.steps.map(screen => screen.id === screenId ? { ...screen, content: update(screen.content) } : screen);
  if (enabled && !inserted) return tree;
  return referencedJourney({ ...tree, steps, submissions: tree.submissions.map(item => item.id !== submission.id ? item : { ...item,
    fields: enabled ? [...item.fields, `n${n}`] : item.fields.filter(id => !(node && 'id' in node && id === node.id)) }) });
}
