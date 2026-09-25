import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { JourneyTest } from '../../resources/admin/src/builder/JourneyTest';
import type { Template } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-only.json';

vi.mock('@renderer/mount', () => ({ mount: ({ anchor }: { anchor: HTMLElement }) => {
  const root = document.createElement('form');
  anchor.append(root);
  return { mounted: true, root, show() {}, showStep(step: number) {
    root.innerHTML = step === 0
      ? '<label>Email address<input type="email" required data-capture-id="n2"></label><label><input type="checkbox" required data-capture-id="n3">Consent</label><button data-action="submit" data-submission="email-signup" type="submit">Sign up</button>'
      : '<h2>Received</h2><button data-action="back" type="button">Back</button>';
  }, close() { root.remove(); } };
} }));

afterEach(cleanup);

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
