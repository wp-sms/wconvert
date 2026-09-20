import schema from '../static-blocks.json';
import type { BlockInstance } from '@wordpress/blocks';
export const LOCK_BLOCK = 'wconvert/content-lock';
export const DIVIDER_BLOCK = 'wconvert/content-lock-divider';
export const ALLOWED_BLOCKS = schema.top;
const children: Record<string, readonly string[]> = schema.children;

/** Validate the whole subtree; direct-child inserter restrictions are insufficient. */
export function supportedContent(blocks: BlockInstance[], allowed: readonly string[] = ALLOWED_BLOCKS, allowEditingLocks = false): boolean {
  return blocks.every(block => block.isValid !== false && allowed.includes(block.name)
    && (allowEditingLocks || !block.attributes.lock)
    && !(block.attributes.metadata && typeof block.attributes.metadata === 'object' && 'bindings' in block.attributes.metadata && Object.keys(block.attributes.metadata.bindings as object ?? {}).length)
    && supportedContent(block.innerBlocks, children[block.name] ?? [], allowEditingLocks));
}
export function lockCount(blocks: BlockInstance[]): number {
  return blocks.reduce((count, block) => count + Number(block.name === LOCK_BLOCK || block.name === DIVIDER_BLOCK) + lockCount(block.innerBlocks), 0);
}
