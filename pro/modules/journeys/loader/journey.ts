import { journeyLabel } from '@loader/journey-labels';
import { answerReview } from '@renderer/answer-review';
import { journeyNotice } from '@renderer/journey-notice';
import type { Mounted } from '@renderer/mount';
import type { TemplateNode } from '@renderer/types';
import type { PayloadEntry } from '@loader/types';
import { captureEndpoint, beaconEndpoint } from '@loader/payload';
import { createBeacon, type BeaconKind } from '@loader/beacon';
import { clear, pending, refuse } from '@loader/capture';
import { chooseResult, journeyTrace, type Answers } from '@loader/journey-rules';
import { graphTrace } from '@loader/journey-graph';
import { journeyNodes } from '@loader/journey-nodes';
import { isResultFirst } from '@loader/journey-mode';
import { journeyCapturePrefix } from '@loader/journey-capture';
import { showProducts } from '@loader/products';

type Input = HTMLInputElement | HTMLSelectElement;
type PhoneControl = HTMLInputElement & { __p?: (value: string) => void; __r?: () => void };
interface Reply { id?: string; grant?: string; message?: string; data?: { field?: string }; }
interface Options { onCaptured(): void; onCompleted?(): void; onDismiss?(): void; onRefused?(kind: 'correctable' | 'unconfirmed'): void; }


