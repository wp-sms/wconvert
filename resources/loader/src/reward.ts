import type { TemplateTree } from '@renderer/types';
import { journeyNodes } from './journey-nodes';

export type Reward = Record<string, ({ text?: string; apply_href?: string; href?: string } | null)[]>;

/**
 * The codes and resource links the page held back, filled into the tree the
 * mount draws from (ADR 0164). One entry per `code` and `followup` on a held
 * step, in tree order; `null`, or no reward at all, leaves the node hidden.
 */
export function fillReward(tree: TemplateTree, reward: Reward = {}): void {
  for (const step of tree.steps) journeyNodes(step.content).filter(node => node.type === 'code' || node.type === 'followup')
    .forEach((node, i) => { const value = reward[step.id]?.[i]; if (value) Object.assign(node, value, { hidden: false }); });
}
