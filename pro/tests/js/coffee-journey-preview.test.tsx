import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { JourneyTest } from '../../../resources/admin/src/builder/JourneyTest';
import { registerPremiumJourneyRenderer } from '../../modules/journeys/loader/render';
import type { Template } from '@renderer/types';
import fixture from '../../../tests/fixtures/journey-graph-coffee.json';

registerPremiumJourneyRenderer();
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(template = fixture.template as Template) {
  const view = render(<JourneyTest template={template} onEdit={() => {}} />);
  const root = () => [...view.container.querySelectorAll('*')].find(node => node.shadowRoot)!.shadowRoot!;
  const visitor = () => within(root() as unknown as HTMLElement);
  return { ...view, root, visitor };
}

it('simulates product failure and retry without remounting the visitor screen or sending requests', async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const { visitor, root } = setup();
  await user.click(visitor().getByRole('radio', { name: 'Espresso machine' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  await user.click(visitor().getByRole('checkbox', { name: 'Rich and chocolatey' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  const heading = visitor().getByRole('heading', { name: 'Rich espresso, made for your mornings' });
  await user.click(screen.getByText('Simulate a problem'));
  const error = screen.getByRole('radio', { name: 'Loading error' });
  error.focus(); fireEvent.click(error);
  expect(visitor().getByRole('heading', { name: 'Rich espresso, made for your mornings' })).toBe(heading);
  expect(document.activeElement).toBe(error);
  expect(visitor().getByRole('status')).toHaveTextContent('Products could not load. You can still use the link below.');
  expect(visitor().getByRole('link', { name: 'Explore all coffee' })).toBeVisible();
  await user.click(visitor().getByRole('button', { name: 'Retry products' }));
  expect(visitor().queryByRole('button', { name: 'Retry products' })).not.toBeInTheDocument();
  expect(visitor().getByRole('status')).toHaveTextContent('2 selected products');
  expect(root().activeElement).toBe(visitor().getByRole('status'));
  expect(screen.getByRole('radio', { name: 'Available' })).toBeChecked();
  await user.click(screen.getByRole('radio', { name: 'None available' }));
  expect(visitor().getByRole('status')).toHaveTextContent('These products are unavailable');
  expect(visitor().queryByRole('button', { name: 'Retry products' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start over' }));
  await user.click(visitor().getByRole('radio', { name: 'French press' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByText('Simulate a problem'));
  expect(screen.getByRole('radio', { name: 'Available' })).toBeChecked();
  expect(visitor().getByRole('status')).toHaveTextContent('1 selected product would be checked');
  await user.click(visitor().getByRole('button', { name: 'Optional email updates' }));
  await user.click(visitor().getByRole('button', { name: 'No thanks' }));
  expect(visitor().getByRole('heading', { name: 'Thanks for visiting' })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it('does not offer catalog simulation controls for a content-only result', async () => {
  const user = userEvent.setup();
  const template = fixture.template as Template;
  const { visitor } = setup({ ...template, tree: { ...template.tree, steps: template.tree.steps.map(step => ({ ...step,
    results: step.results?.map(result => ({ ...result, product_ids: [] })),
  })) } });
  await user.click(visitor().getByRole('radio', { name: 'French press' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  await user.click(visitor().getByRole('button', { name: 'Continue' }));
  expect(visitor().getByRole('heading', { name: 'An easy everyday favourite' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Product availability (simulation)' })).not.toBeInTheDocument();
});
