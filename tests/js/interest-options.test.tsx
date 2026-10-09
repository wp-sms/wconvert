import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { InterestOptions, validDraftInterestOptions, validInterestOptions, type InterestOption } from '../../resources/admin/src/builder/InterestOptions';

const OPTIONS: InterestOption[] = [
  { value: 'repair', label: 'Repair' },
  { value: 'installation', label: 'Installation' },
  { value: 'servicing', label: 'Servicing' },
];

function Editor({ initial = OPTIONS }: { initial?: InterestOption[] }) {
  const [options, setOptions] = useState(initial);
  return <InterestOptions value={options} onChange={setOptions} onEdit={setOptions} />;
}

describe('editing qualification choices', () => {
  it('keeps focus on the moved answer instead of reversing the move with the next Enter', async () => {
    render(<Editor />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Move choice 2 up' }));
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveValue('Installation');
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveValue('Installation');
    expect(screen.getByText('Saved as: installation')).toBeInTheDocument();
  });

  it('focuses the nearest surviving answer after removal and Add choice after removing the last', async () => {
    render(<Editor initial={OPTIONS.slice(0, 2)} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove choice 2' }));
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove choice 1' }));
    expect(screen.getByRole('button', { name: 'Add choice' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveFocus();
  });

  it('preserves the sent value while the visible label is edited without remounting its input', async () => {
    render(<Editor />);
    const user = userEvent.setup();
    const label = screen.getByRole('textbox', { name: 'Choice 1' });
    await user.clear(label);
    await user.type(label, 'Emergency repair');
    expect(label).toHaveFocus();
    expect(label).toHaveValue('Emergency repair');
    expect(screen.getByText('Saved as: repair')).toBeInTheDocument();
  });
});

describe('qualification option validation', () => {
  it.each([
    ['a malformed list', {}],
    ['a malformed row among valid ones', [...OPTIONS, null]],
    ['an incomplete row', [{ value: 'repair' }]],
    ['a blank label', [{ value: 'repair', label: ' ' }]],
    ['a duplicate value', [...OPTIONS, OPTIONS[0]]],
    ['a trailing newline', [{ value: 'repair\n', label: 'Repair' }]],
    ['too many answers', Array.from({ length: 13 }, (_, at) => ({ value: `option-${at}`, label: `Answer ${at}` }))],
  ])('rejects %s for both publishing and draft saves', (_name, options) => {
    expect(validInterestOptions(options)).toBe(false);
    expect(validDraftInterestOptions(options)).toBe(false);
  });

  it('lets empty and absent options remain an unfinished saved draft', () => {
    for (const options of [undefined, []]) {
      expect(validDraftInterestOptions(options)).toBe(true);
      expect(validInterestOptions(options)).toBe(false);
    }
    expect(validDraftInterestOptions(OPTIONS)).toBe(true);
    expect(validInterestOptions(OPTIONS)).toBe(true);
  });
});
