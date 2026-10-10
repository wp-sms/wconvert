import { treeFixture } from './support/journey';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TokenField } from '../../resources/admin/src/builder/Tokens';
import { ParamChoice } from '../../resources/admin/src/builder/ParamChoice';
import { nodeAt } from '../../resources/admin/src/builder/structure/tree';
import { ScopeStyle } from '../../resources/admin/src/builder/ScopeStyle';
import { gradientOf } from '../../resources/admin/src/builder/gradient';
import { AdvancedContext } from '../../resources/admin/src/builder/advanced';
import { spacingSides } from '../../resources/admin/src/builder/SpacingField';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';
import type { Template } from '@renderer/types';

const labels = { tokens: { pad: 'Padding', bg: 'Background' }, layouts: {}, tokenValues: {}, roles: {}, layoutNotes: {}, layoutParams: {}, layoutParamValues: {}, tokenGroups: {}, fields: {}, placeholders: {}, nodes: {}, params: {}, paramValues: {}, nodeNotes: {}, captures: {}, nodeParams: {}, nodeParamValues: {}, keys: {} } as TemplateLabels;
function Control({ initial, token, changed, inherited = false }: { initial: string; token: string; changed: (value: string) => void; inherited?: boolean }) {
  const [value, setValue] = useState(inherited ? '' : initial);
  const [open, setOpen] = useState(false);
  // The exact controls are Advanced's (ADR 0135).
  return <AdvancedContext.Provider value><TokenField label="Setting" token={token} labels={labels} value={value} fallback={initial} standard="1rem"
    design={initial} open={open} onOpenChange={setOpen} onChange={next => { setValue(next); changed(next); }} /></AdvancedContext.Provider>;
}