/** One mounted page owns unsaved answers and the expiring request capability. */
export function bindJourney(mounted: Mounted, entry: PayloadEntry, options: Options): void {
  const tree = entry.template?.tree;
  if (!tree || (tree.submissions.length === 0 && !tree.steps.some(screen => screen.kind === 'result'))) return;
  const route = (answers: Answers) => tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers);
  const activeFor = (answers: Answers) => route(answers).answers;
  const nodes = new Map<string, { node: TemplateNode; screen: number }>();
  tree.steps.forEach((screen, index) => journeyNodes(screen.content).forEach(node => {
    if ('id' in node && typeof node.id === 'string') nodes.set(node.id, { node, screen: index });
  }));
  const submitScreen = (id: string) => [...nodes.values()].find(({ node }) => node.type === 'button' && 'submission' in node && node.submission === id && 'action' in node && node.action === 'submit')?.screen ?? -1;
  const resultAt = tree.steps.findIndex(screen => screen.kind === 'result');
  const resultFirst = isResultFirst(tree);
  const beacon = createBeacon(beaconEndpoint());
  const counted = new Set<string>();
  const report = (kind: BeaconKind, index = step) => {
    const screen = tree.steps[index]; const key = `${screen.id}:${kind}`;
    if (counted.has(key) || !entry.capture_contract) return;
    counted.add(key); beacon.report(entry.id, kind, `screen:${entry.capture_contract}:${screen.id}`); beacon.flush();
  };
  const entryIndex = tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0;
  let step = entryIndex;
  let grant: string | undefined;
  let busy = false;
  const answers = new Map<string, string | boolean>();
  const questionAnswers: Answers = {};
  let completed = false;
  let stopProducts: (() => void) | undefined;
  const visited: number[] = [step];
  const accepted = new Set<string>();
  const fixed = new Set<string>();
  const lockedQuestions = new Set<string>();
  const cleared = new Set<string>();
  const controls = () => [...(mounted.root?.querySelectorAll<Input>('[data-capture-id]') ?? [])];
  const validQuestions = (root: HTMLElement): boolean => {
    for (const node of nodes.values()) {
      if (node.screen !== step || node.node.type !== 'question' || !('id' in node.node) || typeof node.node.id !== 'string') continue;
      const questionId = node.node.id;
      const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')].filter(input => input.dataset.questionId === questionId);
      if (!inputs.length) continue;
      const answered = inputs[0] instanceof HTMLTextAreaElement ? inputs[0].value.trim() !== '' : inputs.some(input => input instanceof HTMLInputElement && input.checked);
      if ('required' in node.node && node.node.required === true && !answered) {
        inputs[0].setCustomValidity('Please answer this question.'); inputs[0].reportValidity(); inputs[0].focus(); return false;
      }
      inputs[0].setCustomValidity('');
    }
    return true;
  };
  const save = () => {
    for (const input of controls()) if (!fixed.has(input.dataset.captureId!)) answers.set(input.dataset.captureId!, input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.dataset.e164 ?? input.value);
    const groups = new Map<string, (HTMLInputElement | HTMLTextAreaElement)[]>();
    for (const input of mounted.root?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]') ?? []) {
      const id = input.dataset.questionId ?? '';
      groups.set(id, [...(groups.get(id) ?? []), input]);
    }
    for (const [id, inputs] of groups) {
      if (lockedQuestions.has(id)) continue;
      const first = inputs[0];
      if (first instanceof HTMLTextAreaElement) {
        const value = first.value.trim();
        if (value) questionAnswers[id] = value; else delete questionAnswers[id];
      } else if (first.type === 'checkbox') {
        const values = inputs.filter(input => input instanceof HTMLInputElement && input.checked).map(input => input.value);
        if (values.length) questionAnswers[id] = values; else delete questionAnswers[id];
      } else {
        const value = inputs.find(input => input instanceof HTMLInputElement && input.checked)?.value;
        if (value) questionAnswers[id] = value; else delete questionAnswers[id];
      }
    }
    const active = activeFor(questionAnswers);
    for (const id of Object.keys(questionAnswers)) if (!(id in active)) delete questionAnswers[id];
  };
  const next = (index: number, direction: 1 | -1): number => {
    const path = route(questionAnswers).indices;
    const position = path.indexOf(index);
    return path[position + direction] ?? index;
  };
  function show(index: number) {
    if (index < 0 || index >= tree!.steps.length) return;
    stopProducts?.(); stopProducts = undefined;
    step = index; mounted.showStep(index); bind();
    if (tree!.steps[index].kind === 'result') {
      const result = chooseResult(tree!.steps[index].results ?? [], activeFor(questionAnswers));
      const root = mounted.root;
      const heading = root?.querySelector<HTMLElement>('[data-result-heading]');
      const body = root?.querySelector<HTMLElement>('[data-result-body]');
      const link = root?.querySelector<HTMLAnchorElement>('[data-result-link]');
      if (heading) heading.textContent = result?.heading ?? '';
      if (body) body.textContent = result?.body ?? '';
      if (link) {
        link.textContent = result?.link_label ?? '';
        if (result?.href) { link.href = result.href; link.hidden = false; }
        else { link.removeAttribute('href'); link.hidden = true; }
      }
      const products = root?.querySelector<HTMLElement>('[data-result-products]');
      if (products) stopProducts = showProducts(products, result, () => { beacon.report(entry.id, 'result_click'); beacon.flush(); });
      if (!completed) { completed = true; options.onCompleted?.(); }
    }
    const root = mounted.root;
    if (root && root.getClientRects().length > 0) {
      const target = root.querySelector<HTMLElement>('h1,h2,h3,[role="heading"]') ?? root;
      target.tabIndex = -1; target.focus({ preventScroll: true });
    }
  }
  function bind() {
    const root = mounted.root;
    if (!root) return;
    root.setAttribute('aria-label', tree!.steps[step].name);
    if (tree!.steps[step].review_answers) answerReview(root, visited.filter(index => index !== step).flatMap(index => journeyNodes(tree!.steps[index].content)), activeFor(questionAnswers), journeyLabel(4));
    if (step === entryIndex && resultAt >= 0 && !resultFirst) {
      journeyNotice(root, journeyLabel(2));
    }
    const index = step;
    let observer: IntersectionObserver | undefined;
    const visible = () => {
      if (typeof window.IntersectionObserver !== 'function') { report('screen_shown'); return; }
      observer?.disconnect();
      observer = new IntersectionObserver(entries => {
        if (root.isConnected && entries.some(e => e.isIntersecting)) { report('screen_shown', index); observer?.disconnect(); }
      });
      observer.observe(root);
    };
    visible();
    root.addEventListener('wconvert:shown', visible);
    root.addEventListener('wconvert:closed', () => observer?.disconnect());
    root.addEventListener('wconvert:dismissed', () => report('screen_dismissed'));
    root.querySelector('.wc-close')?.addEventListener('click', () => report('screen_dismissed'));
    let reviewing = false;
    for (const input of controls()) {
      const id = input.dataset.captureId!;
      const value = answers.get(id);
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = value === true;
      else if (typeof value === 'string') {
        const widget = (input as PhoneControl).__p;
        if (widget) widget(value);
        else input.value = value;
      }
      else if (cleared.delete(id)) (input as PhoneControl).__r?.();
      if (fixed.has(id)) {
        reviewing = true;
        input.required = false;
        if (input instanceof HTMLSelectElement || (input instanceof HTMLInputElement && input.type === 'checkbox')) input.disabled = true;
        else input.readOnly = true;
      }
    }
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')) {
      const value = questionAnswers[input.dataset.questionId ?? ''];
      if (input instanceof HTMLTextAreaElement) input.value = typeof value === 'string' ? value : '';
      else input.checked = Array.isArray(value) ? value.includes(input.value) : value === input.value;
      if (lockedQuestions.has(input.dataset.questionId ?? '')) { input.disabled = true; reviewing = true; }
      input.addEventListener('input', () => { for (const peer of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')) if (peer.dataset.questionId === input.dataset.questionId) peer.setCustomValidity(''); });
    }
    if (reviewing) journeyNotice(root, journeyLabel(3));
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      if (button.dataset.action === 'submit' && accepted.has(button.dataset.submission!)) {
        button.dataset.action = 'next'; button.textContent = journeyLabel(0);
      }
    }
    if (tree!.steps[step].kind === 'result') {
      root.querySelector('[data-result-link]')?.addEventListener('click', () => { if (completed || !resultFirst) { beacon.report(entry.id, 'result_click'); beacon.flush(); } });
    }
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.dataset.action === 'submit' || (button.dataset.action === 'next' && root instanceof HTMLFormElement)) return;
      event.preventDefault();
      if (busy) return;
      if (button.dataset.action === 'next') {
        if (!validQuestions(root)) return;
        const invalid = [...controls(), ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')].find(input => !input.checkValidity());
        if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
      }
      save();
      if (button.dataset.action === 'next') { report('screen_advanced'); const target = next(step, 1); if (target !== step) { visited.push(target); show(target); } }
      if (button.dataset.action === 'back') { visited.pop(); show(visited[visited.length - 1] ?? next(step, -1)); }
      if (button.dataset.action === 'close') { report('screen_dismissed'); options.onDismiss?.(); mounted.close(); }
      if (button.dataset.action === 'skip') {
        const submission = tree!.submissions.find(s => s.id === button.dataset.submission && !s.required);
        if (!submission || accepted.has(submission.id)) return;
        [...submission.fields, ...submission.consents].forEach(id => { answers.delete(id); cleared.add(id); });
        report('screen_skipped'); const target = next(submitScreen(submission.id), 1); visited.push(target); show(target);
      }
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (busy) return;
      const button = (event as SubmitEvent).submitter as HTMLButtonElement | null
        ?? root.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!button) return;
      if (root instanceof HTMLFormElement && !root.reportValidity()) return;
      if (!validQuestions(root)) return;
      save();
      if (button.dataset.action === 'next') { report('screen_advanced'); const target = next(step, 1); if (target !== step) { visited.push(target); show(target); } return; }
      if (button.dataset.action !== 'submit') return;
      const submission = tree!.submissions.find(s => s.id === button.dataset.submission);
      if (!submission || accepted.has(submission.id)) return;
      const snapshot = journeyCapturePrefix(tree!.steps, tree!.graph, step, questionAnswers);
      if (!snapshot) { refuse(root, journeyLabel(1), null); options.onRefused?.('correctable'); return; }
      const fields: Record<string, string> = {};
      for (const id of submission.fields) {
        const node = nodes.get(id)?.node;
        if (node && 'name' in node && typeof node.name === 'string' && typeof answers.get(id) === 'string') fields[node.name] = answers.get(id) as string;
      }
      busy = true; clear(root); const release = pending(root);
      void (async () => {
        try {
          const base = { optin_id: entry.id, contract: entry.capture_contract };
          if (!grant) {
            const start = await request({ ...base, phase: 'start' });
            if (typeof start.grant !== 'string' || start.grant.trim() === '') throw {};
            grant = start.grant;
          }
          const result = await request({ ...base, grant, submission: submission.id, fields, question_answers: snapshot.answers,
            consent: submission.consents.length > 0 ? submission.consents.every(id => answers.get(id) === true) : undefined });
          if (typeof result.id !== 'string' || result.id.trim() === '') throw {};
          accepted.add(submission.id);
          [...submission.fields, ...submission.consents].forEach(id => fixed.add(id));
          snapshot.questionIds.forEach(id => lockedQuestions.add(id));
          release(); busy = false;
          report('screen_advanced'); const target = next(step, 1); if (target !== step) { visited.push(target); show(target); }
          if (accepted.size === 1 && resultAt < 0) options.onCaptured();
        } catch (error) {
          release(); busy = false;
          const reply = (error instanceof Error ? {} : error) as Reply;
          const field = reply?.data?.field;
          if (field) {
            const target = field === 'consent' ? nodes.get(submission.consents[0])
              : nodes.get(field) ?? [...nodes.values()].find(({ node }) => 'name' in node && node.name === field);
            if (target && target.screen !== step) show(target.screen);
          }
          if (mounted.root) refuse(mounted.root, reply?.message || journeyLabel(1), field ?? null);
          if (field && nodes.get(field)?.node.type === 'question') mounted.root?.querySelector<HTMLElement>(`[data-question-id="${field}"]`)?.focus();
          options.onRefused?.(field ? 'correctable' : 'unconfirmed');
        }
      })();
    });
  }
  if (tree.graph) mounted.showStep(step);
  bind();
}

async function request(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = captureEndpoint();
  if (!endpoint) throw {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const reply: unknown = await response.json();
    if (!reply || typeof reply !== 'object' || Array.isArray(reply)) throw {};
    if (!response.ok) throw reply;
    return reply as Reply;
  } finally { clearTimeout(timeout); }
}
