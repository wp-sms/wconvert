import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlacementControl,
  resolvedPlacement,
} from '../../resources/admin/src/builder/PlacementControl';

afterEach(() => {
  document.documentElement.style.removeProperty('direction');
});

describe('overlay placement', () => {
  it('uses the existing bottom positions when the stored override is absent', () => {
    expect(resolvedPlacement('floating_bar', undefined)).toBe('block_end');
    expect(resolvedPlacement('slide_in', undefined)).toBe('block_end_inline_end');
  });

  it('stores only the non-default floating-bar choice', async () => {
    const changed = vi.fn();

    const { rerender } = render(
      <PlacementControl displayType="floating_bar" value={undefined} onChange={changed} />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Top' }));
    expect(changed).toHaveBeenLastCalledWith('block_start');

    rerender(<PlacementControl displayType="floating_bar" value="block_start" onChange={changed} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Bottom' }));
    expect(changed).toHaveBeenLastCalledWith(null);
  });

  it('labels logical slide-in corners by the physical RTL position the merchant will see', async () => {
    document.documentElement.style.direction = 'rtl';
    const changed = vi.fn();

    render(<PlacementControl displayType="slide_in" value={undefined} onChange={changed} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Top right' }));

    expect(changed).toHaveBeenCalledWith('block_start_inline_start');
    expect(screen.getByRole('radio', { name: 'Bottom left' })).toBeChecked();
  });

  it('renders no placement control for popup or inline designs', () => {
    const { rerender } = render(
      <PlacementControl displayType="popup" value={undefined} onChange={vi.fn()} />,
    );

    expect(screen.queryByRole('group', { name: 'Position' })).toBeNull();

    rerender(<PlacementControl displayType="inline" value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Position' })).toBeNull();
  });
});
