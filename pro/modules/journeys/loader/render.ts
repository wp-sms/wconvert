import { registerJourneyRenderer } from '@renderer/render';
import { registerJourneyStyles } from '@renderer/css';
import type { QuestionNode, TemplateScreen, TemplateNode } from '@renderer/types';

function question(raw: TemplateNode): HTMLElement {
  const node = raw as QuestionNode;
  const group = document.createElement('fieldset');
  group.className = 'wc-question';
  const legend = document.createElement('legend'); legend.textContent = node.label; group.append(legend);
  if (node.help) { const help = document.createElement('p'); help.className = 'wc-question-help'; help.textContent = node.help; group.append(help); }
  if (node.answer_type === 'text') {
    const answer = document.createElement('textarea');
    answer.name = `wcq-${node.id ?? ''}`; answer.dataset.questionId = node.id ?? '';
    answer.maxLength = 500; answer.required = node.required === true; answer.rows = 3;
    group.append(answer);
  } else {
    for (const choice of node.options ?? []) {
      const label = document.createElement('label'); label.className = 'wc-question-choice';
      const answer = document.createElement('input');
      answer.type = node.answer_type === 'multi' ? 'checkbox' : 'radio';
      answer.name = `wcq-${node.id ?? ''}`; answer.value = choice.value; answer.dataset.questionId = node.id ?? '';
      if (node.required && node.answer_type === 'single') answer.required = true;
      label.append(answer, document.createTextNode(choice.label)); group.append(label);
    }
  }
  return group;
}

function result(screen: TemplateScreen): HTMLElement {
  const fallback = screen.results?.[screen.results.length - 1];
  const section = document.createElement('section'); section.className = 'wc-result';
  const heading = document.createElement('h2'); heading.className = 'wc-heading'; heading.dataset.resultHeading = ''; heading.textContent = fallback?.heading ?? '';
  const body = document.createElement('p'); body.className = 'wc-text'; body.dataset.resultBody = ''; body.textContent = fallback?.body ?? '';
  const products = document.createElement('div'); products.className = 'wc-products'; products.dataset.resultProducts = '';
  const link = document.createElement('a'); link.className = 'wc-button'; link.dataset.resultLink = ''; link.textContent = fallback?.link_label ?? '';
  if (fallback?.href) link.href = fallback.href; else link.hidden = true;
  section.append(heading, body, products, link);
  return section;
}

const CSS = [
  `.wc-question{display:grid;gap:.625rem;border:0;padding:0;margin:0;min-inline-size:0;text-align:start}`,
  `.wc-question>legend{font-weight:700;margin-block-end:.5rem}`,
  `.wc-question-help{margin:0;color:var(--wc-muted,#6b7280)}`,
  `.wc-question-choice{display:flex;align-items:center;gap:.75rem;min-block-size:2.75rem;padding:.625rem;border:1px solid var(--wc-border,#e5e7eb);border-radius:var(--wc-radius,.5rem);cursor:pointer}`,
  `.wc-question-choice:has(input:checked){border-color:var(--wc-accent,#2563eb)}`,
  `.wc-question-choice>input{flex:none;accent-color:var(--wc-accent,#2563eb)}`,
  `.wc-question>textarea{inline-size:100%;min-block-size:5rem;padding:.625rem;border:1px solid var(--wc-border,#e5e7eb);border-radius:var(--wc-radius,.5rem);font:inherit}`,
  `.wc-result{display:grid;gap:var(--wc-gap,.75rem);text-align:start}`,
  `.wc-result [hidden]{display:none}`,
  `.wc-result .wc-text{margin:0}`,
  `.wc-products-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.75rem;list-style:none;margin:0;padding:0}`,
  `.wc-products-list li{display:grid;align-content:start;gap:.4rem;min-width:0;padding:.75rem;border:1px solid var(--wc-border,#ddd);border-radius:var(--wc-radius,.5rem)}`,
  `.wc-products-list img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:.25rem}`,
  `.wc-products-list a{overflow-wrap:anywhere}`,
  `.wc-products{display:grid;gap:.75rem}`,
].join('');

/** Called by Pro's single entry before any Campaign can mount. */
export function registerPremiumJourneyRenderer(): void {
  registerJourneyRenderer({ question, result });
  registerJourneyStyles(CSS);
}
