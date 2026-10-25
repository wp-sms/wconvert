import { createRef } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ pickerData: vi.fn(), savePreferences: vi.fn(), saveOccasions: vi.fn() }));
vi.mock('../../resources/admin/src/discovery/api', () => api);

const { NewOccasionDialog } = await import('../../resources/admin/src/occasions/NewOccasion');

const data = (items: unknown[] = []) => ({ schema: 1, today: '2026-09-30', timezone: 'Asia/Muscat', collections: [], preferences: { schema: 1, revision: 0, saved: [], hidden: [] }, occasions: { schema: 1, revision: 2, items } });

beforeEach(() => {
  vi.clearAllMocks();
  api.pickerData.mockResolvedValue(data());
});

const fill = async () => {
  await userEvent.type(await screen.findByLabelText('Occasion name'), 'Autumn launch');
  await userEvent.type(screen.getByLabelText('First day'), '2026-10-01');
  await userEvent.type(screen.getByLabelText('Last day'), '2026-10-07');
};

it('adds a shared occasion and opens its page, saying it schedules nothing', async () => {
  api.saveOccasions.mockImplementation(value => Promise.resolve({ ...value, revision: value.revision + 1 }));
  const onCreated = vi.fn();
  render(<NewOccasionDialog returnFocusTo={createRef()} onClose={vi.fn()} onCreated={onCreated} />);
  expect(await screen.findByText(/never schedules a campaign/)).toBeVisible();
  await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Add occasion' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  const saved = api.saveOccasions.mock.calls[0][0];
  expect(saved.items).toEqual([expect.objectContaining({ name: 'Autumn launch', start: '2026-10-01', end: '2026-10-07' })]);
  expect(onCreated).toHaveBeenCalledWith(saved.items[0].id);
});

it('keeps what was typed when saving fails, and says why', async () => {
  api.saveOccasions.mockRejectedValue(new Error('A newer occasion list exists.'));
  const onCreated = vi.fn();
  render(<NewOccasionDialog returnFocusTo={createRef()} onClose={vi.fn()} onCreated={onCreated} />);
  await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Add occasion' }));
  expect(await screen.findByText('A newer occasion list exists.')).toBeVisible();
  expect(screen.getByLabelText('Occasion name')).toHaveValue('Autumn launch');
  expect(onCreated).not.toHaveBeenCalled();
});

it('says the limit instead of offering a fifty-first occasion', async () => {
  api.pickerData.mockResolvedValue(data(Array.from({ length: 50 }, (_, at) => ({ id: `o${at}`, name: `Occasion ${at}`, start: '2026-10-01', end: '2026-10-02' }))));
  render(<NewOccasionDialog returnFocusTo={createRef()} onClose={vi.fn()} onCreated={vi.fn()} />);
  expect(await screen.findByText('You can keep up to 50 occasions. Delete one to add another.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add occasion' })).toBeDisabled();
});
