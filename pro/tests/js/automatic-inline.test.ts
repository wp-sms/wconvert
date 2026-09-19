import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectAutomatic, showAutomatic } from '../../modules/inline-placement/loader';
import type { PayloadEntry } from '@loader/types';

const entry = (id: string, priority = 0): PayloadEntry => ({ id, display_type: 'inline', priority,
  triggers: [{ type: 'page_load' }], conditions: [], template: { tokens: {}, tree: { steps: [{ type: 'stack', children: [] }] } },
  ...{ inline_placement: { position: 'after_content' } },
});
afterEach(() => { document.body.innerHTML = ''; });

describe('automatic inline placement', () => {
  it('chooses only the highest priority usable ready candidate and leaves manual forms alone', () => {
    document.body.innerHTML = '<div hidden data-wconvert-auto="a"></div><div hidden data-wconvert-auto="b"></div><div data-wconvert-optin="manual"></div>';
    const manual = { ...entry('manual'), inline_placement: undefined };
    expect(selectAutomatic([entry('a'), entry('b', 10), manual]).map(e => e.id)).toEqual(['b', 'manual']);
    expect(selectAutomatic([entry('missing', 99), entry('a')]).map(e => e.id)).toEqual(['a']);
  });

  it('prefers an explicit manual location and reuses the existing presenter', () => {
    document.body.innerHTML = '<div hidden data-wconvert-auto="a"></div><div data-wconvert-optin="a"></div>';
    const base = { show: vi.fn() };
    const controls = { impression: vi.fn(), convert: vi.fn(), dismiss: vi.fn() };
    showAutomatic(entry('a'), controls, base);
    expect(base.show).toHaveBeenCalledWith(entry('a'), controls);
    expect(document.querySelector('[data-wconvert-auto]')).not.toHaveAttribute('data-wconvert-optin');
  });

  it('keeps losers hidden, restores failed mounts and never replaces a mounted winner', () => {
    document.body.innerHTML = '<div hidden data-wconvert-auto="a"></div><div hidden data-wconvert-auto="b"></div>';
    const controls = { impression: vi.fn(), convert: vi.fn(), dismiss: vi.fn() };
    showAutomatic(entry('a'), controls, { show() {} });
    expect(document.querySelector('[data-wconvert-auto="a"]')).not.toHaveAttribute('data-wconvert-optin');
    showAutomatic(entry('a'), controls, { show() {
      document.querySelector('[data-wconvert-optin="a"]')!.append(document.createElement('div'));
    } });
    expect(document.querySelector('[data-wconvert-auto="a"]')).not.toHaveAttribute('hidden');
    expect(selectAutomatic([entry('b', 100)])).toEqual([]);
  });
});
