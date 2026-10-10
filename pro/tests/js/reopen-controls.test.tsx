import { treeFixture } from '../../../tests/js/support/journey';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReopenPreview from '../../modules/display-types/admin/ReopenPreview';
import ReopenSettings from '../../modules/display-types/admin/ReopenSettings';
import { ReopenSettings as EditionSettings } from '@/reopenControls';

const template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Offer' }] }] }) };
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
  await user.click(screen.getByRole('checkbox', { name: 'Show a reopen button' }));
  // The box refuses anything outside 8–96, so no permanent line says so (ADR 0136).
  expect(screen.getByLabelText('Distance (px)')).toHaveAttribute('min', '8');
  expect(screen.getByLabelText('Distance (px)')).toHaveAttribute('max', '96');
  expect(screen.queryByText('From 8 to 96.')).toBeNull();
  await user.clear(screen.getByLabelText('Button text'));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter button text');
  expect(screen.getByLabelText('Button text')).toHaveAccessibleDescription('Enter button text before saving.');
  await user.type(screen.getByLabelText('Button text'), 'Get the offer');
  await user.selectOptions(screen.getByLabelText('Position', { exact: true }), 'block_start_inline_start');
  await user.click(screen.getByText('Colors and mobile'));
  await user.click(screen.getByRole('checkbox', { name: 'Show on mobile' }));
  expect(JSON.parse(screen.getByTestId('settings').textContent!)).toMatchObject({ label: 'Get the offer', placement: 'block_start_inline_start', mobile: { visible: false } });
  // A color is the shared swatch and picker, named, showing the campaign's own until changed (ADR 0135).
  expect(screen.getByRole('button', { name: /Choose a color for Background/ })).toHaveTextContent('Blue');
  expect(screen.queryByRole('textbox', { name: /Background/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /back to the campaign’s own/ })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Preview' })).toBeNull();
  expect(screen.queryByText(/visitors can bring it back/)).toBeNull();
  expect(screen.queryByText(/Colors follow the campaign’s design/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'About reopen buttons' }));
  expect(screen.getByText(/After closing, visitors can bring it back from a small button/)).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByText(/visitors can bring it back/)).toBeNull();
  expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  save.mockRestore();
});

it('Free explains retained settings and offers no premium authoring controls', () => {
  render(<EditionSettings value={{ label: 'Saved offer' }} template={template} onChange={vi.fn()} />);
  expect(screen.getByText('This campaign has a reopen button saved. It isn’t shown on this site.')).toBeInTheDocument();
  expect(screen.queryByText(/Pro/)).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

/** With nothing saved there is nothing to explain, and nothing to sell (ADR 0116). */
it('Free says nothing about a reopen button that was never set up', () => {
  const { container } = render(<EditionSettings value={undefined} template={template} onChange={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
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
