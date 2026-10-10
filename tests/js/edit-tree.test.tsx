import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { EditTree, lookSummary } from '../../resources/admin/src/builder/EditTree';
import fixture from '../fixtures/journey-graph-branch-groups.json';
import { treeFixture } from './support/journey';

/**
 * The Edit tab's left column (ADR 0134): the pinned Look row, then the
 * screens, the open one unfolded into its elements.
 */
const tree = fixture as unknown as TemplateTree;
afterEach(cleanup);

const straight = treeFixture({ steps: [
  { type: 'stack', children: [{ type: 'field', name: 'email', required: true }, { type: 'button', action: 'submit', label: 'Join' }] },
  { type: 'stack', children: [{ type: 'heading', text: 'Thanks' }] },
] });

describe('the Edit tree', () => {
  it('keeps each interest group under its source, renders every screen once, and selects the actual child', () => {
    const select = vi.fn();
    const at = tree.steps.findIndex(item => item.id === 'home_garden');
    render(<EditTree tree={tree} step={at} onSelect={select} />);
    const home = screen.getByRole('region', { name: 'Follow-ups: Your home interests' });
    const business = screen.getByRole('region', { name: 'Follow-ups: Your business interests' });
    expect(home.parentElement).toHaveTextContent('Your home interests');
    expect(home.parentElement).not.toHaveTextContent('Your business interests');
    expect(within(home).getByText('If “Garden landscaping” is selected')).toBeInTheDocument();
    expect(within(business).queryByText('Garden landscaping details')).toBeNull();
    for (const item of tree.steps) expect(screen.getAllByText(item.name, { exact: true })).toHaveLength(1);
    const button = within(home).getByRole('button', { name: /Garden landscaping details/ });
    expect(button).toHaveAttribute('aria-current', 'true');
    fireEvent.click(button);
    expect(select).toHaveBeenCalledWith(at);
  });

  /** D5: the look is the first row, and opening it is not editing a screen. */
  it('pins the Look first and marks it, not a screen, while it is open', () => {
    const open = vi.fn();
    render(<EditTree tree={straight} step={0} editingScreen={false} onSelect={() => {}}
      look={{ open: true, colors: ['#fff', '#000', '#2f4f37'], summary: lookSummary('popup'), onOpen: open }} />);
    const look = screen.getByRole('button', { name: /^Look Colors, fonts, popup position/ });
    expect(look).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Screen 1/ })).not.toHaveAttribute('aria-current');
    fireEvent.click(look);
    expect(open).toHaveBeenCalledOnce();
  });

  it('unfolds only the open screen into its elements, and draws the extra rows and Add screen', () => {
    const reopen = vi.fn();
    render(<EditTree tree={straight} step={1} onSelect={() => {}} elements={<p>the elements</p>}
      extraRows={[{ key: 'reopen', label: 'Reopen button', current: false, onSelect: reopen }]} addScreen={<button type="button">Add screen</button>} />);
    expect(within(screen.getByRole('group', { name: 'Elements on Screen 2' })).getByText('the elements')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Elements on Screen 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen button' }));
    expect(reopen).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Add screen' })).toBeInTheDocument();
  });

  /** One list feeds every count (ADR 0133): a screen's badge counts the issues about it and opens the first. */
  it('counts each screen’s issues and opens the first', () => {
    const onIssue = vi.fn();
    const issue = { key: 'x', said: 'Add a web address for “the guide”.', blocks: true, tab: 'edit' as const, go: { to: 'edit-design' as const }, screenId: 's1' };
    render(<EditTree tree={straight} step={0} onSelect={() => {}} issues={[issue]} onIssue={onIssue} />);
    fireEvent.click(screen.getByRole('button', { name: '1 issue on “Screen 1”: Add a web address for “the guide”.' }));
    expect(onIssue).toHaveBeenCalledWith(issue);
  });

  /** A check is not a blocker (ADR 0133); the tree marks it, quietly. */
  it('marks a screen whose issues are only checks as soft', () => {
    const check = { key: 'y', said: 'Check where “Shop” goes (now: Shop page).', blocks: false, tab: 'edit' as const, go: { to: 'edit-design' as const }, screenId: 's1' };
    render(<EditTree tree={straight} step={0} onSelect={() => {}} issues={[check]} />);
    expect(screen.getByRole('button', { name: /^1 issue on “Screen 1”/ })).toHaveAttribute('data-soft', 'true');
  });
});
