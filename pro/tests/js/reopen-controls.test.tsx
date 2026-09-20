import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReopenSettings from '../../modules/display-types/admin/ReopenSettings';
import { ReopenSettings as EditionSettings } from '@/reopenControls';

const template = { tokens: {}, tree: { steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Offer' }] }] } };
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => vi.unstubAllGlobals());

it('authors optional settings and previews without visitor storage or requests', async () => {
  const user = userEvent.setup();
  const save = vi.spyOn(Storage.prototype, 'setItem');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  function Editor() {
    const [value, setValue] = useState<unknown>(null);
    return <><ReopenSettings value={value} template={template} onChange={setValue} /><output data-testid="settings">{JSON.stringify(value)}</output></>;
  }
  render(<Editor />);
  expect(screen.queryByLabelText('Button text')).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Reopen button', exact: true }));
  await user.clear(screen.getByLabelText('Button text'));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter button text');
  await user.type(screen.getByLabelText('Button text'), 'Get the offer');
  await user.selectOptions(screen.getByLabelText('Position', { exact: true }), 'block_start_inline_start');
  await user.click(screen.getByText('Colors and mobile'));
  await user.click(screen.getByRole('checkbox', { name: 'Show on mobile' }));
  await user.click(screen.getByRole('checkbox', { name: 'Mobile preview' }));
  expect(screen.getByText('Hidden on mobile')).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('settings').textContent!)).toMatchObject({ label: 'Get the offer', placement: 'block_start_inline_start', mobile: { visible: false } });
  await user.selectOptions(screen.getByLabelText('Preview', { exact: true }), 'success');
  expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  save.mockRestore();
});

it('Free explains retained settings and offers no premium authoring controls', () => {
  render(<EditionSettings value={{ label: 'Saved offer' }} template={template} onChange={vi.fn()} />);
  expect(screen.getByText(/settings are saved, but showing it requires Pro/)).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
