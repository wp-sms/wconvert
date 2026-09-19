import {
  childKeysOf,
  LEAVES,
  LAYOUTS,
  TOKENS,
  sourceOfToken,
  type Path,
  type Scope,
  type WidthBag,
} from './panel';
import { nodeAt } from './structure/tree';
import type { Template, TemplateNode } from '@renderer/types';

/** Controls follow the token readers declared by the selected content. */
export function styleTokens(template: Template, path: Path | null, width: WidthBag = 'tokens') {
  const used = new Set<string>();
  const collect = (node: TemplateNode) => {
    const definition = LEAVES[node.type] ?? LAYOUTS[node.type];
    for (const name of definition?.style_tokens ?? []) used.add(name);
    for (const key of childKeysOf(node.type)) {
      const children = (node as Record<string, unknown>)[key];
      if (Array.isArray(children)) children.forEach((child: TemplateNode) => collect(child));
    }
  };
  const node = path === null ? null : nodeAt(template.tree, path);
  if (node !== null) collect(node);
  const focus = hasPicture(template, path, width) || (path === null && hasPicture(template, null, 'narrow'));
  return TOKENS.filter(token => (path === null || used.has(token.name)) && (token.name !== 'image-position' || focus));
}

/** Clearing mobile means the same node's desktop value, then its ancestors. */
export function inheritedStyle(chain: readonly Scope[], template: Template, name: string, width: WidthBag) {
  const without = chain.map((scope, index) => {
    if (index !== chain.length - 1) return scope;
    const bag = { ...scope[width] };
    delete bag[name];
    return { ...scope, [width]: bag };
  });
  return sourceOfToken(without, template.tokens, name, width).value;
}

/** Background-painting boxes reset the inherited photograph in the renderer.
 * Keep unknown CSS image expressions editable; only known empty/gradient-only
 * backgrounds have no useful focal point. Hidden values are never removed.
 */
function hasPicture(template: Template, path: Path | null, width: WidthBag): boolean {
  const picture = (value: string | undefined) => {
    const held = value?.trim() ?? '';
    if (['', 'none', 'initial', 'unset'].includes(held)) return false;
    return !/gradient\(/i.test(held) || /(?:url|image-set|var|image|cross-fade)\(/i.test(held);
  };
  const painted = (node: TemplateNode): boolean => {
    if (node.type === 'image' && 'src' in node && typeof node.src === 'string' && node.src.trim() !== '') return true;
    if (node.type === 'panel' || node.type === 'media') {
      const wide = 'tokens' in node ? node.tokens?.['bg-image'] : undefined;
      const narrow = 'narrow' in node ? node.narrow?.['bg-image'] : undefined;
      const background = width === 'narrow' ? narrow ?? wide : wide;
      if (picture(background)) return true;
    }
    return childKeysOf(node.type).some(key => {
      const children = (node as Record<string, unknown>)[key];
      return Array.isArray(children) && children.some((child: TemplateNode) => painted(child));
    });
  };
  if (path === null) return picture(template.tokens['bg-image']) || template.tree.steps.some(painted);
  const node = nodeAt(template.tree, path);
  if (node === null) return false;
  // An image's own source is independent of background inheritance.
  return painted(node);
}
