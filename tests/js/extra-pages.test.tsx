import { afterEach, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { Shell } from '../../resources/admin/src/shell/Shell';
import { PlanBadge } from '../../resources/admin/src/shell/Brand';
import { setPlanBadge } from '../../resources/admin/src/shell/planBadge';
import { extraPageFor, registerPage } from '../../resources/admin/src/extraPages';

/**
 * The two generic slots another bundle fills (ADR 0143): a page reached by its
 * own hash, and a plan badge that links somewhere and carries a dot. Free
 * names nothing it does not ship — the words come from whoever registers.
 */
afterEach(() => { delete window.wconvertAdmin; setPlanBadge(null); });

it('finds a registered page by its hash, with or without the # and a query', () => {
  const Component = () => null;
  registerPage({ id: 'elsewhere', title: 'Elsewhere', description: 'A page.', Component });

  expect(extraPageFor('#elsewhere')?.title).toBe('Elsewhere');
  expect(extraPageFor('elsewhere?x=1')?.Component).toBe(Component);
  expect(extraPageFor('#optins')).toBeUndefined();
});

it('draws a registered page inside the frame with no tab current', () => {
  render(<Shell page={{ id: 'elsewhere', title: 'Elsewhere', description: 'A page reached by a link.' }}><p>Body</p></Shell>);

  const nav = screen.getByRole('navigation', { name: 'WConvert sections' });
  expect(within(nav).getAllByRole('link').every((link) => !link.hasAttribute('aria-current'))).toBe(true);
  expect(screen.getByRole('heading', { level: 1, name: 'Elsewhere' })).toBeInTheDocument();
  expect(screen.getByText('A page reached by a link.')).toBeInTheDocument();
});

it('is a plain label when nothing says where it goes', () => {
  setPlanBadge(null);
  render(<PlanBadge tier="elite" />);

  expect(screen.queryByRole('link')).toBeNull();
});

it('becomes a prompt with the words it is given', () => {
  setPlanBadge({ href: '#elsewhere', label: 'Do the thing', prompt: true, tone: null, reason: null });
  render(<PlanBadge tier="elite" />);

  const link = screen.getByRole('link', { name: 'Do the thing' });
  expect(link).toHaveAttribute('href', '#elsewhere');
  expect(link).toHaveAttribute('data-prompt');
});

it('carries a dot whose reason a pointer and a screen reader both get, and updates live', () => {
  setPlanBadge({ href: '#elsewhere', label: null, prompt: false, tone: 'red', reason: 'Needs a look now' });
  render(<PlanBadge tier="elite" currentPage="elsewhere" />);

  const link = screen.getByRole('link', { name: /Needs a look now/ });
  expect(link).toHaveAttribute('title', 'Needs a look now');
  expect(link).toHaveAttribute('aria-current', 'page');
  expect(link.querySelector('.wconvert-plan-dot')).toHaveAttribute('data-tone', 'red');

  act(() => setPlanBadge({ href: '#elsewhere', label: null, prompt: false, tone: null, reason: null }));
  expect(link.querySelector('.wconvert-plan-dot')).toBeNull();
  expect(link).not.toHaveAttribute('title');
});
