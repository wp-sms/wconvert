import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FactList, FactRow, FieldHeading, PanelField, PanelHeader, PanelSection } from '../../resources/admin/src/builder/PanelSection';

/** The one panel grammar every editor panel is written in (ADR 0136). */
describe('the panel grammar', () => {
  it('heads a panel with one title, one caption and its actions, and names its way back', async () => {
    const back = vi.fn();
    render(<PanelHeader back={{ label: 'Details', onClick: back }} icon={<svg />} title={<h4>Headline</h4>} caption="In Image box"
      actions={<button type="button">Hide</button>} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Headline' })).toBeInTheDocument();
    expect(screen.getByText('In Image box')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Details' }));
    expect(back).toHaveBeenCalledOnce();
  });

  it('makes a titled section a region named by its level-4 title, with its tip and action in the title row', async () => {
    render(<PanelSection title="Results" tip="Visitors see the first result that matches." action={<button type="button">Add result</button>}><p>Body</p></PanelSection>);
    const region = screen.getByRole('region', { name: 'Results' });
    expect(within(region).getByRole('heading', { level: 4, name: 'Results' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Add result' })).toBeInTheDocument();
    expect(screen.queryByText('Visitors see the first result that matches.')).toBeNull();
    await userEvent.click(within(region).getByRole('button', { name: 'About Results' }));
    expect(screen.getByText('Visitors see the first result that matches.')).toBeVisible();
  });

  it('draws an untitled section without a heading, and names it only when asked', () => {
    const { container } = render(<><PanelSection><p>Plain</p></PanelSection><PanelSection label="About this screen"><p>Facts</p></PanelSection></>);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('group', { name: 'About this screen' })).toBeInTheDocument();
    expect(container.querySelectorAll('.wconvert-panel-section')).toHaveLength(2);
  });

  it('states a fact as label, value and the way to where it is changed, and labels a value that is a control', async () => {
    const rules = vi.fn();
    render(<FactList>
      <FactRow label="When it opens" action="Display rules" onAction={rules}>Everyone · After 8 seconds</FactRow>
      <FactRow label="Then" htmlFor="then"><select id="then"><option>Received</option></select></FactRow>
    </FactList>);
    expect(screen.getByText('Everyone · After 8 seconds')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Then' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Display rules' }));
    expect(rules).toHaveBeenCalledOnce();
  });

  it('labels a field above its control, with its tip, actions and one hint', () => {
    render(<PanelField label="Example inside the field" htmlFor="ex" tip="Disappears when visitors type." hint="One line." actions={<button type="button">Reset</button>}>
      <input id="ex" />
    </PanelField>);
    expect(screen.getByRole('textbox', { name: 'Example inside the field' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Example inside the field' })).toBeInTheDocument();
    expect(screen.getByText('One line.')).toHaveClass('wconvert-panel-hint');
  });

  it('names a group with a span heading when the label is not one control’s', () => {
    render(<><FieldHeading as="span" label="Choices" labelId="c" /><div role="group" aria-labelledby="c" /></>);
    expect(screen.getByRole('group', { name: 'Choices' })).toBeInTheDocument();
  });
});
