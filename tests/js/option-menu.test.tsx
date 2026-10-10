import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrowUp, Copy, Trash2 } from 'lucide-react';
import { Popover, PopoverTrigger } from '../../resources/admin/src/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger } from '../../resources/admin/src/components/ui/dropdown-menu';
import {
  OptionEmpty,
  OptionGroup,
  OptionItem,
  OptionList,
  OptionListContent,
  OptionMenuContent,
} from '../../resources/admin/src/components/ui/option-menu';

/**
 * The option menu (ADR 0139): one set of parts, a list mode that owns its arrow
 * keys and a menu mode where Radix does. What each mode promises a keyboard and
 * a screen reader is asserted here once, rather than at each of the call sites
 * that used to write it themselves.
 */

// Radix measures a tooltip's anchor, and jsdom has nothing to measure with.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('dir');
});

const readRightToLeft = () => {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.style.direction = 'rtl';
};

function List({ onPick = vi.fn() }: { onPick?: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const names = ['Heading', 'Text', 'Image'].filter(name => name.toLowerCase().includes(query.toLowerCase()));

  return <Popover>
    <PopoverTrigger>Add</PopoverTrigger>
    <OptionListContent aria-label="Add element">
      <OptionList search={{ value: query, onChange: setQuery, label: 'Find an element', placeholder: 'Find an element…' }}>
        {names.length > 0 && <OptionGroup heading="Text">
          {names.map(name => <OptionItem key={name} name={name} onSelect={() => onPick(name)} />)}
          <OptionItem name="Products" refused={{ short: 'Only on a single offer screen', reason: 'Use one product recommendation block as the action of a single offer screen.' }}
            onSelect={() => onPick('Products')} />
        </OptionGroup>}
        {names.length === 0 && <OptionEmpty what="elements" onClear={() => setQuery('')} />}
      </OptionList>
    </OptionListContent>
  </Popover>;
}

function Menu({ onPick = vi.fn() }: { onPick?: (name: string) => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
    <OptionMenuContent aria-label="Actions">
      <OptionItem icon={ArrowUp} name="Move up" refused={{ short: 'Already first', reason: 'This is the first screen.' }} onSelect={() => onPick('Move up')} />
      <OptionItem icon={Copy} name="Duplicate" onSelect={() => onPick('Duplicate')} />
      <OptionItem icon={Trash2} name="Delete" destructive onSelect={() => onPick('Delete')} />
    </OptionMenuContent>
  </DropdownMenu>;
}

describe('list mode', () => {
  it('opens on the search, and walks the list with the arrow keys, Home and End', async () => {
    render(<List />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const search = screen.getByRole('searchbox', { name: 'Find an element' });

    expect(search).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Heading' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Text' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Products' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Heading' })).toHaveFocus();
    // ArrowUp from the first item goes back to the search, not round the list.
    await userEvent.keyboard('{ArrowUp}');
    expect(search).toHaveFocus();
  });

  it('keeps a refused item focusable, does nothing on Enter, and describes it by the whole reason', async () => {
    const onPick = vi.fn();
    render(<List onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const refused = screen.getByRole('button', { name: 'Products' });

    expect(refused).toHaveAttribute('aria-disabled', 'true');
    expect(refused).not.toBeDisabled();
    expect(refused).toHaveTextContent('Only on a single offer screen');
    expect(refused).toHaveAccessibleDescription('Use one product recommendation block as the action of a single offer screen.');
    refused.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPick).not.toHaveBeenCalled();
    // The sentence is also one press away, in ⓘ beside the item.
    expect(screen.getByRole('button', { name: 'Why: Products' })).toBeInTheDocument();
  });

  it('says nothing matched, and Clear search brings everything back', async () => {
    render(<List />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');

    expect(screen.getByRole('status')).toHaveTextContent('No matching elements');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(within(screen.getByRole('group', { name: 'Text' })).getByRole('button', { name: 'Image' })).toBeInTheDocument();
  });

  it('follows the page into right-to-left', async () => {
    readRightToLeft();
    render(<List />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('dialog', { name: 'Add element' })).toHaveAttribute('dir', 'rtl');
  });
});

describe('menu mode', () => {
  it('jumps by typeahead, which Radix owns', async () => {
    render(<Menu />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.keyboard('d');

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('keeps a refused item reachable, keeps the menu open on Enter, and describes it by the reason', async () => {
    const onPick = vi.fn();
    render(<Menu onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const refused = screen.getByRole('menuitem', { name: 'Move up' });

    expect(refused).toHaveAttribute('aria-disabled', 'true');
    expect(refused).not.toHaveAttribute('data-disabled');
    expect(refused).toHaveAccessibleDescription('This is the first screen.');
    refused.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
  });

  /**
   * A button inside a `menuitem` is pressed as the item and closes the menu, so
   * menu mode's ⓘ is a tooltip on the item itself — shown on keyboard focus.
   */
  it('shows the reason in a tooltip when the item takes focus', async () => {
    render(<Menu />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('This is the first screen.');
  });

  it('follows the page into right-to-left', async () => {
    readRightToLeft();
    render(<Menu />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu', { name: 'Actions' })).toHaveAttribute('dir', 'rtl');
  });
});
