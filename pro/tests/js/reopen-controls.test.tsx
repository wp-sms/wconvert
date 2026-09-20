import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReopenPreview from '../../modules/display-types/admin/ReopenPreview';
import ReopenSettings from '../../modules/display-types/admin/ReopenSettings';
import { ReopenSettings as EditionSettings } from '@/reopenControls';

const template = { tokens: {}, tree: { steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Offer' }] }] } };
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => vi.unstubAllGlobals());

it('authors optional settings with on-demand help and without visitor storage or requests', async () => {
  const user = userEvent.setup();
  const save = vi.spyOn(Storage.prototype, 'setItem');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  function Editor() {
    const [value, setValue] = useState<unknown>(null);
    return <><ReopenSettings value={value} template={template} onChange={setValue} /><output data-testid="settings">{JSON.stringify(value)}</output></>;
  }
  render(<Editor />);
  expect(screen.queryByLabelText('Button text')).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Reopen button' }));
  await user.clear(screen.getByLabelText('Button text'));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter button text');
  await user.type(screen.getByLabelText('Button text'), 'Get the offer');
  await user.selectOptions(screen.getByLabelText('Position', { exact: true }), 'block_start_inline_start');
  await user.click(screen.getByText('Colors and mobile'));
  await user.click(screen.getByRole('checkbox', { name: 'Show on mobile' }));
  expect(JSON.parse(screen.getByTestId('settings').textContent!)).toMatchObject({ label: 'Get the offer', placement: 'block_start_inline_start', mobile: { visible: false } });
  expect(screen.queryByRole('combobox', { name: 'Preview' })).toBeNull();
  expect(screen.queryByText(/After visitors close this Campaign/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'About reopen buttons' }));
  expect(screen.getByText(/After visitors close this Campaign/)).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByText(/After visitors close this Campaign/)).toBeNull();
  expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  save.mockRestore();
});

it('Free explains retained settings and offers no premium authoring controls', () => {
  render(<EditionSettings value={{ label: 'Saved offer' }} template={template} onChange={vi.fn()} />);
  expect(screen.getByText(/settings are saved, but showing it requires Pro/)).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('uses the shared canvas device choice for mobile visibility without visitor storage', () => {
  const save = vi.spyOn(Storage.prototype, 'setItem');
  const value = { label: 'Offer', mobile: { visible: false } };
  const { rerender, container } = render(<ReopenPreview value={value} template={template} mobile onReopen={vi.fn()} />);
  expect(screen.getByText('Hidden on mobile')).toBeVisible();
  expect(container.querySelector('[data-wconvert-reopen]')).toBeNull();
  rerender(<ReopenPreview value={value} template={template} mobile={false} onReopen={vi.fn()} />);
  expect(screen.queryByText('Hidden on mobile')).toBeNull();
  expect(container.querySelector('[data-wconvert-reopen]')).not.toBeNull();
  expect(save).not.toHaveBeenCalled();
  save.mockRestore();
});
