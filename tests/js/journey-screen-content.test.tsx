import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { JourneyScreenContent } from '../../resources/admin/src/builder/JourneyScreenContent';
import { addGraphScreen } from '../../resources/admin/src/builder/structure/graphInsertion';
import { graphTrace } from '../../resources/loader/src/journey-graph';
import fixture from '../fixtures/journey-graph-enquiry.json';
const tree = fixture as unknown as TemplateTree;
afterEach(cleanup);
it('edits split-layout copy in place without changing IDs, field ownership, tokens or button actions', async () => {
  const input: TemplateTree = { ...tree, steps: [{ ...tree.steps[0], content: { type: 'split', start: [{ type: 'heading', id: 'n101', text: 'Hello', tokens: { fg: '#123456' } }], end: [{ type: 'text', id: 'n102', text: 'Tell us more' }, { type: 'button', id: 'n103', label: 'Send', action: 'submit', submission: 'enquiry' }] } }, ...tree.steps.slice(1)] };
  function Harness() { const [value, update] = useState(input); return <><JourneyScreenContent tree={value} step={0} onChange={update}/><output data-testid="tree">{JSON.stringify(value)}</output></>; }
  render(<Harness/>); const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Heading')); await user.type(screen.getByLabelText('Heading'), 'Your request');
  await user.clear(screen.getByLabelText('Button text')); await user.type(screen.getByLabelText('Button text'), 'Send request');
  const changed = JSON.parse(screen.getByTestId('tree').textContent!) as TemplateTree;
  expect(changed.steps[0].content).toMatchObject({ start: [{ id: 'n101', text: 'Your request', tokens: { fg: '#123456' } }], end: [{ id: 'n102', text: 'Tell us more' }, { id: 'n103', label: 'Send request', action: 'submit', submission: 'enquiry' }] });
  expect(changed.graph).toEqual(input.graph); expect(changed.submissions).toEqual(input.submissions);
});
it('does not flatten messages containing formatted slots into plain copy', () => {
  const input: TemplateTree = { ...tree, steps: [{ ...tree.steps[0], content: { type: 'text', text: 'Read %l', link: { label: 'our guide', href: '/guide/' } } }] };
  render(<JourneyScreenContent tree={input} step={0} onChange={() => {}}/>);
  expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  expect(screen.getByText(/contains formatted text or links/)).toBeInTheDocument();
});
it('never shows a link placeholder as text to edit', () => {
  // The renderer's link mark is %s; a raw "%s" in a text box reads as a bug.
  const input: TemplateTree = { ...tree, steps: [{ ...tree.steps[0], content: { type: 'text', text: 'Unsubscribe any time. %s', link: { label: 'Privacy', href: '/privacy/' } } }] };
  render(<JourneyScreenContent tree={input} step={0} onChange={() => {}}/>);
  expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  expect(screen.getByText(/contains formatted text or links/)).toBeInTheDocument();
});

it('inserts a conditional message without forcing a question or interrupting the shared enquiry', () => {
  const next = addGraphScreen(tree, 'edge:start', 'content', { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['garden'] }] }, true);
  const added = next.steps.at(-1)!;
  expect(added.kind).toBe('content');
  expect(next.graph!.edges.find(edge => edge.from === added.id && edge.kind === 'hidden')).toBeDefined();
  expect(graphTrace(next.steps, next.graph!, { n1: ['garden'] }).indices).toContain(next.steps.length - 1);
  expect(graphTrace(next.steps, next.graph!, { n1: ['balcony'] }).indices).not.toContain(next.steps.length - 1);
  expect(next.submissions).toEqual(tree.submissions);
});

it('omits hidden copy from the quick content editor', () => {
  const input: TemplateTree = { ...tree, steps: [{ ...tree.steps[0], content: { type: 'stack', children: [
    { type: 'stack', children: [{ type: 'heading', hidden: true, text: 'Hidden heading' }] },
    { type: 'text', hidden: true, text: 'Hidden message' },
    { type: 'text', text: 'Visible message' },
  ] } }] };
  render(<JourneyScreenContent tree={input} step={0} onChange={() => {}}/>);
  expect(screen.queryByLabelText('Heading')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Button text')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Visible message');
});