describe('padding and gradients preserve authored values until an explicit edit', () => {
  it('preserves an unlisted height in a select until a preset is explicitly chosen', async () => {
    const changed = vi.fn();
    render(<ParamChoice id="height" label="Minimum height" offered={['0', '10rem', '16rem']}
      held="22rem" fallback="0" nameOfValue={value => value} onChange={changed} />);
    const height = screen.getByRole('combobox', { name: 'Minimum height' });
    expect(within(height).getByRole('option', { name: 'Current: 22rem' })).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.selectOptions(height, '0');
    expect(changed).toHaveBeenCalledExactlyOnceWith(0);
  });
  it.each([
    ['heading-weight', '600', 'heading-weight.700', '700'],
    ['tracking', 'normal', 'tracking.0.04em', '0.04em'],
    ['leading', '1.5', 'leading.1.7', '1.7'],
    ['align', 'start', 'align.center', 'center'],
  ])('keeps inherited %s intact when opening Custom, then applies a preset', async (token, initial, choice, expected) => {
    const changed = vi.fn();
    render(<Control initial={initial} token={token} changed={changed} inherited />);
    expect(changed).not.toHaveBeenCalled();
    if (token === 'align') {
      await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
      expect(changed).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('radio', { name: choice }));
    } else {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Setting' }), '__custom');
      expect(changed).not.toHaveBeenCalled();
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Setting' }), expected);
    }
    expect(changed).toHaveBeenCalledExactlyOnceWith(expected);
    expect(screen.queryByRole('textbox', { name: 'Setting value' })).not.toBeInTheDocument();
  });

  it('groups picture and heading settings and omits unused effects without changing the draft', () => {
    const template: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'media', tokens: { 'bg-image': 'url(photo.jpg)' }, children: [{ type: 'heading', text: 'Hello' }] }] }) };
    const changed = vi.fn();
    render(<AdvancedContext.Provider value><ScopeStyle template={template} labels={labels} path={[0]} width="tokens" copied={null} onCopy={vi.fn()}
      openToken={null} onOpenToken={vi.fn()} onSelect={vi.fn()} onChange={changed} /></AdvancedContext.Provider>);
    expect(within(screen.getByRole('region', { name: 'Picture' })).getByRole('group', { name: 'image-position' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Headings' })).getByRole('combobox', { name: 'heading-weight' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Effects' })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
  it('opens inherited picture focus without creating an override, then commits one coordinate', async () => {
    const changed = vi.fn();
    render(<Control initial="right top" token="image-position" changed={changed} inherited />);
    await userEvent.click(screen.getByRole('button', { name: 'Adjust precisely…' }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton', { name: 'Horizontal %' })).toHaveValue(100);
    const vertical = screen.getByRole('spinbutton', { name: 'Vertical %' });
    await userEvent.clear(vertical);
    expect(changed).not.toHaveBeenCalled();
    await userEvent.type(vertical, '20{Enter}');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenLastCalledWith('100% 20%');
  });

  it('preserves authored CSS focus and permits switching back to a preset', async () => {
    const changed = vi.fn();
    render(<Control initial="right 10px bottom 20px" token="image-position" changed={changed} />);
    expect(screen.getByRole('textbox', { name: 'Setting value' })).toHaveValue('right 10px bottom 20px');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'image-position.center' }));
    expect(changed).toHaveBeenLastCalledWith('center');
    expect(screen.queryByRole('textbox', { name: 'Setting value' })).not.toBeInTheDocument();
  });

  it('recognizes equivalent percentage focus without normalizing it and cancels unfinished input', async () => {
    const changed = vi.fn();
    render(<Control initial="0% 100%" token="image-position" changed={changed} />);
    expect(screen.getByRole('radio', { name: 'image-position.left bottom' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Adjust precisely…' }));
    const horizontal = screen.getByRole('spinbutton', { name: 'Horizontal %' });
    await userEvent.clear(horizontal);
    await userEvent.type(horizontal, '40{Escape}');
    expect(horizontal).toHaveValue(0);
    await userEvent.tab();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.clear(horizontal);
    await userEvent.type(horizontal, '120{Enter}');
    expect(horizontal).toHaveValue(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it('expands all CSS shorthand forms and leaves expressions custom', () => {
    expect(spacingSides('1rem 2px 3rem')).toEqual(['1rem', '2px', '3rem', '2px']);
    expect(spacingSides('1rem 2px 3rem 4px')).toEqual(['1rem', '2px', '3rem', '4px']);
    expect(spacingSides('clamp(1rem, 3vw, 2rem)')).toBeNull();
    expect(spacingSides('-1rem')).toBeNull();
  });

  it('unlinks without writing, edits one side, and links with one explicit change', async () => {
    const changed = vi.fn();
    render(<Control initial="1rem" token="pad" changed={changed} />);
    // One name for the toggle, pressed while the sides are linked (ADR 0136).
    expect(screen.getByRole('button', { name: 'Link all sides' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Link all sides' }));
    expect(screen.getByRole('button', { name: 'Link all sides' })).toHaveAttribute('aria-pressed', 'false');
    expect(changed).not.toHaveBeenCalled();
    const right = screen.getByRole('spinbutton', { name: 'Setting, Right amount' });
    await userEvent.clear(right);
    await userEvent.type(right, '2{Enter}');
    expect(changed).toHaveBeenLastCalledWith('1rem 2rem 1rem 1rem');
    await userEvent.click(screen.getByRole('button', { name: 'Link all sides' }));
    expect(changed).toHaveBeenLastCalledWith('1rem');
  });

  it('keeps a complex spacing value intact when opening its controls', () => {
    const changed = vi.fn();
    render(<Control initial="clamp(1rem, 3vw, 2rem)" token="pad" changed={changed} />);
    expect(screen.getByLabelText('Setting custom value')).toHaveValue('clamp(1rem, 3vw, 2rem)');
    expect(screen.queryByRole('button', { name: 'Custom CSS' })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it('parses linear gradients without splitting color channels or guessing mixed stops', () => {
    expect(gradientOf('linear-gradient(to right, rgba(0, 0, 0, 0), #ffffff)')).toEqual({ angle: 90, stops: [{ color: 'rgba(0, 0, 0, 0)', at: 0 }, { color: '#ffffff', at: 100 }] });
    expect(gradientOf('linear-gradient(red 20%, blue, green 80%)')).toBeNull();
    expect(gradientOf('radial-gradient(circle, red, blue)')).toBeNull();
    expect(gradientOf('linear-gradient(red, blue), url("/picture.jpg")')).toBeNull();
  });

  it('opens without rewriting a gradient, then changes its direction and adds a stop', async () => {
    const changed = vi.fn();
    render(<Control initial="linear-gradient(to right, #000, #fff)" token="overlay" changed={changed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit gradient' }));
    expect(changed).not.toHaveBeenCalled();
    const direction = screen.getByLabelText('Direction (degrees)');
    await userEvent.clear(direction);
    await userEvent.type(direction, '180{Enter}');
    expect(changed).toHaveBeenLastCalledWith('linear-gradient(180deg, #000 0%, #fff 100%)');
    await userEvent.click(screen.getByRole('button', { name: 'Add color' }));
    expect(changed).toHaveBeenLastCalledWith('linear-gradient(180deg, #000 0%, #000 50%, #fff 100%)');
  });

  it('keeps unsupported gradients in the custom editor', async () => {
    const changed = vi.fn();
    render(<Control initial="radial-gradient(circle, red, blue)" token="overlay" changed={changed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit gradient' }));
    expect(screen.getByLabelText('Setting CSS')).toHaveValue('radial-gradient(circle, red, blue)');
    expect(screen.queryByLabelText('Direction (degrees)')).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});

it.each([
  [{ pad: '1rem' }, {}, '1rem', false],
  [{}, { pad: '1rem' }, '1rem', false],
  [{ pad: '2rem' }, {}, '1rem', true],
])('marks mobile padding only when its effective value differs (%j, %j, %s)', (local, inherited, mobile, different) => {
  const template: Template = { tokens: inherited, tree: treeFixture({ steps: [{ type: 'panel', tokens: local, narrow: { pad: mobile }, children: [] }] }) };
  render(<AdvancedContext.Provider value><ScopeStyle template={template} labels={labels} path={[0]} width="tokens" copied={null} onCopy={vi.fn()}
    openToken={null} onOpenToken={vi.fn()} onSelect={vi.fn()} onChange={vi.fn()} /></AdvancedContext.Provider>);
  expect(screen.queryByText('Different on mobile') !== null).toBe(different);
  // The device row counts what differs on mobile and names it on hover (ADR 0136).
  expect(screen.getByText('1 mobile change')).toHaveAttribute('title', 'Padding');
});

it('lists local mobile overrides and resets only the selected element’s narrow bag', async () => {
  const original: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'panel', tokens: { pad: '2rem' }, narrow: { pad: '1rem' }, children: [] }] }] }) };
  const changed = vi.fn();
  function Editor() {
    const [template, setTemplate] = useState(original);
    return <ScopeStyle template={template} labels={labels} path={[0, 'children', 0]} width="narrow" copied={null} onCopy={vi.fn()}
      openToken={null} onOpenToken={vi.fn()} onSelect={vi.fn()} onChange={next => { changed(next); setTemplate(next); }} />;
  }
  render(<Editor />);
  expect(screen.getByRole('status')).toHaveTextContent('MobileFollows desktop unless changed');
  await userEvent.click(screen.getByRole('button', { name: 'Reset on mobile' }));
  const result = changed.mock.calls[0][0] as Template;
  expect(nodeAt(result.tree, [0, 'children', 0])).toMatchObject({ tokens: { pad: '2rem' } });
  expect(nodeAt(result.tree, [0, 'children', 0])).not.toHaveProperty('narrow');
  expect(screen.getByRole('button', { name: 'Reset on mobile' })).toBeDisabled();
});

/** ADR 0135: the plain view is presets, swatches and words; Advanced holds the exact values. */
describe('the plain style view', () => {
  it('resets this element on desktop, and offers nothing to reset when it sets nothing', async () => {
    const original: Template = { tokens: {}, tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'panel', tokens: { pad: '2rem' }, narrow: { pad: '1rem' }, children: [] }] }] }) };
    function Editor() {
      const [template, setTemplate] = useState(original);
      return <ScopeStyle template={template} labels={labels} path={[0, 'children', 0]} width="tokens" copied={null} onCopy={vi.fn()}
        openToken={null} onOpenToken={vi.fn()} onSelect={vi.fn()} onChange={setTemplate} />;
    }
    render(<Editor />);
    const reset = screen.getByRole('button', { name: 'Reset' });
    await userEvent.click(reset);
    expect(reset).toBeDisabled();
    expect(screen.getByText('1 mobile change')).toHaveAttribute('title', 'Padding');
  });

  it('names a color on its swatch and keeps the hex for Advanced', async () => {
    function Swatch({ advanced }: { advanced: boolean }) {
      const [open, setOpen] = useState(false);
      return <AdvancedContext.Provider value={advanced}><TokenField label="Background" token="bg" labels={labels} value="#2f4f37" fallback="#ffffff" standard="#ffffff"
        design="#ffffff" open={open} onOpenChange={setOpen} onChange={vi.fn()} /></AdvancedContext.Provider>;
    }
    const { unmount } = render(<Swatch advanced={false} />);
    expect(screen.getByRole('button', { name: /Choose a color for Background/ })).toHaveTextContent('Forest');
    await userEvent.click(screen.getByRole('button', { name: /Choose a color for Background/ }));
    expect(screen.queryByLabelText('Background value')).toBeNull();
    unmount();
    render(<Swatch advanced />);
    expect(screen.getByRole('button', { name: /Choose a color for Background/ })).toHaveTextContent('#2f4f37');
  });

  it('offers type sizes in the words an element’s Size uses', () => {
    render(<TokenField simple label="Heading size" token="heading-size" labels={labels} value="" fallback="2rem" standard="2rem"
      design="2rem" open={false} onOpenChange={vi.fn()} onChange={vi.fn()} />);
    expect(within(screen.getByRole('combobox', { name: 'Heading size' })).getAllByRole('option').map(option => option.textContent))
      .toEqual(['Small', 'Medium', 'Large', 'Extra large']);
  });
});
