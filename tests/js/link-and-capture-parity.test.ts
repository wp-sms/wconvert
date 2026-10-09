import { describe, expect, it } from 'vitest';
import rules from '../fixtures/link-and-capture-rules.json';
import { withPolicyLink } from '../../resources/admin/src/builder/policy';
import { problemsIn } from '../../resources/admin/src/builder/structure/problems';
import { captureModeOf } from '../../resources/admin/src/builder/captureMode';
import { treeFixture } from './support/journey';
import type { Template, TemplateNode } from '@renderer/types';

/**
 * The admin's half of three rules the server also spells (ADR 0133).
 * `tests/unit/Template/LinkAndCaptureParityTest.php` reads the same fixture.
 */
const design = (node: unknown): Template => ({
  tree: treeFixture({ steps: [{ type: 'stack', children: [node, { type: 'button', action: 'link', href: 'https://example.test/', label: 'Go' }] }] }),
  tokens: {},
}) as unknown as Template;

describe('links and where leads go, as the server reads them', () => {
  it.each(rules.links)('$why', ({ node, resolved, unfinished }) => {
    const tree = withPolicyLink(design(node).tree, rules.policy);
    const drawn = (tree.steps[0].content as unknown as { children: TemplateNode[] }).children[0] as { link?: { href?: string } };
    expect(drawn.link?.href ?? null).toBe(resolved);
    expect(problemsIn(design(node), undefined).some(problem => problem.said.startsWith('Add a web address'))).toBe(unfinished);
  });

  it.each(rules.captureModes)('$why', ({ config, mode }) => {
    expect(captureModeOf(config)).toBe(mode);
  });
});
