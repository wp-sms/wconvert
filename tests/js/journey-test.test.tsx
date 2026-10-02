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
    root.innerHTML = template.tree.steps[step].kind === 'result'
      ? '<h2 data-result-heading>Default result</h2><p data-result-body></p><a data-result-link href="https://example.test/stale">Default link</a>'
      : step === 0
      ? `${template.tree.steps[0].name === 'Combined save' ? '<label>Optional note<textarea data-question-id="optional-note"></textarea></label>' : ''}${template.tree.steps[0].name === 'Choice save' ? '<label><input type="checkbox" data-question-id="interest-question" value="second">Balcony</label>' : ''}<label>Email address<input type="email" required data-capture-id="n2"></label><label><input type="checkbox" required data-capture-id="n3">Consent</label><button data-action="submit" data-submission="email-signup" type="submit">Sign up</button>`
      : '<h2>Received</h2><button data-action="back" type="button">Back</button>';
  }, close() { root.remove(); } };
} }));

afterEach(cleanup);

it('shows the selected result link in the visitor test and hides it when absent', () => {
  const result = { id: 'default', heading: 'Your guide', body: 'A useful next step.', href: 'https://example.test/guide', link_label: 'Read your guide' };
  const template: Template = { tokens: {}, tree: { v: 2, submissions: [], steps: [{ id: 'result', name: 'Your result', kind: 'result',
    content: { type: 'stack', children: [] }, results: [result] }] } };
  const view = render(<JourneyTest template={template} onEdit={() => {}} />);
  expect(screen.getByRole('link', { name: 'Read your guide' })).toHaveAttribute('href', result.href);
  view.rerender(<JourneyTest template={{ ...template, tree: { ...template.tree, steps: [{ ...template.tree.steps[0],
    results: [{ ...result, href: '', link_label: '' }] }] } }} onEdit={() => {}} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-result-link]')).not.toHaveAttribute('href');
});

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
  await user.click(screen.getByText('Submitted answers'));
  expect(screen.getByText('Balcony')).toBeInTheDocument();
  expect(screen.queryByText('second')).not.toBeInTheDocument();
});

it('keeps typed details when failure is toggled, then accepts a retry without sending data', async () => {
  const user = userEvent.setup();
  render(<JourneyTest template={source as Template} onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByText('Test a problem'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate failure on next submission' }));
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  expect(screen.getByText(/Submission not confirmed/)).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Received' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Restart this test' }));
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('');
});

it('starts a graph test at its entry screen and resets to that entry', async () => {
  const user = userEvent.setup();
  const template = { tree: { v: 3, steps: graphFixture.steps, graph: graphFixture.graph, submissions: [] }, tokens: {} } as unknown as Template;
  render(<JourneyTest template={template} onEdit={() => {}} />);
  expect(screen.getByText('Interests').closest('li')).toHaveAttribute('data-current', 'true');
  expect(screen.getByText('One enquiry').closest('li')).toHaveAttribute('data-current', 'false');
  expect(screen.queryByText('Why this path?')).not.toBeInTheDocument();
  expect(screen.getByText('Garden details').closest('li')).toHaveTextContent('Not reached yet');
  expect(screen.getByText('Garden details')).not.toBeVisible();
  await user.click(screen.getByText('Other screens'));
  await user.click(screen.getByText(/^Not reached yet \(/));
  expect(screen.getByText('Garden details')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Edit condition' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Restart this test' }));
  expect(screen.getByText('Interests').closest('li')).toHaveAttribute('data-current', 'true');
});

it('separates an accepted save from failed destination delivery and retries delivery only', async () => {
  const user = userEvent.setup();
  render(<JourneyTest template={source as Template} deliveryMode="connected" destinationSummary="MailPoet" onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByText('Test a problem'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate delivery failure after next accepted save' }));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  expect(screen.getByText(/Destination delivery failed in this simulation/)).toBeInTheDocument();
  expect(screen.getByText(/Destination setup: MailPoet/)).toBeInTheDocument();
  await user.click(screen.getByText('Submitted answers'));
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
  await user.click(screen.getByText('Test a problem'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate failure on next submission' }));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByLabelText('Optional note')).toHaveValue('A sunny space');
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  await user.click(screen.getByText('Submitted answers'));
  expect(screen.getAllByText('A sunny space').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Optional note')).toHaveValue('A sunny space');
  expect(screen.getByLabelText('Optional note')).toBeDisabled();
  expect(screen.getByText('Already saved. You can review these details, but cannot change them.')).toBeInTheDocument();
});

it('keeps a malformed imported save on its screen instead of accepting an empty snapshot', async () => {
  const user = userEvent.setup();
  const template = { ...source, tree: { ...source.tree, submissions: source.tree.submissions.map(submission => ({ ...submission, fields: ['missing_contact'] })),
    steps: [{ ...source.tree.steps[0], name: 'Combined save', content: { type: 'stack', children: [source.tree.steps[0].content,
      { type: 'question', id: 'optional-note', label: 'Optional note', answer_type: 'text', required: false, options: [] }], } }, ...source.tree.steps.slice(1)],
  } } as Template;
  render(<JourneyTest template={template} onEdit={() => {}} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.test');
  await user.type(screen.getByLabelText('Optional note'), 'Please keep this draft');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByRole('status')).toHaveTextContent('This save is incomplete or is not on the visited path.');
  expect(screen.getByLabelText('Optional note')).toHaveValue('Please keep this draft');
  expect(screen.queryByText('Accepted in test')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('visitor@example.test');
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
});

it('returns only the path actually visited to the map, before and after a save', async () => {
  const user = userEvent.setup(), show = vi.fn();
  render(<JourneyTest template={source as Template} onEdit={() => {}} onShowPath={show} />);
  expect(screen.queryByRole('button', { name: 'Show this path on the map' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  await user.click(screen.getByRole('button', { name: 'Show this path on the map' }));
  expect(show.mock.lastCall?.[0]).toEqual([0, 1]);
  expect(show.mock.lastCall?.[1]).toHaveLength(1);
});


it('keeps skipped-condition repairs available inside the collapsed summary', async () => {
  const user = userEvent.setup();
  const edit = vi.fn();
  const template = { ...source, tree: { ...source.tree, steps: [source.tree.steps[0], {
    id: 'conditional', name: 'Extra details', kind: 'input', content: { type: 'stack', children: [] },
    when: { match: 'all', clauses: [{ question: 'unanswered', operator: 'is', values: ['yes'] }] },
  }, source.tree.steps[1]] } } as unknown as Template;
  render(<JourneyTest template={template} onEdit={edit} />);
  await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('Edit condition')).not.toBeVisible();
  await user.click(screen.getByText('Skipped screens (1)'));
  await user.click(screen.getByRole('button', { name: 'Edit condition' }));
  expect(edit).toHaveBeenCalledWith(1, 'condition');
});

it('resizes the existing form without losing drafts and counts each completed run once', async () => {
  const user = userEvent.setup();
  render(<JourneyTest template={source as Template} onEdit={() => {}} />);
  const email = screen.getByLabelText('Email address');
  await user.type(email, 'visitor@example.com');
  await user.click(screen.getByRole('button', { name: 'Mobile' }));
  expect(screen.getByLabelText('Email address')).toBe(email);
  expect(email).toHaveValue('visitor@example.com');
  await user.click(screen.getByLabelText('Consent'));
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(screen.getByText('1 completed run this session')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Previous screen' }));
  expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('1 completed run this session')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Restart this test' }));
  expect(screen.getByText('1 completed run this session')).toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('');
});
