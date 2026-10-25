import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CollectionBar, CollectionShelf } from '../../resources/admin/src/gallery/CollectionShelf';
import type { Collection } from '../../resources/admin/src/discovery/api';
import type { GalleryCard } from '../../resources/admin/src/gallery/model';

const collection: Collection = { id: 'useful', revision: 'r', name: 'Useful starts', description: 'Useful ideas', cover: 'reading', priority: 1, business_types: [], items: [] };
const card = (key: string): GalleryCard => ({ key, name: key, words: key, displayType: 'popup', facets: null, captures: [], act: 'click', tier: 'free', availability: 'ready',
  recommended: null, newerRevision: null, source: 'online', thumbnail: { '1x': `https://cdn/${key}.webp` , '2x': `https://cdn/${key}@2x.webp` }, template_id: key, designName: null, designKey: `registered:${key}`,
  business_types: [], tags: [], sha256: null, previewUrl: null });
const shelf = [{ collection, members: new Map([['a', 'before'], ['b', 'during']]) }];
const props = { shelf, cards: [card('a'), card('b')], trees: new Map(), today: '2026-11-01', active: null, hidden: 0, onOpen: vi.fn(), onHide: vi.fn(), onRestore: vi.fn(), onHideAll: vi.fn() };

it('filters by a collection and shows every template again when pressed twice', async () => {
  const onOpen = vi.fn();
  const { rerender } = render(<CollectionShelf {...props} onOpen={onOpen} />);
  const tile = screen.getByRole('button', { name: 'Useful starts, 2 templates' });

  expect(tile).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(tile);
  expect(onOpen).toHaveBeenLastCalledWith('useful');
  rerender(<CollectionShelf {...props} onOpen={onOpen} active="useful" />);
  await userEvent.click(screen.getByRole('button', { name: 'Useful starts, 2 templates' }));
  expect(onOpen).toHaveBeenLastCalledWith(null);
});

it('covers a tile with three of its templates and says how long a seasonal one runs', () => {
  const event = { family: 'sale', start: '2026-11-27', end_exclusive: '2026-12-02', feature_start: '2026-11-01', feature_end_exclusive: '2026-12-02' };
  const { container } = render(<CollectionShelf {...props} shelf={[{ ...shelf[0], collection: { ...collection, event } }]} />);

  expect(container.querySelectorAll('.wconvert-shelf__cover .wconvert-stage')).toHaveLength(2);
  expect(screen.getByText(/^Until (1 Dec|Dec 1)$/)).toBeInTheDocument();
});

it('counts the days to a seasonal event once it is two weeks away or less', () => {
  const halloween = { family: 'halloween', start: '2026-10-31', end_exclusive: '2026-11-01', feature_start: '2026-10-01', feature_end_exclusive: '2026-11-01' };
  const tile = (today: string) => {
    const { unmount } = render(<CollectionShelf {...props} today={today} shelf={[{ ...shelf[0], collection: { ...collection, event: halloween } }]} />);
    const words = document.querySelector('[data-season]')?.textContent;
    unmount();
    return words;
  };

  expect([tile('2026-10-10'), tile('2026-10-25'), tile('2026-10-30'), tile('2026-10-31')]).toEqual([expect.stringMatching(/^Until (31 Oct|Oct 31)$/), 'In 6 days', 'Tomorrow', 'Ends today']);
});

it('hides one collection, restores the hidden ones, or hides the shelf', async () => {
  const onHide = vi.fn(), onRestore = vi.fn(), onHideAll = vi.fn();
  render(<CollectionShelf {...props} hidden={2} onHide={onHide} onRestore={onRestore} onHideAll={onHideAll} />);

  await userEvent.click(screen.getByRole('button', { name: 'Hide Useful starts' }));
  await userEvent.click(screen.getByRole('button', { name: 'Show 2 hidden' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hide featured' }));
  expect([onHide.mock.calls, onRestore.mock.calls.length, onHideAll.mock.calls.length]).toEqual([[['useful']], 1, 1]);
});

it('offers When only for the stages the open collection has', async () => {
  const onStage = vi.fn(), onClose = vi.fn();
  render(<CollectionBar shelf={shelf[0]} stage="any" onStage={onStage} onClose={onClose} />);
  const when = screen.getByRole('group', { name: 'When' });

  expect(within(when).getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual(['Any time', 'Before', 'During']);
  await userEvent.click(within(when).getByRole('radio', { name: 'During' }));
  expect(onStage).toHaveBeenCalledWith('during');
  await userEvent.click(screen.getByRole('button', { name: 'Show all templates' }));
  expect(onClose).toHaveBeenCalledOnce();
});
