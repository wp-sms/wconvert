import { describe, expect, it, vi } from 'vitest';
import { closeButton } from '@renderer/mount';
import { render } from '@renderer/render';
import { treeFixture } from './support/journey';

describe('visitor control icons', () => {
  it('draws the close control independently of font metrics and keeps its accessible action', () => {
    const dismiss = vi.fn();
    const button = closeButton(dismiss);
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.querySelector('svg')).toHaveAttribute('focusable', 'false');
    expect(button).toHaveAttribute('aria-label', 'Close');
    expect(button).toHaveAttribute('type', 'button');
    // Clicking the drawing must reach the same dismissal handler.
    button.querySelector('path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('anchors the select indicator to the input, without replacing the native labelled control', () => {
    const root = render(treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'interest', label: 'When could you come?', required: true,
        options: [{ label: 'Weekdays', value: 'weekdays' }] },
    ] }] }), {});
    const select = root.querySelector('select')!;
    const control = select.parentElement!;
    expect(control).not.toHaveClass('wc-field');
    expect(control.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(select.labels?.[0].textContent).toBe('When could you come? *');
    expect(select.checkValidity()).toBe(false);
    select.value = 'weekdays';
    expect(select.checkValidity()).toBe(true);
    expect(new FormData(root as HTMLFormElement).get('interest')).toBe('weekdays');
  });
});
