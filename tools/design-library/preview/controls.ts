import { enhancePhones } from '../../../resources/phone/src/enhance';

export type PreviewValues = Record<string, { value: string | boolean; country?: string }>;
type Control = (HTMLInputElement | HTMLSelectElement) & { __p?: (value: string, country?: string) => void };

/** Uses the shipping adapter; GB is only the studio's sample site country. */
export function prepareControls(root: HTMLElement, shadow: ShadowRoot) {
  return enhancePhones(root, shadow, 'GB');
}

export function readFields(root: HTMLElement, values: PreviewValues) {
  for (const input of root.querySelectorAll<Control>('[data-capture-id]')) {
    if (input.disabled || (input instanceof HTMLInputElement && input.readOnly)) continue;
    values[input.dataset.captureId!] = {
      value: input.type === 'checkbox' ? (input as HTMLInputElement).checked : input.dataset.e164 ?? input.value,
      country: input.dataset.phoneCountry,
    };
  }
}

export function restoreFields(root: HTMLElement, values: PreviewValues, locked: string[] = []) {
  for (const input of root.querySelectorAll<Control>('[data-capture-id]')) {
    const saved = values[input.dataset.captureId!];
    if (saved) {
      if (input.type === 'checkbox') (input as HTMLInputElement).checked = saved.value === true;
      else if (input.__p) input.__p(String(saved.value), saved.country);
      else input.value = String(saved.value);
    }
    if (locked.includes(input.dataset.captureId!)) {
      if (input instanceof HTMLInputElement && input.type !== 'checkbox') input.readOnly = true;
      else input.disabled = true;
    }
  }
}

/** Dispose widgets before replacing a shadow host, including open country menus. */
export function disposePreview(target: HTMLElement) {
  for (const host of [target, ...target.querySelectorAll<HTMLElement>('*')]) {
    host.shadowRoot?.querySelector('.wc-root')?.dispatchEvent(new Event('wconvert:closed'));
  }
}

/** Native radios cover single answers; required multi-choice questions need a group check. */
export function validQuestions(root: HTMLElement, content: unknown): boolean {
  const questions: { id: string }[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    if (value.type === 'question' && value.required && typeof value.id === 'string') questions.push({ id: value.id });
    Object.values(value).forEach(walk);
  };
  walk(content);
  for (const question of questions) {
    const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-question-id]')].filter(input => input.dataset.questionId === question.id);
    const valid = inputs.some(input => input instanceof HTMLTextAreaElement ? !!input.value.trim() : input.checked);
    inputs[0]?.setCustomValidity(valid ? '' : 'Please answer this question.');
    if (inputs.length && !valid) { inputs[0].reportValidity(); inputs[0].focus(); return false; }
  }
  return true;
}
