import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { render as renderVisitor } from '@renderer/render';
import { answerReview } from '@renderer/answer-review';
import { captureName, setCaptureName } from '../../resources/admin/src/builder/structure/captureDetails';
import { JourneyCaptureSettings } from '../../resources/admin/src/builder/JourneyCaptureSettings';
import fixture from '../fixtures/journey-graph-enquiry.json';
const tree = fixture as unknown as TemplateTree;
afterEach(cleanup);
it('adds an optional name owned by this save, then removes its ownership as one edit', () => {
  const next = setCaptureName(tree, 'contact', true);
  const name = captureName(next, 'contact').node!;
  expect(name).toMatchObject({ type: 'field', name: 'name', required: false });
  expect(next.submissions[0].fields).toContain('id' in name ? name.id : '');
  expect(next.graph).toBe(tree.graph);
  const removed = setCaptureName(next, 'contact', false);
  expect(captureName(removed, 'contact').node).toBeUndefined();
  expect(removed.submissions).toEqual(tree.submissions);
});
it('shows readable earlier answers only, safely as text, and renders the merchant note', () => {
  const updated = { ...tree, steps: tree.steps.map((item, index) => index === 0 ? { ...item, details_note: '<b>We reply to your request</b>' } : item) };
  const root = renderVisitor(updated, {}, 0);
  answerReview(root, [2, 5].flatMap(index => walkNodes(tree.steps[index].content)), { n1: ['garden'], n2: 'small', n3: 'bright' }, 'Review your answers');
  expect(root.querySelector('.wc-answer-review')?.textContent).toContain('Garden size?Small');
  expect(root.querySelector('.wc-answer-review')?.textContent).not.toContain('Indoor light');
  expect(root.querySelector('.wc-capture-note')?.textContent).toBe('<b>We reply to your request</b>');
  expect(root.querySelector('.wc-capture-note b')).toBeNull();
});
it('edits all capture conveniences in the inspector without changing routes or adding another save', async () => {
  const user = userEvent.setup();
  function Harness() { const [draft, update] = useState(tree); return <><JourneyCaptureSettings tree={draft} step={0} onChange={update} /><output data-testid="draft">{JSON.stringify(draft)}</output></>; }
  render(<Harness />);
  await user.click(screen.getByLabelText('Ask for a name (optional)'));
  await user.click(screen.getByLabelText('Let visitors review earlier answers before submitting'));
  await user.type(screen.getByLabelText('How you will use their details'), 'We reply to this request.');
  const next = JSON.parse(screen.getByTestId('draft').textContent!) as TemplateTree;
  expect(next.steps[0]).toMatchObject({ review_answers: true, details_note: 'We reply to this request.' });
  expect(next.graph).toEqual(tree.graph);
  expect(next.submissions).toHaveLength(1);
});

/** The Form section sets Required and opens each field's own panel; a field's words are edited there, once (ADR 0134). */
it('switches Required and opens a field’s own panel, preserving save ownership and layout', async () => {
  const user = userEvent.setup();
  const opened = vi.fn();
  function Harness() { const [draft, update] = useState(tree); return <><JourneyCaptureSettings tree={draft} step={0} onChange={update} onSelectField={opened} /><output data-testid="draft">{JSON.stringify(draft)}</output></>; }
  render(<Harness />);
  expect(screen.queryByRole('textbox', { name: 'Field label' })).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Required' }));
  const next = JSON.parse(screen.getByTestId('draft').textContent!) as TemplateTree;
  const field = walkNodes(next.steps[0].content).find(node => node.type === 'field');
  expect(field).toMatchObject({ id: 'n5', name: 'email', required: false });
  expect(next.submissions).toEqual(tree.submissions);
  expect(next.graph).toEqual(tree.graph);
  expect(walkNodes(next.steps[0].content).filter(node => node.type === 'button')).toEqual(walkNodes(tree.steps[0].content).filter(node => node.type === 'button'));
  await user.click(screen.getByRole('button', { name: /Email address/ }));
  expect(opened).toHaveBeenCalledOnce();
});
