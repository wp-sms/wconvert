import { describe, expect, it } from 'vitest';
import { render } from '@renderer/render';
import type { CodeNode, TemplateTree } from '@renderer/types';

/**
 * A code's apply link (ADR 0152): drawn as the button anchor is, only where
 * its address is safe, with or without the copy button.
 */
const draw = (code: Omit<CodeNode, 'type'>): Element =>
  render({ v: 2, steps: [{ id: 'screen', name: 'Offer', kind: 'content', content: { type: 'code', ...code } }], submissions: [] } as TemplateTree, {});

describe('the code link', () => {
  it('draws a link that applies the code, beside the code and after its copy button', () => {
    const root = draw({ text: 'BF30', copy: true, apply_label: 'Apply BF30', apply_href: '?coupon=BF30' });
    const link = root.querySelector<HTMLAnchorElement>('a.wc-button');

    expect(link?.textContent).toBe('Apply BF30');
    expect(link?.getAttribute('href')).toBe('?coupon=BF30');
    expect(link?.previousElementSibling?.getAttribute('role')).toBe('status');
    expect(root.querySelector('.wc-code')?.textContent).toBe('BF30');
  });

  it('draws it without the copy button, with an English default for an empty label', () => {
    const root = draw({ text: 'SAVE10', apply_href: 'https://shop.example/checkout/?discount=SAVE10' });

    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('a.wc-button')?.textContent).toBe('Apply code');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', ''])('draws no link for %j', (href) => {
    const root = draw({ text: 'BF30', apply_label: 'Apply', apply_href: href });

    expect(root.querySelector('a')).toBeNull();
    expect(root.querySelector('.wc-code')?.textContent).toBe('BF30');
  });
});
