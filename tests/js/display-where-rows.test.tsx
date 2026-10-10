import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Where } from '../../resources/admin/src/builder/rules/Where';
import type { Targeting } from '../../resources/admin/src/builder/api';
import { ruleTypes } from './support/rule-types';

vi.mock('../../resources/admin/src/builder/rules/objects', async (original) => ({
  ...(await original<typeof import('../../resources/admin/src/builder/rules/objects')>()),
  resolveObjects: vi.fn(async (_kind: string, ids: readonly string[]) => ids.map(id => ({ id, title: 'The Friday Edit' }))),
}));

// The site's post types are an install fact, so the stand-in vocabulary has none.
const types = ruleTypes().targeting.map(type => type.params.value?.control === 'post_type'
  ? { ...type, params: { value: { ...type.params.value, options: [{ value: 'post', label: 'Posts' }, { value: 'product', label: 'Products' }] } } } : type);

/** Where's page rules read as sentences, as the Who and When rows do (ADR 0139). */
describe('a page rule', () => {
  function setup(targeting: Targeting) {
    let latest = targeting;
    function Harness() {
      const [value, setValue] = useState(targeting);
      latest = value;
      return <Where types={types} targeting={value} showInclude={false} onChange={setValue} />;
    }
    render(<Harness />);
    return () => latest;
  }

  it('names a page on its pill by its title, joins rows with or, and draws a content type as a word', async () => {
    const read = setup({ exclude: [{ type: 'post', value: '70' }, { type: 'archive', value: '' }] });

    expect(await screen.findByRole('button', { name: 'value: The Friday Edit' })).toBeInTheDocument();
    expect(document.querySelector('.wconvert-rules__joiner')).toHaveTextContent('or');
    const word = screen.getByRole('combobox', { name: 'value' });
    expect(word).toHaveAttribute('data-attention');
    await userEvent.selectOptions(word, 'product');
    expect(read().exclude?.[1]).toEqual({ type: 'archive', value: 'product' });
    expect(screen.getByRole('combobox', { name: 'value' })).not.toHaveAttribute('data-attention');
  });

  it('opens a path in its pill, and says Choose… while it is empty', async () => {
    const read = setup({ exclude: [{ type: 'url', value: '' }] });

    await userEvent.click(screen.getByRole('button', { name: 'value: Choose…' }));
    await userEvent.type(screen.getByRole('textbox'), '/checkout/');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(read().exclude?.[0]).toEqual({ type: 'url', value: '/checkout/' });
    expect(screen.getByRole('button', { name: 'value: /checkout/' })).toHaveFocus();
  });
});
