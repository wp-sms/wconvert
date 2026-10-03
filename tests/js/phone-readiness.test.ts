import { afterEach, describe, expect, it } from 'vitest';
import { shell } from '@renderer/mount';
import { treeFixture } from './support/journey';
import type { Template } from '@renderer/types';

const template: Template = { tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'field', name: 'phone', phone_country: 'US' }] }] }), tokens: {} };
const api = () => window as Window & { wconvertPhone?: (root: HTMLElement) => void };
const draw = () => {
  const mounted = shell(template, null, { template });
  document.body.appendChild(mounted.host);
  return mounted;
};

afterEach(() => { delete api().wconvertPhone; document.body.innerHTML = ''; });

describe('phone asset readiness', () => {
  it('upgrades an untouched field when the optional asset arrives late', () => {
    const mounted = draw();
    let called = 0;
    api().wconvertPhone = root => { expect(root).toBe(mounted.root); called++; };
    window.dispatchEvent(new Event('wconvert:phone-ready'));
    expect(called).toBe(1);
  });

  it('does not reinterpret a field the visitor focused or edited', () => {
    const typed = draw();
    typed.root.querySelector<HTMLInputElement>('input[name="phone"]')!.value = '202';
    const focused = draw();
    focused.root.querySelector<HTMLInputElement>('input[name="phone"]')!.focus();
    let called = 0;
    api().wconvertPhone = () => { called++; };
    window.dispatchEvent(new Event('wconvert:phone-ready'));
    expect(called).toBe(0);
  });

  it('releases a late-asset listener when a screen closes', () => {
    const mounted = draw();
    mounted.stop();
    let called = 0;
    api().wconvertPhone = () => { called++; };
    window.dispatchEvent(new Event('wconvert:phone-ready'));
    expect(called).toBe(0);
  });
});
