import { describe, expect, it, vi } from 'vitest';
import { previewResult } from '../../tools/design-library/preview/results';
import type { ResultVariant } from '../../resources/renderer/src/types';

describe('studio product results', () => {
  it('shows inert sample products for an unconfigured required result, without making a request', () => {
    const request = vi.spyOn(globalThis, 'fetch');
    const root = document.createElement('div');
    root.innerHTML = '<div data-result-products></div>';
    previewResult(root, { id: 'coffee', heading: 'Your starting point' } as ResultVariant, true);
    expect(root.textContent).toContain('Sample products');
    expect(root.textContent).toContain('Current store price');
    expect(root.querySelectorAll('.wc-button')).toHaveLength(2);
    expect(root.querySelector('a,button,img')).toBeNull();
    expect(request).not.toHaveBeenCalled();
    previewResult(root, { id: 'guide', heading: 'A guide' } as ResultVariant);
    expect(root.querySelector('[data-result-products]')?.childElementCount).toBe(0);
    request.mockRestore();
  });
});
