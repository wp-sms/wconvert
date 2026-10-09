import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotFields } from '../../resources/admin/src/builder/SlotFields';
import { slotsOf } from '../../resources/admin/src/builder/panel';
import type { TemplateLabels } from '../../resources/admin/src/templates/api';
import type { Template } from '@renderer/types';
import { treeFixture } from './support/journey';

const labels = {
  keys: { label: 'Button text', href: 'Where the button goes', text: 'Text', link: 'Link' },
  nodeParams: { 'button.action': 'Button action' }, nodeParamValues: {}, roles: {}, fields: {}, nodes: {},
} as unknown as TemplateLabels;

const slotFor = (node: Record<string, unknown>) => {
  const template = { tree: treeFixture({ steps: [{ type: 'stack', children: [node] }] }), tokens: {} } as unknown as Template;
  return slotsOf(template.tree)[0];
};

const draw = (node: Record<string, unknown>) => render(<SlotFields slot={slotFor(node)} labels={labels}
  onValue={vi.fn()} onSentence={vi.fn()} onParam={vi.fn()} onHidden={vi.fn()} />);

describe('a button’s controls', () => {
  /** The ⇄ menu is the one way to change what a button does; it refuses the flips that break a design. */
  it('never draws the button’s action as a setting', () => {
    draw({ type: 'button', role: 'cta_label', label: 'Go', action: 'link', href: 'https://example.test/' });
    expect(screen.queryByText('Button action')).toBeNull();
  });

  it('asks where a link button goes', () => {
    draw({ type: 'button', role: 'cta_label', label: 'Go', action: 'link', href: '' });
    expect(screen.getByText('Where the button goes')).toBeVisible();
  });

  it.each([
    ['submit', 'Sends the form and saves the visitor’s details.'],
    ['skip', 'Skips this form without saving anything and moves on.'],
    ['next', 'Goes to the next screen.'],
  ])('says what a %s button does instead of asking for an address it ignores', (action, said) => {
    draw({ type: 'button', role: 'cta_label', label: 'Go', action });
    expect(screen.queryByText('Where the button goes')).toBeNull();
    expect(screen.getByText(said)).toBeVisible();
  });
});

describe('an empty link’s address', () => {
  it('means the privacy policy in fine print', async () => {
    draw({ type: 'text', role: 'fine_print', text: 'See our %s.', link: { label: 'policy' } });
    await userEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByText('Leave empty to use your site’s privacy policy.')).toBeVisible();
  });

  /** Anywhere else it is unfinished, and the review asks for one (ADR 0133). */
  it('promises nothing in body text', async () => {
    draw({ type: 'text', role: 'body', text: 'Read %s.', link: { label: 'the guide' } });
    await userEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByRole('combobox', { name: 'Link address' })).toBeVisible();
    expect(screen.queryByText(/privacy policy/i)).toBeNull();
  });
});
