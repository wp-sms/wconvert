import { __, sprintf } from '@wordpress/i18n';
import type { Template, TemplateNode } from '@renderer/types';
import type { SampleQuestion } from '../destinations/api';

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

/** Visits every visible node on the screens up to and including the one a save point submits from. */
function walkSubmission(template: Template, submissionId: string, visit: (node: TemplateNode) => void): void {
  const submission = template.tree.submissions.find((item) => item.id === submissionId);
  const boundary = template.tree.steps.findIndex((step) => submission?.fields.some((id) => {
    const contains = (node: TemplateNode): boolean => {
      if ('id' in node && node.id === id) return true;
      return children(node).some(contains);
    };
    return contains(step.content);
  }));
  const walk = (node: TemplateNode) => {
    if ((node as { hidden?: boolean }).hidden) return;
    visit(node);
    children(node).forEach(walk);
  };
  template.tree.steps.slice(0, boundary < 0 ? 0 : boundary + 1).forEach((step) => walk(step.content));
}

type Visited = { type: string; id?: string; label?: string; name?: string; answer_type?: string; options?: readonly { value: string; label: string }[] };

/** Stable choice values keep mappings intact when labels change. */
export function answerSources(template: Template, submissionId: string): AnswerSource[] {
  const found: AnswerSource[] = [];
  walkSubmission(template, submissionId, (node) => {
    const item = node as Visited;
    if (item.type === 'question' && item.id && item.label) {
      found.push({ id: item.id, label: item.label });
      const questionLabel = item.label;
      const questionId = item.id;
      if (item.answer_type === 'multi') item.options?.forEach((option) => found.push({
        id: `choice:${item.id}:${option.value}`,
        label: sprintf(/* translators: 1: a quiz question's text, e.g. “Which topics interest you?”, 2: one of its answer choices, e.g. “Recipes”. */ __('%1$s — %2$s', 'wconvert'), questionLabel, option.label),
        type: 'boolean',
        choice: { questionId, questionLabel, label: option.label },
      }));
    }
    if (item.type === 'field' && (item.name === 'interest' || item.name === 'message')) found.push({ id: `field:${item.name}`, label: item.name === 'message' ? __('Message', 'wconvert') : __('Interest', 'wconvert') });
  });
  return found.filter((item, index) => found.findIndex((other) => other.id === item.id) === index);
}

/**
 * The real questions a save point asks, for a webhook test's sample answers —
 * no `choice:` or `field:` ids, which are mapping sources rather than
 * questions. Only ids the server accepts, so a test never fails on a draft's
 * odd id (ADR 0148).
 */
export function sampleQuestions(template: Template, submissionId: string): SampleQuestion[] {
  const found: SampleQuestion[] = [];
  walkSubmission(template, submissionId, (node) => {
    const item = node as Visited;
    if (item.type !== 'question' || !item.id || !item.label || !/^[A-Za-z0-9_-]{1,64}$/.test(item.id) || found.some((other) => other.id === item.id)) return;
    found.push({ id: item.id, label: item.label.slice(0, 200), answer_type: item.answer_type === 'multi' || item.answer_type === 'text' ? item.answer_type : 'single',
      options: (item.options ?? []).map((option) => option.label) });
  });
  return found;
}
