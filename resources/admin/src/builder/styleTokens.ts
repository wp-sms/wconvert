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
export function styleTokens(template: Template, path: Path | null) {
  if (path === null) return TOKENS;
  const used = new Set<string>();
  const collect = (node: TemplateNode) => {
    const definition = LEAVES[node.type] ?? LAYOUTS[node.type];
    for (const name of definition?.style_tokens ?? []) used.add(name);
    for (const key of childKeysOf(node.type)) {
      const children = (node as Record<string, unknown>)[key];
      if (Array.isArray(children)) children.forEach((child: TemplateNode) => collect(child));
    }
  };
  const node = nodeAt(template.tree, path);
  if (node !== null) collect(node);
  return TOKENS.filter((token) => used.has(token.name));
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
