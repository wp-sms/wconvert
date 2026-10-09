import type { QuestionNode, TemplateNode } from './types';

/** Text-only, path-scoped review. The existing Back action edits earlier answers. */
export function answerReview(root: HTMLElement, questions: readonly TemplateNode[], answers: Readonly<Record<string, string | string[]>>, label: string): void {
  const element = (tag: string, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
  const list = element('dl');
  for (const raw of questions) {
    if (raw.type !== 'question') continue;
    const node = raw as QuestionNode, value = answers[node.id ?? ''];
    if (!value || !value.length) continue;
    list.append(element('dt', node.label), element('dd', (Array.isArray(value) ? value : [value]).map(answer => node.options?.find(option => option.value === answer)?.label ?? answer).join(', ')));
  }
  if (!list.children.length) return;
  const section = element('section'); section.className = 'wc-answer-review'; section.setAttribute('aria-label', label);
  const heading = element('h3', label); heading.className = 'wc-text';
  section.append(heading, list);
  const title = root.querySelector('h1,h2,h3');
  if (title) title.after(section); else root.prepend(section);
}
