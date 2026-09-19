import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddRule } from '../../resources/admin/src/builder/rules/AddRule';
import { ruleTypes } from './support/rule-types';

const delay = { ...ruleTypes().triggers.find(type => type.type === 'time_on_page')!, label: 'Time delay' };
const scroll = { ...ruleTypes().triggers.find(type => type.type === 'scroll_depth')!, label: 'Scroll depth' };
const axis = [delay, scroll];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('dir');
});

describe('searchable rule picker', () => {
  it('searches translated type and preset words, then adds exactly the chosen preset', async () => {
    const onAdd = vi.fn();
    render(<AddRule axis={axis} label="Add a trigger" onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a trigger' }));
    const search = screen.getByRole('searchbox', { name: 'Find a rule' });
    expect(search).toHaveFocus();
    await userEvent.type(search, ' DELAY moment ');
    expect(screen.queryByRole('group', { name: 'Scroll depth' })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onAdd).toHaveBeenCalledExactlyOnceWith({ type: 'time_on_page', seconds: 5 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a trigger' })).toHaveFocus();
  });

  it('supports Escape, no matches, and a fresh search after reopening without editing', async () => {
    const onAdd = vi.fn();
    render(<AddRule axis={axis} label="Add a trigger" onAdd={onAdd} />);
    const trigger = screen.getByRole('button', { name: 'Add a trigger' });
    await userEvent.click(trigger);
    await userEvent.type(screen.getByRole('searchbox'), 'nothing matches');
    expect(screen.getByRole('status')).toHaveTextContent('No matching rules.');
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('keeps missing dependencies and paid rules searchable as noninteractive explanations', async () => {
    const types = ruleTypes({ elite: 'unavailable', pro: 'locked' });
    render(<AddRule axis={[...types.triggers, ...types.conditions]} label="Add" onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.type(screen.getByRole('searchbox'), 'WooCommerce');
    const dependency = screen.getByRole('group', { name: 'Needs WooCommerce' });
    expect(within(dependency).getByText('cart_has_items')).toBeInTheDocument();
    expect(within(dependency).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'click');
    const premium = screen.getByRole('group', { name: 'With WConvert Pro' });
    expect(within(premium).getByText('click_element')).toBeInTheDocument();
    expect(within(premium).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps vertical keyboard navigation and the portaled content in RTL', async () => {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.direction = 'rtl';
    render(<AddRule axis={axis} label="Add" onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('dir', 'rtl');
    const buttons = within(dialog).getAllByRole('button');
    await userEvent.keyboard('{ArrowDown}');
    expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(buttons.at(-1)).toHaveFocus();
    await userEvent.keyboard('{Home}{ArrowUp}');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
