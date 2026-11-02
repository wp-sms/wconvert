import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorField, DesignColors } from '../../resources/admin/src/builder/ColorField';

const open = (value: string, onChange = vi.fn()) => render(
  <DesignColors.Provider value={['#112233', '#445566']}>
    <ColorField label="Background" fallback="#ffffff" value={value} open clearable onOpenChange={vi.fn()} onChange={onChange} />
  </DesignColors.Provider>,
);

/** One of a design's colors, or None: never a row of pressed toggles (GUIDELINES §7). */
describe('the design colors in a color picker', () => {
  it('announces them and None as one set, with one tab stop', () => {
    open('#112233');
    const dots = within(screen.getByRole('group', { name: 'This design’s colors' })).getAllByRole('radio');
    const none = screen.getByRole('radio', { name: 'None' });
    expect(dots).toHaveLength(2);
    expect(new Set([...dots, none].map(radio => radio.getAttribute('name'))).size).toBe(1);
    expect(dots[0]).toBeChecked();
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
  });

  it('checks none of them for a color picked by hand', () => {
    open('#abcdef');
    expect(screen.getAllByRole('radio').filter(radio => (radio as HTMLInputElement).checked)).toEqual([]);
  });

  it('writes the chosen color', async () => {
    const onChange = vi.fn();
    open('#112233', onChange);
    await userEvent.click(screen.getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith('#445566');
  });
});
