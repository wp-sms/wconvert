import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MediaControl } from '../../resources/admin/src/builder/SlotFields';
import { CHOICES } from '../../resources/admin/src/builder/panel';
import { TokenField } from '../../resources/admin/src/builder/Tokens';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';

const labels = { tokenValues: {} } as TemplateLabels;
function Control({ initial = '28rem', token = 'width', fallback = '28rem', changed = vi.fn() }: {
  initial?: string; token?: string; fallback?: string; changed?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  return <><TokenField token={token} label="Setting" labels={labels} value={value} fallback={fallback}
    standard={fallback} design={fallback} open={open} onOpenChange={setOpen}
    onChange={(next) => { setValue(next); changed(next); }} />
    <output data-testid="stored">{value}</output>
    <button onClick={() => setValue(fallback)}>External reset</button></>;
}
const amount = (name = 'Setting amount') => screen.getByRole('spinbutton', { name });
const unit = (name = 'Setting unit') => screen.getByRole('combobox', { name });

describe('appearance values without CSS syntax for ordinary edits', () => {
  it('shows inherited amount and unit without storing an override', async () => {
    const changed = vi.fn();
    render(<Control initial="" changed={changed} />);
    expect(amount()).toHaveValue(28);
    expect(unit()).toHaveValue('rem');
    expect(screen.queryByRole('option', { name: 'Custom…' })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByTestId('stored')).toHaveTextContent('');
  });

  it('lets a number be cleared and retyped before applying it', async () => {
    const changed = vi.fn();
    render(<Control changed={changed} />);
    await userEvent.clear(amount());
    expect(changed).not.toHaveBeenCalled();
    await userEvent.type(amount(), '32');
    expect(amount()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('32rem');
    expect(amount()).toHaveFocus();
    await userEvent.tab();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('slider', { name: 'Setting' })).toHaveValue('32');
  });

  it('changes a unit explicitly without converting the number', async () => {
    const changed = vi.fn();
    render(<Control changed={changed} />);
    await userEvent.selectOptions(unit(), 'px');
    expect(changed).toHaveBeenCalledExactlyOnceWith('28px');
    expect(amount()).toHaveValue(28);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('keeps the other spacing component verbatim when changing one amount', async () => {
    const changed = vi.fn();
    render(<Control initial=".75rem 20px" fallback=".75rem 20px" changed={changed} />);
    const sides = amount('Setting, sides amount');
    await userEvent.clear(sides);
    await userEvent.type(sides, '25');
    await userEvent.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('.75rem 25px');
  });

  it('keeps explicit zero distinct from deleting an override', async () => {
    const changed = vi.fn();
    render(<Control changed={changed} />);
    await userEvent.clear(amount());
    await userEvent.type(amount(), '0{Enter}');
    expect(changed).toHaveBeenLastCalledWith('0rem');
    await userEvent.click(screen.getByRole('button', { name: 'Put Setting back to the design’s own' }));
    expect(changed).toHaveBeenLastCalledWith('28rem');
    expect(amount()).toHaveValue(28);
  });

  it('restores a blank numeric edit without silently deleting the style', async () => {
    const changed = vi.fn();
    render(<Control changed={changed} />);
    await userEvent.clear(amount());
    await userEvent.keyboard('{Enter}');
    expect(amount()).toHaveValue(28);
    expect(changed).not.toHaveBeenCalled();
  });

  it('keeps CSS expression typing focused and stores its exact text on completion', async () => {
    const changed = vi.fn();
    render(<Control initial="var(--size)" changed={changed} />);
    const input = screen.getByLabelText('Setting');
    await userEvent.clear(input);
    await userEvent.type(input, 'clamp(20rem, 50vw, 30rem)');
    expect(input).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('clamp(20rem, 50vw, 30rem)');
    expect(screen.getByLabelText('Setting')).toHaveValue('clamp(20rem, 50vw, 30rem)');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('cancels only uncommitted CSS with Escape', async () => {
    const changed = vi.fn();
    render(<Control initial="var(--size)" changed={changed} />);
    const input = screen.getByLabelText('Setting');
    await userEvent.clear(input);
    await userEvent.type(input, 'calc(');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('var(--size)');
    expect(input).toHaveFocus();
    fireEvent.blur(input);
    expect(changed).not.toHaveBeenCalled();
  });

  it('allows custom color syntax instead of filtering it into a hex value', async () => {
    const changed = vi.fn();
    render(<Control token="bg" initial="#123456" fallback="#ffffff" changed={changed} />);
    await userEvent.click(screen.getByRole('button', { name: /Choose a color/ }));
    const input = screen.getByLabelText('Setting value');
    await userEvent.clear(input);
    await userEvent.type(input, 'var(--brand, #abc)');
    expect(input).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('var(--brand, #abc)');
    expect(screen.getByLabelText('Setting')).toHaveValue('var(--brand, #abc)');
    expect(screen.queryByRole('button', { name: /Choose a color/ })).not.toBeInTheDocument();
  });

  it('keeps Escape local to the color text without closing the picker', async () => {
    const changed = vi.fn();
    render(<Control token="bg" initial="#123456" fallback="#ffffff" changed={changed} />);
    await userEvent.click(screen.getByRole('button', { name: /Choose a color/ }));
    const input = screen.getByLabelText('Setting value');
    await userEvent.clear(input);
    await userEvent.type(input, '#');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('#123456');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: /Choose a color/ })).toHaveAttribute('aria-expanded', 'true');
    expect(changed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Choose a color/ })).toHaveAttribute('aria-expanded', 'false');
  });
});


