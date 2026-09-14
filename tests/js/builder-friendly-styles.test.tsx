import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TokenField } from '../../resources/admin/src/builder/Tokens';
import { nodeAt } from '../../resources/admin/src/builder/structure/tree';
import { ScopeStyle } from '../../resources/admin/src/builder/ScopeStyle';
import { gradientOf } from '../../resources/admin/src/builder/gradient';
import { spacingSides } from '../../resources/admin/src/builder/SpacingField';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';
import type { Template } from '@renderer/types';

const labels = { tokens: { pad: 'Padding', bg: 'Background' }, layouts: {}, tokenValues: {}, roles: {}, layoutNotes: {}, layoutParams: {}, layoutParamValues: {}, tokenGroups: {}, fields: {}, placeholders: {}, nodes: {}, params: {}, paramValues: {}, nodeNotes: {}, captures: {}, nodeParams: {}, nodeParamValues: {}, keys: {} } as TemplateLabels;
function Control({ initial, token, changed }: { initial: string; token: string; changed: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  return <TokenField label="Setting" token={token} labels={labels} value={value} fallback={initial} standard="1rem"
    design={initial} open={open} onOpenChange={setOpen} onChange={next => { setValue(next); changed(next); }} />;
}

describe('padding and gradients preserve authored values until an explicit edit', () => {
  it('expands all CSS shorthand forms and leaves expressions custom', () => {
    expect(spacingSides('1rem 2px 3rem')).toEqual(['1rem', '2px', '3rem', '2px']);
    expect(spacingSides('1rem 2px 3rem 4px')).toEqual(['1rem', '2px', '3rem', '4px']);
    expect(spacingSides('clamp(1rem, 3vw, 2rem)')).toBeNull();
    expect(spacingSides('-1rem')).toBeNull();
  });

  it('unlinks without writing, edits one side, and links with one explicit change', async () => {
    const changed = vi.fn();
    render(<Control initial="1rem" token="pad" changed={changed} />);
    await userEvent.click(screen.getByRole('button', { name: 'All sides together' }));
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

it('lists local mobile overrides and resets only the selected element’s narrow bag', async () => {
  const original: Template = { tokens: {}, tree: { steps: [{ type: 'stack', children: [{ type: 'panel', tokens: { pad: '2rem' }, narrow: { pad: '1rem' }, children: [] }] }] } };
  const changed = vi.fn();
  function Editor() {
    const [template, setTemplate] = useState(original);
    return <ScopeStyle template={template} labels={labels} path={[0, 'children', 0]} width="narrow" copied={null} onCopy={vi.fn()}
      openToken={null} onOpenToken={vi.fn()} onSelect={vi.fn()} onChange={next => { changed(next); setTemplate(next); }} />;
  }
  render(<Editor />);
  expect(screen.getByText('Mobile settings: Padding')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reset this element’s mobile overrides' }));
  const result = changed.mock.calls[0][0] as Template;
  expect(nodeAt(result.tree, [0, 'children', 0])).toMatchObject({ tokens: { pad: '2rem' } });
  expect(nodeAt(result.tree, [0, 'children', 0])).not.toHaveProperty('narrow');
  expect(screen.getByText('No mobile overrides on this element. It follows the surrounding design.')).toBeInTheDocument();
});
