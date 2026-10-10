import { LiveProductMatches } from './ResultProductFilter';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialogFooter } from '../components/ui/admin-dialog';
import { Disclosure } from '../shell/Disclosure';
import { PreviewWidth } from './PreviewWidth';
import { changeTestGuide, type JourneyChange } from './structure/changeTestGuide';
import { followupGroups } from './structure/followupGroups';
import { journeyTestProgress } from './structure/journeyTestProgress';
import { journeyTraceEdges } from './structure/journeyTraceEdges';
import { answerReview } from '@renderer/answer-review';
import { journeyNotice } from '@renderer/journey-notice';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import type { Template, TemplateNode } from '@renderer/types';
import { activeAnswers, chooseResult, journeyPath, journeyTrace, type Answers } from '../../../loader/src/journey-rules';
import { graphTrace } from '../../../loader/src/journey-graph';
import { graphDisplayOrder } from './structure/graph';
import { walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { testCaptureSnapshot, type TestCaptureSnapshot } from './structure/journeyTestState';

type ProductState = 'selected' | 'empty' | 'error';

function TestProducts({ count, state, onRetry }: { count: number; state: ProductState; onRetry(): void }) {
  const status = useRef<HTMLParagraphElement>(null);
  return <>
    <p ref={status} role="status" tabIndex={-1}>{state === 'selected'
      ? sprintf(_n('%d selected product would be checked for current price and availability.', '%d selected products would be checked for current price and availability.', count, 'wconvert'), count)
      : state === 'empty' ? __('These products are unavailable right now. Please use the link below.', 'wconvert')
        : __('Products could not load. You can still use the link below.', 'wconvert')}</p>
    {state === 'error' && <button type="button" className="wc-button" onClick={() => {
      // This same status stays mounted when Retry disappears.
      status.current?.focus(); onRetry();
    }}>{__('Retry products', 'wconvert')}</button>}
  </>;
}

function TestCartAction() {
  const [added, setAdded] = useState(false);
  return <div><p>{__('Preview only. Your basket stays unchanged.', 'wconvert')}</p>
    <button type="button" className="wc-button" disabled={added} onClick={() => setAdded(true)}>{added ? __('Added', 'wconvert') : __('Test add to cart', 'wconvert')}</button>
    <p role="status">{added ? __('Sample item added. Live additions appear in Product activity.', 'wconvert') : __('Products with options open their product page.', 'wconvert')}</p></div>;
}

/** The real renderer, with in-memory answers and no capture or analytics calls. */
export function JourneyTest({ template, onEdit, onShowPath, deliveryMode = 'none', destinationSummary, changeToCheck, onClose, active: visible = true }: {
  onClose?(): void; active?: boolean;
  template: Template; onEdit(step: number, focus?: 'condition'): void; onShowPath?(screens: readonly number[], edges: readonly string[]): void; deliveryMode?: 'local' | 'connected' | 'none'; destinationSummary?: string; changeToCheck?: JourneyChange;
}) {
  const tree = template.tree;
  const entry = tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0;
  const anchor = useRef<HTMLDivElement>(null);
  const backAction = useRef<() => void>(() => {});
  const [step, setStep] = useState(entry);
  const [mobile, setMobile] = useState(false);
  const isVisible = useRef(visible); isVisible.current = visible;
  const [answers, setAnswers] = useState<Answers>({});
  const [visited, setVisited] = useState<number[]>([entry]);
  const [productState, setProductState] = useState<ProductState>('selected');
  const [productHost, setProductHost] = useState<HTMLElement | null>(null);
  const [captureValues, setCaptureValues] = useState<Record<string, string | boolean>>({});
  const phoneCountries = useRef<Record<string, string>>({});
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
  const progress = journeyTestProgress(tree, step, visited, trace);
  const followups = followupGroups(tree).find(group => group.screens.includes(step))?.screens.filter(at => trace.indices.includes(at));
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
    if (at !== undefined) {
      setVisited([...visited, at]); setStep(at);
    }
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
      if (!isVisible.current || !root.isConnected || !root.getClientRects().length) return;
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
    if (tree.steps[step].review_answers) answerReview(root, visited.filter(index => index !== step).flatMap(index => walkNodes(tree.steps[index].content)), active, __('Review your answers', 'wconvert'));
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
      else if (typeof value === 'string') {
        const restore = (input as HTMLInputElement & { __p?: (value: string, country?: string) => void }).__p;
        if (restore) restore(value, phoneCountries.current[id]); else input.value = value;
      }
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
    let productsHost: HTMLElement | null = null;
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
      if (products && (result?.product_ids?.length || result?.product_filter)) productsHost = products;
    }
    setProductHost(productsHost);
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
        const id = input.dataset.captureId ?? '';
        next[id] = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.dataset.e164 ?? input.value;
        if (input.dataset.phoneCountry) phoneCountries.current[id] = input.dataset.phoneCountry;
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
          if (!snapshot) { setAnswers(currentAnswers); setFeedback(__('This save is incomplete or is not on the visited path. Check its contact fields and submission settings before testing again.', 'wconvert')); return; }
          setAccepted(previous => previous.includes(id) ? previous : [...previous, id]);
          setSnapshots(previous => ({ ...previous, [id]: previous[id] ?? snapshot }));
          setAcceptedQuestions(previous => [...new Set([...previous, ...snapshot.questionIds])]);
          if (deliveryMode === 'connected') {
            const deliveryFailed = failDeliveryNextRef.current;
            setDelivery(previous => ({ ...previous, [id]: deliveryFailed ? 'failed' : 'queued' }));
            failDeliveryNextRef.current = false; setFailDeliveryNext(false);
          }
          setFeedback(__('Save accepted in this test. The visitor can continue; no real lead or destination request was created.', 'wconvert'));
        } else if (button.dataset.action === 'skip') {
          const id = button.dataset.submission ?? '';
          const submission = tree.submissions.find(item => item.id === id);
          if (!submission || submission.required || accepted.includes(id)) return;
          for (const field of [...submission.fields, ...submission.consents]) delete draft[field];
          setCaptureValues(draft);
          setSkipped(previous => previous.includes(id) ? previous : [...previous, id]);
          setFeedback(__('Optional signup skipped. No new details were saved; earlier accepted saves are unchanged.', 'wconvert'));
        } else setFeedback('');
        move(1, currentAnswers);
      }
    };
    backAction.current = () => { saveDraft(); setFeedback(''); move(-1, read()); };
    root.addEventListener('click', advance);
    root.addEventListener('submit', event => event.preventDefault());
    root.querySelectorAll('a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
    return () => { cancelAnimationFrame(focusFrame); mounted.close(); };
  // Remount when the preview path or its answers change; this never sends data.
  }, [template, step, entry, answers, active, trace.indices, move, tree, captureValues, accepted, acceptedQuestions, deliveryMode, visited]);
  const nodes = tree.steps.flatMap(screen => walkNodes(screen.content));
  const nodeLabel = (id: string) => {
    const node = nodes.find(item => 'id' in item && item.id === id);
    return node && 'label' in node && typeof node.label === 'string' ? node.label
      : node?.type === 'consent' ? __('Consent', 'wconvert') : __('Answer', 'wconvert');
  };
  const routeSteps: { id: string; label: string }[] = progress.decisions.flatMap(decision => {
    if (tree.graph && 'edge' in decision) {
      const source = tree.steps.find(screen => screen.id === decision.from);
      const edge = tree.graph.edges.find(item => item.id === decision.edge);
      const from = source?.name ?? __('Removed screen', 'wconvert');
      const to = tree.steps.find(screen => screen.id === decision.to)?.name ?? __('Removed screen', 'wconvert');
      const branches = tree.graph.edges.some(edge => edge.from === decision.from && edge.kind === 'answer');
      const action = decision.kind === 'hidden' ? source?.when
        ? sprintf(__('Hidden because %s did not match', 'wconvert'), conditionText(tree, source.when))
        : __('Hidden screen continues', 'wconvert')
        : decision.kind === 'answer' ? edge?.when
          ? sprintf(__('First matching path %1$d: %2$s', 'wconvert'), (decision.priority ?? 0) + 1, conditionText(tree, edge.when))
          : sprintf(__('Answer path %d', 'wconvert'), (decision.priority ?? 0) + 1)
          : branches ? __('All other answers: no answer path matched', 'wconvert') : __('Continue', 'wconvert');
      /* translators: 1: the screen a visitor left, 2: the screen they reached, 3: why. */
      return [{ id: decision.edge, label: sprintf(__('%1$s to %2$s: %3$s', 'wconvert'), from, to, action) }];
    }
    if (!('from' in decision) || typeof decision.from !== 'number') return [];
    const from = tree.steps[decision.from]?.name ?? '';
    const to = tree.steps[Number(decision.to)]?.name ?? '';
    const action = decision.kind === 'hidden' ? __('Hidden screen continues', 'wconvert')
      : decision.kind === 'route' ? sprintf(__('Answer path %d', 'wconvert'), (decision.priority ?? 0) + 1)
        : __('Continue', 'wconvert');
    return [{ id: `${decision.from}-${decision.to}`, label: sprintf(__('%1$s to %2$s: %3$s', 'wconvert'), from, to, action) }];
  });
  const answerText = (id: string, value: string | string[] | undefined) => {
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) return __('Unanswered', 'wconvert');
    const node = nodes.find(item => 'id' in item && item.id === id);
    const choices = node && 'options' in node && Array.isArray(node.options) ? node.options : [];
    return (Array.isArray(value) ? value : [value]).map(answer => choices.find(choice => choice.value === answer)?.label ?? answer).join(', ');
  };
  const currentSubmissions = tree.submissions.filter(submission => walkNodes(tree.steps[step].content)
    .some(node => node.type === 'button' && 'submission' in node && node.submission === submission.id && 'action' in node && node.action === 'submit'));
  const shownSubmissions = tree.submissions.filter(submission => accepted.includes(submission.id) || skipped.includes(submission.id));
  // A result with nothing after it ends the run as an ending does.
  const complete = tree.steps[step].kind === 'acknowledgement' || (tree.steps[step].kind === 'result' && trace.indices.at(-1) === step);
  const failable = currentSubmissions.some(submission => !accepted.includes(submission.id));
  const hasProducts = !!shownResult?.product_ids?.length || !!shownResult?.product_filter;
  const reset = () => {
    setAnswers({}); setCaptureValues({}); phoneCountries.current = {}; setAccepted([]); setSnapshots({}); setAcceptedQuestions([]); setSkipped([]); setDelivery({});
    failNextRef.current = false; setFailNext(false); failDeliveryNextRef.current = false; setFailDeliveryNext(false); setProductState('selected'); setFeedback(''); setStep(entry); setVisited([entry]);
  };
  // Width changes only resize the mounted renderer. Back reads its unsaved inputs
  // before moving, exactly like a Back button inside the visitor's form.

  return <div className="wconvert-journey-test">
    <section className="wconvert-journey-test__visitor" aria-label={__('Interactive preview', 'wconvert')}>
      <div className="wconvert-preview-test__toolbar"><span>{sprintf(
        /* translators: 1: how many screens this run has reached, 2: the screen on show, e.g. “Your result”. */
        __('Screen %1$d · %2$s', 'wconvert'), visited.length, tree.steps[step].name)}</span><PreviewWidth mobile={mobile} onChange={setMobile} /></div>
      <div className="wconvert-journey-test__canvas"><div ref={anchor} data-mobile={mobile} className="wconvert-journey-test__stage" /></div>
      {feedback && <p className="wconvert-journey-test__feedback" role="status">{feedback}</p>}
      <div className="wconvert-preview-test__screen-actions"><Button variant="ghost" size="sm" disabled={visited.length < 2} onClick={() => backAction.current()}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Previous screen', 'wconvert')}</Button><Button variant="ghost" size="sm" onClick={() => onEdit(step)}>{__('Edit this screen', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button></div>
    </section>
    {productHost && (shownResult?.product_ids?.length || shownResult?.product_filter) && createPortal(<>{shownResult.product_filter && productState === 'selected' ? <LiveProductMatches filter={shownResult.product_filter} /> : <TestProducts count={shownResult.product_filter ? 3 : shownResult.product_ids?.length ?? 0}
      state={productState} onRetry={() => setProductState('selected')} />}{shownResult.product_action === 'add_to_cart' && productState === 'selected' && <TestCartAction key={shownResult.id} />}</>, productHost)}
    <aside className="wconvert-journey-test__side" aria-label={__('What happened', 'wconvert')}>
      {changeToCheck && <section className="wconvert-journey-test__change" aria-label={__('Change to check', 'wconvert')}><p>{__('Testing your change:', 'wconvert')} <strong>{changeToCheck.screenName}</strong> {changeToCheck.text}</p><Disclosure variant="inline" title={__('Suggested checks', 'wconvert')}><ul>{changeTestGuide(tree, changeToCheck.screenId).map(check => <li key={check}>{check}</li>)}</ul><p>{__('These are cases to try, not proof that a rule is reachable or wins. Earlier answers and the top-to-bottom order still apply.', 'wconvert')}</p></Disclosure></section>}
      <div className="wconvert-journey-test__status"><h3>{__('What happened', 'wconvert')}</h3><small data-complete={complete || undefined}>{complete ? __('Finished', 'wconvert') : __('In progress', 'wconvert')}</small></div>
      {visited.length === 1 && !complete && <p>{__('Use the form as a visitor would. Each screen you reach is listed here.', 'wconvert')}</p>}
      <ol className="wconvert-journey-test__timeline" aria-label={__('Visited screens', 'wconvert')}>
        {visited.map((at, index) => <li key={tree.steps[at].id} data-current={at === step} aria-current={at === step ? 'step' : undefined}>
          <span className="wconvert-journey-test__number" aria-hidden="true">{at === step ? index + 1 : <Check size={12} />}</span>
          <div><strong>{tree.steps[at].name}</strong><small>{at === step ? __('Current screen', 'wconvert') : __('Visited', 'wconvert')}</small>
          {at === step && followups && <small>{sprintf(__('Follow-up %1$d of %2$d for these answers', 'wconvert'), followups.indexOf(step) + 1, followups.length)}</small>}
          {at === step && shownResult && <small>{sprintf(__('Result shown: %s', 'wconvert'), shownResult.heading)}</small>}</div>
        </li>)}
      </ol>
      {(['skipped', 'pending'] as const).map(category => {
        const screens = readingOrder.filter(at => category === 'pending' ? progress.states[at] === 'pending' : ['hidden', 'bypassed'].includes(progress.states[at]));
        // Screens off this path are one muted line each, never a list to open (ADR 0138).
        return screens.length > 0 && <div key={category} className="wconvert-journey-test__others" data-category={category}>
          <span>{category === 'pending' ? __('Not reached yet:', 'wconvert') : __('Skipped:', 'wconvert')}</span>
          <ul>{screens.map(at => <li key={tree.steps[at].id} data-current="false" title={progress.states[at] === 'pending' ? __('Not reached yet', 'wconvert') : progress.states[at] === 'bypassed' ? __('Bypassed by another path', 'wconvert') : __('Show condition did not match', 'wconvert')}>
            <bdi>{tree.steps[at].name}</bdi>
            {category === 'skipped' && <button type="button" onClick={() => onEdit(at, progress.states[at] === 'hidden' ? 'condition' : undefined)}>{progress.states[at] === 'hidden' ? __('Edit condition', 'wconvert') : __('Review screen', 'wconvert')}</button>}
          </li>)}</ul>
        </div>;
      })}
      {routeSteps.length > 0 && <Disclosure variant="inline" className="wconvert-journey-test__route" title={__('Why this path?', 'wconvert')}>
        <ol>{routeSteps.map(item => <li key={item.id} data-edge-id={item.id}>{item.label}</li>)}</ol></Disclosure>}
      {onShowPath && visited.length > 1 && <Button variant="link" size="sm" className="wconvert-journey-test__map self-start px-0" onClick={() => onShowPath(visited, journeyTraceEdges(tree, progress.decisions))}>{__('Show this path on the map', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>}
      {shownSubmissions.length > 0 && <section className="wconvert-journey-test__capture"><h4>{__('Test submissions', 'wconvert')}</h4>
        <ol>{shownSubmissions.map(submission => <li key={submission.id} className="wconvert-journey-test__checkpoint"><div><strong>{tree.steps.find(screen => walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit' && 'submission' in node && node.submission === submission.id))?.name ?? __('Signup', 'wconvert')}</strong><span>{accepted.includes(submission.id) ? __('Accepted in test', 'wconvert') : __('Skipped', 'wconvert')}</span></div>
          {accepted.includes(submission.id) && <>
            <small>{deliveryMode === 'connected' ? delivery[submission.id] === 'failed'
              ? __('Destination delivery failed in this simulation. The accepted save remains; retry delivery without resubmitting.', 'wconvert')
              : __('Destination delivery is queued in this simulation.', 'wconvert')
              : deliveryMode === 'local' ? __('This would be stored in WConvert only.', 'wconvert')
                : __('No destination is configured for this test.', 'wconvert')}</small>
            {deliveryMode === 'connected' && delivery[submission.id] === 'failed' && <button type="button" onClick={() => setDelivery(previous => ({ ...previous, [submission.id]: 'queued' }))}>
              {__('Simulate delivery retry', 'wconvert')}</button>}
            {snapshots[submission.id] && <Disclosure variant="inline" title={__('Submitted answers', 'wconvert')}><dl>
              {Object.entries(snapshots[submission.id].values).map(([id, value]) => <div key={id}><dt>{nodeLabel(id)}</dt><dd>{typeof value === 'boolean'
                ? value ? __('Agreed', 'wconvert') : __('Not agreed', 'wconvert') : answerText(id, value)}</dd></div>)}
              {snapshots[submission.id].questionIds.map(id => <div key={id}><dt>{nodeLabel(id)}</dt><dd>{answerText(id, snapshots[submission.id].answers[id])}</dd></div>)}
            </dl></Disclosure>}
          </>}
        </li>)}</ol>
        <small>{__('No real submission or delivery occurred.', 'wconvert')}</small>
      </section>}
      {complete && <p className="wconvert-journey-test__complete">{accepted.length ? __('This path is complete. Start over to try another.', 'wconvert') : __('This path is complete, and no contact details were submitted on it. Start over to try another.', 'wconvert')}</p>}
      {/* Every way to make the run go wrong, folded into one place (ADR 0138). */}
      {(failable || hasProducts) && <Disclosure variant="inline" className="wconvert-test-diagnostics" title={__('Simulate a problem', 'wconvert')}>
        {failable && <>
          <p>{__('Applies to the next submission only. A failed save keeps the visitor here so they can retry.', 'wconvert')}</p>
          <label><input type="checkbox" checked={failNext} onChange={event => { failNextRef.current = event.target.checked; setFailNext(event.target.checked); }} />{__('Simulate failure on next submission', 'wconvert')}</label>
          {deliveryMode === 'connected' && <label><input type="checkbox" checked={failDeliveryNext} onChange={event => { failDeliveryNextRef.current = event.target.checked; setFailDeliveryNext(event.target.checked); }} />{__('Simulate delivery failure after next accepted save', 'wconvert')}</label>}
        </>}
        {hasProducts && <fieldset><legend>{__('Products on this result', 'wconvert')}</legend>
          {(['selected', 'empty', 'error'] as const).map(value => <label key={value}><input type="radio" name="product-state" checked={productState === value} onChange={() => setProductState(value)} />{value === 'selected' ? __('Available', 'wconvert') : value === 'empty' ? __('None available', 'wconvert') : __('Loading error', 'wconvert')}</label>)}
          <p>{shownResult?.product_filter ? __('Available shows live matches. The other options simulate problems. No activity is counted.', 'wconvert') : __('This test does not fetch your catalog. Retry simulates a successful response; check actual prices and stock on your website.', 'wconvert')}</p>
        </fieldset>}
      </Disclosure>}
      <p className="wconvert-journey-test__scope">{destinationSummary && tree.submissions.length > 0 ? sprintf(__('Checks screens, answers and required fields. Destination setup: %s; delivery here is simulated.', 'wconvert'), destinationSummary) : __('Checks screens, answers and required fields. Nothing is saved, sent or counted.', 'wconvert')}</p>
    </aside>
    <AdminDialogFooter className="wconvert-preview-test__footer" note={__('Uses your unsaved draft.', 'wconvert')}>
      <Button variant="outline" onClick={reset}><RotateCcw aria-hidden="true" />{__('Start over', 'wconvert')}</Button>
      {onClose && <Button onClick={onClose}>{__('Done', 'wconvert')}</Button>}
    </AdminDialogFooter>
  </div>;
}
