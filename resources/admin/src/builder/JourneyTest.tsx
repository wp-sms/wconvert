import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import type { Template, TemplateNode } from '@renderer/types';
import { activeAnswers, chooseResult, journeyPath, journeyTrace, type Answers } from '../../../loader/src/journey-rules';
import { walkNodes } from './structure/journey';

/** The real renderer, with in-memory answers and no capture or analytics calls. */
export function JourneyTest({ template, onEdit }: { template: Template; onEdit(step: number): void }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [visited, setVisited] = useState<number[]>([0]);
  const [productState, setProductState] = useState<'selected' | 'empty' | 'error'>('selected');
  const [captureValues, setCaptureValues] = useState<Record<string, string | boolean>>({});
  const [accepted, setAccepted] = useState<string[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);
  const [feedback, setFeedback] = useState('');
  const tree = template.tree;
  const trace = useMemo(() => journeyTrace(tree.steps, answers), [tree.steps, answers]);
  const active = trace.answers;
  const applicable = tree.steps.map((_, index) => trace.indices.includes(index));
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
      if (acceptedQuestions.includes(input.dataset.questionId ?? '')) input.disabled = true;
    }
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-capture-id]')) {
      const id = input.dataset.captureId ?? '';
      const value = captureValues[id];
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = value === true;
      else if (typeof value === 'string') input.value = value;
      if (tree.submissions.some(submission => accepted.includes(submission.id) && [...submission.fields, ...submission.consents].includes(id))) {
        if (input instanceof HTMLInputElement && input.type === 'checkbox' || input instanceof HTMLSelectElement) input.disabled = true;
        else input.readOnly = true;
        input.required = false;
      }
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action="submit"]')) {
      if (accepted.includes(button.dataset.submission ?? '')) { button.dataset.action = 'next'; button.textContent = __('Continue', 'wconvert'); }
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
    const saveDraft = () => {
      const next = { ...captureValues };
      for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-capture-id]')) {
        if (input.disabled || input instanceof HTMLInputElement && input.readOnly) continue;
        next[input.dataset.captureId ?? ''] = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
      }
      setCaptureValues(next);
      return next;
    };
    const validQuestions = () => {
      const questions = walkNodes(tree.steps[step].content).filter(node => node.type === 'question' && 'id' in node && node.required);
      for (const question of questions) {
        const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')].filter(input => input.dataset.questionId === ('id' in question ? question.id : ''));
        if (inputs.length && !inputs.some(input => input instanceof HTMLTextAreaElement ? !!input.value.trim() : input.checked)) {
          inputs[0].setCustomValidity(__('Please answer this question.', 'wconvert'));
          inputs[0].reportValidity(); inputs[0].focus(); return false;
        }
        inputs[0]?.setCustomValidity('');
      }
      return true;
    };
    const advance = (event: Event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button) return;
      event.preventDefault();
      if (button.dataset.action === 'back') { saveDraft(); setFeedback(''); move(-1, read()); return; }
      if (['next', 'submit', 'skip'].includes(button.dataset.action ?? '')) {
        if (button.dataset.action !== 'skip' && (!validQuestions() || root instanceof HTMLFormElement && !root.reportValidity())) return;
        const draft = saveDraft();
        if (button.dataset.action === 'submit') {
          const id = button.dataset.submission ?? '';
          if (failNextRef.current) { failNextRef.current = false; setFailNext(false); setFeedback(__('Submission not confirmed. The visitor stays here and can retry.', 'wconvert')); return; }
          setAccepted(previous => previous.includes(id) ? previous : [...previous, id]);
          setAcceptedQuestions(previous => [...new Set([...previous, ...Object.keys(activeAnswers(tree.steps, read()))])]);
          setFeedback(__('Submission accepted in this test. No lead was created.', 'wconvert'));
        } else if (button.dataset.action === 'skip') {
          const id = button.dataset.submission ?? '';
          const submission = tree.submissions.find(item => item.id === id);
          if (!submission || submission.required || accepted.includes(id)) return;
          for (const field of [...submission.fields, ...submission.consents]) delete draft[field];
          setCaptureValues(draft);
          setSkipped(previous => previous.includes(id) ? previous : [...previous, id]);
          setFeedback(__('Optional submission skipped. No details were saved.', 'wconvert'));
        } else setFeedback('');
        move(1, read());
      }
    };
    root.addEventListener('click', advance);
    root.addEventListener('submit', event => event.preventDefault());
    root.querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    return () => mounted.close();
  // Remount when the preview path or its answers change; this never sends data.
  }, [template, step, productState, answers, active, move, tree.steps, tree.submissions, captureValues, accepted, acceptedQuestions]);
  return <div className="wconvert-journey-test">
    <div ref={anchor} className="wconvert-journey-test__stage" />
    <div className="wconvert-journey-test__side">
      <h3>{__('Path summary', 'wconvert')}</h3>
      <ol>{tree.steps.map((screen, at) => <li key={screen.id} data-current={at === step}>
        <span>{screen.name}</span><small>{applicable[at] ? visited.includes(at) ? __('Visited', 'wconvert') : __('Included', 'wconvert')
          : trace.skips.find(skip => skip.index === at)?.reason === 'route' ? __('Bypassed by another path', 'wconvert')
            : __('Show condition did not match', 'wconvert')}</small>
        {!applicable[at] && <button type="button" onClick={() => onEdit(at)}>{__('Edit condition', 'wconvert')}</button>}
      </li>)}</ol>
      {shownResult && <p className="wconvert-journey-test__result">{sprintf(__('Result shown: %s', 'wconvert'), shownResult.heading)}</p>}
      {tree.submissions.length > 0 && <section className="wconvert-journey-test__capture"><h4>{__('Capture checkpoints', 'wconvert')}</h4>
        <ol>{tree.submissions.map(submission => <li key={submission.id}><strong>{tree.steps.find(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submission.id))?.name ?? submission.id}</strong><span>{accepted.includes(submission.id)
          ? __('Accepted in test', 'wconvert') : skipped.includes(submission.id) ? __('Skipped', 'wconvert')
            : [...submission.fields, ...submission.consents].some(id => id in captureValues) ? __('Draft only', 'wconvert') : __('Not reached', 'wconvert')}</span></li>)}</ol>
        <label><input type="checkbox" checked={failNext} onChange={event => { failNextRef.current = event.target.checked; setFailNext(event.target.checked); }} />{__('Simulate failure on next submission', 'wconvert')}</label>
        {feedback && <p role="status">{feedback}</p>}
        <p>{__('Destination delivery is not tested here.', 'wconvert')}</p>
      </section>}
      {tree.steps[step].kind === 'result' && <fieldset><legend>{__('Product state', 'wconvert')}</legend>
        {(['selected', 'empty', 'error'] as const).map(value => <label key={value}><input type="radio" name="product-state" checked={productState === value} onChange={() => setProductState(value)} />{value === 'selected' ? __('Selected', 'wconvert') : value === 'empty' ? __('None available', 'wconvert') : __('Loading error', 'wconvert')}</label>)}
      </fieldset>}
      <button type="button" onClick={() => { setAnswers({}); setCaptureValues({}); setAccepted([]); setAcceptedQuestions([]); setSkipped([]); failNextRef.current = false; setFailNext(false); setFeedback(''); setStep(0); setVisited([0]); }}>{__('Reset test', 'wconvert')}</button>
      <p>{__('Preview never saves answers, creates Leads, or counts conversions.', 'wconvert')}</p>
    </div>
  </div>;
}
