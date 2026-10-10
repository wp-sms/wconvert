import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { JourneyTest } from '../../resources/admin/src/builder/JourneyTest';
import { enhancePhones } from '../../resources/phone/src/enhance';
import type { Template, TemplateNode } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-only.json';

const api = () => window as Window & { __wcPhone?: (root: HTMLElement) => void };
afterEach(() => { cleanup(); delete api().__wcPhone; });

it('retains the selected phone country and canonical number after failure, Back and accepted review', async () => {
  const user = userEvent.setup();
  api().__wcPhone = root => { enhancePhones(root, root.getRootNode() as ShadowRoot, 'AM'); };
  const phone = (node: TemplateNode): TemplateNode => {
    if (node.type === 'field') return { ...node, name: 'phone', label: 'Phone number' } as TemplateNode;
    if ('children' in node && node.children) return { ...node, children: node.children.map(phone) };
    return node;
  };
  const template = { ...source, tree: { ...source.tree, steps: source.tree.steps.map(step => ({ ...step, content: step.kind === 'acknowledgement'
    ? { type: 'stack', children: [phone(step.content as TemplateNode), { type: 'button', action: 'back', label: 'Back' }] }
    : phone(step.content as TemplateNode) })) } } as Template;
  const { container } = render(<JourneyTest template={template} onEdit={() => {}} />);
  const visitor = () => within([...container.querySelectorAll('*')].find(node => node.shadowRoot)!.shadowRoot as unknown as HTMLElement);
  await user.click(visitor().getByRole('button', { name: 'Select country: Armenia (+374)' }));
  await user.type(visitor().getByRole('combobox', { name: 'Search countries' }), 'Canada');
  fireEvent.click(visitor().getByRole('option', { name: /Canada/ }));
  expect(visitor().getByRole('button', { name: 'Select country: Canada (+1)' })).toBeInTheDocument();
  await user.type(visitor().getByRole('textbox', { name: /Phone number/ }), '5065550123');
  expect(visitor().getByRole('textbox', { name: /Phone number/ })).toHaveAttribute('data-e164', '+15065550123');
  await user.click(visitor().getByRole('checkbox'));
  await user.click(screen.getByRole('checkbox', { name: 'Simulate failure on next submission' }));
  await user.click(visitor().getByRole('button', { name: 'Sign up for email' }));
  expect(screen.getByText(/Submission not confirmed/)).toBeInTheDocument();
  expect(visitor().getByRole('button', { name: 'Select country: Canada (+1)' })).toBeInTheDocument();
  expect(visitor().getByRole('textbox', { name: /Phone number/ })).toHaveAttribute('data-e164', '+15065550123');
  await user.click(visitor().getByRole('button', { name: 'Sign up for email' }));
  expect(screen.getByText('Accepted in test')).toBeInTheDocument();
  expect(screen.getByText('+15065550123')).toBeInTheDocument();
  await user.click(visitor().getByRole('button', { name: 'Back' }));
  expect(visitor().getByRole('textbox', { name: /Phone number/ })).toHaveAttribute('readonly');
  expect(visitor().getByRole('textbox', { name: /Phone number/ })).toHaveAttribute('data-e164', '+15065550123');
  expect(visitor().getByRole('button', { name: 'Select country: Canada (+1)' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Start over' }));
  expect(visitor().getByRole('button', { name: 'Select country: Armenia (+374)' })).toBeInTheDocument();
  expect(visitor().getByRole('textbox', { name: /Phone number/ })).toHaveValue('');
});
