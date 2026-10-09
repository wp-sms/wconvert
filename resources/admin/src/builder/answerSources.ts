import { __, sprintf } from '@wordpress/i18n';
import type { Template, TemplateNode } from '@renderer/types';

export interface AnswerSource {
  id: string;
  label: string;
  type?: 'boolean';
  choice?: { questionId: string; questionLabel: string; label: string };
}

/** Keep a question's choices together in setup and in its sample preview. */
export function answerGroups(sources: readonly AnswerSource[]) {
  const groups = new Map<string, { id: string; label: string; answer?: AnswerSource; choices: AnswerSource[] }>();
  for (const source of sources) {
    const id = source.choice?.questionId ?? source.id;
    const group = groups.get(id) ?? { id, label: source.choice?.questionLabel ?? source.label, choices: [] };
    if (source.choice) group.choices.push(source); else group.answer = source;
    groups.set(id, group);
  }
  return [...groups.values()];
}

const children = (node: TemplateNode): readonly TemplateNode[] => {
  const branches = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])];
};

/** Stable choice values keep mappings intact when labels change. */
export function answerSources(template: Template, submissionId: string): AnswerSource[] {
  const found: AnswerSource[] = [];
  const submission = template.tree.submissions.find((item) => item.id === submissionId);
  const boundary = template.tree.steps.findIndex((step) => submission?.fields.some((id) => {
    const contains = (node: TemplateNode): boolean => {
      if ('id' in node && node.id === id) return true;
      return children(node).some(contains);
    };
    return contains(step.content);
  }));
  const walk = (node: TemplateNode) => {
    const item = node as { type: string; id?: string; label?: string; name?: string; hidden?: boolean; answer_type?: string; options?: readonly { value: string; label: string }[] };
    if (item.hidden) return;
    if (item.type === 'question' && item.id && item.label) {
      found.push({ id: item.id, label: item.label });
      const questionLabel = item.label;
      const questionId = item.id;
      if (item.answer_type === 'multi') item.options?.forEach((option) => found.push({
        id: `choice:${item.id}:${option.value}`,
        label: sprintf(__('%1$s — %2$s', 'wconvert'), questionLabel, option.label),
        type: 'boolean',
        choice: { questionId, questionLabel, label: option.label },
      }));
    }
    if (item.type === 'field' && (item.name === 'interest' || item.name === 'message')) found.push({ id: `field:${item.name}`, label: item.name === 'message' ? __('Message', 'wconvert') : __('Interest', 'wconvert') });
    children(node).forEach(walk);
  };
  template.tree.steps.slice(0, boundary < 0 ? 0 : boundary + 1).forEach((step) => walk(step.content));
  return found.filter((item, index) => found.findIndex((other) => other.id === item.id) === index);
}
