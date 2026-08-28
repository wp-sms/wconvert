import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../resources/admin/src/components/ui/dropdown-menu';

/**
 * ============================================================================
 * A MENU DOES NOT LOCK THE PAGE, AND THIS IS THE TEST THAT WAS MISSING.
 * ============================================================================
 * Radix ships `DropdownMenu` as `modal`, which sets `overflow: hidden` on
 * `<body>` through `react-remove-scroll` and `pointer-events: none` on it
 * through the dismiss layer. The first removes the document scrollbar, so on a
 * machine that draws scrollbars in the layout the viewport widens and the whole
 * page jumps sideways when a menu opens.
 *
 * **And the jump back is late.** The lock is unmounted with the menu content,
 * and the content is held until its exit animation ends — measured against a
 * real WordPress, `<body>` still carried `data-scroll-locked` 100ms after the
 * click that dismissed the menu. So the page moves a second time, after the
 * menu has already faded, which is the "glitch on close" as a merchant sees it.
 *
 * This was diagnosed once and fixed at ONE of the three call sites, as
 * `modal={false}` on the block-row menu. The Optin row's `⋯` and the
 * inspector's swap menu kept it, and so did the bug report. The default now
 * sits on the vendored component, and what this file guards is that it stays
 * there — a call site added tomorrow inherits the fix instead of re-earning it.
 */

/** What Radix leaves on `<body>` while a modal layer is open. */
const pageIsLocked = () =>
  document.body.hasAttribute('data-scroll-locked') ||
  document.body.style.pointerEvents === 'none';

const optins = vi.hoisted(() => ({
  listOptins: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  deleteOptin: vi.fn(),
}));

const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));
vi.mock('../../resources/admin/src/goals/api', () => goals);

const { OptinList } = await import('../../resources/admin/src/optins/OptinList');

afterEach(() => {
  document.body.removeAttribute('data-scroll-locked');
  document.body.removeAttribute('style');
});

describe('the vendored DropdownMenu', () => {
  it('leaves the page scrollable and clickable while it is open', async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(pageIsLocked()).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('menuitem', { name: 'Delete' });

    expect(pageIsLocked()).toBe(false);
  });

  /**
   * The default is a default, not a hard-coded value: a dialog-shaped menu can
   * still ask for modality. Nothing in this admin does, and the test says so by
   * proving the opt-in works rather than by pretending the prop is gone.
   */
  it('still locks when a caller explicitly asks for a modal one', async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu modal>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('menuitem', { name: 'Delete' });

    expect(pageIsLocked()).toBe(true);
  });
});

describe("an Optin row's actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    optins.listOptins.mockResolvedValue([
      {
        id: '01JQ00000000000000000000AA',
        name: 'Welcome discount',
        goal: 'grow_email_list',
        published_at: null,
        deleted_at: null,
        suspended: null,
      },
    ]);
    goals.listGoals.mockResolvedValue([
      { id: 'grow_email_list', label: 'Grow my email list', availability: 'ready' },
    ]);
  });

  /**
   * The screen the report named. It is a row's actions, not a dialog — the list
   * behind it stays scrollable and the `⋯` on every other row stays clickable.
   */
  it('opens without locking the list behind it', async () => {
    const user = userEvent.setup();

    render(<OptinList onEdit={() => {}} />);

    await user.click(
      await screen.findByRole('button', { name: 'More actions for Welcome discount' }),
    );
    await screen.findByRole('menuitem', { name: 'Delete' });

    expect(pageIsLocked()).toBe(false);
  });

  /**
   * **And it is still unlocked once the menu has gone**, which is the half the
   * modal version got wrong twice over: it locked on open AND released the lock
   * a beat after the close, so the page moved when nothing had been pressed.
   */
  it('is still unlocked after a dismiss', async () => {
    const user = userEvent.setup();

    render(<OptinList onEdit={() => {}} />);

    await user.click(
      await screen.findByRole('button', { name: 'More actions for Welcome discount' }),
    );
    await screen.findByRole('menuitem', { name: 'Delete' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull());

    expect(pageIsLocked()).toBe(false);
  });
});
