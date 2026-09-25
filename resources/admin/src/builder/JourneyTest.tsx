import { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import type { Template, TemplateNode } from '@renderer/types';
import { activeAnswers, chooseResult, journeyPath, type Answers } from '../../../loader/src/journey-rules';
import { walkNodes } from './structure/journey';

/** The real renderer, with in-memory answers and no capture or analytics calls. */
export function JourneyTest({ template, onEdit }: { template: Template; onEdit(step: number): void }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [visited, setVisited] = useState<number[]>([0]);
  const [productState, setProductState] = useState<'selected' | 'empty' | 'error'>('selected');
  const tree = template.tree;
  const active = activeAnswers(tree.steps, answers);
  const applicable = tree.steps.map((_, index) => journeyPath(tree.steps, answers).indices.includes(index));
  const shownResult = tree.steps[step].kind === 'result' ? chooseResult(tree.steps[step].results ?? [], active) : undefined;
  const move = useCallback((direction: 1 | -1, current: Answers) => {
    const inPath = activeAnswers(tree.steps, current);
    setAnswers(inPath);
    if (direction < 0) {
      const previous = visited.slice(0, -1);
      setVisited(previous);
      setStep(previous.at(-1) ?? 0);
      return;
    }
    const path = journeyPath(tree.steps, inPath).indices;
    const at = path[path.indexOf(step) + 1];
    if (at !== undefined) { setVisited([...visited, at]); setStep(at); }
  }, [tree.steps, visited, step]);
  useEffect(() => {
    const target = anchor.current;
    if (!target) return;
    const mounted = mount({ displayType: 'inline', template, anchor: target });
    if (!mounted.mounted) return;
    mounted.show(); mounted.showStep(step);
    const root = mounted.root;
    if (!root) return () => mounted.close();
    const resultAt = tree.steps.findIndex(screen => screen.kind === 'result');
    const signupAt = tree.submissions[0] ? tree.steps.findIndex(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'submission' in node && node.submission === tree.submissions[0].id && 'action' in node && node.action === 'submit')) : -1;
    if (step === 0 && resultAt > signupAt && signupAt >= 0) {
      const notice = document.createElement('p');
      notice.className = 'wc-gate-note'; notice.textContent = __('Contact details are required before you see your result.', 'wconvert');
      const heading = root.querySelector('h1,h2,h3');
      if (heading) heading.after(notice); else root.prepend(notice);
    }
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')) {
      const answer = answers[input.dataset.questionId ?? ''];
      if (input instanceof HTMLTextAreaElement) input.value = typeof answer === 'string' ? answer : '';
      else input.checked = Array.isArray(answer) ? answer.includes(input.value) : answer === input.value;
    }
    if (tree.steps[step].kind === 'result') {
      const result = chooseResult(tree.steps[step].results ?? [], active);
      const heading = root.querySelector<HTMLElement>('[data-result-heading]');
      const body = root.querySelector<HTMLElement>('[data-result-body]');
      const products = root.querySelector<HTMLElement>('[data-result-products]');
      if (heading) heading.textContent = result?.heading ?? '';
      if (body) body.textContent = result?.body ?? '';
      if (products && result?.product_ids?.length) products.textContent = productState === 'selected'
        ? sprintf(__('%d selected products would be checked for current price and availability.', 'wconvert'), result.product_ids.length)
        : productState === 'empty' ? __('No selected products are currently available. The shop link remains visible.', 'wconvert')
          : __('Product loading failed. Visitors see the fallback link and can retry.', 'wconvert');
    }
    const read = (): Answers => {
      const next = { ...answers };
      const questions = walkNodes(tree.steps[step].content).filter(node => node.type === 'question' && 'id' in node) as (TemplateNode & { id: string })[];
      for (const question of questions) {
        const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')].filter(input => input.dataset.questionId === question.id);
        if (!inputs.length) continue;
        let value: string | string[] | undefined;
        if (inputs[0] instanceof HTMLTextAreaElement) value = inputs[0].value.trim();
        else if (inputs[0] instanceof HTMLInputElement && inputs[0].type === 'checkbox') value = inputs.filter(input => input instanceof HTMLInputElement && input.checked).map(input => input.value);
        else value = inputs.find(input => input instanceof HTMLInputElement && input.checked)?.value;
        if (value === undefined || value === '' || Array.isArray(value) && !value.length) delete next[question.id];
        else next[question.id] = value;
      }
      return next;
    };
    const advance = (event: Event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button) return;
      event.preventDefault();
      if (button.dataset.action === 'back') { move(-1, read()); return; }
      if (['next', 'submit', 'skip'].includes(button.dataset.action ?? '')) {
        if (button.dataset.action !== 'skip' && root instanceof HTMLFormElement && !root.reportValidity()) return;
        move(1, read());
      }
    };
    root.addEventListener('click', advance);
    root.addEventListener('submit', event => event.preventDefault());
    root.querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    return () => mounted.close();
  // Remount when the preview path or its answers change; this never sends data.
  }, [template, step, productState, answers, active, move, tree.steps, tree.submissions]);
  return <div className="wconvert-journey-test">
    <div ref={anchor} className="wconvert-journey-test__stage" />
    <div className="wconvert-journey-test__side">
      <h3>{__('Path summary', 'wconvert')}</h3>
      <ol>{tree.steps.map((screen, at) => <li key={screen.id} data-current={at === step}>
        <span>{screen.name}</span><small>{applicable[at] ? visited.includes(at) ? __('Visited', 'wconvert') : __('Included', 'wconvert') : __('Skipped by condition', 'wconvert')}</small>
        {!applicable[at] && <button type="button" onClick={() => onEdit(at)}>{__('Edit condition', 'wconvert')}</button>}
      </li>)}</ol>
      {shownResult && <p className="wconvert-journey-test__result">{sprintf(__('Result shown: %s', 'wconvert'), shownResult.heading)}</p>}
      {tree.steps[step].kind === 'result' && <fieldset><legend>{__('Product state', 'wconvert')}</legend>
        {(['selected', 'empty', 'error'] as const).map(value => <label key={value}><input type="radio" name="product-state" checked={productState === value} onChange={() => setProductState(value)} />{value === 'selected' ? __('Selected', 'wconvert') : value === 'empty' ? __('None available', 'wconvert') : __('Loading error', 'wconvert')}</label>)}
      </fieldset>}
      <button type="button" onClick={() => { setAnswers({}); setStep(0); setVisited([0]); }}>{__('Reset answers', 'wconvert')}</button>
      <p>{__('Preview never saves answers, creates Leads, or counts conversions.', 'wconvert')}</p>
    </div>
  </div>;
}
