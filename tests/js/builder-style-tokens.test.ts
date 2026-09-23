import { treeFixture } from './support/journey';
import { describe, expect, it } from 'vitest';
import { styleTokens, styleGroups, inheritedStyle } from '../../resources/admin/src/builder/styleTokens';
import { scopeChainOf } from '../../resources/admin/src/builder/panel';
import type { Template } from '@renderer/types';
import { urlIn } from '../../resources/admin/src/builder/themes';

const template: Template = {
  tokens: { fg: '#111', 'heading-size': '2rem' },
  tree: treeFixture({ steps: [{ type: 'stack', narrow: { fg: '#222' }, children: [
    { type: 'heading', text: 'Title', tokens: { 'heading-size': '3rem' }, narrow: { 'heading-size': '1.5rem' } },
    { type: 'field', name: 'email', label: 'Email', placeholder: '', required: true },
  ] }] }),
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


describe('picture controls follow the content without discarding values', () => {
  const hasFocus = (value: Template, path: (string | number)[] | null, width: 'tokens' | 'narrow' = 'tokens') =>
    styleTokens(value, path, width).some(token => token.name === 'image-position');

  it('hides focus on empty and gradient-only designs, preserving the saved crop', () => {
    const value: Template = { ...template, tokens: { 'image-position': '80% 20%', 'bg-image': 'linear-gradient(red, blue)' } };
    const before = JSON.stringify(value);
    expect(hasFocus(value, null)).toBe(false);
    expect(hasFocus(value, [0])).toBe(false);
    expect(JSON.stringify(value)).toBe(before);
    expect(hasFocus({ ...value, tokens: { ...value.tokens, 'bg-image': 'url(photo.jpg)' } }, null)).toBe(true);
  });

  it('offers focus for descendant photos and hides it when their source is cleared', () => {
    const value: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'image', src: '/photo.jpg', alt: '' }] }] }) };
    expect(hasFocus(value, null)).toBe(true);
    expect(hasFocus(value, [0])).toBe(true);
    expect(hasFocus(value, [0, 'children', 0])).toBe(true);
    const empty: Template = { ...value, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'image', src: '', alt: '' }] }] }) };
    expect(hasFocus(empty, [0])).toBe(false);
  });

  it('matches the renderer’s background reset and mobile override', () => {
    const value: Template = { tokens: { 'bg-image': 'url(global.jpg)' }, tree: treeFixture({ steps: [{ type: 'media', children: [], narrow: { 'bg-image': 'url(mobile.jpg)' } }] }) };
    expect(hasFocus(value, null)).toBe(true);
    expect(hasFocus(value, [0])).toBe(false);
    expect(hasFocus(value, [0], 'narrow')).toBe(true);
    const onlyMobile: Template = { ...value, tokens: {} };
    expect(hasFocus(onlyMobile, null)).toBe(true);
    const hiddenOnMobile: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'panel', children: [], tokens: { 'bg-image': 'url(photo.jpg)' }, narrow: { 'bg-image': 'none' } }] }) };
    expect(hasFocus(hiddenOnMobile, [0])).toBe(true);
    expect(hasFocus(hiddenOnMobile, [0], 'narrow')).toBe(false);
  });

  it('keeps focus available for custom CSS image expressions', () => {
    expect(hasFocus({ ...template, tokens: { 'bg-image': 'var(--brand-art)' } }, null)).toBe(true);
  });
});


describe('field order stays useful and stable', () => {
  it.each([
    ['heading', ['heading', 'space', 'color']],
    ['text', ['type', 'space', 'color']],
    ['button', ['color', 'type', 'space']],
    ['field', ['color', 'type', 'space']],
  ])('puts the everyday settings first for %s', (type, expected) => {
    const value: Template = { tokens: {}, tree: treeFixture({ steps: [{ type }] }) };
    expect(styleGroups(value, [0], 'tokens').map(group => group.id)).toEqual(expected);
  });

  it('keeps section order while adding, removing or changing a box’s background picture', () => {
    const empty: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'panel', children: [] }] }) };
    const photo: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'panel', tokens: { 'bg-image': 'url(photo.jpg)' }, children: [] }] }) };
    const ids = (value: Template) => styleGroups(value, [0], 'tokens').map(group => group.id);
    expect(ids(empty)).toEqual(['space', 'color', 'image']);
    expect(ids(photo)).toEqual(ids(empty));
  });
});
