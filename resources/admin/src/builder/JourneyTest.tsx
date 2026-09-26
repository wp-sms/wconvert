import { journeyNotice } from '@renderer/journey-notice';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import type { Template, TemplateNode } from '@renderer/types';
import { activeAnswers, chooseResult, journeyPath, journeyTrace, type Answers } from '../../../loader/src/journey-rules';
import { graphTrace } from '../../../loader/src/journey-graph';
import { graphDisplayOrder } from './structure/graph';
import { walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { testCaptureSnapshot, type TestCaptureSnapshot } from './structure/journeyTestState';

/** The real renderer, with in-memory answers and no capture or analytics calls. */
export function JourneyTest({ template, onEdit, deliveryMode = 'none', destinationSummary }: {
  template: Template; onEdit(step: number): void; deliveryMode?: 'local' | 'connected' | 'none'; destinationSummary?: string;
}) {
  const tree = template.tree;
  const entry = tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0;
  const anchor = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(entry);
  const [answers, setAnswers] = useState<Answers>({});
  const [visited, setVisited] = useState<number[]>([entry]);
  const [productState, setProductState] = useState<'selected' | 'empty' | 'error'>('selected');
  const [captureValues, setCaptureValues] = useState<Record<string, string | boolean>>({});
  const [accepted, setAccepted] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, TestCaptureSnapshot>>({});
  const [acceptedQuestions, setAcceptedQuestions] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<Record<string, 'queued' | 'failed'>>({});
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);
  const [failDeliveryNext, setFailDeliveryNext] = useState(false);
  const failDeliveryNextRef = useRef(false);
  const [feedback, setFeedback] = useState('');
  const trace = useMemo(() => tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers), [tree.steps, tree.graph, answers]);
  const active = trace.answers;
  const readingOrder = graphDisplayOrder(tree);
  const applicable = tree.steps.map((_, index) => trace.indices.includes(index));
  const shownResult = tree.steps[step].kind === 'result' ? chooseResult(tree.steps[step].results ?? [], active) : undefined;
  const move = useCallback((direction: 1 | -1, current: Answers) => {
    const inPath = tree.graph ? graphTrace(tree.steps, tree.graph, current).answers : activeAnswers(tree.steps, current);
    setAnswers(inPath);
    if (direction < 0) {
      const previous = visited.slice(0, -1);
      setVisited(previous);
      setStep(previous.at(-1) ?? entry);
      return;
    }
    const path = tree.graph ? graphTrace(tree.steps, tree.graph, inPath).indices : journeyPath(tree.steps, inPath).indices;
    const at = path[path.indexOf(step) + 1];
    if (at !== undefined) { setVisited([...visited, at]); setStep(at); }
  }, [tree.steps, tree.graph, visited, step, entry]);
  useEffect(() => {
    const target = anchor.current;
    if (!target) return;
    const mounted = mount({ displayType: 'inline', template, anchor: target, shadowMode: 'open' });
    if (!mounted.mounted) return;
    mounted.show(); mounted.showStep(step);
    const root = mounted.root;
    if (!root) return () => mounted.close();
    // Start keyboard travel in the visitor screen, before the diagnostic sidebar.
    const focusFrame = requestAnimationFrame(() => {
      if (!root.isConnected || !root.getClientRects().length) return;
      const heading = root.querySelector<HTMLElement>('h1,h2,h3') ?? root;
      heading.tabIndex = -1; heading.focus();
    });
    const resultAt = tree.steps.findIndex(screen => screen.kind === 'result');
    const signupAt = tree.submissions[0] ? tree.steps.findIndex(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'submission' in node && node.submission === tree.submissions[0].id && 'action' in node && node.action === 'submit')) : -1;
    if (step === entry && signupAt >= 0 && resultAt >= 0 && (tree.graph
      ? trace.indices.indexOf(signupAt) >= 0 && trace.indices.indexOf(signupAt) < trace.indices.indexOf(resultAt)
      : resultAt > signupAt)) {
      journeyNotice(root, __('Contact details are required before you see your result.', 'wconvert'));
    }
    let reviewing = false;
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')) {
      const answer = answers[input.dataset.questionId ?? ''];
      if (input instanceof HTMLTextAreaElement) input.value = typeof answer === 'string' ? answer : '';
      else input.checked = Array.isArray(answer) ? answer.includes(input.value) : answer === input.value;
      if (acceptedQuestions.includes(input.dataset.questionId ?? '')) { input.disabled = true; reviewing = true; }
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
        reviewing = true;
      }
    }
    if (reviewing) journeyNotice(root, __('Already saved. You can review these details, but cannot change them.', 'wconvert'));
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action="submit"]')) {
      if (accepted.includes(button.dataset.submission ?? '')) { button.dataset.action = 'next'; button.textContent = __('Continue', 'wconvert'); }
    }
    if (tree.steps[step].kind === 'result') {
      const result = chooseResult(tree.steps[step].results ?? [], active);
      const heading = root.querySelector<HTMLElement>('[data-result-heading]');
      const body = root.querySelector<HTMLElement>('[data-result-body]');
      const link = root.querySelector<HTMLAnchorElement>('[data-result-link]');
      const products = root.querySelector<HTMLElement>('[data-result-products]');
      if (heading) heading.textContent = result?.heading ?? '';
      if (body) body.textContent = result?.body ?? '';
      if (link) {
        link.textContent = result?.link_label ?? '';
        link.hidden = !result?.href;
        if (result?.href) link.href = result.href;
        else link.removeAttribute('href');
      }
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
        const currentAnswers = read();
        const draft = saveDraft();
        if (button.dataset.action === 'submit') {
          const id = button.dataset.submission ?? '';
          if (failNextRef.current) { setAnswers(currentAnswers); failNextRef.current = false; setFailNext(false); setFeedback(__('Submission not confirmed. The visitor stays here and can retry.', 'wconvert')); return; }
          const snapshot = testCaptureSnapshot(tree, step, id, currentAnswers, draft);
          if (!snapshot) { setFeedback(__('This save point is not on the current route. Review its connections.', 'wconvert')); return; }
          setAccepted(previous => previous.includes(id) ? previous : [...previous, id]);
          setSnapshots(previous => ({ ...previous, [id]: previous[id] ?? snapshot }));
          setAcceptedQuestions(previous => [...new Set([...previous, ...snapshot.questionIds])]);
          if (deliveryMode === 'connected') {
            const deliveryFailed = failDeliveryNextRef.current;
            setDelivery(previous => ({ ...previous, [id]: deliveryFailed ? 'failed' : 'queued' }));
            failDeliveryNextRef.current = false; setFailDeliveryNext(false);
          }
          setFeedback(__('Save accepted in this test. The visitor can continue; no real Lead or destination request was created.', 'wconvert'));
        } else if (button.dataset.action === 'skip') {
          const id = button.dataset.submission ?? '';
          const submission = tree.submissions.find(item => item.id === id);
          if (!submission || submission.required || accepted.includes(id)) return;
          for (const field of [...submission.fields, ...submission.consents]) delete draft[field];
          setCaptureValues(draft);
          setSkipped(previous => previous.includes(id) ? previous : [...previous, id]);
          setFeedback(__('Optional submission skipped. No details were saved.', 'wconvert'));
        } else setFeedback('');
        move(1, currentAnswers);
      }
    };
    root.addEventListener('click', advance);
    root.addEventListener('submit', event => event.preventDefault());
    root.querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    return () => { cancelAnimationFrame(focusFrame); mounted.close(); };
  // Remount when the preview path or its answers change; this never sends data.
  }, [template, step, entry, productState, answers, active, trace.indices, move, tree, captureValues, accepted, acceptedQuestions, deliveryMode]);
  const nodes = tree.steps.flatMap(screen => walkNodes(screen.content));
  const nodeLabel = (id: string) => {
    const node = nodes.find(item => 'id' in item && item.id === id);
    return node && 'label' in node && typeof node.label === 'string' ? node.label
      : node?.type === 'consent' ? __('Consent', 'wconvert') : id;
  };
  const routeSteps: { id: string; label: string }[] = trace.decisions.flatMap(decision => {
    if (tree.graph && 'edge' in decision) {
      const source = tree.steps.find(screen => screen.id === decision.from);
      const edge = tree.graph.edges.find(item => item.id === decision.edge);
      const from = source?.name ?? decision.from;
      const to = tree.steps.find(screen => screen.id === decision.to)?.name ?? decision.to;
      const branches = tree.graph.edges.some(edge => edge.from === decision.from && edge.kind === 'answer');
      const action = decision.kind === 'hidden' ? source?.when
        ? sprintf(__('Hidden because %s did not match', 'wconvert'), conditionText(tree, source.when))
        : __('Hidden screen continues', 'wconvert')
        : decision.kind === 'answer' ? edge?.when
          ? sprintf(__('First matching path %1$d: %2$s', 'wconvert'), (decision.priority ?? 0) + 1, conditionText(tree, edge.when))
          : sprintf(__('Answer path %d', 'wconvert'), (decision.priority ?? 0) + 1)
          : branches ? __('Everyone else: no answer path matched', 'wconvert') : __('Continue', 'wconvert');
      return [{ id: decision.edge, label: sprintf(__('%1$s → %2$s: %3$s', 'wconvert'), from, to, action) }];
    }
    if (!('from' in decision) || typeof decision.from !== 'number') return [];
    const from = tree.steps[decision.from]?.name ?? '';
    const to = tree.steps[Number(decision.to)]?.name ?? '';
    const action = decision.kind === 'hidden' ? __('Hidden screen continues', 'wconvert')
      : decision.kind === 'route' ? sprintf(__('Answer path %d', 'wconvert'), (decision.priority ?? 0) + 1)
        : __('Continue', 'wconvert');
    return [{ id: `${decision.from}-${decision.to}`, label: sprintf(__('%1$s → %2$s: %3$s', 'wconvert'), from, to, action) }];
  });
  const answerText = (id: string, value: string | string[] | undefined) => {
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) return __('Unanswered', 'wconvert');
    const node = nodes.find(item => 'id' in item && item.id === id);
    const choices = node && 'options' in node && Array.isArray(node.options) ? node.options : [];
    return (Array.isArray(value) ? value : [value]).map(answer => choices.find(choice => choice.value === answer)?.label ?? answer).join(', ');
  };
  return <div className="wconvert-journey-test">
    <div ref={anchor} className="wconvert-journey-test__stage" />
    <div className="wconvert-journey-test__side">
      <h3>{__('Path summary', 'wconvert')}</h3>
      <ol>{readingOrder.map(at => { const screen = tree.steps[at]; return <li key={screen.id} data-current={at === step}>
        <span>{screen.name}</span><small>{applicable[at] ? visited.includes(at) ? __('Visited', 'wconvert') : __('Included', 'wconvert')
          : ('skips' in trace && trace.skips.find(skip => skip.index === at)?.reason === 'route') || ('hidden' in trace && !trace.hidden.includes(screen.id)) ? __('Bypassed by another path', 'wconvert')
            : __('Show condition did not match', 'wconvert')}</small>
        {!applicable[at] && <button type="button" onClick={() => onEdit(at)}>{__('Edit condition', 'wconvert')}</button>}
      </li>; })}</ol>
      {routeSteps.length > 0 && <details className="wconvert-journey-test__route"><summary>{__('Why this path?', 'wconvert')}</summary>
        <ol>{routeSteps.map(item => <li key={item.id} data-edge-id={item.id}>{item.label}</li>)}</ol></details>}
      {shownResult && <p className="wconvert-journey-test__result">{sprintf(__('Result shown: %s', 'wconvert'), shownResult.heading)}</p>}
      {tree.submissions.length > 0 && <section className="wconvert-journey-test__capture"><h4>{__('Capture checkpoints', 'wconvert')}</h4>
        <ol>{tree.submissions.map(submission => <li key={submission.id} className="wconvert-journey-test__checkpoint"><div><strong>{tree.steps.find(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submission.id))?.name ?? submission.id}</strong><span>{accepted.includes(submission.id)
          ? __('Accepted in test', 'wconvert') : skipped.includes(submission.id) ? __('Skipped', 'wconvert')
            : [...submission.fields, ...submission.consents].some(id => id in captureValues) ? __('Draft only', 'wconvert') : __('Not reached', 'wconvert')}</span></div>
          {accepted.includes(submission.id) && <>
            <small>{deliveryMode === 'connected' ? delivery[submission.id] === 'failed'
              ? __('Destination delivery failed in this simulation. The accepted save remains; retry delivery without resubmitting.', 'wconvert')
              : __('Destination delivery is queued in this simulation.', 'wconvert')
              : deliveryMode === 'local' ? __('This would be stored in WConvert only.', 'wconvert')
                : __('No destination is configured for this test.', 'wconvert')}</small>
            {deliveryMode === 'connected' && delivery[submission.id] === 'failed' && <button type="button" onClick={() => setDelivery(previous => ({ ...previous, [submission.id]: 'queued' }))}>
              {__('Simulate delivery retry', 'wconvert')}</button>}
            {snapshots[submission.id] && <details><summary>{__('Review accepted snapshot', 'wconvert')}</summary><dl>
              {Object.entries(snapshots[submission.id].values).map(([id, value]) => <div key={id}><dt>{nodeLabel(id)}</dt><dd>{typeof value === 'boolean'
                ? value ? __('Agreed', 'wconvert') : __('Not agreed', 'wconvert') : answerText(id, value)}</dd></div>)}
              {snapshots[submission.id].questionIds.map(id => <div key={id}><dt>{nodeLabel(id)}</dt><dd>{answerText(id, snapshots[submission.id].answers[id])}</dd></div>)}
            </dl></details>}
          </>}
        </li>)}</ol>
        <label><input type="checkbox" checked={failNext} onChange={event => { failNextRef.current = event.target.checked; setFailNext(event.target.checked); }} />{__('Simulate failure on next submission', 'wconvert')}</label>
        {deliveryMode === 'connected' && <label><input type="checkbox" checked={failDeliveryNext} onChange={event => { failDeliveryNextRef.current = event.target.checked; setFailDeliveryNext(event.target.checked); }} />{__('Simulate delivery failure after next accepted save', 'wconvert')}</label>}
        {feedback && <p role="status">{feedback}</p>}
        <p>{destinationSummary ? sprintf(__('Destination setup: %s. Test outcomes are simulated.', 'wconvert'), destinationSummary)
          : __('Test outcomes are simulated; no destination receives a request.', 'wconvert')}</p>
      </section>}
      {tree.steps[step].kind === 'result' && <fieldset><legend>{__('Product state', 'wconvert')}</legend>
        {(['selected', 'empty', 'error'] as const).map(value => <label key={value}><input type="radio" name="product-state" checked={productState === value} onChange={() => setProductState(value)} />{value === 'selected' ? __('Selected', 'wconvert') : value === 'empty' ? __('None available', 'wconvert') : __('Loading error', 'wconvert')}</label>)}
      </fieldset>}
      <button type="button" onClick={() => { setAnswers({}); setCaptureValues({}); setAccepted([]); setSnapshots({}); setAcceptedQuestions([]); setSkipped([]); setDelivery({});
        failNextRef.current = false; setFailNext(false); failDeliveryNextRef.current = false; setFailDeliveryNext(false); setFeedback(''); setStep(entry); setVisited([entry]); }}>{__('Reset test', 'wconvert')}</button>
      <p>{__('Preview never saves answers, creates Leads, or counts conversions.', 'wconvert')}</p>
    </div>
  </div>;
}
