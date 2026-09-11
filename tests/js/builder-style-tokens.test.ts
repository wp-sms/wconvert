import { describe, expect, it } from 'vitest';
import { styleTokens, inheritedStyle } from '../../resources/admin/src/builder/styleTokens';
import { scopeChainOf } from '../../resources/admin/src/builder/panel';
import type { Template } from '@renderer/types';
import { urlIn } from '../../resources/admin/src/builder/themes';

const template: Template = {
  tokens: { fg: '#111', 'heading-size': '2rem' },
  tree: { steps: [{ type: 'stack', narrow: { fg: '#222' }, children: [
    { type: 'heading', text: 'Title', tokens: { 'heading-size': '3rem' }, narrow: { 'heading-size': '1.5rem' } },
    { type: 'field', name: 'email', label: 'Email', placeholder: '', required: true },
  ] }] },
};

describe('contextual appearance', () => {
  it('recognizes the embedded SVG image without mistaking its inner quotes for the URL delimiter', () => {
    const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";
    expect(urlIn(`url("${image}")`)).toBe(image);
    expect(urlIn('linear-gradient(#fff,#000)')).toBeNull();
  });

  it('offers heading controls without image, form, or container controls', () => {
    const names = styleTokens(template, [0, 'children', 0]).map(token => token.name);
    expect(names).toContain('heading-size');
    expect(names).toContain('fg');
    expect(names).not.toContain('input-bg');
    expect(names).not.toContain('bg-image');
    expect(names).not.toContain('pad');
  });

  it('includes descendant controls when editing a layout', () => {
    const names = styleTokens(template, [0]).map(token => token.name);
    expect(names).toContain('heading-size');
    expect(names).toContain('input-bg');
  });

  it('clearing a mobile override follows the same element’s desktop value', () => {
    const chain = scopeChainOf(template.tree, [0, 'children', 0]);
    expect(inheritedStyle(chain, template, 'heading-size', 'narrow')).toBe('3rem');
    expect(inheritedStyle(chain, template, 'heading-size', 'tokens')).toBe('2rem');
    expect(inheritedStyle(chain, template, 'fg', 'narrow')).toBe('#222');
  });
});
