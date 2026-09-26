import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { JourneyTest } from '../../resources/admin/src/builder/JourneyTest';
import type { Template } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-only.json';
import graphFixture from '../fixtures/journey-graph.json';

vi.mock('@renderer/mount', () => ({ mount: ({ anchor, template }: { anchor: HTMLElement; template: Template }) => {
  const root = document.createElement('form');
  anchor.append(root);
  return { mounted: true, root, show() {}, showStep(step: number) {
    root.innerHTML = step === 0
      ? `${template.tree.steps[0].name === 'Combined save' ? '<label>Optional note<textarea data-question-id="optional-note"></textarea></label>' : ''}${template.tree.steps[0].name === 'Choice save' ? '<label><input type="checkbox" data-question-id="interest-question" value="second">Balcony</label>' : ''}<label>Email address<input type="email" required data-capture-id="n2"></label><label><input type="checkbox" required data-capture-id="n3">Consent</label><button data-action="submit" data-submission="email-signup" type="submit">Sign up</button>`
      : '<h2>Received</h2><button data-action="back" type="button">Back</button>';
  }, close() { root.remove(); } };
} }));

afterEach(cleanup);

it('shows merchant-facing choice labels in the accepted snapshot', async () => {
  const user = userEvent.setup();
  const first = source.tree.steps[0];
  const template = { ...source, tree: { ...source.tree, steps: [{ ...first, name: 'Choice save', content: {
    ...first.content, children: [...first.content.children,
      { type: 'question', id: 'interest-question', label: 'Your interests', answer_type: 'multi', required: false,
        options: [{ value: 'first', label: 'Garden' }, { value: 'second', label: 'Balcony' }] }],
  } }, ...source.tree.steps.slice(1)] } } as unknown as Template;
  render(<JourneyTest template={template} onEdit={() => {}} />);
  await user.click(screen.getByLabelText('Balcony'));
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  await user.click(screen.getByText('Review accepted snapshot'));
  expect(screen.getByText('Balcony')).toBeInTheDocument();
  expect(screen.queryByText('second')).not.toBeInTheDocument();
});

it('keeps typed details when failure is toggled, then accepts a retry without sending data', async () => {
  const user = userEvent.setup();
  render(<JourneyTest template={source as Template} onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate failure on next submission' }));
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Draft only')).toBeInTheDocument();
  expect(screen.getByText(/Submission not confirmed/)).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Received' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset test' }));
  expect(screen.getByText('Not reached')).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('');
});

it('starts a graph test at its entry screen and resets to that entry', async () => {
  const user = userEvent.setup();
  const template = { tree: { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] }, tokens: {} } as unknown as Template;
  render(<JourneyTest template={template} onEdit={() => {}} />);
  expect(screen.getByText('Interests').closest('li')).toHaveAttribute('data-current', 'true');
  expect(screen.getByText('One enquiry').closest('li')).toHaveAttribute('data-current', 'false');
  await user.click(screen.getByText('Why this path?'));
  expect(screen.getByText(/Garden details → Indoor details: Hidden because What interests you\? includes any of Garden did not match/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset test' }));
  expect(screen.getByText('Interests').closest('li')).toHaveAttribute('data-current', 'true');
});

it('separates an accepted save from failed destination delivery and retries delivery only', async () => {
  const user = userEvent.setup();
  render(<JourneyTest template={source as Template} deliveryMode="connected" destinationSummary="MailPoet" onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate delivery failure after next accepted save' }));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  expect(screen.getByText(/Destination delivery failed in this simulation/)).toBeInTheDocument();
  expect(screen.getByText(/Destination setup: MailPoet/)).toBeInTheDocument();
  await user.click(screen.getByText('Review accepted snapshot'));
  expect(screen.getByText('visitor@example.com')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Simulate delivery retry' }));
  expect(screen.getByText('Destination delivery is queued in this simulation.')).toBeInTheDocument();
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
});

it('retains an answer on the capture screen after a simulated save failure', async () => {
  const user = userEvent.setup();
  const first = source.tree.steps[0];
  const template = { ...source, tree: { ...source.tree, steps: [{ ...first, name: 'Combined save', content: {
    ...first.content, children: [...first.content.children,
      { type: 'question', id: 'optional-note', label: 'Optional note', answer_type: 'text', required: false, options: [] }],
  } }, ...source.tree.steps.slice(1)] } } as unknown as Template;
  render(<JourneyTest template={template} onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Optional note'), 'A sunny space');
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate failure on next submission' }));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByLabelText('Optional note')).toHaveValue('A sunny space');
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  await user.click(screen.getByText('Review accepted snapshot'));
  expect(screen.getAllByText('A sunny space').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Optional note')).toHaveValue('A sunny space');
  expect(screen.getByLabelText('Optional note')).toBeDisabled();
});
