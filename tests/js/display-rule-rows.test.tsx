import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Audience } from '@loader/display-rules';
import { AudienceEditor } from '../../resources/admin/src/builder/rules/AudienceEditor';
import type { Rule } from '../../resources/admin/src/builder/api';
import { ruleTypes } from './support/rule-types';

/**
 * Display rules rows and groups (ADR 0139): a rule is one sentence of pills,
 * a group says how its rules combine even with one, and the limits are said in
 * words where the Add controls were.
 */

const types = ruleTypes().conditions.concat(ruleTypes().targeting);

function setup(rules: readonly Rule[], groups = 1) {
  const audience: Audience = {
    mode: 'groups',
    groups: Array.from({ length: groups }, (_, at) => ({ id: `g${at}`, match: 'all', rules: rules.map((rule, index) => ({ ...rule, id: `r${at}-${index}` })) })),
  };
  let latest: Audience = audience;
  function Harness() {
    const [value, setValue] = useState(audience);
    latest = value;
    return <AudienceEditor value={value} types={types} onChange={setValue} />;
  }
  render(<Harness />);
  return () => (latest.mode === 'groups' ? latest.groups : []);
}

describe('a group', () => {
  it('says how its rules combine even with one rule, and joins rows to match', async () => {
    const groups = setup([{ type: 'device', in: ['mobile'] }, { type: 'logged_in', value: true }]);
    const group = screen.getByRole('region', { name: 'Group 1' });
    const match = within(group).getByRole('combobox', { name: 'Group 1: match all or any' });

    expect(match).toHaveValue('all');
    expect(group.querySelector('.wconvert-rules__joiner')).toHaveTextContent('and');
    expect(group.querySelector('.wconvert-rules__joiner')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.selectOptions(match, 'any');
    expect(groups()[0].match).toBe('any');
    expect(group.querySelector('.wconvert-rules__joiner')).toHaveTextContent('or');
  });

  it('shows the match even with one rule', () => {
    setup([{ type: 'device', in: ['mobile'] }]);

    expect(screen.getByRole('combobox', { name: 'Group 1: match all or any' })).toBeInTheDocument();
  });

  it('says the limit in words at eight rules, where Add a rule was', () => {
    setup(Array.from({ length: 8 }, () => ({ type: 'device', in: ['mobile'] })));

    expect(screen.queryByRole('button', { name: 'Add a rule' })).toBeNull();
    expect(screen.getByText('Up to 8 rules in a group')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About the rule limit' })).toBeInTheDocument();
  });

  it('says the limit in words at five groups, where the add link was', () => {
    setup([{ type: 'device', in: ['mobile'] }], 5);

    expect(screen.queryByRole('button', { name: '+ Add another group' })).toBeNull();
    expect(screen.getByText('Up to 5 groups')).toBeInTheDocument();
    expect(screen.getAllByRole('separator', { name: 'or' })).toHaveLength(4);
  });
});

describe('a rule row', () => {
  it('picks a preset from its pill, sets the fixed params, closes and returns focus', async () => {
    const groups = setup([{ type: 'device', in: ['mobile'] }]);
    const pill = screen.getByRole('button', { name: 'device: mobile_only' });

    await userEvent.click(pill);
    const menu = screen.getByRole('dialog', { name: 'device' });
    expect(within(menu).getByRole('button', { name: 'mobile_only' })).toHaveAttribute('aria-current', 'true');
    expect(within(menu).getByRole('button', { name: 'mobile_only' })).toHaveFocus();
    await userEvent.click(within(menu).getByRole('button', { name: 'desktop_only' }));

    expect(groups()[0].rules[0]).toMatchObject({ type: 'device', in: ['desktop'] });
    expect(screen.queryByRole('dialog', { name: 'device' })).toBeNull();
    expect(screen.getByRole('button', { name: 'device: desktop_only' })).toHaveFocus();
  });

  it('keeps the values on Custom…, stays open on the first control, and Escape returns to the pill', async () => {
    const groups = setup([{ type: 'device', in: ['mobile'] }]);

    await userEvent.click(screen.getByRole('button', { name: 'device: mobile_only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Custom…' }));
    expect(groups()[0].rules[0]).toMatchObject({ type: 'device', in: ['mobile'] });
    const boxes = within(screen.getByRole('dialog', { name: 'device' })).getAllByRole('checkbox');
    expect(boxes[0]).toHaveFocus();
    expect(boxes[0]).toBeChecked();

    await userEvent.click(boxes[1]);
    expect(groups()[0].rules[0]).toMatchObject({ in: ['mobile', 'tablet'] });
    // Still the custom form, though its values could be read as no preset at all.
    expect(screen.getByRole('button', { name: 'Custom…' })).toHaveAttribute('aria-current', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'device: mobile or tablet' })).toHaveFocus();
  });

  it('opens a set’s own control from its pill, and marks an empty one', async () => {
    const groups = setup([{ type: 'role' }]);
    const pill = screen.getByRole('button', { name: 'value: Choose…' });

    expect(pill).toHaveAttribute('data-attention');
    await userEvent.click(pill);
    expect(within(screen.getByRole('dialog', { name: 'value' })).getByRole('group')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(groups()[0].rules[0]).toMatchObject({ type: 'role' });
    expect(screen.getByRole('button', { name: 'value: Choose…' })).toHaveFocus();
  });

  it('draws a closed choice as a word in the sentence', async () => {
    const groups = setup([{ type: 'cart_products', operator: 'any', ids: [1, 2] }, { type: 'logged_in', value: true }]);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'operator' }), 'none');
    expect(groups()[0].rules[0]).toMatchObject({ operator: 'none' });
    expect(screen.getByRole('button', { name: 'ids: 2 products' })).toBeInTheDocument();
    const signedIn = screen.getByRole('combobox', { name: 'value' });
    expect(within(signedIn).getByRole('option', { name: 'Signed in' })).toBeInTheDocument();
    await userEvent.selectOptions(signedIn, 'false');
    expect(groups()[0].rules[1]).toMatchObject({ type: 'logged_in', value: false });
  });

  it('keeps a key pill and a values pill apart for a URL parameter', async () => {
    setup([{ type: 'query_param', key: 'utm_source', value: ['news'] }]);

    expect(screen.getByRole('button', { name: 'key: utm_source' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'value: news' })).toBeInTheDocument();
  });

  it('is its name alone when it takes nothing', () => {
    setup([{ type: 'cart_has_items' }]);
    const row = screen.getByRole('region', { name: 'Group 1' }).querySelector('.wconvert-rule')!;

    expect(row).toHaveTextContent('cart_has_items');
    expect(within(row as HTMLElement).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Remove cart_has_items']);
  });

  it('offers only removal for a rule this site does not know', () => {
    setup([{ type: 'nothing_here' }]);

    expect(screen.getByText('A rule that is not available on this site.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove unavailable rule' })).toBeInTheDocument();
  });
});
