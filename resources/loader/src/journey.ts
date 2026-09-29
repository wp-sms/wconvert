import { requestCapture, type Reply } from './capture-request';
import { protectionField } from './protection';
import { journeyLabel } from './journey-labels';
import { journeyNotice } from '@renderer/journey-notice';
import type { Mounted } from '@renderer/mount';
import type { TemplateNode } from '@renderer/types';
import type { PayloadEntry } from './types';
import { beaconEndpoint } from './payload';
import { createBeacon, type BeaconKind } from './beacon';
import { clear, pending, refuse } from './capture';

type Input = HTMLInputElement | HTMLSelectElement;
type PhoneControl = HTMLInputElement & { __p?: (value: string) => void; __r?: () => void };
interface Options { onLeadAccepted?(): void; onCaptured(): void; onDismiss?(): void; onRefused?(kind: 'correctable' | 'unconfirmed'): void; }

/** One mounted page owns unsaved answers and the expiring request capability. */
export function bindJourney(mounted: Mounted, entry: PayloadEntry, options: Options): void {
  const tree = entry.template?.tree;
  if (!tree || tree.submissions.length === 0) return;
  const beacon = createBeacon(beaconEndpoint());
  const counted = new Set<string>();
  const report = (kind: BeaconKind, index = step) => {
    const screen = tree.steps[index]; const key = `${screen.id}:${kind}`;
    if (counted.has(key) || !entry.capture_contract) return;
    counted.add(key); beacon.report(entry.id, kind, `screen:${entry.capture_contract}:${screen.id}`); beacon.flush();
  };
  let step = 0;
  let grant: string | undefined;
  let busy = false;
  const answers = new Map<string, string | boolean>();
  const accepted = new Set<string>();
  const fixed = new Set<string>();
  const cleared = new Set<string>();
  const nodes = new Map<string, { node: TemplateNode; screen: number }>();
  function collect(node: TemplateNode, screen: number) {
    if ('id' in node && typeof node.id === 'string') nodes.set(node.id, { node, screen });
    const branches = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
    [...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])].forEach(child => collect(child, screen));
  }
  tree.steps.forEach((screen, i) => collect(screen.content, i));
  const submitScreen = (id: string) => [...nodes.values()].find(({ node }) => node.type === 'button' && 'submission' in node && node.submission === id && 'action' in node && node.action === 'submit')?.screen ?? -1;
  const controls = () => [...(mounted.root?.querySelectorAll<Input>('[data-capture-id]') ?? [])];
  const save = () => { for (const input of controls()) if (!fixed.has(input.dataset.captureId!)) answers.set(input.dataset.captureId!, input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.dataset.e164 ?? input.value); };
  function show(index: number) {
    if (index < 0 || index >= tree!.steps.length) return;
    step = index; mounted.showStep(index); bind();
    const root = mounted.root;
    if (root && root.getClientRects().length > 0) {
      const target = root.querySelector<HTMLElement>('h1,h2,h3,[role="heading"]') ?? root;
      target.tabIndex = -1; target.focus({ preventScroll: true });
    }
  }
  function bind() {
    const root = mounted.root;
    if (!root) return;
    const website = protectionField(root);
    root.setAttribute('aria-label', tree!.steps[step].name);
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
    if (reviewing) journeyNotice(root, journeyLabel(3));
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      if (button.dataset.action === 'submit' && accepted.has(button.dataset.submission!)) {
        button.dataset.action = 'next'; button.textContent = journeyLabel(0);
      }
    }
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.dataset.action === 'submit' || (button.dataset.action === 'next' && root instanceof HTMLFormElement)) return;
      event.preventDefault();
      if (busy) return;
      if (button.dataset.action === 'next') {
        const invalid = controls().find(input => !input.checkValidity());
        if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
      }
      save();
      if (button.dataset.action === 'next') { report('screen_advanced'); show(step + 1); }
      if (button.dataset.action === 'back') show(step - 1);
      if (button.dataset.action === 'close') { report('screen_dismissed'); options.onDismiss?.(); mounted.close(); }
      if (button.dataset.action === 'skip') {
        const submission = tree!.submissions.find(s => s.id === button.dataset.submission && !s.required);
        if (!submission || accepted.has(submission.id)) return;
        [...submission.fields, ...submission.consents].forEach(id => { answers.delete(id); cleared.add(id); });
        report('screen_skipped'); show(submitScreen(submission.id) + 1);
      }
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (busy) return;
      const button = (event as SubmitEvent).submitter as HTMLButtonElement | null
        ?? root.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!button) return;
      if (root instanceof HTMLFormElement && !root.reportValidity()) return;
      save();
      if (button.dataset.action === 'next') { report('screen_advanced'); show(step + 1); return; }
      if (button.dataset.action !== 'submit') return;
      const submission = tree!.submissions.find(s => s.id === button.dataset.submission);
      if (!submission || accepted.has(submission.id)) return;
      const fields: Record<string, string> = {};
      for (const id of submission.fields) {
        const node = nodes.get(id)?.node;
        if (node && 'name' in node && typeof node.name === 'string' && typeof answers.get(id) === 'string') fields[node.name] = answers.get(id) as string;
      }
      busy = true; clear(root); const release = pending(root);
      void (async () => {
        try {
          const base = { optin_id: entry.id, contract: entry.capture_contract, website: website() };
          if (!grant) {
            const start = await requestCapture({ ...base, phase: 'start' });
            if (typeof start.grant !== 'string' || start.grant.trim() === '') throw {};
            grant = start.grant;
          }
          const result = await requestCapture({ ...base, grant, submission: submission.id, fields,
            consent: submission.consents.length > 0 ? submission.consents.every(id => answers.get(id) === true) : undefined });
          if (typeof result.id !== 'string' || result.id.trim() === '') throw {};
          accepted.add(submission.id);
          [...submission.fields, ...submission.consents].forEach(id => fixed.add(id));
          release(); busy = false;
          if (accepted.size === 1) options.onLeadAccepted?.();
          report('screen_advanced'); show(step + 1);
          if (accepted.size === 1) options.onCaptured();
        } catch (error) {
          release(); busy = false;
          const reply = (error instanceof Error ? {} : error) as Reply;
          const field = reply?.data?.field;
          if (field) {
            const target = field === 'consent' ? nodes.get(submission.consents[0])
              : [...nodes.values()].find(({ node }) => 'name' in node && node.name === field);
            if (target && target.screen !== step) show(target.screen);
          }
          if (mounted.root) refuse(mounted.root, reply?.message || journeyLabel(1), field ?? null);
          options.onRefused?.(field ? 'correctable' : 'unconfirmed');
        }
      })();
    });
  }
  bind();
}
