import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Template, TemplateTree } from '@renderer/types';
import coffee from '../fixtures/journey-graph-coffee.json';
import split from '../fixtures/journey-graph-split-capture.json';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { captureOwnership, withCaptureOwner } from '../../resources/admin/src/builder/structure/captureOwnership';
import { captureReadiness } from '../../resources/admin/src/builder/structure/captureReadiness';
import { CaptureOwnership } from '../../resources/admin/src/builder/CaptureOwnership';
import { BlockInspector } from '../../resources/admin/src/builder/BlockInspector';
import { nodesOf, nodeAt, withRemoved } from '../../resources/admin/src/builder/structure/tree';
import { withValue } from '../../resources/admin/src/builder/panel';

const template = () => structuredClone(coffee.template) as Template;
const pathOf = (tree: TemplateTree, id: string) => nodesOf(tree).find(block => {
  const node = nodeAt(tree, block.path); return node && 'id' in node && node.id === id;
})!.path;

describe('explicit capture ownership', () => {
  it('opens Content for a new repair request while ordinary edits retain Style', async () => {
    const current = template();
    const path = pathOf(current.tree, 'n22');
    const labels = { roles: {}, nodes: { consent: 'Consent' }, layouts: {}, layoutNotes: {}, layoutParams: {}, layoutParamValues: {}, nodeParams: {}, nodeParamValues: {}, fields: {}, placeholders: {}, keys: {}, params: {}, tokens: {}, tokenValues: {} };
    const props = { template: current, path, labels, act: 'match' as const, onChange: () => {}, onSwap: () => {}, look: <p>Appearance controls</p> };
    const { rerender } = render(<BlockInspector {...props} revealContent={null} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Style' }));
    rerender(<BlockInspector {...props} template={{ ...current, tokens: { ...current.tokens, bg: '#ffffff' } }} revealContent={null} />);
    expect(screen.getByRole('tab', { name: 'Style' })).toHaveAttribute('aria-selected', 'true');
    rerender(<BlockInspector {...props} revealContent={{ path }} />);
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Saved with' })).toBeVisible();
  });
  it('repairs an unowned field without changing paths, identities or other capture settings', () => {
    const tree = structuredClone(split) as TemplateTree;
    const missing = { ...tree, submissions: tree.submissions.map(save => ({ ...save, fields: [] })) };
    const path = pathOf(missing, 'n1');
    const repaired = withCaptureOwner(missing, path, 'enquiry');
    expect(repaired).toEqual(tree);
    expect(repaired.graph).toBe(missing.graph);
    expect(repaired.steps).toBe(missing.steps);
    expect(withCaptureOwner(missing, path, 'missing')).toBe(missing);
  });

  it('refuses branch-only capture ownership rather than silently accepting incomplete paths', () => {
    const tree = structuredClone(split) as TemplateTree;
    const path = pathOf(tree, 'n1');
    const source = tree.steps[Number(path[0])];
    const conditional = { ...tree, steps: tree.steps.map(step => step.id === source.id ? { ...step, when: { match: 'all' as const, clauses: [] } } : step) };
    expect(captureOwnership(conditional, path)?.choices[0].reason).toMatch(/Every path/);
    expect(withCaptureOwner(conditional, path, 'enquiry')).toBe(conditional);
  });

  it('removes deleted subtree references without dropping ownership elsewhere', () => {
    const { tree } = template();
    const path = pathOf(tree, 'n22');
    const removed = withRemoved(tree, path);
    expect(removed.submissions[0].consents).toEqual([]);
    expect(removed.submissions[0].fields).toEqual(tree.submissions[0].fields);
    expect(tree.submissions[0].consents).toEqual(['n22']);
  });

  it('lets merchants assign and unassign consent through a named save point', async () => {
    const { tree } = template();
    const path = pathOf(tree, 'n22');
    function Editor() {
      const [draft, setDraft] = useState<TemplateTree>({ ...tree, submissions: tree.submissions.map(save => ({ ...save, consents: [] })) });
      return <><CaptureOwnership tree={draft} path={path} onChange={setDraft} /><output aria-label="Accepted consent">{draft.submissions[0].consents.join(',')}</output></>;
    }
    render(<Editor />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Saved with' }), 'coffee-signup');
    expect(screen.getByLabelText('Accepted consent')).toHaveTextContent('n22');
    expect(screen.getByRole('combobox', { name: 'Saved with' })).toHaveValue('coffee-signup');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Saved with' }), '');
    expect(screen.getByLabelText('Accepted consent')).toBeEmptyDOMElement();
  });
});

describe('capture review repairs', () => {
  it('checks SMS consent and contact separately from an accepted email signup', () => {
    const current: Template = { ...progressive, tree: upgradeToGraph(progressive.tree as TemplateTree) };
    expect(captureReadiness(current, 'email')).toEqual([]);
    const phone = nodesOf(current.tree).find(block => block.captures === 'phone')!;
    const missing = { ...current, tree: withValue(current.tree, phone.path, 'required', false) };
    expect(captureReadiness(missing, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Require a phone field/), path: phone.path }));
    expect(captureReadiness(missing, 'email').some(issue => /Require an email field/.test(issue.said))).toBe(false);
    const firstConsent = pathOf(current.tree, current.tree.submissions[0].consents[0]);
    expect(captureOwnership(current.tree, firstConsent)?.choices[1].reason).toMatch(/already has a consent/);
    expect(withCaptureOwner(current.tree, firstConsent, current.tree.submissions[1].id)).toBe(current.tree);
  });
  it('accepts the complete coffee journey and request-only split capture', () => {
    expect(captureReadiness(template(), 'email')).toEqual([]);
    expect(captureReadiness({ tree: split as TemplateTree, tokens: {} }, null)).toEqual([]);
  });
  it('names and locates blank, hidden and unassigned consent', () => {
    const current = template();
    const path = pathOf(current.tree, 'n22');
    expect(captureReadiness({ ...current, tree: withValue(current.tree, path, 'text', '') }, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Write the consent wording/), path, blocksPublish: true }));
    expect(captureReadiness({ ...current, tree: withValue(current.tree, path, 'hidden', true) }, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Show the consent checkbox/), path }));
    const unowned = { ...current, tree: withCaptureOwner(current.tree, path, '') };
    expect(captureReadiness(unowned, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Assign the consent checkbox/), path }));
    expect(captureReadiness(unowned, 'email').filter(issue => /Saved with/.test(issue.said))).toHaveLength(1);
  });
  it('links a missing skip button to the exact optional signup screen', () => {
    const current = template();
    const skip = nodesOf(current.tree).find(block => block.action === 'skip')!;
    expect(captureReadiness({ ...current, tree: withRemoved(current.tree, skip.path) }, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Add a No thanks button to “Optional email signup”/), path: [skip.path[0]] }));
  });
  it('points at a conflicting Continue and a skip assigned to an unknown save', () => {
    const current = template();
    const skip = nodesOf(current.tree).find(block => block.action === 'skip')!;
    expect(captureReadiness({ ...current, tree: withValue(current.tree, skip.path, 'action', 'next') }, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/both Continue and Save/), path: skip.path }));
    expect(captureReadiness({ ...current, tree: withValue(current.tree, skip.path, 'submission', 'missing') }, 'email')).toContainEqual(expect.objectContaining({ said: expect.stringMatching(/Choose a valid save point/), path: skip.path }));
  });
});
