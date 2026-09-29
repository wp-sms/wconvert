import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { verify } from '../../resources/protection/src/host';
import { protectionField } from '@loader/protection';
const challenge = { url: `${location.origin}/wp-json/wconvert/v1/protection/challenge`, asset: '/protection.js', title: 'Verify', cancel: 'Cancel', cancelled: 'Cancelled, please retry.', failed: 'Verification unavailable.', loading: 'Loading verification…' };
beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
it('accepts only tokens from its own frame and exact origin', async () => {
  const result = verify(challenge);
  const frame = document.querySelector('iframe')!;
  let resolved = false; void result.then(() => { resolved = true; });
  window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', source: frame.contentWindow, data: { type: 'wconvert:verification', token: 'bad' } }));
  window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: window, data: { type: 'wconvert:verification', token: 'bad' } }));
  await Promise.resolve(); expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow, data: { type: 'wconvert:verification', token: 'good' } }));
  await expect(result).resolves.toBe('good');
  expect(document.querySelector('dialog')).toBeNull();
});
it('cleans up on cancel and rejects without altering form values', async () => {
  const form = document.createElement('form'); form.innerHTML = '<input name="email" value="person@example.com">'; document.body.append(form);
  const result = verify(challenge); const assertion = expect(result).rejects.toEqual({ code: 'wconvert_verification_failed', message: challenge.cancelled });
  document.querySelector<HTMLButtonElement>('dialog button')!.click();
  await assertion;
  expect(document.querySelector('dialog')).toBeNull(); expect(form.querySelector('input')!.value).toBe('person@example.com');
});
it('rejects cross-origin verification frames before opening them', async () => {
  await expect(verify({ ...challenge, url: 'https://other.test/challenge' })).rejects.toEqual({ code: 'wconvert_verification_failed', message: challenge.failed });
  expect(document.querySelector('iframe')).toBeNull();
});
it('keeps the honeypot out of captured-field selectors and keyboard navigation', () => {
  const root = document.createElement('form'); const read = protectionField(root); const input = root.querySelector('input')!;
  expect(input.tabIndex).toBe(-1); expect(input.autocomplete).toBe('off');
  expect(input.closest('[hidden]')).not.toBeNull(); expect(root.querySelector('[data-capture-id],.wc-input')).toBeNull();
  input.value = 'bot content'; expect(read()).toBe('bot content');
});

it('sizes only from its own frame and constrains challenge sizes', async () => {
  const result = verify(challenge); const frame = document.querySelector('iframe')!;
  const message = (height: number, source: Window | null = frame.contentWindow) => window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source, data: { type: 'wconvert:verification-ready', height } }));
  message(560, window); expect(frame.style.height).toBe('160px');
  message(260); expect(frame.style.height).toBe('260px');
  expect(document.querySelector('[role="status"]')).toBeNull();
  message(560); expect(frame.style.height).toBe('560px');
  message(10000); expect(frame.style.height).toBe('560px');
  const assertion = expect(result).rejects.toEqual({ code: 'wconvert_verification_failed', message: challenge.cancelled });
  document.querySelector<HTMLButtonElement>('dialog button')!.click(); await assertion;
});
it('returns a useful retry message on frame failure and restores focus', async () => {
  const button = document.createElement('button'); document.body.append(button); button.focus();
  const result = verify(challenge); const assertion = expect(result).rejects.toEqual({ code: 'wconvert_verification_failed', message: challenge.failed });
  document.querySelector('iframe')!.dispatchEvent(new Event('error')); await assertion;
  expect(document.activeElement).toBe(button); expect(document.querySelector('dialog')).toBeNull();
});