describe('staying in the field while editing', () => {
  it('keeps custom choice text mounted when typing through a preset value', async () => {
    const changed = vi.fn();
    render(<Control token="leading" initial="1.55" fallback="1.5" changed={changed} />);
    const input = screen.getByRole('textbox', { name: 'Setting value' });
    await userEvent.clear(input);
    await userEvent.type(input, '1.7');
    expect(input).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('1.7');
    expect(changed).toHaveBeenCalledExactlyOnceWith('1.7');
    await userEvent.type(input, '5');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('1.7');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('commits a pending amount before changing its unit', async () => {
    const changed = vi.fn();
    render(<Control changed={changed} />);
    await userEvent.clear(amount());
    await userEvent.type(amount(), '32');
    await userEvent.selectOptions(unit(), 'px');
    expect(changed).toHaveBeenLastCalledWith('32px');
    expect(unit()).toHaveFocus();
    expect(amount()).toHaveValue(32);
  });

  it('does not expose CSS for a named layered shadow until explicitly opened', async () => {
    const changed = vi.fn();
    const layered = CHOICES.shadow.find(value => value.includes('),'))!;
    render(<Control token="shadow" initial={layered} fallback="none" changed={changed} />);
    expect(screen.queryByRole('textbox', { name: 'Setting value' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit shadow CSS' }));
    expect(screen.getByRole('textbox', { name: 'Setting value' })).toHaveValue(layered);
    expect(changed).not.toHaveBeenCalled();
  });

  it('keeps the picture while a replacement address is being typed, then commits once', async () => {
    const changed = vi.fn();
    function Picture() {
      const [value, setValue] = useState('/old.jpg');
      return <label htmlFor="test-picture-address">Picture address<MediaControl id="test-picture-address" label="Picture address" value={value}
        onChange={next => { setValue(next); changed(next); }} /></label>;
    }
    render(<Picture />);
    const address = screen.getByRole('textbox', { name: 'Picture address' });
    await userEvent.clear(address);
    await userEvent.type(address, '/new.jpg');
    expect(document.querySelector('img')).toHaveAttribute('src', '/old.jpg');
    expect(changed).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(address).toHaveFocus();
    expect(changed).toHaveBeenCalledExactlyOnceWith('/new.jpg');
    expect(document.querySelector('img')).toHaveAttribute('src', '/new.jpg');
    await userEvent.tab();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
